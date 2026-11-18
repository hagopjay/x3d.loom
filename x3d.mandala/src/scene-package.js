import {YANTRA,GEOMETRY_CERTIFICATE as C} from './yantra-data.js';
import {buildScene} from './scene.js';
export function createArtwork({quality='high'}={}){
  const result=buildScene(YANTRA,{quality});
  const provenance=`<meta name="canonicalGeometrySHA256" content="${C.canonicalJsonSha256}"/><meta name="canonicalConstruction" content="Concentric Huet-family; Decimal100; 43 odd-coverage triangular chambers"/><meta name="canonicalFloat64ToleranceR" content="1e-12"/><meta name="float32QuantizationToleranceR" content="1e-7"/>`;
  result.xml=result.xml.replace('</head>',provenance+'</head>');
  result.stats.bytes=new TextEncoder().encode(result.xml).length;
  return result;
}
