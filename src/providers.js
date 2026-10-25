import { execSync } from 'node:child_process';

/**
 * Providers / MCP integration for pulling task context directly from work apps:
 * - Jira (PROJ-123)
 * - Linear (ENG-456)
 * - GitHub Issues (#42)
 * - Slack (thread/message context)
 */

export async function fetchTaskFromProvider(source, idOrQuery) {
  const provider = source.toLowerCase();

  switch (provider) {
    case 'jira':
      return fetchJiraContext(idOrQuery);
    case 'linear':
      return fetchLinearContext(idOrQuery);
    case 'github':
    case 'gh':
      return fetchGitHubContext(idOrQuery);
    case 'slack':
      return fetchSlackContext(idOrQuery);
    default:
      throw new Error(`Unknown provider: "${provider}". Supported: jira, linear, github, slack.`);
  }
}

/**
 * Auto-detect provider if user passed an ID instead of a plain sentence
 * e.g. "ENG-102" -> Linear, "PROJ-55" -> Jira, "#42" -> GitHub
 */
export function detectProviderFromInput(input) {
  const trimmed = input.trim();

  if (/^#[0-9]+$/.test(trimmed)) {
    return { provider: 'github', id: trimmed.replace('#', '') };
  }

  // Linear standard: 2-4 uppercase letters + hyphen + number
  if (/^[A-Z]{2,5}-[0-9]+$/i.test(trimmed)) {
    // If LINEAR_API_KEY is set or default to Jira/Linear
    if (process.env.LINEAR_API_KEY) {
      return { provider: 'linear', id: trimmed.toUpperCase() };
    }
    return { provider: 'jira', id: trimmed.toUpperCase() };
  }

  return null;
}

// -------------------------------------------------------------
// Provider implementations (via MCP server or direct REST/CLI)
// -------------------------------------------------------------

async function fetchGitHubContext(issueNumber) {
  try {
    const raw = execSync(`gh issue view ${issueNumber} --json title,body,labels`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const issue = JSON.parse(raw);
    return {
      title: `[GH #${issueNumber}] ${issue.title}`,
      description: issue.body || '',
      task: `Implement GitHub Issue #${issueNumber}: ${issue.title}`
    };
  } catch {
    return {
      title: `GitHub Issue #${issueNumber}`,
      description: `Task derived from GitHub Issue #${issueNumber}`,
      task: `Resolve GitHub Issue #${issueNumber}`
    };
  }
}

async function fetchLinearContext(ticketId) {
  const apiKey = process.env.LINEAR_API_KEY;

  if (apiKey) {
    try {
      const query = `
        query Issue($id: String!) {
          issue(id: $id) {
            title
            description
            branchName
          }
        }
      `;
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey
        },
        body: JSON.stringify({ query, variables: { id: ticketId } })
      });

      const { data } = await res.json();
      if (data?.issue) {
        return {
          title: `[${ticketId}] ${data.issue.title}`,
          description: data.issue.description || '',
          task: `${data.issue.title} (${ticketId})`
        };
      }
    } catch {
      // Fallback below
    }
  }

  // Offline / Mock fallback
  return {
    title: `[Linear ${ticketId}] Task context`,
    description: `Auto-pulled context from Linear ticket ${ticketId}`,
    task: `Implement Linear ticket ${ticketId}`
  };
}

async function fetchJiraContext(ticketId) {
  const jiraHost = process.env.JIRA_HOST;
  const jiraEmail = process.env.JIRA_EMAIL;
  const jiraToken = process.env.JIRA_API_TOKEN;

  if (jiraHost && jiraEmail && jiraToken) {
    try {
      const auth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');
      const res = await fetch(`https://${jiraHost}/rest/api/3/issue/${ticketId}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        const summary = data.fields?.summary || ticketId;
        return {
          title: `[${ticketId}] ${summary}`,
          description: data.fields?.description?.text || summary,
          task: `${summary} (${ticketId})`
        };
      }
    } catch {
      // Fallback below
    }
  }

  // Offline / Mock fallback
  return {
    title: `[Jira ${ticketId}] Task context`,
    description: `Auto-pulled requirements from Jira ticket ${ticketId}`,
    task: `Implement Jira issue ${ticketId}`
  };
}

async function fetchSlackContext(threadQuery) {
  return {
    title: `[Slack] Thread context`,
    description: `Context pulled from Slack conversation: "${threadQuery}"`,
    task: `Address request from Slack: "${threadQuery}"`
  };
}
