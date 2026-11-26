// Static orphan call-site checker.
// Usage: node scripts/orphan-check.js <file.jsx>
// Lists identifiers that are USED (call/reference) but never DEFINED/imported in the same file,
// to catch ReferenceError like the loadShell bug after purging code.
const fs = require('fs');
const path = process.argv[2];
const src = fs.readFileSync(path, 'utf8');

// collect declarations: const/let/var NAME, function NAME, class NAME, import { A, B } / import NAME / import * as NAME
const declared = new Set();
let m;
const reDecl = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
while ((m = reDecl.exec(src))) declared.add(m[1]);
// destructuring: const { a, b } = ... ; const [a, b] = ...
const reDestruct = /(?:const|let|var)\s*\{([^}]*)\}\s*=/g;
while ((m = reDestruct.exec(src))) {
  m[1].split(',').forEach((p) => {
    const name = p.split(':').pop().trim().replace(/\s*=.*$/, '').trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
  });
}
const reDestructArr = /(?:const|let|var)\s*\[([^\]]*)\]\s*=/g;
while ((m = reDestructArr.exec(src))) {
  m[1].split(',').forEach((p) => {
    const name = p.trim().replace(/\s*=.*$/, '').trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
  });
}
const reFunc = /function\s+([A-Za-z_$][\w$]*)/g;
while ((m = reFunc.exec(src))) declared.add(m[1]);
const reClass = /class\s+([A-Za-z_$][\w$]*)/g;
while ((m = reClass.exec(src))) declared.add(m[1]);
const reImport = /import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?/g;
while ((m = reImport.exec(src))) {
  if (m[1]) declared.add(m[1]);
  if (m[2]) m[2].split(',').forEach((p) => {
    const name = p.split(' as ').pop().trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
  });
}
// arrow function props in destructure of component args, params etc — also catch (a, b) => and {x} params
const reParams = /\(\s*\{([^}]*)\}\s*\)/g;
while ((m = reParams.exec(src))) {
  m[1].split(',').forEach((p) => {
    const name = p.split(':').pop().trim().replace(/\s*=.*$/, '').trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
  });
}

// find identifiers used as bare function calls: name(
const used = new Map();
const reCall = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
while ((m = reCall.exec(src))) {
  const id = m[1];
  if (!used.has(id)) used.set(id, src.slice(0, m.index).split(/\r?\n/).length);
}

// JS/React builtins + globals to ignore
const ignore = new Set(['if','for','while','switch','catch','return','function','typeof','new','await','Promise','useState','useEffect','useMemo','useCallback','useRef','console','Array','Object','String','Number','Boolean','Math','JSON','Date','Intl','Set','Map','require','super','this','void','delete','in','of','case','do','else','try','finally','throw','filter','map','forEach','reduce','some','every','find','findIndex','push','join','split','slice','concat','includes','sort','keys','values','entries','from','of','test','replace','trim','toFixed','then','catch','format','formatToParts','parse','stringify','isArray','isNaN','setTimeout','setInterval','clearTimeout','clearInterval','addEventListener','removeEventListener','getElementById','querySelector','querySelectorAll','createElement','appendChild','remove','click','revokeObjectURL','createObjectURL','match','matchAll','padStart','padEnd','startsWith','endsWith','toLowerCase','toUpperCase','abs','round','floor','ceil','min','max','sign','now','getTime','toISOString','toLocaleString','toLocaleDateString','toLocaleTimeString','hasOwnProperty','assign','freeze','stringFromColumnIndex','open','close','load','reload','focus','blur','preventDefault','stopPropagation','addEventListener','requestAnimationFrame','alert','confirm','Blob','FileReader','FormData','URL','TextEncoder','TextDecoder','AbortController','structuredClone','queueMicrotask','process']);

const orphans = [];
for (const [id, line] of used) {
  if (declared.has(id) || ignore.has(id)) continue;
  orphans.push({ id, line });
}
if (orphans.length === 0) {
  console.log('OK: no orphan call-sites detected in', path);
} else {
  console.log('POSSIBLE ORPHANS in', path + ':');
  orphans.sort((a, b) => a.line - b.line).forEach((o) => console.log('  line ' + o.line + ': ' + o.id + '()'));
}
