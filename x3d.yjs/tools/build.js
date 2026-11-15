import { build } from 'esbuild'
await build({ entryPoints: { yx3d: 'src/browser.js' }, bundle: true, format: 'esm', outdir: 'demo/dist', minify: true, sourcemap: false, legalComments: 'none' })
console.log('built demo/dist/yx3d.js')
