// The HTTP server, on the module node:http of Node. This file does what a web framework does:
// it finds the handler, reads the JSON body, protects the server, and changes an error into a reply.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import type { ApiError, ErrorCode, Problem } from '../../shared/contracts.ts';
import { AppError, DuplicateKey, STATUS_OF, StorageUnavailable } from '../errors.ts';
import { HANDLERS, type App, type Reply } from './handlers.ts';

// 9000 characters of a statement can be 36 000 bytes of UTF-8. The limit is in bytes.
export const MAX_BODY_BYTES = 40_000;
const LOCAL_NAMES = new Set(['127.0.0.1', 'localhost', '[::1]']);
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

const fail = (status: number, code: ErrorCode, problems: Problem[] = [], headers?: Record<string, string>, run_id?: string): Reply => ({
  status, headers, body: { error: { code, problems, ...(run_id ? { run_id } : {}) } } satisfies ApiError,
});

/** Changes each error into a reply. This is the only location that selects a status code for an error. */
export function replyForError(error: unknown): Reply {
  if (error instanceof AppError) return fail(STATUS_OF[error.code], error.code, error.problems, undefined, error.run_id);
  if (error instanceof StorageUnavailable) return fail(503, 'STORAGE_UNAVAILABLE', [], { 'Retry-After': '1' }, error.run_id);
  if (error instanceof DuplicateKey) return fail(409, 'KEY_CONFLICT', [{ rule: 'R8', text: 'This request key is already recorded.' }]);
  console.error(error); // a defect: the detail goes to the log of the server, not to the client
  return fail(500, 'INTERNAL');
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new AppError('BAD_REQUEST', [{ rule: 'HTTP', text: 'The body is larger than ' + MAX_BODY_BYTES + ' bytes.' }]);
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError('BAD_REQUEST', [{ rule: 'HTTP', text: 'The body is not JSON.' }]);
  }
}

/** An Origin that is not a URL (for example the text "null") is a different site, not a defect. */
function sameOrigin(origin: string, host: string | undefined): boolean {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function api(app: App, req: IncomingMessage, url: URL): Promise<Reply> {
  // The Host must be this computer. This stops a web page of a different site that
  // points a domain name at 127.0.0.1 (DNS rebinding).
  const host = (req.headers.host ?? '').replace(/:\d+$/, '');
  if (!LOCAL_NAMES.has(host)) return fail(403, 'BAD_REQUEST', [{ rule: 'HTTP', text: 'The Host is not this computer.' }]);
  // A browser sends Origin with a POST. It must be the origin of this application.
  const origin = req.headers.origin;
  if (origin && !sameOrigin(origin, req.headers.host)) return fail(403, 'BAD_REQUEST', [{ rule: 'HTTP', text: 'The Origin is a different site.' }]);

  let params: string[] = [];
  const handler = HANDLERS.find((h) => {
    if (h.method !== req.method) return false;
    if (typeof h.path === 'string') return h.path === url.pathname;
    const m = h.path.exec(url.pathname);
    if (m) params = m.slice(1);
    return m !== null;
  });
  if (!handler) return fail(404, 'NOT_FOUND');

  let body: unknown = null;
  if (req.method === 'POST') {
    if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return fail(415, 'BAD_REQUEST', [{ rule: 'HTTP', text: 'The content type must be application/json.' }]);
    body = await readJson(req);
  }
  return handler.handle(app, { query: url.searchParams, params, body });
}

/** Gives a file of the built web application. The same origin serves the page and the API, thus CORS is not necessary. */
function staticFile(webDir: string, pathname: string): { type: string; data: Buffer } | null {
  const root = resolve(webDir);
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null; // "%" with no valid code after it
  }
  let file = resolve(join(root, decoded));
  if (file !== root && !file.startsWith(root + sep)) return null; // a path that goes out of the folder
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  if (!existsSync(file)) return null;
  return { type: MIME[extname(file)] ?? 'application/octet-stream', data: readFileSync(file) };
}

export function createHttpServer(app: App, options: { webDir?: string } = {}): Server {
  // The listener must never let an error go out: an error that nobody handles stops the process.
  // Thus all the work is in `handle`, and one `catch` here answers 500 for a defect.
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    handle(req, res).catch((error) => {
      console.error(error);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(fail(500, 'INTERNAL').body));
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://local');
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(fail(400, 'BAD_REQUEST', [{ rule: 'HTTP', text: 'The address of the request is not valid.' }]).body));
      return;
    }
    if (!url.pathname.startsWith('/api/')) {
      const file = req.method === 'GET' && options.webDir ? staticFile(options.webDir, url.pathname) : null;
      res.writeHead(file ? 200 : 404, { 'Content-Type': file ? file.type : 'text/plain' });
      res.end(file ? file.data : 'Not found. Do "npm run build" to make the web application.');
      return;
    }
    let reply: Reply;
    try {
      reply = await api(app, req, url);
    } catch (error) {
      reply = replyForError(error);
    }
    res.writeHead(reply.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...reply.headers });
    res.end(JSON.stringify(reply.body));
  }
}
