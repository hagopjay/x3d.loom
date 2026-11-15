# x3d.zod: typed X3D for checkable LLM output

> X3D is the 3D format an AI can be held accountable to. This folder makes that sentence executable in TypeScript: the Web3D X3D 4.0
> JSON Schema, generated into Zod 4 schemas and TS types, plus a node-restricted schema for constrained decoding.

```text
  Web3D x3d-4.0-JSONSchema.json (sha1 c6765a4, Draft 2020-12, 364 defs, 261 scene nodes)
        |  + in-memory fix: NavigationInfo.@type is an MFString typed "string"   (same fix as x3d_mcp validate.py)
        v
  tools/gen.mjs ---> src/generated/x3d.zod.ts   Zod 4 schemas (z.strictObject, z.union, z.tuple) + 364 explicit TS types
        |                      |
        |                      +--> src/index.ts      validateX3DJson, parseLlmX3D (fenced JSON), repairPrompt, issue paths
        |                                              in the x3d_mcp format ("X3D/Scene/-children/0/Shape/...")
        +--> src/restrict.ts     restrictSchema(schema, {nodes, lean}) -> a JSON Schema for a chosen vocabulary
                                 (same transform as x3d_mcp src/validation/llm_schema.py and its x3d_json_schema tool)
```

## Run

```bash
cd x3d.zod && npm install
npm run gen         # regenerate src/generated/x3d.zod.ts and receipts/gen.json
npm run typecheck   # tsc: the 364 explicit types and the Zod schemas must agree
npm test            # node --test (Node >= 22.18 strips types, no build step)
```

Corpus run (every `.x3d` in the project repos, XML converted to JSON with the schema's own typing, then judged by four validators):

```bash
python3 tools/corpus.py /tmp/zod-corpus <repo-dir> [<repo-dir> ...]     # needs x3d_mcp/src on X3D_MCP_SRC, lxml, jsonschema
python3 tools/report.py                                                  # receipts/corpus-summary.json
```

## Use

```ts
import { parseLlmX3D, repairPrompt } from './src/index.ts';
const r = parseLlmX3D(modelText);                 // accepts a fenced ```json block or bare JSON
if (!r.ok) retry(repairPrompt(r.issues));         // paths and messages the model can act on
```

```ts
import { restrictSchema } from './src/restrict.ts';
const schema = restrictSchema(fullSchema, { nodes: ['Transform', 'Shape', 'Box', 'Material', 'Appearance'], lean: true });
// hand `schema` to a structured-output / constrained-decoding API, then check the result with parseLlmX3D
```

Test ids use the prefix `zod-` (`zod-g01` accepted documents, `zod-b01` rejected ones, `zod-001`.. structural checks).

## What this is not

It checks the JSON encoding against the Web3D schema. It does not check ROUTE targets, DEF/USE order, containerField sense or profile
declarations (the x3d_mcp semantic rules and the XSD still own those), and it never calls a model.
