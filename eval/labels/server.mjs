/**
 * Serves the flag-labelling page. Node's built-in modules only.
 *
 * Run it with `npm run label`. It listens on 127.0.0.1, on port 4317 or the next
 * free one, and saves every label to `labels.json` beside this file.
 */

import { createServer } from 'node:http';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const labelsFile = join(here, 'labels.json');
const HOST = '127.0.0.1';
const FIRST_PORT = 4317;
const LAST_PORT = FIRST_PORT + 50;

/** The PRD sections the page shows, by their headings, copied out of PRD.md as they stand. */
const PRD_HEADINGS = [
  '### 2. Flags and gaps, ranked by severity, each showing its source',
  '## Success metrics',
];

async function prdSections() {
  const lines = (await readFile(join(root, 'PRD.md'), 'utf8')).replace(/\r\n/g, '\n').split('\n');
  return PRD_HEADINGS.map((heading) => {
    const start = lines.indexOf(heading);
    if (start === -1) return { heading, body: '(This heading is no longer in PRD.md.)' };
    const level = heading.match(/^#+/)[0].length;
    let end = start + 1;
    while (end < lines.length) {
      const match = lines[end].match(/^(#+) /);
      if (match && match[1].length <= level) break;
      end += 1;
    }
    return {
      heading: heading.replace(/^#+ /, ''),
      body: lines.slice(start + 1, end).join('\n').trim(),
    };
  });
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

/** Accepts only the shape the page writes, so a stray request cannot wipe the file. */
function isLabels(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.flags === 'object' &&
    value.flags !== null &&
    typeof value.updatedAt === 'string'
  );
}

let writing = Promise.resolve();

/** Writes to a temporary file and renames it, so a crash mid-write leaves the old file whole. */
function saveLabels(json) {
  writing = writing.then(async () => {
    const temp = `${labelsFile}.tmp`;
    await writeFile(temp, json, 'utf8');
    await rename(temp, labelsFile);
  });
  return writing;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('Too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, `http://${HOST}`).pathname;

    if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
      return send(res, 200, 'text/html; charset=utf-8', await readFile(join(here, 'index.html')));
    }
    if (req.method === 'GET' && path === '/flags.json') {
      return send(res, 200, 'application/json; charset=utf-8', await readFile(join(here, 'flags.json')));
    }
    if (req.method === 'GET' && path === '/labels.json') {
      const body = existsSync(labelsFile) ? await readFile(labelsFile) : 'null';
      return send(res, 200, 'application/json; charset=utf-8', body);
    }
    if (req.method === 'GET' && path === '/prd.json') {
      return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(await prdSections()));
    }
    if (req.method === 'GET' && path === '/health') {
      return send(res, 200, 'text/plain; charset=utf-8', 'ok');
    }
    if (req.method === 'POST' && path === '/labels') {
      const parsed = JSON.parse(await readBody(req));
      if (!isLabels(parsed)) return send(res, 400, 'text/plain; charset=utf-8', 'Not a labels file.');
      await saveLabels(`${JSON.stringify(parsed, null, 2)}\n`);
      return send(res, 200, 'text/plain; charset=utf-8', 'saved');
    }
    send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  } catch (error) {
    send(res, 500, 'text/plain; charset=utf-8', error instanceof Error ? error.message : String(error));
  }
});

function listen(port) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < LAST_PORT) return listen(port + 1);
    console.error(`Could not start the labelling server: ${error.message}`);
    process.exit(1);
  });
  server.listen(port, HOST, () => {
    console.log(`Labelling page: http://${HOST}:${port}/`);
    console.log(`Labels are saved to ${labelsFile}`);
  });
}

listen(FIRST_PORT);
