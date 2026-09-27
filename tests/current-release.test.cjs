const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('all application script references exist locally', () => {
  const html = read('index.html');
  const sources = [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map(match => match[1]);
  assert.ok(sources.length > 0);
  for (const source of sources) assert.ok(fs.existsSync(path.join(root, source)), `Missing ${source}`);
});

test('release metadata is consistent', () => {
  assert.match(read('app_meta.js'), /v1\.5\.7/);
  assert.match(read('package.json'), /"version":\s*"1\.5\.7"/);
  assert.match(read('index.html'), /id="aboutDialog"/);
});

test('volumetric zoom limits are 0.7x through 100x', () => {
  assert.match(read('charts.js'), /Math\.max\(\.7,Math\.min\(100,/);
  assert.match(read('app.js'), /Math\.max\(\.7,Math\.min\(100,/);
});

test('built-in demo profiles are bundled with the project', () => {
  assert.match(read('demo_profiles.js'), /Demo 1/);
  assert.match(read('demo_profiles.js'), /Demo 2/);
});
