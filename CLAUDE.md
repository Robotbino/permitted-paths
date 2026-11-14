# Permitted Paths — Claude Code notes

Static course site (Graph Engineering). Repo: `git@github.com:Robotbino/permitted-paths.git`, branch `main`, published by GitHub Pages at https://robotbino.github.io/permitted-paths/ (every push to `main` goes live).

## Rules
- No build step. `index.html` opens from `file://`; classic scripts under one `GE` namespace. Read `README.md` before adding a part or instrument.
- Prose uses simplified English: short sentences, PASS/FAIL, "path" never "route".
- Content comes from the notes `GE 00–08`. The originals are in the author's Obsidian vault, outside this repo; don't edit the vault from here. `notes/` holds published copies (see `notes/README.md`); source chips link to them.
- This repo is public. Don't write local paths, usernames, vault names, account or plan details, or other personal information into any file.
- `backups/` holds old copies; never load or edit them as live files.
- `lab/claude/settings.json` is course material (part L), not this project's config. Project config is `.claude/`.
- `examples/personal-finance/` is the reference application of part S. It has its own `package.json` and build; the course site still has none. `js/data/studio-files.js` and `js/data/studio-runs.js` are generated: never edit them.

## After changes
- Changed a file in `lab/`: `python lab/tools/sync-page.py`
- Changed the bridge: `node lab/bridge/test/run.mjs`
- Changed a file in `examples/personal-finance/`: `npm run check` in that folder, then `python examples/tools/sync-studio.py` from the root. New file: add it to `levels.json`.
- Run `tests.html` (preview server "site", open `/tests.html`; `window.__tests` = `{pass, fail}`).
- Update `docs/REPORT.md` for notable changes.

## Git
Work on a branch for anything large; commit with clear messages; push only when asked.
