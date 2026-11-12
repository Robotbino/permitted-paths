// guard.mjs: a PreToolUse hook for the Bash tool. Put it in .claude/hooks/ of a repository.
// Claude Code gives the tool call as JSON on stdin. Exit code 2 blocks the call, and the text
// on stderr goes back to the agent as the reason. This is a second lock: the permission rules
// in settings.json are the first one.
let text = '';
for await (const chunk of process.stdin) text += chunk;

let command = '';
try { command = String(JSON.parse(text).tool_input?.command ?? ''); } catch { process.exit(0); }

const BLOCKED = [
  [/\bgit\s+push\b/, 'A push needs approval on the phone. The bridge does it, not the agent.'],
  [/\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s)/, 'This command removes work that is not committed.'],
  [/\b(deploy|kubectl|terraform|aws|az|gcloud)\b/, 'No deployment from an agent session.'],
  [/(^|[\s;&|])(rm|del|rmdir|Remove-Item)\b.*\s(-r|-rf|-Recurse|\/s)\b/i, 'No recursive delete.'],
  [/\.env\b|id_rsa|credentials\.json/, 'This command names a file with secrets.']
];

for (const [pattern, reason] of BLOCKED) {
  if (pattern.test(command)) { console.error('Blocked by guard.mjs: ' + reason); process.exit(2); }
}
process.exit(0);
