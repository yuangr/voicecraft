import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
let child, upstream, base, received;
before(async () => {
  upstream = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const data = JSON.parse(Buffer.concat(chunks).toString());
    received = { url: req.url, key: req.headers['x-goog-api-key'] };
    res.setHeader('content-type', 'application/json');
    if (data.contents[0].parts[0].text === 'valid-audio') {
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: 'AAAAAA==', mimeType: 'audio/L16' } }] } }] }));
    } else {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: { message: 'SENSITIVE provider diagnostic' } }));
    }
  }).listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  child = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: '0', GEMINI_API_KEY: 'fixture-key', GEMINI_BASE_URL: `http://127.0.0.1:${upstream.address().port}` },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 15000);
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/localhost:(\d+)/);
      if (match) { base = `http://127.0.0.1:${match[1]}`; clearTimeout(timeout); resolve(); }
    });
  });
});
after(async () => {
  if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
  if (upstream) await new Promise(resolve => upstream.close(resolve));
});
function tts(body) {
  return fetch(`${base}/api/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
test('rejects malformed JSON with a JSON error response', async () => {
  const res = await fetch(`${base}/api/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
  assert.equal(res.status, 400); assert.equal((await res.json()).error, 'Invalid JSON request.');
});
test('rejects non-text, empty and oversized synthesis input before contacting providers', async () => {
  for (const text of [{ content: 'x' }, '', '   ', 'x'.repeat(10001)]) {
    const res = await tts({ text }); assert.equal(res.status, 400);
  }
});
test('returns an explicit upload limit response', async () => {
  const form = new FormData();
  form.append('file', new Blob([Buffer.alloc(25 * 1024 * 1024 + 1)], { type: 'audio/wav' }), 'audio.wav');
  const res = await fetch(`${base}/api/stt`, { method: 'POST', body: form });
  assert.equal(res.status, 413); assert.equal((await res.json()).error, 'Audio file exceeds 25 MB.');
});
test('keeps provider diagnostics private and credentials out of URLs', async () => {
  const res = await tts({ provider: 'gemini', text: 'provider-error' });
  assert.equal(res.status, 500); assert.equal((await res.json()).error, 'Speech synthesis failed. Please retry.');
  assert.equal(received.key, 'fixture-key'); assert.ok(!received.url.includes('key='));
});
test('preserves Gemini PCM-to-WAV responses after dependency upgrade', async () => {
  const res = await tts({ provider: 'gemini', text: 'valid-audio' });
  assert.equal(res.status, 200); assert.equal(res.headers.get('content-type'), 'audio/wav');
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.equal(bytes.readUInt32LE(40), 4); assert.equal(bytes.length, 48);
});
