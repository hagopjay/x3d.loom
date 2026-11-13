import {ARM} from '../data/arm';
import {parseRecipe,type Recipe} from './contract';
/** Curated physical authoring profile. No inference of inertia from X3D shading. */
export function compileRecipe(input:Recipe):string{
 const r=parseRecipe(input);
 return ARM.xml
 .replace('size="0.08 0.055" rgba=', 'size="0.08 0.055" mass="0" rgba=')
 .replace('size="0.065 0.05" rgba=', 'size="0.065 0.05" mass="0" rgba=')
 .replace('pos="0.88 0.56 0.34" size="0.11"',`pos="${r.obstacle.position.join(' ')}" size="${r.obstacle.radius}"`)
 .replace('fromto="0 0 0 0.55 0 0"',`fromto="0 0 0 ${r.upperLength} 0 0"`)
 .replace('mass="0.65"',`mass="${r.upperMass}"`)
 .replace('pos="0.55 0 0"',`pos="${r.upperLength} 0 0"`)
 .replace('fromto="0 0 0 0.45 0 0"',`fromto="0 0 0 ${r.lowerLength} 0 0"`)
 .replace('mass="0.4"',`mass="${r.lowerMass}"`)
 .replaceAll('pos="0.45 0 0"',`pos="${r.lowerLength} 0 0"`);
}
