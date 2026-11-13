// Copies the X_ITE 16.7.0 runtime (with its RigidBodyPhysics/ammo.js component) and licences into public/vendor/x_ite.
import { cp, mkdir, copyFile } from 'node:fs/promises';
const src = 'node_modules/x_ite/dist', dest = 'public/vendor/x_ite';
await mkdir(dest, { recursive: true });
for (const name of ['x_ite.min.js', 'x_ite.js', 'x_ite.css', 'LICENSE.md']) await copyFile(`${src}/${name}`, `${dest}/${name}`);
await cp(`${src}/assets`, `${dest}/assets`, { recursive: true });
await cp('node_modules/x_ite/LICENSES', `${dest}/LICENSES`, { recursive: true });
console.log('vendored X_ITE runtime and licences to', dest);
