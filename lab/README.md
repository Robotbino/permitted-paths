# lab — the files of part L, "Operate it from your phone"

These are the working files that part L of the course shows. The page has a copy of each one; these are the originals.

Researched and written on 2026-11-12. Prices, limits and flags change: read the sources in part L before you depend on one.

```
lab/
  bridge/
    server.mjs            the bridge between n8n and Claude Code (Node.js 20 or later, no dependencies)
    config.example.json   copy to config.json and put in your paths and your Telegram user id
    test/run.mjs          28 checks with a stand-in for Claude Code: node test/run.mjs
    test/fake-claude.mjs  the stand-in
  n8n/
    phone-to-claude.workflow.json   import into n8n 2.47.5 (Workflows, Import from file)
  claude/
    settings.json         example permission rules and a hook for one repository: copy to .claude/settings.json
    hooks/guard.mjs       the hook: blocks push, deploy, recursive delete and secret files by exit code 2
```

## Start in this sequence

1. **Architecture A first.** `claude --remote-control "name"` in a repository, then open the session in the Code tab of the Claude app. Nothing in this folder is necessary for that.
2. **The bridge.** In `lab/bridge`: copy `config.example.json` to `config.json`; set the environment variable `BRIDGE_TOKEN` (32 characters or more); `node server.mjs --check`; `node server.mjs`.
3. **n8n.** `npx n8n@2.47.5` (Node.js 24 or later). Import the workflow. Put your Telegram user id in the nodes "Telegram Trigger" and "Settings". Select your Telegram credential in each Telegram node. Make a Header Auth credential named `X-Bridge-Token` with the same secret and select it in the four HTTP Request nodes.
4. **The public address.** `tailscale funnel --bg --set-path /webhook http://127.0.0.1:5678/webhook`, then set `N8N_WEBHOOK_URL` to the `https://…ts.net/` address and `N8N_PROXY_HOPS=1` before you start n8n.
5. First real task: `/ask` and a question about your notes. Mode ask has read-only tools.

## What was tested, and what was not

| Item | Result |
|---|---|
| `node test/run.mjs` (bridge, with a stand-in for Claude Code) | PASS, 28 of 28 |
| Workflow against the node definitions of `n8n-nodes-base` in n8n 2.47.5 | PASS, 28 of 28 nodes |
| `n8n import:workflow` on n8n 2.47.5 | PASS |
| The hook `guard.mjs` with five commands | PASS |
| The flags of `claude` against `claude --help` of 2.1.211 | All present except `--max-turns` (in the CLI reference, not in `--help`; set `"maxTurns": 0` if your version rejects it) |
| The bridge with the real `claude -p` | NOT RUN: it uses the limits of your plan |
| The workflow from a Telegram message to the end | NOT RUN: it needs your bot token and a public address |
| `tailscale funnel --set-path` on Windows | NOT RUN |

## Rules that the files obey

- The bridge listens on 127.0.0.1 only and has no address that runs a command from a request.
- The prompt goes to Claude Code on stdin. No text from the phone is part of a command line.
- The tools of a run come from its mode, not from the request. `git push` is denied in each mode.
- The bridge removes `ANTHROPIC_API_KEY` for the child process, so the run uses your plan and not the API.
- The bridge runs the tests and reads the diff itself, and refuses to push after a test run that is not PASS.
- Nothing merges, deploys or changes a credential.

Use this for personal projects and private notes only. Do not connect a repository or a credential of an employer.
