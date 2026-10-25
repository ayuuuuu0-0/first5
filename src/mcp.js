import { spawn } from 'node:child_process';

/**
 * Lightweight JSON-RPC 2.0 client to call tools on local MCP servers
 * Compatible with any standard Model Context Protocol stdio server.
 */
export async function callMcpTool(serverCommand, serverArgs, toolName, toolArguments = {}) {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const proc = spawn(serverCommand, serverArgs, {
      shell: process.platform === 'win32',
      stdio: ['pipe', 'pipe', 'ignore']
    });

    let buffer = '';

    proc.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep remainder

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.id === 2) {
            resolved = true;
            proc.kill();
            resolve(json.result);
            return;
          }
        } catch {
          // Ignore partial or non-json output
        }
      }
    });

    proc.on('error', (err) => {
      if (!resolved) reject(err);
    });

    // 1. Initialize MCP Handshake
    const initPayload = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'first5-cli', version: '1.0.0' }
      }
    });

    // 2. Call Tool
    const callPayload = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: toolArguments
      }
    });

    proc.stdin.write(initPayload + '\n');
    proc.stdin.write(callPayload + '\n');

    // Timeout safety
    setTimeout(() => {
      if (!resolved) {
        proc.kill();
        resolve({ error: 'MCP call timed out' });
      }
    }, 8000);
  });
}
