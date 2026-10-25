# first5

Scaffolds the first 5 minutes of any dev task, places your cursor on line 1, and opens your editor.

## The Idea

Most developers don't struggle with coding. They struggle with starting:
- You get pulled into Slack or a standup and come back with zero context.
- You dread copy-pasting acceptance criteria from Jira or Linear.
- You waste 10 minutes setting up imports, mocks, and file paths.

Most AI coding tools try to write the entire feature for you, spitting out 300 lines of code you don't trust and have to audit.

`first5` does the opposite. It only does the boring first 5 minutes:
1. Pulls context from your active git branch or ticket (Jira / Linear / GitHub / Slack).
2. Scans your repo's tech stack (TypeScript, React, Python, Go, Rust).
3. Generates the boilerplate, imports, and types.
4. Leaves a half-finished comment or assertion right where logic begins.
5. Spawns your editor (`code`, `cursor`, `nvim`) focused on that exact line.

---

## Usage

### Zero-argument mode (Active Radar)
Run `first5` with no arguments to pick up where you left off:

```bash
first5
```

```text
[first5] Where you left off:
(Use ↑/↓ arrows to navigate, Enter to select, Ctrl+C to cancel)

  ❯ [Git Working Tree Resume Work] Continue work on src/webhook.ts (feat/payment)
    [Jira PROJ-1042] Add idempotency keys to Stripe webhook handler
    [GitHub PR #34] Address review feedback on token expiration
    [Slack #backend-alerts] Triage Redis connection pool timeouts
    [Custom New] Type a custom task description...
```

### Direct command or ticket
```bash
# By task description
first5 "write migration doc for redis cache"

# Direct Jira or Linear issue (auto-cuts branch)
first5 JIRA-1042 -b
first5 ENG-892 -b

# GitHub issue
first5 #42

# From Postman collection / request schema
first5 --from postman "reset-password"

# From Slack thread
first5 --from slack "auth-incident"
```

### Wrap up when done
```bash
first5 done
```
Stages modified files and creates a clean conventional commit matching your branch/ticket.

### Shell idle reminder
Run `first5 hook` to print a shell snippet for Bash, Zsh, or PowerShell that nudges you if your terminal has been inactive for >30 minutes.

---

## CLI Options

```text
Usage:
  first5                               # Launches Active Radar (shows where you left off)
  first5 "<task description>" [options]
  first5 <TICKET-ID> [options]
  first5 done [optional message]       # Stages changes and writes a clean conventional commit
  first5 hook                          # Print shell idle reminder hook

Options:
  --from <app> <id>    Pull task context from work app (postman, jira, linear, github, slack)
  -b, --branch         Auto-create and checkout a clean git branch (e.g. feat/task-slug)
  -p, --preset <type>  Enforce task archetype: test, doc, component, api
  -t, --timer          Start a 5-minute focus countdown
  --mock               Run deterministic local fallback without an LLM
  --dry-run            Preview output in terminal without writing files
  --no-open            Create file without launching the editor
  -h, --help           Show help
```

---

## AI Backends

Built to run against local, open-weight models via Ollama:

```bash
# Local Ollama (default)
ollama run qwen2.5-coder:7b
first5

# Remote Ollama instance
export OLLAMA_HOST="http://192.168.1.150:11434"

# OpenAI-compatible API key fallback
export OPENAI_API_KEY="sk-..."

# Offline / Mock mode (no model needed)
first5 --mock
```

---

## License

MIT
