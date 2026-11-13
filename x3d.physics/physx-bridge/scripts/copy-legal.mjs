// Copy the licence texts and THIRD_PARTY_NOTICES.md into dist/legal (they travel with the built app).
import { cp, mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/legal', { recursive: true });
await cp('licenses', 'dist/legal/licenses', { recursive: true });
await copyFile('THIRD_PARTY_NOTICES.md', 'dist/legal/THIRD_PARTY_NOTICES.md');
console.log('copied licences and notices to dist/legal');
