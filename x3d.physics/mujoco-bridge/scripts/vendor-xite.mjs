import {cp,mkdir,copyFile} from 'node:fs/promises';
const src='node_modules/x_ite/dist',dest='public/vendor/x_ite';
await mkdir(dest,{recursive:true});
for(const name of ['x_ite.min.js','x_ite.css','LICENSE.md'])await copyFile(`${src}/${name}`,`${dest}/${name}`);
await cp(`${src}/assets`,`${dest}/assets`,{recursive:true});
await cp('node_modules/x_ite/LICENSES',`${dest}/LICENSES`,{recursive:true});
// Project licence files travel with the built app (dist/legal/).
await mkdir('public/legal',{recursive:true});
for(const name of ['LICENSE','NOTICE','THIRD_PARTY_NOTICES.txt'])await copyFile(name,`public/legal/${name}`);
console.log('Vendored X_ITE 16.7.0 runtime, assets and license notices; copied LICENSE, NOTICE, THIRD_PARTY_NOTICES.txt to public/legal.');
