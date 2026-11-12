# Permitted Paths — Claude Code notes

Static course site (Graph Engineering). Repo: `git@github.com:Robotbino/permitted-paths.git`, branch `main`, published by GitHub Pages at https://robotbino.github.io/permitted-paths/ (every push to `main` goes live).

## Rules
- No build step. `index.html` opens from `file://`; classic scripts under one `GE` namespace. Read `README.md` before adding a part or instrument.
- Prose uses simplified English: short sentences, PASS/FAIL, "path" never "route".
- Content comes from the vault notes `GE 00–08` (Obsidian vault at `C:\Users\Binoh\Documents\Applications\Obsidian-main`). Don't edit the vault from here.
- `backups/` holds old copies; never load or edit them as live files.
- `lab/claude/settings.json` is course material (part L), not this project's config. Project config is `.claude/`.

## After changes
- Changed a file in `lab/`: `python lab/tools/sync-page.py`
- Changed the bridge: `node lab/bridge/test/run.mjs`
- Run `tests.html` (preview server "site", open `/tests.html`; `window.__tests` = `{pass, fail}`).
- Update `docs/REPORT.md` for notable changes.

## Git
Work on a branch for anything large; commit with clear messages; push only when asked.
