// What a profile promises, apart from how it does it (no glTF-Transform imports, so the page can load it for free).
//   identity  'exact' every x3d_* tag, name and extras token survives (lost 0, added 0)
//             'mapped' tags survive inside `extras.x3d_instances` of a batch node (lost 0); the batch nodes are new
//             'lossy'  tags may be lost; the loss is counted and shown, never hidden
//   geometry  'exact' centroids identical within 1e-7 of the scene diagonal (one float32 ULP is 1.19e-7); 'bits:N' quantised: within 2^-(N-1) of the diagonal
//             Why not 0: a node that stores a 4x4 `matrix` (the Castle exporter does) is decomposed to translation/rotation/scale by glTF-Transform on read,
//             and its writer snaps a scale within float32 noise of 1 to the default. That moved the Castle annotation-standard glb by 2.19e-9 of its diagonal (measured).
export function boundsForGeometry(spec) { const m = /^bits:(\d+)$/.exec(spec); return m ? { bits: +m[1], relMax: 2 ** -(+m[1] - 1) } : { bits: null, relMax: 1e-7 }; }
