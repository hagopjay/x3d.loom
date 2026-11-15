// Public surface of x3d.zod: the generated Zod schema plus checkable-LLM-output helpers.
import { z } from 'zod';
import { X3DJson, defs, NODE_NAMES, type X3DJsonDocument } from './generated/x3d.zod.ts';

export { X3DJson, defs, NODE_NAMES };
export type { X3DJsonDocument };

export interface X3DIssue { path: string; code: string; message: string }
export type X3DResult = { ok: true; value: X3DJsonDocument } | { ok: false; issues: X3DIssue[] };

const fmtPath = (p: PropertyKey[]) => (p.length ? p.map(String).join('/') : '(root)');

/**
 * Same path format as x3d_mcp validate_json ("X3D/Scene/-children/0/Shape/..."), so reports line up.
 *
 * Every X3D node is a union of a USE arm and a definition arm, and Zod reports a failed union as one opaque
 * "Invalid input". We open each union and keep the arm the document was trying to be: not the USE arm (unless
 * @USE is present), then the arm that got deepest, then the one with the fewest complaints.
 */
export function toIssues(error: z.ZodError): X3DIssue[] {
  const out: X3DIssue[] = [];
  for (const i of error.issues) out.push(...expand(i as Raw, []));
  return out;
}
type Raw = z.core.$ZodIssue & { errors?: Raw[][] };

function expand(i: Raw, parent: PropertyKey[]): X3DIssue[] {
  const abs = parent.concat(i.path);
  if (i.code === 'invalid_union' && i.errors?.length) {
    const arms = i.errors.map((arm) => arm.flatMap((j) => expand(j, abs)));
    const cost = (a: X3DIssue[]) => [a.some((x) => x.path.endsWith('/@USE') && /undefined/.test(x.message)) ? 1 : 0, -Math.max(0, ...a.map((x) => x.path.split('/').length)), a.length];
    const best = arms.filter((a) => a.length).sort((x, y) => { const cx = cost(x), cy = cost(y); return cx[0] - cy[0] || cx[1] - cy[1] || cx[2] - cy[2]; })[0];
    if (best) return best;
  }
  return [{ path: fmtPath(abs), code: i.code, message: i.message }];
}

export function validateX3DJson(input: unknown): X3DResult {
  let r;
  try { r = X3DJson.safeParse(input); }
  catch (e) {
    // Zod validates by recursive descent; a scene nested about 115 Transforms deep (Node 22 default stack) overflows it.
    // That is "could not check", not "invalid": say so, and let the caller use an iterative validator (ajv, jsonschema).
    if (e instanceof RangeError) return { ok: false, issues: [{ path: '(root)', code: 'stack_depth', message: 'document nests too deeply for the Zod validator; not checked' }] };
    throw e;
  }
  return r.success ? { ok: true, value: r.data } : { ok: false, issues: toIssues(r.error) };
}

/** Parse LLM text (optionally fenced) and validate; the retry prompt is built from issues. */
export function parseLlmX3D(text: string): X3DResult {
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  let data: unknown;
  try { data = JSON.parse((m ? m[1] : text).trim()); }
  catch (e) { return { ok: false, issues: [{ path: '(root)', code: 'json_parse', message: String((e as Error).message) }] }; }
  return validateX3DJson(data);
}

export function repairPrompt(issues: X3DIssue[], max = 12): string {
  const shown = issues.slice(0, max).map((i) => `- ${i.path}: ${i.message}`).join('\n');
  const more = issues.length > max ? `\n(+${issues.length - max} more)` : '';
  return `The X3D JSON failed validation against the Web3D X3D 4.0 JSON Schema:\n${shown}${more}\nReturn the complete corrected document only.`;
}
