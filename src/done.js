import { execSync } from 'node:child_process';

/**
 * first5 done: Stages changes, drafts a conventional commit, and commits your work.
 */
export async function finishTask(customMessage = null) {
  try {
    const status = execSync('git status --short', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8'
    }).trim();

    if (!status) {
      console.log('\x1b[33m[first5]\x1b[0m Working tree is clean. Nothing to commit.');
      return;
    }

    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8'
    }).trim();

    // Stage changes
    execSync('git add .', { stdio: ['ignore', 'ignore', 'ignore'] });

    // Generate clean commit message
    const commitMsg = customMessage || deriveCommitMessage(branch, status);

    // Commit
    execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, {
      stdio: ['ignore', 'ignore', 'ignore']
    });

    console.log(`\n\x1b[32m✔ All changes staged & committed:\x1b[0m \x1b[1m"${commitMsg}"\x1b[0m`);
    console.log(`\x1b[36m[first5]\x1b[0m Task completed. Activation energy conquered.\n`);
  } catch (err) {
    console.error(`\x1b[31m[first5] Failed to commit:\x1b[0m ${err.message}`);
  }
}

function deriveCommitMessage(branch, status) {
  // If branch is feat/slug or feat/jira-1042-slug
  const branchMatch = branch.match(/^feat\/(.+)$/i);
  if (branchMatch) {
    const raw = branchMatch[1];
    // Check if starts with ticket ID like jira-1042 or eng-88
    const ticketMatch = raw.match(/^([a-z]+-[0-9]+)-(.*)$/i);
    if (ticketMatch) {
      const scope = ticketMatch[1].toUpperCase();
      const desc = ticketMatch[2].replace(/-/g, ' ');
      return `feat(${scope}): ${desc}`;
    }
    return `feat: ${raw.replace(/-/g, ' ')}`;
  }

  const firstFile = status.split('\n')[0].replace(/^..\s*/, '').trim();
  return `feat: progress on ${firstFile}`;
}
