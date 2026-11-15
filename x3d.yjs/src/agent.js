// LLM co-editor: an agent is just another Yjs peer. It speaks the same op vocabulary as the x3d_mcp
// scene tools (modify_node, add_node, remove_node, move_node: see x3d_mcp/src/tools/scene_ops.py) as JSON
// ops against DEF names, and each op is one tagged transaction, so a human sees it as a normal remote edit.
// The model proposes ops; this applier validates them (names must exist, fields must be strings) and
// reports per-op results, so a model that hallucinates a DEF gets an error back instead of corrupting the doc.
export const AGENT_TOOLS = [
  { name: 'modify_node', input: { def: 'string', fields: 'object<string,string>' } },
  { name: 'add_node', input: { parent: 'DEF|#scene', slot: 'string?', xml: 'string' } },
  { name: 'remove_node', input: { def: 'string' } },
  { name: 'move_node', input: { def: 'string', parent: 'DEF|#scene', slot: 'string?' } },
]
export function agentApply(xdoc, ops, agentId = 'agent') {
  const origin = 'agent:' + agentId, res = []
  const need = d => { if (d === '#scene') return '#scene'; const u = xdoc.findByDef(d); if (!u) throw new Error('no node DEF ' + d); return u }
  for (const op of ops) {
    try {
      if (op.op === 'modify_node') xdoc.setFields(need(op.def), op.fields, origin)
      else if (op.op === 'add_node') { const u = xdoc.addXML(op.xml, need(op.parent ?? '#scene'), op.slot ?? 'children', undefined, origin); res.push({ ok: true, uid: u }); continue }
      else if (op.op === 'remove_node') xdoc.remove(need(op.def), origin)
      else if (op.op === 'move_node') xdoc.move(need(op.def), need(op.parent), op.slot ?? 'children', undefined, origin)
      else throw new Error('unknown op ' + op.op)
      res.push({ ok: true })
    } catch (e) { res.push({ ok: false, error: e.message }) }
  }
  return res
}
