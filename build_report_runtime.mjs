import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(directory, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const scriptPaths = [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map(match => match[1]);
const scripts = scriptPaths.filter(src => src !== 'demo_profiles.js').map(src => ({ src, code: fs.readFileSync(path.join(directory, src), 'utf8') }));
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(code => code.trim());
const runtime = {
  css: fs.readFileSync(path.join(directory, 'styles.css'), 'utf8'),
  scripts,
  inlineScripts,
};
const safeJson = JSON.stringify(runtime).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const block = `<script id="viewer-report-runtime" type="application/json">${safeJson}</script>`;
const withoutOldBlock = html.replace(/\s*<script id="viewer-report-runtime" type="application\/json">[\s\S]*?<\/script>/, '');
const insertionPoint = withoutOldBlock.search(/<script\s+src="/);
if (insertionPoint < 0) throw new Error('Could not find the app script list in index.html.');
html = withoutOldBlock.slice(0, insertionPoint) + block + '\n' + withoutOldBlock.slice(insertionPoint);
fs.writeFileSync(indexPath, html);
