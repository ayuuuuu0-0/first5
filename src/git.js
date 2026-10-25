import { execSync } from 'node:child_process';

export function createBranch(task, cwd = process.cwd()) {
  try {
    // Generate clean branch name: feat/short-task-slug
    const slug = task
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 32);

    const branchName = `feat/${slug}`;

    execSync(`git checkout -b ${branchName}`, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8'
    });

    return branchName;
  } catch (err) {
    // Return null if git fails (e.g. branch exists or not a repo)
    return null;
  }
}
