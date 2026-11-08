// Focused regressions for unsupported gates and motion visible only in raster output.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserInstallCommand } from '../lib/capture.mjs';

const scripts = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(scripts, '../../..');
const artifacts = join(repo, '.replica', 'regressions');
const cli = join(scripts, 'replica.mjs');
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
assert.equal(
  browserInstallCommand(),
  `npx --prefix "${fileURLToPath(new URL('..', import.meta.url))}" playwright install chromium`,
  'the install hint should use a native path resolved from the capture module URL',
);
assert.equal(
  browserInstallCommand('C:\\Users\\Test User\\Replica scripts'),
  'npx --prefix "C:\\Users\\Test User\\Replica scripts" playwright install chromium',
  'the install hint should quote a native path containing spaces',
);
const run = (...args) => {
  try {
    return { code: 0, out: execFileSync('node', [cli, ...args], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
};
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const pngChunk = (type, data) => {
  const name = Buffer.from(type);
  const body = Buffer.concat([name, data]);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(body), chunk.length - 4);
  return chunk;
};
const pixelPng = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
  pngChunk('IDAT', deflateSync(Buffer.from([0, 255, 255, 255, 255]))),
  pngChunk('IEND', Buffer.alloc(0)),
]);

await rm(artifacts, { recursive: true, force: true });
await mkdir(artifacts, { recursive: true });

try {
  const image = join(artifacts, 'static.png');
  await writeFile(image, pixelPng);
  const imageRef = join(artifacts, 'image-ref');
  let r = run('capture', image, '--out', imageRef, '--level', 'structure');
  assert.equal(r.code, 0, r.out);

  r = run('compare', imageRef, fixture('regression-raster-motion-missing.html'), '--level', 'structure');
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /no applicable gated axes.*image.*structure/i);
  assert.match(r.out, /faithful|exact|URL|video/i);
  assert.doesNotMatch(r.out, /\bPASS\b|score\s+100/i, 'unsupported comparisons must not report a score or pass');
  assert.equal(existsSync(join(dirname(imageRef), 'round-1')), false, 'unsupported comparison must not create its default sibling round');
  assert.equal(existsSync(join(dirname(imageRef), 'history.jsonl')), false, 'unsupported comparison must not append history');
  const unsupportedOut = join(artifacts, 'unsupported-custom');
  r = run('compare', imageRef, 'http://127.0.0.1:1/', '--level', 'structure', '--out', unsupportedOut);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /no applicable gated axes.*image.*structure/i, 'preflight should happen before browser navigation');
  assert.equal(existsSync(unsupportedOut), false, 'unsupported custom output should not be created');

  const motionRef = join(artifacts, 'motion-ref');
  r = run(
    'capture',
    fixture('regression-raster-motion-ref.html'),
    '--out', motionRef,
    '--level', 'structure',
    '--viewports', '320x200',
    '--motion', '1000',
    '--fps', '10',
    '--settle', '1',
  );
  assert.equal(r.code, 0, r.out);
  const refMotion = JSON.parse(await readFile(join(motionRef, 'motion', 'motion.json'), 'utf8'));
  assert.equal(refMotion.tracks.length, 0, 'the canvas animation should not create DOM motion tracks');

  const missingOut = join(motionRef, 'missing');
  r = run('compare', motionRef, fixture('regression-raster-motion-missing.html'), '--level', 'structure', '--out', missingOut);
  assert.equal(r.code, 1, r.out);
  const missingScore = JSON.parse(await readFile(join(missingOut, 'score.json'), 'utf8'));
  assert.ok(missingScore.axes.motion < 85, `missing canvas motion must fail the structure motion gate: ${missingScore.axes.motion}`);
  assert.match(await readFile(join(missingOut, 'report.md'), 'utf8'), /raster motion|changing pixels|motion match/i);

  const brandOut = join(motionRef, 'brand');
  r = run('compare', motionRef, fixture('regression-raster-motion-brand.html'), '--level', 'structure', '--out', brandOut);
  assert.equal(r.code, 0, r.out);
  const brandScore = JSON.parse(await readFile(join(brandOut, 'score.json'), 'utf8'));
  assert.ok(brandScore.axes.pixels < 85, `the static brand difference must be large enough to fail a raw-frame motion score: ${brandScore.axes.pixels}`);
  assert.ok(brandScore.axes.motion >= 85, `static branding changes must not fail the structure motion gate: ${brandScore.axes.motion}`);

  const largeRef = join(artifacts, 'large-ref');
  r = run(
    'capture',
    fixture('regression-raster-large-ref.html'),
    '--out', largeRef,
    '--level', 'structure',
    '--viewports', '1200x200',
    '--motion', '1000',
    '--fps', '10',
    '--settle', '1',
  );
  assert.equal(r.code, 0, r.out);
  const largeMotion = JSON.parse(await readFile(join(largeRef, 'motion', 'motion.json'), 'utf8'));
  assert.equal(largeMotion.tracks.length, 0);
  const largeOut = join(largeRef, 'missing');
  r = run('compare', largeRef, fixture('regression-raster-large-missing.html'), '--level', 'structure', '--out', largeOut);
  assert.equal(r.code, 1, r.out);
  const largeScore = JSON.parse(await readFile(join(largeOut, 'score.json'), 'utf8'));
  assert.ok(largeScore.axes.motion < 85, `raster motion near the far edge of a wide viewport must remain visible: ${largeScore.axes.motion}`);

  const fadeRef = join(artifacts, 'fade-ref');
  r = run(
    'capture',
    fixture('regression-raster-fade-ref.html'),
    '--out', fadeRef,
    '--level', 'structure',
    '--viewports', '320x200',
    '--motion', '1000',
    '--fps', '10',
    '--settle', '1',
  );
  assert.equal(r.code, 0, r.out);
  const reversedOut = join(fadeRef, 'reversed');
  r = run('compare', fadeRef, fixture('regression-raster-fade-reversed.html'), '--level', 'structure', '--out', reversedOut);
  assert.equal(r.code, 1, r.out);
  const reversedScore = JSON.parse(await readFile(join(reversedOut, 'score.json'), 'utf8'));
  assert.ok(reversedScore.axes.motion < 85, `opposite fade progression must fail the structure motion gate: ${reversedScore.axes.motion}`);
  const reversedReport = await readFile(join(reversedOut, 'report.md'), 'utf8');
  const direction = /raster motion match ([\d.]+)% \(footprint ([\d.]+)%, brightness direction ([\d.]+)%/.exec(reversedReport);
  assert.ok(direction, reversedReport);
  assert.ok(+direction[1] < 85, `opposite progression combined score should fail, got ${direction[1]}`);
  assert.ok(+direction[2] >= 85, `opposite fade should retain the same spatial footprint, got ${direction[2]}`);
  assert.ok(+direction[3] < 85, `opposite fade should fail signed direction matching, got ${direction[3]}`);

  console.log('regressions ok');
} finally {
  // Keep captured evidence under the ignored .replica directory for review.
}
