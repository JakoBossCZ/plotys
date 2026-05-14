// ============================================================
// PLOTYS - DIAGNOSTIKA OBRÁZKŮ
// Spuštění: node check-images.js
// ============================================================
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;

// ── Helpers ──────────────────────────────────────────────────

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

// Extract every "image": "..." value from arbitrary text
function extractImagePaths(text) {
  const found = new Set();
  const re = /"image"\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const p = m[1].trim();
    if (p) found.add(p);
  }
  return found;
}

// ── Collect paths from both data sources ─────────────────────

const allPaths = new Set();

// 1) database.json  (plain JSON)
try {
  const raw = fs.readFileSync(path.join(ROOT, 'database.json'), 'utf8');
  extractImagePaths(raw).forEach(p => allPaths.add(p));
} catch (e) { console.error('❌ Nelze číst database.json:', e.message); }

// 2) data.js  (JS file – extract with regex, same pattern)
try {
  const raw = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
  extractImagePaths(raw).forEach(p => allPaths.add(p));
} catch (e) { console.error('❌ Nelze číst data.js:', e.message); }

// ── Check every path against disk ────────────────────────────

const ok        = [];
const wrongDir  = [];   // exists, but under images/images/ instead of images/
const missing   = [];

for (const imgPath of [...allPaths].sort()) {
  if (exists(imgPath)) {
    ok.push(imgPath);
    continue;
  }

  // Check the "double images" variant
  const doubled = imgPath.replace(/^images\//, 'images/images/');
  if (doubled !== imgPath && exists(doubled)) {
    wrongDir.push({ wanted: imgPath, found: doubled });
    continue;
  }

  // Check without "images/" prefix (file in project root)
  const bare = imgPath.replace(/^images\//, '');
  if (bare !== imgPath && exists(bare)) {
    wrongDir.push({ wanted: imgPath, found: bare });
    continue;
  }

  missing.push(imgPath);
}

// ── Report ────────────────────────────────────────────────────

const hr = '─'.repeat(60);

console.log('\n' + hr);
console.log('  PLOTYS – DIAGNOSTIKA OBRÁZKŮ');
console.log(hr);

// OK
console.log(`\n✅  NALEZENO  (${ok.length})`);
ok.forEach(p => console.log(`    ✓ ${p}`));

// Wrong location
if (wrongDir.length) {
  console.log(`\n⚠️   ŠPATNÉ MÍSTO – soubor existuje, ale jinde  (${wrongDir.length})`);
  wrongDir.forEach(({ wanted, found }) => {
    console.log(`    ✗ hledám : ${wanted}`);
    console.log(`    ✓ nalezeno: ${found}`);
    console.log('');
  });

  console.log('  💡 Soubory jsou v images/images/ místo images/');
  console.log('  💡 Oprava – spusťte tento PowerShell příkaz (z projektu):');
  console.log('');
  console.log('  $src = "images\\images"; $dst = "images"');
  console.log('  Get-ChildItem $src -Recurse -File | ForEach-Object {');
  console.log('    $rel  = $_.FullName.Substring((Resolve-Path $src).Path.Length + 1)');
  console.log('    $dest = Join-Path $dst $rel');
  console.log('    New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null');
  console.log('    Copy-Item $_.FullName $dest -Force');
  console.log('  }');
  console.log('');
}

// Missing
if (missing.length) {
  console.log(`\n❌  CHYBÍ NA DISKU  (${missing.length})`);
  missing.forEach(p => console.log(`    ✗ ${p}`));
} else {
  console.log('\n✅  Žádné soubory nechybí (nebo jsou na špatném místě – viz výše).');
}

console.log('\n' + hr);
console.log(`  Celkem cest: ${allPaths.size}  |  OK: ${ok.length}  |  Špatné místo: ${wrongDir.length}  |  Chybí: ${missing.length}`);
console.log(hr + '\n');
