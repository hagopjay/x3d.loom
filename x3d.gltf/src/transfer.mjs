// What a CDN would send: gzip -9 and brotli q11 of the whole file (Node only; the page uses CompressionStream for gzip).
// Meshopt is designed to be compressed again by the transport; Draco and KTX2 are not.
import zlib from 'node:zlib';

export function transferSizes(buf) {
  return {
    raw: buf.length,
    gzip: zlib.gzipSync(buf, { level: 9 }).length,
    brotli: zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } }).length,
  };
}
