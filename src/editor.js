import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function writeScaffold(filePath, content, cwd = process.cwd()) {
  const fullPath = path.resolve(cwd, filePath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // If file already exists, don't blindly overwrite if it has substantial content
  if (fs.existsSync(fullPath)) {
    const existing = fs.readFileSync(fullPath, 'utf-8');
    if (existing.trim().length > 0 && !existing.includes('first5')) {
      const backupPath = `${fullPath}.backup-${Date.now()}`;
      fs.copyFileSync(fullPath, backupPath);
    }
  }

  fs.writeFileSync(fullPath, content, 'utf-8');
  return fullPath;
}

export function openInEditor(filePath, line = 1, cwd = process.cwd()) {
  const fullPath = path.resolve(cwd, filePath);
  const editor = detectEditor();

  if (!editor) {
    return false;
  }

  try {
    let args = [];
    if (editor === 'code' || editor === 'code.cmd' || editor === 'cursor' || editor === 'cursor.cmd') {
      args = ['-g', `${fullPath}:${line}`];
    } else if (editor === 'nvim' || editor === 'vim') {
      args = [`+${line}`, fullPath];
    } else {
      args = [fullPath];
    }

    const child = spawn(editor, args, {
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32'
    });

    // Handle error event so unhandled 'error' (e.g. ENOENT if 'code' isn't in PATH) never crashes the process
    child.on('error', () => {
      if (process.platform === 'darwin') {
        try {
          const fallback = spawn('open', ['-a', 'Visual Studio Code', fullPath], {
            detached: true,
            stdio: 'ignore'
          });
          fallback.on('error', () => {});
          fallback.unref();
        } catch {}
      }
    });

    child.unref();
    return true;
  } catch {
    return false;
  }
}

function detectEditor() {
  if (process.env.EDITOR) return process.env.EDITOR;
  if (process.env.VISUAL) return process.env.VISUAL;

  return 'code';
}
