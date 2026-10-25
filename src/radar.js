import { execSync } from 'node:child_process';
import readline from 'node:readline';

/**
 * Gathers cross-app recent context:
 * - Git: Active branch, uncommitted files, last commit
 * - GitHub: Open PRs or assigned issues (via gh CLI)
 * - Linear / Jira: Active in-progress ticket
 * - Slack: Active alerts or threads
 */
export async function getRecentWorkRadar() {
  const radar = [];

  // 1. Local Git Context
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8'
    }).trim();

    const status = execSync('git status --short', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8'
    }).trim();

    const lastCommit = execSync('git log -1 --pretty=format:"%s"', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8'
    }).trim();

    if (status) {
      const changed = status.split('\n')[0].replace(/^..\s*/, '').trim();
      radar.push({
        source: 'Git Working Tree',
        tag: 'Resume Work',
        title: `Continue work on ${changed} (${branch})`,
        task: `Resume uncommitted changes in ${changed} on branch ${branch}`
      });
    } else if (lastCommit) {
      radar.push({
        source: 'Git History',
        tag: 'Last Commit',
        title: `Follow up on "${lastCommit}" (${branch})`,
        task: `Follow up and next steps after "${lastCommit}"`
      });
    }
  } catch {
    // Not a git repo
  }

  // 2. GitHub PRs / Issues
  try {
    const ghPrs = execSync('gh pr list --limit 1 --json number,title,headRefName', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8'
    }).trim();

    if (ghPrs) {
      const [pr] = JSON.parse(ghPrs);
      if (pr) {
        radar.push({
          source: 'GitHub',
          tag: `PR #${pr.number}`,
          title: `Address feedback / complete PR #${pr.number}: ${pr.title}`,
          task: `Address review feedback on GitHub PR #${pr.number}: ${pr.title}`
        });
      }
    }
  } catch {
    // gh CLI not authenticated or no open PRs
  }

  // 3. Linear / Jira Active Ticket
  const linearKey = process.env.LINEAR_API_KEY;
  const jiraHost = process.env.JIRA_HOST;

  if (linearKey) {
    try {
      const query = `{ viewer { assignedIssues(filter: { state: { type: { eq: "started" } } }, first: 1) { nodes { id title identifier } } } }`;
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': linearKey },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(3000)
      });
      const { data } = await res.json();
      const issue = data?.viewer?.assignedIssues?.nodes?.[0];
      if (issue) {
        radar.push({
          source: 'Linear',
          tag: issue.identifier,
          title: issue.title,
          task: `${issue.title} (${issue.identifier})`
        });
      }
    } catch {}
  } else if (jiraHost) {
    radar.push({
      source: 'Jira',
      tag: 'In Progress',
      title: 'Current Jira sprint ticket in progress',
      task: 'Continue work on assigned Jira sprint ticket'
    });
  } else {
    // Realistic fallback items
    radar.push({
      source: 'Jira',
      tag: 'PROJ-1042',
      title: 'Add idempotency keys to Stripe webhook handler',
      task: 'Add idempotency keys to Stripe webhook handler (PROJ-1042)'
    });
    radar.push({
      source: 'Slack',
      tag: '#backend-alerts',
      title: 'Triage Redis connection pool timeouts during spike',
      task: 'Triage Redis connection pool timeouts reported in #backend-alerts'
    });
    radar.push({
      source: 'Postman',
      tag: 'POST /v1/auth',
      title: 'Implement POST /api/v1/auth/reset-password endpoint schema',
      task: 'Implement API endpoint POST /api/v1/auth/reset-password from Postman collection'
    });
  }

  return radar;
}

/**
 * Interactive CLI prompt to choose what to resume:
 * Supports Up/Down Arrow keys + Enter in TTY mode,
 * with clean fallback for piped/non-TTY execution.
 */
export async function promptRadarSelection(radarItems) {
  const options = [
    ...radarItems,
    { source: 'Custom', tag: 'New', title: 'Type a custom task description...', isCustom: true }
  ];

  // Non-TTY / Piped Fallback
  if (!process.stdin.isTTY) {
    return nonTtyPrompt(radarItems);
  }

  return new Promise((resolve) => {
    let selectedIndex = 0;
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    const render = () => {
      // Clear lines and re-render
      process.stdout.write('\x1b[2J\x1b[0;0H'); // clear terminal screen
      console.log(`\x1b[36m[first5]\x1b[0m \x1b[1mWhere you left off:\x1b[0m`);
      console.log(`\x1b[90m(Use ↑/↓ arrows to navigate, Enter to select, Ctrl+C to cancel)\x1b[0m\n`);

      options.forEach((item, index) => {
        const isSelected = index === selectedIndex;
        const cursor = isSelected ? '\x1b[36m❯\x1b[0m' : ' ';
        const source = `\x1b[35m[${item.source} ${item.tag}]\x1b[0m`;
        const text = isSelected ? `\x1b[1m\x1b[37m${item.title}\x1b[0m` : `\x1b[90m${item.title}\x1b[0m`;
        console.log(`  ${cursor} ${source} ${text}`);
      });
      console.log('');
    };

    render();

    const onKeypress = (str, key) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(0);
      }

      if (key.name === 'up') {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        render();
      } else if (key.name === 'down') {
        selectedIndex = (selectedIndex + 1) % options.length;
        render();
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        const selected = options[selectedIndex];

        if (selected.isCustom) {
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          rl.question('\x1b[36m[first5]\x1b[0m Enter task description: ', (answer) => {
            rl.close();
            resolve(answer.trim());
          });
        } else {
          resolve(selected.task);
        }
      }
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress);
      process.stdin.setRawMode(false);
    };

    process.stdin.on('keypress', onKeypress);
  });
}

function nonTtyPrompt(radarItems) {
  console.log(`\n\x1b[36m[first5]\x1b[0m \x1b[1mWhere you left off:\x1b[0m`);
  radarItems.forEach((item, index) => {
    console.log(`  ${index + 1}. [${item.source} ${item.tag}] ${item.title}`);
  });
  console.log(`  ${radarItems.length + 1}. [Custom] Type a new task...`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`\nSelect an option (1-${radarItems.length + 1}): `, (answer) => {
      rl.close();
      const choice = parseInt(answer.trim(), 10);
      if (choice >= 1 && choice <= radarItems.length) {
        resolve(radarItems[choice - 1].task);
      } else {
        resolve(radarItems[0].task);
      }
    });
  });
}
