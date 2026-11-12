// Stand-in for claude: records its arguments and stdin, and makes one commit in a worktree when --worktree is given.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const a = process.argv.slice(2);
let input = ''; for await (const c of process.stdin) input += c;
writeFileSync(join(process.env.FAKE_OUT, 'args.json'), JSON.stringify({ a, input, hasKey: !!process.env.ANTHROPIC_API_KEY, cwd: process.cwd() }));
const w = a.indexOf('--worktree');
if (w >= 0) {
  const name = a[w + 1], dir = join('.claude', 'worktrees', name);
  mkdirSync(join('.claude', 'worktrees'), { recursive: true });
  execFileSync('git', ['worktree', 'add', '-q', '-b', 'worktree-' + name, dir]);
  const broken = existsSync(join(process.env.FAKE_OUT, 'break-tests'));
  writeFileSync(join(dir, 'm.mjs'), broken ? 'export const add = (a, b) => a - b; // wrong\n' : 'export const add = (a, b) => a + b; // fixed\n');
  execFileSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'fix']);
}
console.log(JSON.stringify({ result: 'Investigated\nFound\nChanged\nRemaining concerns', session_id: 's-1', is_error: false, num_turns: 3 }));
