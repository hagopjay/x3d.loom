// d3-x3d DEF hygiene (from x3d.demo d3-bridge v2.2, tools/x3d3.mjs).
// Run it on finished X3D XML. A DEF is kept only if the file USEs it, a ROUTE names it, or pageNames matches it
// (names the host page reaches through SAI getNamedNode). Page names get <EXPORT> so a checker sees them as referenced.
// Also swaps the empty-Group far level of a label LOD for a WorldInfo, which draws nothing and does not warn.
export function defHygiene(xml, pageNames = /^$/) {
  xml = xml.replaceAll('<Group/></LOD>', `<WorldInfo info='"far level: label hidden"'/></LOD>`);
  const refs = new Set();
  for (const m of xml.matchAll(/\bUSE='([^']+)'/g)) refs.add(m[1]);
  for (const m of xml.matchAll(/\b(?:fromNode|toNode)='([^']+)'/g)) refs.add(m[1]);
  const stats = { kept: 0, stripped: 0, exported: [] };
  const out = xml.replace(/ DEF='([^']+)'/g, (m, name) => {
    if (refs.has(name)) { stats.kept++; return m; }
    if (pageNames.test(name)) { stats.kept++; stats.exported.push(name); return m; }
    stats.stripped++; return '';
  });
  const exp = stats.exported.map(n => `<EXPORT localDEF='${n}' AS='${n}'/>`).join('\n    ');
  return { xml: exp ? out.replace('\n  </Scene>', `\n    ${exp}\n  </Scene>`) : out, stats };
}
