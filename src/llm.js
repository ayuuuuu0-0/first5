export async function generateFirst5(task, context, options = {}) {
  const model = process.env.OLLAMA_MODEL || options.model || 'qwen2.5-coder:7b';
  const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const preset = options.preset ? `\n- Enforce Task Archetype: ${options.preset}` : '';

  const systemPrompt = `You are a developer activation agent. Your ONLY job is to do the first 5 minutes of a development task to overcome task initiation dread.
Do NOT build the entire feature.
Instead:
1. Determine the exact target file path where work should start.
2. Generate the necessary boilerplate, standard imports, type signatures, or doc outline matching the repository's tech stack.
3. Stop at the point where the developer needs to write the core logic.
4. Leave a clean comment placeholder: "// TODO(first5): Finish this thought: <one sentence prompt>" (or language-appropriate comment syntax).
5. Identify the exact 1-indexed line number where the cursor should be placed for the user to finish that thought.

You MUST respond ONLY with valid JSON matching this schema:
{
  "targetFile": "path/to/file.ext",
  "content": "full content of the file",
  "cursorLine": 12,
  "starterPrompt": "Short sentence explaining what the user needs to write first"
}
Do not include markdown code block formatting (like \`\`\`json) outside the JSON output. Return pure JSON.`;

  const userPrompt = `TASK: "${task}"${preset}

REPOSITORY CONTEXT:
- Detected Stack: ${context.stack}
- Git Branch: ${context.gitBranch || 'N/A'}
- Recent Changed Files: ${context.recentFiles.join(', ') || 'None'}
- Directory Structure:
${context.tree.join('\n')}

Generate the first 5 minutes.`;

  // 1. Check if mock/dry-run requested or if Ollama is unreachable
  if (options.mock) {
    return generateMock(task, context, options.preset);
  }

  // 2. Try Ollama
  try {
    const res = await fetch(`${ollamaHost}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        stream: false,
        format: 'json'
      }),
      signal: AbortSignal.timeout(options.timeout || 30000)
    });

    if (res.ok) {
      const data = await res.json();
      return parseResponse(data.response);
    }
  } catch (err) {
    if (!options.silent) {
      console.warn(`[first5] Could not reach Ollama at ${ollamaHost}: ${err.message}`);
    }
  }

  // 3. Fallback: OpenAI-compatible API if OPENAI_API_KEY is defined
  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiBase = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const res = await fetch(`${openaiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: openaiModel,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        return parseResponse(data.choices[0].message.content);
      }
    } catch (err) {
      console.warn(`[first5] OpenAI fallback failed: ${err.message}`);
    }
  }

  console.log('[first5] No AI endpoint active. Running in local fallback mode (use --mock or start Ollama).');
  return generateMock(task, context, options.preset);
}

function parseResponse(raw) {
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse model response into JSON.');
  }
}

function generateMock(task, context, preset) {
  const isDoc = preset === 'doc' || /doc|readme|migration|guide|spec/i.test(task);
  const isTest = preset === 'test' || /test|spec|unit/i.test(task);
  const isComponent = preset === 'component' || /component|ui|button|modal/i.test(task);

  if (isDoc) {
    const filename = task.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'task';
    const filePath = `docs/${filename}.md`;
    const lines = [
      `# ${task.replace(/^\w/, c => c.toUpperCase())}`,
      '',
      '> Drafted by first5. Complete the primary objective below to unblock.',
      '',
      '## 1. Overview',
      'This document outlines the scope, architecture, and step-by-step rollout plan.',
      '',
      '## 2. Primary Objective',
      '<!-- TODO(first5): Finish this thought: The core reason for this change is... -->'
    ];
    return {
      targetFile: filePath,
      content: lines.join('\n'),
      cursorLine: 9,
      starterPrompt: 'Complete the primary objective sentence to kick off the doc.'
    };
  }

  if (isTest) {
    const filePath = 'tests/starter.test.js';
    const lines = [
      "import { describe, it, expect } from 'vitest';",
      '',
      `describe('${task}', () => {`,
      "  it('should handle the baseline case correctly', async () => {",
      '    // TODO(first5): Finish this test setup:',
      '    const input = { ready: true };',
      '    expect(input.ready).toBe(true);',
      '  });',
      '});'
    ];
    return {
      targetFile: filePath,
      content: lines.join('\n'),
      cursorLine: 6,
      starterPrompt: 'Finish setting up the test input and assertion.'
    };
  }

  if (isComponent) {
    const compName = task
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('') || 'Component';
    const filePath = `src/components/${compName}.jsx`;
    const lines = [
      "import React from 'react';",
      '',
      `export function ${compName}({ className, ...props }) {`,
      '  // TODO(first5): Finish the initial state / event handler:',
      '  const [active, setActive] = React.useState(false);',
      '',
      '  return (',
      `    <div className={className}>`,
      `      {/* Add markup here */}`,
      '    </div>',
      '  );',
      '}'
    ];
    return {
      targetFile: filePath,
      content: lines.join('\n'),
      cursorLine: 5,
      starterPrompt: `Finish writing state or props for <${compName} />.`
    };
  }

  const filePath = 'src/starter.js';
  const lines = [
    '/**',
    ` * Task: ${task}`,
    ' * Scaffolding prepared by first5.',
    ' */',
    '',
    'export async function executeTask(params = {}) {',
    '  // TODO(first5): Finish the initial validation check:',
    '  if (!params) throw new Error("Missing parameters");',
    '',
    '  return true;',
    '}'
  ];
  return {
    targetFile: filePath,
    content: lines.join('\n'),
    cursorLine: 8,
    starterPrompt: 'Finish the parameter check or write the first business logic line.'
  };
}
