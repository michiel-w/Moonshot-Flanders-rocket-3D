import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

// single-file, double-clickable build (works from file://)
await build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  minify: false,
  format: 'iife',
  outfile: path.join(dist, 'bundle.js'),
  logLevel: 'warning',
  // lil-gui is imported via relative path ../lib, keep as is
});

const bundle = fs.readFileSync(path.join(dist, 'bundle.js'), 'utf8');
const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rocket 3D — editable</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
  canvas { display: block; }
  .hint { position: fixed; left: 10px; bottom: 8px; font: 12px/1.4 system-ui, sans-serif;
          color: #456; opacity: .75; pointer-events: none; user-select: none; }
</style>
</head>
<body>
<div class="hint">drag to orbit &middot; scroll to zoom &middot; edit the PARAMS block at the top of the script (or use the panel) and reload</div>
<script>
// ============================================================================
//  EDITABLE: tweak the "const PARAMS" object below (colors / shape / toggles)
//  and reload this page. Or use the on-screen editor panel (top right).
// ============================================================================
${bundle}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(dist, 'rocket.html'), html);

// editable multi-file project: index.html + lib/ + src/
const lib = path.join(dist, 'lib');
fs.mkdirSync(lib, { recursive: true });
fs.copyFileSync(path.join(root, 'node_modules/three/build/three.module.js'), path.join(lib, 'three.module.js'));
fs.mkdirSync(path.join(lib, 'controls'), { recursive: true });
fs.copyFileSync(path.join(root, 'node_modules/three/examples/jsm/controls/OrbitControls.js'), path.join(lib, 'controls/OrbitControls.js'));
fs.copyFileSync(path.join(root, 'node_modules/lil-gui/dist/lil-gui.esm.js'), path.join(lib, 'lil-gui.esm.js'));
fs.mkdirSync(path.join(dist, 'src'), { recursive: true });
fs.copyFileSync(path.join(root, 'src/main.js'), path.join(dist, 'src/main.js'));

const index = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rocket 3D — editable</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
  canvas { display: block; }
  .hint { position: fixed; left: 10px; bottom: 8px; font: 12px/1.4 system-ui, sans-serif;
          color: #456; opacity: .75; pointer-events: none; user-select: none; }
</style>
<script type="importmap">
{ "imports": { "three": "./lib/three.module.js",
               "three/examples/jsm/controls/OrbitControls.js": "./lib/controls/OrbitControls.js",
               "lil-gui": "./lib/lil-gui.esm.js" } }
</script>
</head>
<body>
<div class="hint">drag to orbit &middot; scroll to zoom &middot; edit src/main.js PARAMS (or use the panel)</div>
<script type="module" src="./src/main.js"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(dist, 'index.html'), index);
fs.copyFileSync(path.join(root, 'build.mjs'), path.join(dist, 'build.mjs'));
console.log('built dist/rocket.html (single file) and dist/index.html (editable project)');
