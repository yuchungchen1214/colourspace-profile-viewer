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

test('Profile and imported Target EOTF use the arithmetic mean of per-level gamma values', () => {
  const app = read('app.js');
  const start = app.indexOf('function averageProfileEotf(');
  const end = app.indexOf('\nfunction profileSummary(', start);
  assert.ok(start >= 0 && end > start);
  const averageProfileEotf = vm.runInNewContext(`${app.slice(start, end)}; averageProfileEotf`);
  const xml = read('local-data/profiles/demo/Demo 2.bcs');
  const points = [...xml.matchAll(/<patch\b[\s\S]*?<red>([\d.eE+-]+)<\/red>[\s\S]*?<green>([\d.eE+-]+)<\/green>[\s\S]*?<blue>([\d.eE+-]+)<\/blue>[\s\S]*?<Y>([\d.eE+-]+)<\/Y>[\s\S]*?<\/patch>/g)]
    .map(match => ({r:Number(match[1]),g:Number(match[2]),b:Number(match[3]),Y:Number(match[4])}));
  assert.ok(Math.abs(averageProfileEotf({points}) - 2.2599) < 0.00005);
  assert.match(app, /gamma=averageProfileEotf\(p\)/);
  assert.match(app, /gamma=profileSummary\(profile\)\.gamma/);
  assert.match(app, /eotf:\{value:gamma,valid:Number\.isFinite\(gamma\)&&gamma>0/);
});

test('volumetric zoom limits are 0.7x through 100x', () => {
  assert.match(read('charts.js'), /Math\.max\(\.7,Math\.min\(100,/);
  assert.match(read('app.js'), /Math\.max\(\.7,Math\.min\(100,/);
});

test('chart plot backgrounds and gridlines use neutral grayscale', () => {
  const charts = read('charts.js');
  assert.match(charts, /ctx\.fillStyle='#363636';ctx\.fillRect\(domainClip\.x,domainClip\.y,domainClip\.w,domainClip\.h\)/);
  assert.match(charts, /ctx\.strokeStyle='#484848';ctx\.lineWidth=1/);
});

test('chart black backgrounds use neutral grayscale', () => {
  assert.match(read('charts.js'), /ctx\.fillStyle='#111111';ctx\.fillRect\(0,0,w,h\)/);
  assert.match(read('charts.js'), /ctx\.fillStyle='#111111';ctx\.fillRect\(0,0,width,height\)/);
  assert.match(read('app.js'), /ctx\.fillStyle='#111111';ctx\.fillRect\(0,0,canvas\.width,canvas\.height\)/);
  assert.match(read('styles.css'), /canvas\{[^}]*background:#242424/);
});

test('Patch RGB values include a matching square swatch color', () => {
  const charts = read('charts.js');
  const start = charts.indexOf('function rgbPatchColor(');
  const end = charts.indexOf('\nfunction showChartHover', start);
  assert.ok(start >= 0 && end > start);
  const helper = vm.runInNewContext(`${charts.slice(start, end)}; rgbPatchColor`);
  assert.equal(helper([1, 0, 0.5]), '#ff0080');
  assert.equal(helper([0.25, 0.5, 0.75]), '#4080bf');
  assert.equal(helper(null), null);
  assert.match(charts, /className='patch-rgb-swatch'/);
});

test('cross-chart hover preserves the selected RGB channel but expands single-point sources to all channels', () => {
  const charts = read('charts.js');
  const start = charts.indexOf('function correspondingChartPoints(');
  const end = charts.indexOf('\nfunction showChartHover', start);
  assert.ok(start >= 0 && end > start);
  const helper = vm.runInNewContext(`${charts.slice(start, end)}; correspondingChartPoints`);
  const measuredPoint = {};
  const sourcePanel = { points: [] };
  const channels = ['R', 'G', 'B'].map(channel => ({ profileIndex: 2, q: measuredPoint, channel }));
  const candidatePanel = { type: 'balance', points: channels };
  assert.deepEqual(Array.from(helper(sourcePanel, channels[0], candidatePanel)), [channels[0]]);
  assert.deepEqual(Array.from(helper(sourcePanel, channels[1], candidatePanel)), [channels[1]]);
  assert.deepEqual(Array.from(helper(sourcePanel, { profileIndex: 2, q: measuredPoint }, candidatePanel)), channels);
});

test('a pinned Patch node keeps a prominent ring only while the pointer is in Patch', () => {
  const charts = read('charts.js');
  const start = charts.indexOf('function pinnedPointMatches(');
  const end = charts.indexOf('\nfunction updatePinnedChartRing', start);
  assert.ok(start >= 0 && end > start);
  const helper = vm.runInNewContext(`${charts.slice(start, end)}; pinnedPointMatches`);
  const q = {};
  const pinned = { point: { q, profileIndex: 3, channel: 'G' } };
  assert.equal(helper({ q, profileIndex: 3, channel: 'G' }, pinned), true);
  assert.equal(helper({ q, profileIndex: 3, channel: 'R' }, pinned), false);
  assert.equal(helper({ q, profileIndex: 4, channel: 'G' }, pinned), false);
  assert.match(charts, /if\(pinned&&chartHover\.patchHovered&&panel\.type&&!panel\.article\.hidden\)/);
  assert.match(charts, /for\(const panel of chartPanels\)/);
  assert.match(charts, /const rings=panel\.pinnedRings\|\|\(panel\.pinnedRings=\[\]\)/);
  assert.match(charts, /correspondingChartPoints\(pinned\.panel,pinned\.point,panel\)/);
  assert.match(read('app.js'), /setPinnedChartPatchHover\(detailView==='patch'&&patchDetailPanel\.matches\(':hover'\)\)/);
  assert.match(read('app.js'), /clearPinnedChartRing\(\)/);
});

test('clicking a chart point briefly shows visible feedback at the clicked node', () => {
  const charts = read('charts.js');
  assert.match(charts, /function showChartClickFeedback\(panel,point\)/);
  assert.match(charts, /clickFeedbackTimer=setTimeout\(\(\)=>\{ring\.hidden=true;chartHover\.clickFeedbackTimer=null\},500\)/);
  assert.match(charts, /if\(point\)showChartClickFeedback\(panel,point\)/);
});

test('workspace cards use neutral grayscale backgrounds', () => {
  assert.match(read('styles.css'), /\.charts article\{background:#2b2b2b/);
  assert.match(read('index.html'), /\.summary-column\{background:#2b2b2b/);
});

test('controls and hover states use neutral grayscale while the selected layout remains highlighted', () => {
  const styles = read('styles.css');
  const html = read('index.html');
  assert.match(styles, /button,select,input[^\n]*\{background-color:#343434[^\n]*border:1px solid #626262\}/);
  assert.match(styles, /\.chart-controls button:hover\{border-color:#858585;background:#3a3a3a/);
  assert.match(styles, /\.chart-layout-cell\.selected\{border-color:#91b5eb;background:#486d9c\}/);
  assert.match(html, /\.profile-color-picker-actions button:hover\{background:#414141\}/);
  assert.match(html, /\.note-toolbar button:hover\{background:#454545\}/);
  assert.match(html, /\.profile-list \.profile-item\.file-selected\{outline:1px solid #999;background:#484848\}/);
});

test('menu surfaces use neutral grayscale backgrounds', () => {
  const styles = read('styles.css');
  assert.match(styles, /\.chart-menu\{[^}]*background:#202020/);
  assert.match(styles, /\.chart-point-menu\{[^}]*background:#202020/);
  assert.match(styles, /\.workspace-clear-menu\{[^}]*background:#202020/);
  assert.match(styles, /\.settings-float-menu\{[^}]*background:#202020/);
});

test('Files rows have full-width neutral hover feedback', () => {
  const html = read('index.html');
  assert.match(html, /\.target-preset-item\{[^}]*align-self:stretch/);
  assert.match(html, /\.profile-list \.profile-item\{[^}]*align-self:stretch;width:auto/);
  assert.match(html, /\.profile-list \.profile-item:hover\{background:#3a3a3a\}/);
  assert.match(html, /\.profile-folder-heading:hover\{background:#3a3a3a\}/);
  assert.match(html, /\.profile-category-heading:hover[^}]*background:#3a3a3a/);
  assert.match(html, /\.profile-list \.profile-item:focus-within:has\(:focus-visible\)\{background:#3a3a3a\}/);
});

test('Files profile focus highlight follows actual hover or keyboard focus, not default profile', () => {
  const app = read('app.js');
  const start = app.indexOf('function showProfileDetails(');
  const end = app.indexOf('\nfunction assignProfilePanel', start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(app.slice(start, end), /classList\.toggle\('active'/);
  assert.match(read('index.html'), /\.profile-list \.profile-item:focus-within:has\(:focus-visible\)\{background:#3a3a3a\}/);
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

test('RGB Balance plots zero-XYZ black at the selected white point and reports target Yxy', () => {
  const charts = read('charts.js');
  const start = charts.indexOf('function rgbBalanceChroma');
  const end = charts.indexOf('\nfunction drawBalancePanel', start);
  assert.ok(start >= 0 && end > start);
  const helpers = vm.runInNewContext(`${charts.slice(start, end)}; ({ rgbBalanceChroma, rgbBalanceValues });`);
  const whitePoint = { x: 0.3127, y: 0.329 };
  const black = { X: 0, Y: 0, Z: 0 };
  const chroma = Array.from(helpers.rgbBalanceChroma(black, whitePoint));
  assert.ok(chroma.every((value, index) => Math.abs(value - [whitePoint.x, whitePoint.y, 1 - whitePoint.x - whitePoint.y][index]) < 1e-12));
  assert.deepEqual(Array.from(helpers.rgbBalanceValues(black, whitePoint, [], 0, true)), [0, 0, 0]);
  assert.match(charts, /\[0,targetWhite\.x,targetWhite\.y\]\.map\(n\)\.join\(', '\)/);
  assert.match(charts, /\?\[0,0,0\]\.map\(n\)\.join\(', '\):yxy\(actual\)/);
});

test('Delta-E grayscale includes zero-XYZ black patches', () => {
  const charts = read('charts.js');
  const panel = charts.slice(charts.indexOf('function drawDeltaEPanel'), charts.indexOf('function graph3DCoordinates'));
  assert.match(panel, /filter\(q=>Math\.abs\(q\.r-q\.g\)<\.002&&Math\.abs\(q\.g-q\.b\)<\.002\)/);
  assert.doesNotMatch(panel, /q\.X\+q\.Y\+q\.Z>1e-12/);
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
