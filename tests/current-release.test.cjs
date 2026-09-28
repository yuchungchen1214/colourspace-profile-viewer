const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

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

test('Profile layout defaults to 1 by 2 and supports 1 to 4 rows with chart-style clear warnings', () => {
  const app = read('app.js');
  const html = read('index.html');
  const styles = read('styles.css');
  assert.match(app, /let profileLayoutRows=2/);
  assert.match(app, /rows<1\|\|rows>4/);
  assert.match(app, /Profile layout must contain one to four rows/);
  assert.match(app, /profileLayoutWarning/);
  assert.match(app, /Distribute row heights evenly/);
  assert.match(app, /profileRowWeights\.fill\(1\)/);
  assert.match(app, /classList\.toggle\('will-clear',profileSlotIsActive\(slot,1,profileLayoutRows\)/);
  assert.match(app, /profileRowResizer\$\{gap\}\$\{gap\+1\}/);
  assert.match(app, /profileRows:profileLayoutRows/);
  assert.match(html, /class="chart-layout-picker profile-layout-picker"/);
  assert.match(html, /id="profileLayoutWarning"/);
  assert.match(styles, /\.profile-layout-picker\{grid-template-columns:40px\}/);
});

test('finite custom gamut coordinates remain valid even without an RGB matrix', () => {
  const result = vm.runInNewContext(`${read('target_config.js')}
    selectCustomTargetPrimaries({ R: [1, 0], G: [0, 1], B: [0, 0] });
    selectCustomTargetWhitePoint(0.3333, 0.3333);
    ({ valid: targetConfigurationIsValid(), rgbToXyz: TARGET_RGB_TO_XYZ });`);
  assert.equal(result.valid, true);
  assert.equal(result.rgbToXyz, null);
});

test('custom target coordinates allow zero on valid chromaticity boundaries', () => {
  const result = vm.runInNewContext(`${read('target_config.js')}
    selectCustomTargetPrimaries({ R: [0.64, 0.33], G: [0, 0.6], B: [0.15, 0.06] });
    ({ valid: targetConfigurationIsValid(), green: TARGET_CONFIG.gamut.primaries.G });`);
  assert.equal(result.valid, true);
  assert.deepEqual(Array.from(result.green), [0, 0.6]);
});

test('custom gamuts accept finite imaginary-primary coordinates', () => {
  const result = vm.runInNewContext(`${read('target_config.js')}
    selectCustomTargetPrimaries({ R: [1.2, 0.2], G: [-0.1, 0.5], B: [0.15, 0.06] });
    ({ valid: targetConfigurationIsValid(), red: TARGET_CONFIG.gamut.primaries.R });`);
  assert.equal(result.valid, true);
  assert.deepEqual(Array.from(result.red), [1.2, 0.2]);
});

test('CIE target RGBWCMY markers use chromaticities directly when the RGB matrix is unavailable', () => {
  const source = read('charts.js');
  const start = source.indexOf('function cieTargetVertices(');
  const end = source.indexOf('\nfunction cieNodePath(', start);
  assert.ok(start >= 0 && end > start);
  const helper = source.slice(start, end);
  const result = vm.runInNewContext(`${helper}\ncieTargetVertices(null)`, {
    TARGET_CONFIG: {
      gamut: { primaries: { R: [1, 0], G: [0, 1], B: [0, 0] } },
      whitePoint: { x: 0.3333, y: 0.3333 }
    },
    targetWhitePointForProfile: () => null,
    safeTargetMatrices: () => ({ rgbToXyz: null })
  });
  const byLabel = Object.fromEntries(result.map(point => [point.label, point]));
  assert.deepEqual([byLabel.R.x, byLabel.R.y], [1, 0]);
  assert.deepEqual([byLabel.G.x, byLabel.G.y], [0, 1]);
  assert.deepEqual([byLabel.B.x, byLabel.B.y], [0, 0]);
  assert.deepEqual([byLabel.W.x, byLabel.W.y], [0.3333, 0.3333]);
  assert.deepEqual(['R', 'G', 'B', 'W', 'C', 'M', 'Y'].map(label => byLabel[label].label), ['R', 'G', 'B', 'W', 'C', 'M', 'Y']);
});

test('volumetric target RGBWCMY markers retain direct chromaticities and finite Y without a matrix', () => {
  const source = read('charts.js');
  const start = source.indexOf('function graph3DTargetVertices(');
  const end = source.indexOf('\nfunction draw3DGraphPanel(', start);
  assert.ok(start >= 0 && end > start);
  const helper = source.slice(start, end);
  const result = vm.runInNewContext(`${helper}\ngraph3DTargetVertices(null)`, {
    TARGET_CONFIG: {
      gamut: { primaries: { R: [0.64, 0.33], G: [-1, 0.6], B: [0.15, 0.06] } },
      whitePoint: { x: 0.3127, y: 0.329 }
    },
    targetWhitePointForProfile: () => null,
    safeTargetMatrices: () => ({ rgbToXyz: null }),
    targetLuminanceRange: () => ({ min: 0, max: 120 })
  });
  const byLabel = Object.fromEntries(result.map(point => [point.label, point]));
  assert.deepEqual([byLabel.R.x, byLabel.R.y], [0.64, 0.33]);
  assert.deepEqual([byLabel.G.x, byLabel.G.y], [-1, 0.6]);
  assert.deepEqual([byLabel.B.x, byLabel.B.y], [0.15, 0.06]);
  assert.ok(result.every(point => Number.isFinite(point.Y)));
  assert.deepEqual([byLabel.R.Y, byLabel.C.Y, byLabel.W.Y], [40, 80, 120]);
  assert.deepEqual(['R', 'G', 'B', 'W', 'C', 'M', 'Y'].map(label => byLabel[label].label), ['R', 'G', 'B', 'W', 'C', 'M', 'Y']);
});
