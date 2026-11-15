// Browser entry for the demo bundle: everything a page needs to check and restrict X3D JSON, no Node APIs.
export { validateX3DJson, parseLlmX3D, repairPrompt, toIssues, NODE_NAMES } from './index.ts';
export { restrictSchema, nodeDefNames } from './restrict.ts';
