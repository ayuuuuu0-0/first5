#!/usr/bin/env node

import { getRepoContext } from '../src/context.js';
import { generateFirst5 } from '../src/llm.js';
import { writeScaffold, openInEditor } from '../src/editor.js';
import { createBranch } from '../src/git.js';
import { startFocusTimer } from '../src/timer.js';
import { fetchTaskFromProvider, detectProviderFromInput } from '../src/providers.js';
import { getRecentWorkRadar, promptRadarSelection } from '../src/radar.js';
import { finishTask } from '../src/done.js';
import { printShellHook } from '../src/hook.js';

async function main() {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes('-h') || rawArgs.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  // Subcommand: first5 done
  if (rawArgs[0] === 'done') {
    const customMessage = rawArgs.slice(1).join(' ').trim() || null;
    await finishTask(customMessage);
    process.exit(0);
  }

  // Subcommand: first5 hook
  if (rawArgs[0] === 'hook') {
    printShellHook();
    process.exit(0);
  }

  // Parse flags
  const flags = {
    mock: rawArgs.includes('--mock'),
    dryRun: rawArgs.includes('--dry-run'),
    noOpen: rawArgs.includes('--no-open'),
    branch: rawArgs.includes('-b') || rawArgs.includes('--branch'),
    timer: rawArgs.includes('-t') || rawArgs.includes('--timer'),
    preset: null,
    fromProvider: null,
    fromQuery: null
  };

  const presetIdx = rawArgs.findIndex(a => a === '-p' || a === '--preset');
  if (presetIdx !== -1 && rawArgs[presetIdx + 1]) {
    flags.preset = rawArgs[presetIdx + 1].toLowerCase();
  }

  const fromIdx = rawArgs.findIndex(a => a === '--from');
  if (fromIdx !== -1 && rawArgs[fromIdx + 1] && rawArgs[fromIdx + 2]) {
    flags.fromProvider = rawArgs[fromIdx + 1];
    flags.fromQuery = rawArgs[fromIdx + 2];
  }

  // Filter out flag args
  const taskWords = [];
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '-p' || arg === '--preset' || arg === '--from') {
      i += (arg === '--from' ? 2 : 1);
      continue;
    }
    if (arg.startsWith('-')) continue;
    taskWords.push(arg);
  }

  let task = taskWords.join(' ').trim();

  // 1. Zero-argument mode: Active Radar across connected MCPs & Git
  if (!task && !flags.fromProvider) {
    const radarItems = await getRecentWorkRadar();
    if (radarItems.length > 0) {
      task = await promptRadarSelection(radarItems);
    }
  }

  // 2. Check if user used --from <provider> <id>
  if (flags.fromProvider && flags.fromQuery) {
    console.log(`\x1b[36m[first5]\x1b[0m Pulling context from ${flags.fromProvider}: "${flags.fromQuery}"...`);
    const external = await fetchTaskFromProvider(flags.fromProvider, flags.fromQuery);
    task = external.task;
    console.log(`\x1b[32m✔\x1b[0m Retrieved: \x1b[1m${external.title}\x1b[0m`);
  } 
  // 3. Check if user typed a ticket key directly (e.g. JIRA-104 or ENG-88 or #42)
  else if (task) {
    const autoDetected = detectProviderFromInput(task);
    if (autoDetected) {
      console.log(`\x1b[36m[first5]\x1b[0m Auto-detected ${autoDetected.provider.toUpperCase()} ticket: ${autoDetected.id}...`);
      const external = await fetchTaskFromProvider(autoDetected.provider, autoDetected.id);
      task = external.task;
      console.log(`\x1b[32m✔\x1b[0m Retrieved: \x1b[1m${external.title}\x1b[0m`);
    }
  }

  if (!task) {
    console.error('\x1b[31m[first5] Error: No task selected.\x1b[0m');
    process.exit(1);
  }

  // Optional: Auto-create Git branch
  if (flags.branch) {
    const branch = createBranch(task, process.cwd());
    if (branch) {
      console.log(`\x1b[32m✔\x1b[0m Created and checked out git branch: \x1b[1m${branch}\x1b[0m`);
    } else {
      console.log(`\x1b[90m[first5] Git branch creation skipped (not in git repo or branch exists).\x1b[0m`);
    }
  }

  console.log(`\x1b[36m[first5]\x1b[0m Scanning repository context...`);
  const context = getRepoContext(process.cwd());
  console.log(`\x1b[36m[first5]\x1b[0m Detected stack: ${context.stack}`);

  console.log(`\x1b[36m[first5]\x1b[0m Scaffolding the first 5 minutes for: "${task}"...`);

  try {
    const result = await generateFirst5(task, context, {
      mock: flags.mock,
      preset: flags.preset
    });

    if (flags.dryRun) {
      console.log('\n--- DRY RUN OUTPUT ---');
      console.log(`Target: ${result.targetFile} (Cursor at line ${result.cursorLine})`);
      console.log(`Prompt: ${result.starterPrompt}`);
      console.log('\n' + result.content);
      return;
    }

    writeScaffold(result.targetFile, result.content, process.cwd());
    console.log(`\x1b[32m✔\x1b[0m Created: \x1b[1m${result.targetFile}\x1b[0m`);

    if (!flags.noOpen) {
      const opened = openInEditor(result.targetFile, result.cursorLine, process.cwd());
      if (opened) {
        console.log(`\x1b[32m✔\x1b[0m Opened in editor at line ${result.cursorLine}`);
      }
    }

    console.log(`\n\x1b[33m🎯 Next step:\x1b[0m ${result.starterPrompt}`);
    console.log(`\x1b[90mLine ${result.cursorLine} is waiting for you. Dread broken.\x1b[0m\n`);

    // Optional 5-Minute Focus Timer
    if (flags.timer) {
      await startFocusTimer(5);
    }
  } catch (err) {
    console.error(`\x1b[31m[first5] Error:\x1b[0m ${err.message}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
first5 - Bust developer task dread in one command.

Usage:
  first5                               # Launches Active Radar (shows where you left off)
  first5 "<task description>" [options]
  first5 <TICKET-ID> [options]
  first5 done [optional message]       # Stages changes and writes a clean conventional commit
  first5 hook                          # Print shell idle reminder hook

Zero-Effort Resume (Active Radar):
  Just type 'first5' with no arguments! It scans:
  - Local Git (uncommitted changes & recent commits)
  - Postman (recent API collections & requests)
  - Jira / Linear (your active in-progress tickets)
  - GitHub (your open PRs)
  - Slack (unresolved alerts/threads)
  And lets you navigate with ↑/↓ arrows and Enter.

Options:
  --from <app> <id>    Pull task context from work app (postman, jira, linear, github, slack)
  -b, --branch         Auto-create and checkout a clean git branch (e.g. feat/task-slug)
  -p, --preset <type>  Enforce task archetype: test, doc, component, api
  -t, --timer          Start a 5-minute focus countdown to build initial momentum
  --mock               Use local deterministic fallback without calling any LLM
  --dry-run            Preview output in terminal without creating files or opening editor
  --no-open            Create file without launching the editor
  -h, --help           Show this help message

Environment Variables:
  OLLAMA_HOST          Ollama URL (default: http://localhost:11434)
  OLLAMA_MODEL         Model name (default: qwen2.5-coder:7b)
  OPENAI_API_KEY       Optional fallback if Ollama is not local
  POSTMAN_API_KEY      Postman API Key (or use Postman MCP)
  LINEAR_API_KEY       Linear Personal API Key
  JIRA_HOST/EMAIL/TOKEN Jira Cloud credentials
  EDITOR               Editor command (default: code)
`);
}

main();
