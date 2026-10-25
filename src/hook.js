/**
 * Prints shell hook integrations to alert developers after idle periods.
 */
export function printShellHook() {
  console.log(`
\x1b[36m[first5] Shell Idle Hook Setup\x1b[0m
Add one of the following snippets to your shell profile to get a subtle nudge when returning from meetings or lunch:

\x1b[1mBash / Zsh (~/.bashrc or ~/.zshrc):\x1b[0m
\`\`\`bash
# first5 idle reminder hook
_first5_preexec() { _first5_last=$SECONDS; }
_first5_precmd() {
  if [[ -n "$_first5_last" ]]; then
    local elapsed=$(( SECONDS - _first5_last ))
    if (( elapsed > 1800 )); then # 30 minutes
      echo -e "\\033[36m[first5]\\033[0m Inactive for $(( elapsed / 60 ))m. Run \\033[1mfirst5\\033[0m to resume where you left off."
    fi
  fi
  _first5_last=$SECONDS
}
autoload -Uz add-zsh-hook 2>/dev/null && add-zsh-hook precmd _first5_precmd && add-zsh-hook preexec _first5_preexec
\`\`\`

\x1b[1mPowerShell ($PROFILE):\x1b[0m
\`\`\`powershell
# first5 idle reminder
$global:first5_last = [DateTime]::UtcNow
function Prompt {
  $now = [DateTime]::UtcNow
  $elapsed = ($now - $global:first5_last).TotalMinutes
  if ($elapsed -gt 30) {
    Write-Host "[first5] Inactive for $([math]::Round($elapsed))m. Run 'first5' to resume where you left off." -ForegroundColor Cyan
  }
  $global:first5_last = $now
  return "PS $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) "
}
\`\`\`
`);
}
