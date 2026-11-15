// Node-restricted JSON Schema for constrained decoding: keep the Web3D schema's structure but allow
// only a chosen node vocabulary, so a model cannot emit a node outside it and the prompt stays small.
type J = Record<string, any>;

/** Defs that carry a USE form, i.e. scene nodes; every other def (head, meta, ROUTE, IS...) is structural and always kept. */
export const nodeDefNames = (schema: J): string[] =>
  Object.entries<J>(schema.$defs)
    .filter(([k, d]) => !/^[-@]/.test(k) && JSON.stringify(d).includes('"@USE"'))
    .map(([k]) => k);

export interface RestrictOptions {
  /** scene node names to allow (USE form comes with them) */
  nodes: string[];
  /** drop @class/@id/@style, #comment, IS, -metadata, defaults and $comment to cut tokens */
  lean?: boolean;
}

const LEAN_KEYS = new Set(['@class', '@id', '@style', 'IS', '-metadata', '#comment']);

/**
 * Pass the schema with the NavigationInfo.@type correction already applied (loadFixedSchema does): lean mode
 * deletes the $comment the correction keys on, so correcting after restricting does nothing.
 * Lean mode also drops -metadata, @style, IS and #comment: documents using them are rejected, and ProtoDeclare
 * bodies that wire fields with IS cannot be expressed. Use lean=false when a model must write those.
 */
export function restrictSchema(schema: J, opt: RestrictOptions): J {
  const out = structuredClone(schema) as J;
  const allowed = new Set(opt.nodes);
  const nodeNames = new Set(nodeDefNames(out));
  // same rule as x3d_mcp llm_schema.py: a typo must not silently shrink the vocabulary
  const unknown = [...allowed].filter((n) => !nodeNames.has(n)).sort();
  if (unknown.length) throw new Error(`not X3D 4.0 scene nodes: ${unknown.join(', ')}`);
  const walk = (n: any): void => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n === null || typeof n !== 'object') return;
    if (n.properties) {
      for (const k of Object.keys(n.properties)) {
        if ((nodeNames.has(k) && !allowed.has(k)) || (opt.lean && LEAN_KEYS.has(k))) delete n.properties[k];
      }
      if (n.required) n.required = n.required.filter((k: string) => k in n.properties);
    }
    if (opt.lean) { delete n.$comment; delete n.default; delete n.description; }
    Object.values(n).forEach(walk);
  };
  walk(out.$defs); walk(out.properties);
  // prune unreachable defs
  const seen = new Set<string>();
  const visit = (n: any): void => {
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if (n === null || typeof n !== 'object') return;
    if (typeof n.$ref === 'string') {
      const name = n.$ref.replace('#/$defs/', '');
      if (!seen.has(name)) { seen.add(name); visit(out.$defs[name]); }
    }
    Object.values(n).forEach(visit);
  };
  visit(out.properties);
  for (const k of Object.keys(out.$defs)) if (!seen.has(k)) delete out.$defs[k];
  return out;
}
