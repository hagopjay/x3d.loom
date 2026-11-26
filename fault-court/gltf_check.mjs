import { readFileSync } from 'node:fs';
import validator from 'gltf-validator';
import path from 'node:path';
const f = process.argv[2];
const r = await validator.validateBytes(new Uint8Array(readFileSync(f)), { uri: f, maxIssues: 200,
  externalResourceFunction: (uri) => new Promise((res, rej) => { try { res(new Uint8Array(readFileSync(path.join(path.dirname(f), decodeURIComponent(uri))))); } catch (e) { rej(e.toString()); } }) });
console.log(JSON.stringify({ tool: `Khronos glTF-Validator ${r.validatorVersion}`, messages: r.issues.messages.map(m => ({ code: m.code, pointer: m.pointer, severity: m.severity, message: m.message })) }));
