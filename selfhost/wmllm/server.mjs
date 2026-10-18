// OpenAI-compatible shim in front of `claude -p` (Claude Code, subscription auth).
// World Monitor's "generic" and "ollama" LLM providers POST /v1/chat/completions here.
// Listens on loopback and the docker bridge only; never exposed publicly.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';

const PORT = Number(process.env.WMLLM_PORT || 8787);
const HOSTS = (process.env.WMLLM_HOSTS || '127.0.0.1').split(',').map((h) => h.trim()).filter(Boolean);
const API_KEY = process.env.WMLLM_API_KEY || '';
const MODEL = process.env.WMLLM_MODEL || 'claude-haiku-5-5';
const CLAUDE_BIN = process.env.CLAUDE_BIN || '/usr/local/bin/claude';
const TIMEOUT_MS = Number(process.env.WMLLM_TIMEOUT_MS || 90_000);
const MAX_CONCURRENCY = Number(process.env.WMLLM_MAX_CONCURRENCY || 2);
const MAX_QUEUE = Number(process.env.WMLLM_MAX_QUEUE || 6);
const MAX_CALLS_PER_HOUR = Number(process.env.WMLLM_MAX_CALLS_PER_HOUR || 120);
const MAX_BODY_BYTES = 1_000_000;
const HOUR_MS = 3_600_000;

if (API_KEY.length < 32) {
  console.error('[wmllm] WMLLM_API_KEY missing or too short');
  process.exit(1);
}
if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
  console.error('[wmllm] CLAUDE_CODE_OAUTH_TOKEN missing (run `claude setup-token`, paste into ~/.env)');
  process.exit(1);
}

// Variables that would switch the CLI to billed API or another provider, plus our own key.
const STRIPPED_ENV = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_PROFILE', 'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'WMLLM_API_KEY'];
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !STRIPPED_ENV.includes(k)));

let active = 0;
const queue = [];
const callTimes = [];

function isAuthorized(req) {
  const header = req.headers.authorization || '';
  const given = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
  const expected = Buffer.from(API_KEY);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function underHourlyCap() {
  const cutoff = Date.now() - HOUR_MS;
  while (callTimes.length && callTimes[0] < cutoff) callTimes.shift();
  return callTimes.length < MAX_CALLS_PER_HOUR;
}

function acquire() {
  if (active < MAX_CONCURRENCY) { active += 1; return Promise.resolve(); }
  if (queue.length >= MAX_QUEUE) return null;
  return new Promise((resolve) => queue.push(resolve));
}

function release() {
  const next = queue.shift();
  if (next) next(); else active -= 1;
}

function contentText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('');
  return '';
}

// OpenAI messages -> system prompt + a single user turn for `claude -p`.
function toPrompt(messages) {
  const system = messages.filter((m) => m.role === 'system').map((m) => contentText(m.content)).join('\n\n');
  const turns = messages.filter((m) => m.role !== 'system');
  const user = turns.length === 1
    ? contentText(turns[0].content)
    : turns.map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${contentText(m.content)}`).join('\n\n');
  return { system: system || 'You are a concise analyst. Answer only with what is asked.', user };
}

function runClaude(system, user) {
  const args = ['-p', '--output-format', 'json', '--model', MODEL, '--effort', 'low',
    '--tools', '', '--strict-mcp-config', '--no-session-persistence', '--system-prompt', system];
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, args, { env: childEnv, cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.stdout.setEncoding('utf8').on('data', (d) => { stdout += d; });
    child.stderr.setEncoding('utf8').on('data', (d) => { stderr += d; });
    child.stdin.on('error', (err) => { stderr += `\n[stdin] ${err.message}`; });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (signal) return reject(new Error(`claude -p killed (${signal}) after ${TIMEOUT_MS} ms`));
      let out;
      try { out = JSON.parse(stdout); } catch { return reject(new Error(`non-JSON output (code ${code}): ${(stderr || stdout).slice(0, 300)}`)); }
      if (code !== 0 || out.is_error) return reject(new Error(`claude -p failed: ${String(out.result || stderr).slice(0, 300)}`));
      resolve(out);
    });
    child.stdin.end(user);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: { message, type: 'wmllm_error' } });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function completion(id, text, out) {
  const u = out.usage || {};
  const prompt = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  const completionTokens = u.output_tokens || 0;
  return {
    id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: MODEL,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
    usage: { prompt_tokens: prompt, completion_tokens: completionTokens, total_tokens: prompt + completionTokens },
  };
}

function sendStream(res, id, text) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const base = { id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: MODEL };
  res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: text } }] })}\n\n`);
  res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
  res.end('data: [DONE]\n\n');
}

async function handleCompletion(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return sendError(res, 400, 'invalid JSON body'); }
  if (!Array.isArray(body?.messages) || body.messages.length === 0) return sendError(res, 400, 'messages[] required');
  if (!underHourlyCap()) return sendError(res, 429, 'hourly call cap reached');
  const slot = acquire();
  if (!slot) return sendError(res, 429, 'queue full');
  await slot;
  const started = Date.now();
  const id = `chatcmpl-${randomUUID()}`;
  try {
    callTimes.push(started);
    const { system, user } = toPrompt(body.messages);
    const out = await runClaude(system, user);
    const text = typeof out.result === 'string' ? out.result : '';
    console.log(`[wmllm] ok ${Date.now() - started}ms in=${user.length}c out=${text.length}c`);
    if (body.stream === true) sendStream(res, id, text); else sendJson(res, 200, completion(id, text, out));
  } catch (err) {
    console.error(`[wmllm] fail ${Date.now() - started}ms: ${err.message}`);
    sendError(res, 502, 'upstream claude call failed');
  } finally {
    release();
  }
}

function handle(req, res) {
  const path = (req.url || '').split('?')[0];
  if (req.method === 'GET' && path === '/health') return sendJson(res, 200, { ok: true, active, queued: queue.length });
  if (!isAuthorized(req)) return sendError(res, 401, 'unauthorized');
  if (req.method === 'GET' && path === '/v1/models') {
    return sendJson(res, 200, { object: 'list', data: [{ id: MODEL, object: 'model', owned_by: 'anthropic' }] });
  }
  if (req.method === 'POST' && path === '/v1/chat/completions') {
    handleCompletion(req, res).catch((err) => {
      console.error('[wmllm] handler error', err);
      if (!res.headersSent) sendError(res, 500, 'internal error');
    });
    return;
  }
  sendError(res, 404, 'not found');
}

// One listener per host: binding a non-existent address (bridge not up yet) fails loudly.
for (const host of HOSTS) {
  createServer(handle).listen(PORT, host, () => console.log(`[wmllm] listening ${host}:${PORT} model=${MODEL}`));
}
