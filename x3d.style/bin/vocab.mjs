#!/usr/bin/env node
// Generate the ontology files from the grammar itself, so they cannot drift apart:
//   vocab/xst.context.jsonld   JSON-LD 1.1 context for style documents
//   vocab/xst.ttl              OWL + SKOS vocabulary (classes, token properties, roles, rules, operators, X3D bindings)
//   vocab/xst.shapes.ttl       SHACL shapes: the structural half of the grammar (rule G1) for any RDF tool
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARTS, ROLES, NS, VERSION, lint, THRESHOLDS } from '../src/grammar.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'styles/authored.jsonld'), 'utf8'))['@graph'];
const Cap = s => s[0].toUpperCase() + s.slice(1);
const X3DO = 'https://www.web3d.org/specifications/X3dOntology4.0#';
const BIND = { palette: ['Color', 'Background', 'Fog'], surface: ['UnlitMaterial', 'Material', 'PhysicalMaterial'], light: ['DirectionalLight'], air: ['Fog', 'Background'],
  line: ['IndexedLineSet', 'LineProperties'], form: ['IndexedFaceSet'], type: ['Text', 'FontStyle'], motion: ['TimeSensor', 'ColorInterpolator', 'PositionInterpolator'], encode: ['MetadataSet'], view: ['Viewpoint', 'OrthoViewpoint'] };
const SAYS = { palette: 'Which colours exist, and which role each one serves.', surface: 'How a body answers light: unlit, Phong or physical, and how much of the data colour it carries.',
  light: 'Where light comes from, how hard, and how much contact shade is baked in.', air: 'What lies between the eye and the far masses: fog and its reach.',
  line: 'What is drawn as line: edges, links, ground ornament.', form: 'The shape of a mass: sides, taper, tiers, cap.', type: 'How labels are set.', motion: 'What moves, and how fast.',
  encode: 'Which data channel drives which visual channel.', view: 'How the scene is first looked at.' };

// ---- context
const ctx = { '@version': 1.1, xst: NS, rdfs: 'http://www.w3.org/2000/01/rdf-schema#', xsd: 'http://www.w3.org/2001/XMLSchema#', prov: 'http://www.w3.org/ns/prov#', dct: 'http://purl.org/dc/terms/',
  Style: 'xst:Style', Catalogue: 'xst:Catalogue', label: 'rdfs:label', lineage: 'dct:description', operator: 'xst:operator', authoredScore: { '@id': 'xst:authoredScore', '@type': 'xsd:double' },
  derivedFrom: { '@id': 'prov:wasDerivedFrom', '@type': '@id' },
  intent: { '@id': 'xst:intent', '@context': { key: 'xst:intent_key', mood: 'xst:intent_mood', use: 'xst:intent_use' } } };
for (const [part, toks] of Object.entries(PARTS)) {
  const c = {};
  for (const [tok, kind] of Object.entries(toks)) c[tok] = kind === 'colors' ? { '@id': `xst:${part}_${tok}`, '@container': '@list' } : kind === 'color' || Array.isArray(kind) ? `xst:${part}_${tok}` : { '@id': `xst:${part}_${tok}`, '@type': 'xsd:double' };
  ctx[part] = { '@id': `xst:${part}`, '@context': c };
}
fs.mkdirSync(path.join(ROOT, 'vocab'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'vocab/xst.context.jsonld'), JSON.stringify({ '@context': ctx }, null, 1));

// ---- vocabulary
const q = s => JSON.stringify(String(s));
let t = `@prefix xst: <${NS}> .\n@prefix owl: <http://www.w3.org/2002/07/owl#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n@prefix skos: <http://www.w3.org/2004/02/skos/core#> .\n@prefix dct: <http://purl.org/dc/terms/> .\n@prefix prov: <http://www.w3.org/ns/prov#> .\n@prefix x3do: <${X3DO}> .\n\n`;
t += `<${NS.slice(0, -1)}> a owl:Ontology ; dct:title "X3D style vocabulary and grammar" ; owl:versionInfo ${q(VERSION)} ;\n  dct:description "Style tokens (10 parts of speech), scene roles, grammar rules and operators for styling X3D scenes. Generated from x3d.loom x3d.style/src/grammar.mjs by bin/vocab.mjs." .\n\n`;
t += `xst:Style a owl:Class ; rdfs:label "Style" ; rdfs:comment "A complete sentence: one of each part of speech. Carried in X3D as a MetadataSet named xst:Style." ; rdfs:subClassOf prov:Entity .\nxst:Catalogue a owl:Class ; rdfs:label "Catalogue" .\nxst:Part a owl:Class ; rdfs:label "Part of speech" .\nxst:Scene a owl:Class ; rdfs:label "Scene" ; rdfs:comment "Roles and data only: no colour, material or light." .\n`;
t += `xst:realizedBy a owl:ObjectProperty ; rdfs:label "realized by" ; rdfs:comment "The X3D 4.0 node types (X3D Ontology) a part of speech is compiled to." .\nxst:intent a owl:ObjectProperty ; rdfs:domain xst:Style .\nxst:intent_key a owl:DatatypeProperty ; rdfs:comment "Declared key: low, mid or high. Rule G14 holds the palette to it; the render receipt holds the frame to it." .\nxst:intent_mood a owl:DatatypeProperty .\nxst:intent_use a owl:DatatypeProperty .\nxst:operator a owl:DatatypeProperty ; rdfs:comment "The operator that derived this style; the sources are prov:wasDerivedFrom." .\nxst:authoredScore a owl:DatatypeProperty .\n\n`;
for (const [part, toks] of Object.entries(PARTS)) {
  t += `xst:${Cap(part)} a owl:Class ; rdfs:subClassOf xst:Part ; rdfs:label ${q(Cap(part))} ; rdfs:comment ${q(SAYS[part])} ;\n  xst:realizedBy ${BIND[part].map(n => `x3do:${n}`).join(', ')} .\n`;
  t += `xst:${part} a owl:ObjectProperty, owl:FunctionalProperty ; rdfs:domain xst:Style ; rdfs:range xst:${Cap(part)} .\n`;
  for (const [tok, kind] of Object.entries(toks)) {
    const range = kind === 'colors' ? 'rdf:List' : kind === 'color' || Array.isArray(kind) ? 'xsd:string' : 'xsd:double';
    t += `xst:${part}_${tok} a owl:DatatypeProperty ; rdfs:domain xst:${Cap(part)} ; rdfs:range ${range} ; rdfs:label ${q(`${part}.${tok}`)} ; skos:notation ${q(`xst:${part}_${tok}`)}${Array.isArray(kind) ? ` ; skos:scopeNote ${q('one of: ' + kind.join(', '))}` : kind === 'unit' ? ' ; skos:scopeNote "0..1"' : kind === 'color' ? ' ; skos:scopeNote "sRGB hex colour"' : kind === 'colors' ? ' ; skos:scopeNote "ordered list of sRGB hex colours"' : ''} .\n`;
  }
  t += '\n';
}
t += `xst:Roles a skos:ConceptScheme ; rdfs:label "Scene roles" ; rdfs:comment "What a style may address. A scene group carries its role as MetadataString name='xst:role'." .\nxst:role a owl:DatatypeProperty ; rdfs:comment "The role of a scene group." .\n`;
for (const r of ROLES) t += `xst:role_${r} a skos:Concept ; skos:inScheme xst:Roles ; skos:prefLabel ${q(r)} ; skos:notation ${q(r)} .\n`;
t += `\nxst:Rule a owl:Class ; rdfs:label "Grammar rule" .\nxst:Rules a skos:ConceptScheme ; rdfs:label "Grammar ${VERSION}" .\n`;
for (const r of lint(cat[0]).rules) t += `xst:${r.id} a xst:Rule, skos:Concept ; skos:inScheme xst:Rules ; skos:notation ${q(r.id)} ; skos:prefLabel ${q(r.name)} ; skos:definition ${q(r.need)} .\n`;
t += `\nxst:Operator a owl:Class ; rdfs:label "Style operator" ; rdfs:subClassOf prov:Activity .\n`;
for (const [o, d] of Object.entries({ transpose: 'Keep the structure of one style, take the palette and key of another.', mix: 'Interpolate two styles: numbers and colours blend in OKLab, words switch at one half.', invert: 'Flip the OKLab lightness of every palette colour and reverse the declared key.', repair: 'Move palette lightness the smallest distance that makes the grammar pass.' }))
  t += `xst:op_${o} a xst:Operator ; skos:prefLabel ${q(o)} ; skos:definition ${q(d)} .\n`;
fs.writeFileSync(path.join(ROOT, 'vocab/xst.ttl'), t);

// ---- shapes
const HEX = '^#[0-9a-fA-F]{6}$';
let s = `@prefix xst: <${NS}> .\n@prefix sh: <http://www.w3.org/ns/shacl#> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n\n`;
s += `xst:StyleShape a sh:NodeShape ; sh:targetClass xst:Style ;\n  sh:property [ sh:path rdfs:label ; sh:minCount 1 ] ;\n  sh:property [ sh:path ( xst:intent xst:intent_key ) ; sh:minCount 1 ; sh:in ( "low" "mid" "high" ) ] ;\n`
  + Object.keys(PARTS).map(p => `  sh:property [ sh:path xst:${p} ; sh:minCount 1 ; sh:maxCount 1 ; sh:node xst:${Cap(p)}Shape ; sh:message "G1: a style needs exactly one ${p}" ]`).join(' ;\n') + ' .\n\n';
for (const [part, toks] of Object.entries(PARTS)) {
  s += `xst:${Cap(part)}Shape a sh:NodeShape ;\n` + Object.entries(toks).map(([tok, kind]) => {
    const p = `xst:${part}_${tok}`;
    if (kind === 'color') return `  sh:property [ sh:path ${p} ; sh:minCount 1 ; sh:maxCount 1 ; sh:pattern "${HEX}" ]`;
    if (kind === 'colors') return `  sh:property [ sh:path ${p} ; sh:minCount 1 ; sh:maxCount 1 ] ;\n  sh:property [ sh:path ( ${p} [ sh:zeroOrMorePath rdf:rest ] rdf:first ) ; sh:minCount 2 ; sh:pattern "${HEX}" ]`;
    if (Array.isArray(kind)) return `  sh:property [ sh:path ${p} ; sh:minCount 1 ; sh:maxCount 1 ; sh:in ( ${kind.map(q).join(' ')} ) ]`;
    const lim = kind === 'unit' ? ' ; sh:minInclusive 0 ; sh:maxInclusive 1' : kind === 'signed' ? ' ; sh:minInclusive -1 ; sh:maxInclusive 1' : '';
    return `  sh:property [ sh:path ${p} ; sh:minCount 1 ; sh:maxCount 1 ; sh:datatype xsd:double${lim} ]`;
  }).join(' ;\n') + ' .\n\n';
}
fs.writeFileSync(path.join(ROOT, 'vocab/xst.shapes.ttl'), s);
console.log('vocab written:', ['xst.context.jsonld', 'xst.ttl', 'xst.shapes.ttl'].map(f => `${f} ${fs.statSync(path.join(ROOT, 'vocab', f)).size} B`).join(', '), '| thresholds', Object.keys(THRESHOLDS).length);
