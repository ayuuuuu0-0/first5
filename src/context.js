import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
  '.cache',
  'target',
  'venv',
  '.venv',
  '__pycache__'
]);

export function getRepoContext(cwd = process.cwd()) {
  const context = {
    root: cwd,
    stack: detectStack(cwd),
    tree: getDirectoryTree(cwd, 2),
    gitBranch: null,
    recentFiles: []
  };

  try {
    context.gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8'
    }).trim();

    const gitStatus = execSync('git status --short', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8'
    }).trim();

    if (gitStatus) {
      context.recentFiles = gitStatus
        .split('\n')
        .slice(0, 8)
        .map(line => line.trim());
    }
  } catch {
    // Not a git repo or git not found, safe to ignore
  }

  return context;
}

function detectStack(cwd) {
  const stack = [];

  if (fs.existsSync(path.join(cwd, 'package.json'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      stack.push('Node.js');
      if (deps.typescript) stack.push('TypeScript');
      if (deps.react) stack.push('React');
      if (deps.vue) stack.push('Vue');
      if (deps.express) stack.push('Express');
      if (deps.jest) stack.push('Jest');
      if (deps.vitest) stack.push('Vitest');
      if (deps.pytest) stack.push('Pytest');
      if (deps.tailwind) stack.push('TailwindCSS');
      if (deps.prisma) stack.push('Prisma');
    } catch {
      stack.push('Node.js');
    }
  }

  if (fs.existsSync(path.join(cwd, 'pyproject.toml')) || fs.existsSync(path.join(cwd, 'requirements.txt'))) {
    stack.push('Python');
  }

  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    stack.push('Go');
  }

  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
    stack.push('Rust');
  }

  return stack.length > 0 ? stack.join(', ') : 'Generic project';
}

function getDirectoryTree(dir, maxDepth, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];

  let items = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
      if (IGNORE_DIRS.has(entry.name)) continue;

      const relPath = path.relative(process.cwd(), path.join(dir, entry.name));
      if (entry.isDirectory()) {
        items.push(`${relPath}/`);
        if (currentDepth < maxDepth) {
          items.push(...getDirectoryTree(path.join(dir, entry.name), maxDepth, currentDepth + 1));
        }
      } else {
        items.push(relPath);
      }
    }
  } catch {
    // Ignore read errors
  }

  return items.slice(0, 40); // Keep token usage lean
}
