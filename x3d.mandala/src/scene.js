// Native X3D geometry only. Canonical triangle coordinates never change during
// animation: breathing is a single uniform similarity transform per layer.
const TAU=Math.PI*2;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const finite=x=>{if(!Number.isFinite(x))throw Error('SCENE_NONFINITE');return x;};
const numbers=a=>a.map(finite).join(' ');
const ornamentalNumbers=a=>a.map(x=>Number(finite(x).toPrecision(9))).join(' ');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const mf=s=>escape('"'+String(s).replaceAll('\\','\\\\').replaceAll('"','\\"')+'"').replaceAll("'",'&apos;');
const xyz=(p,z=0)=>[Number(p[0]),Number(p[1]),Number(p[2]??z)];
const polar=(r,a,z=0)=>[r*Math.cos(a),r*Math.sin(a),z];
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453123;return x-Math.floor(x);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);

export const SCENE_BINDINGS=Object.freeze({
  root:'SanctuaryStage',viewpoint:'SanctuaryCamera',yantraFront:'YantraFront',yantraBack:'YantraBack',
  frontSwitch:'YantraFrontSwitch',backSwitch:'YantraBackSwitch',
  petalGroups:['LotusEight','LotusSixteen','CelestialPetals','FiligreeRotor'],
  rings:['BreathHaloA','BreathHaloB','BreathHaloC'],
  materials:['YantraGold','YantraGlow','YantraAura','YantraBackGold','YantraBackGlow','YantraFill','YantraFill1','YantraFill2','YantraFill3','YantraFill4',
    'LotusEightFill','LotusEightEdge','LotusEightGlow','LotusEightVein','LotusSixteenFill','LotusSixteenEdge','LotusSixteenGlow','LotusSixteenVein',
    'CelestialFill','CelestialEdge','CelestialGlow','CelestialVein','FiligreeGold','GuillocheGold','GuillocheGlow','PearlGold','PearlCyan','FrameGold','HaloGold','HaloRose','HaloCyan','BinduGold']
});

function cubic(p0,p1,p2,p3,t){const u=1-t;return p0.map((v,i)=>u*u*u*v+3*u*u*t*p1[i]+3*u*t*t*p2[i]+t*t*t*p3[i]);}
export function lotusPaths(count,inner,outer,samples=40,phase=Math.PI/2){
  const paths=[];
  for(let i=0;i<count;i++){
    const a=phase+i*TAU/count,w=TAU/count*.43;
    const left=polar(inner,a-w),tip=polar(outer,a),right=polar(inner,a+w);
    const l1=polar(inner+(outer-inner)*.36,a-w*1.24),l2=polar(outer-.025,a-w*.24);
    const r1=polar(outer-.025,a+w*.24),r2=polar(inner+(outer-inner)*.36,a+w*1.24);
    const path=[];
    for(let j=0;j<=samples;j++)path.push(cubic(left,l1,l2,tip,j/samples));
    for(let j=1;j<=samples;j++)path.push(cubic(tip,r1,r2,right,j/samples));
    path.push([...left]);paths.push(path);
  }return paths;
}
function circle(radius,count=256,z=0,phase=0){return Array.from({length:count+1},(_,i)=>polar(radius,phase+i*TAU/count,z));}

function lineGeometry(paths,{def,coordinateDef,coordinateUse}={}){
  const points=[],indices=[];let offset=0;
  for(const p of paths){for(let i=0;i<p.length;i++){points.push(...xyz(p[i]));indices.push(offset++);}indices.push(-1);}
  const coordinate=coordinateUse?`<Coordinate USE="${coordinateUse}"/>`:`<Coordinate${coordinateDef?` DEF="${coordinateDef}"`:''} point="${numbers(points)}"/>`;
  return `<IndexedLineSet${def?` DEF="${def}"`:''} coordIndex="${indices.join(' ')}">${coordinate}</IndexedLineSet>`;
}
function ribbonGeometry(paths,width,z=0,def='',ornamental=false){
  const points=[],indices=[];
  for(const path of paths)for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<1e-12)continue;
    const nx=-dy/len*width*.5,ny=dx/len*width*.5,k=points.length/3;
    points.push(a[0]+nx,a[1]+ny,(a[2]??0)+z,a[0]-nx,a[1]-ny,(a[2]??0)+z,
      b[0]+nx,b[1]+ny,(b[2]??0)+z,b[0]-nx,b[1]-ny,(b[2]??0)+z);
    indices.push(k,k+1,k+2,k+2,k+1,k+3);
  }
  return `<IndexedTriangleSet${def?` DEF="${def}"`:''} solid="false" index="${indices.join(' ')}"><Coordinate point="${(ornamental?ornamentalNumbers:numbers)(points)}"/></IndexedTriangleSet>`;
}
function fillGeometry(paths,z=0,fold=0){
  const points=[],indices=[];
  for(const path of paths){
    const p=path.slice(0,-1);if(p.length<3)continue;
    const c=p.reduce((a,v)=>[a[0]+v[0]/p.length,a[1]+v[1]/p.length],[0,0]),base=points.length/3;
    points.push(c[0],c[1],z+fold);for(const v of p)points.push(v[0],v[1],z);
    for(let i=0;i<p.length;i++)indices.push(base,base+1+i,base+1+(i+1)%p.length);
  }
  return `<IndexedTriangleSet solid="false" index="${indices.join(' ')}"><Coordinate point="${numbers(points)}"/></IndexedTriangleSet>`;
}
function material(name,color,transparency=0,shininess=.72){return `<Material DEF="${name}" diffuseColor="${numbers(color.map(v=>v*.4))}" emissiveColor="${numbers(color)}" specularColor="0.75 0.58 0.33" shininess="${shininess}" transparency="${transparency}"/>`;}
function shape(geometry,name,color,transparency=0){return `<Shape><Appearance>${material(name,color,transparency)}</Appearance>${geometry}</Shape>`;}
function group(paths,prefix,{fill=[.12,.025,.055],edge=[.9,.36,.15],glow=[.7,.15,.1],z=0,width=.012}={}){
  const veins=[];
  for(const p of paths){
    const tip=p[Math.floor((p.length-2)/2)],left=p[0],right=p.at(-2),base=left.map((v,i)=>(v+right[i])*.5),center=base.map((v,i)=>(v+tip[i])*.5);
    veins.push(Array.from({length:13},(_,i)=>cubic(base,mix(base,center,.7),mix(center,tip,.7),tip,i/12)));
    for(const side of [-1,1]){
      const source=p.slice(0,-1),half=side<0?source.slice(0,Math.floor(source.length/2)+1):source.slice(Math.floor(source.length/2));
      veins.push(half.filter((_,i)=>i%4===0).map(v=>mix(v,center,.22)));
    }
  }
  return shape(fillGeometry(paths,z-.008,.045),prefix+'Fill',fill,.55)+
    shape(ribbonGeometry(paths,width*5,z-.004),prefix+'Glow',glow,.91)+
    shape(ribbonGeometry(paths,width,z+.002),prefix+'Edge',edge,.12)+
    shape(ribbonGeometry(veins,width*.25,z+.009,'',true),prefix+'Vein',edge,.65);
}
function guillochePaths(samples){
  const paths=[];
  for(let layer=0;layer<2;layer++){
    const path=[];
    for(let i=0;i<=samples;i++){
      const a=i/samples*TAU,r=4.42+.12*Math.sin(24*a+layer*Math.PI)+.08*Math.sin(48*a-layer*.6);
      path.push(polar(r,a,-.35-layer*.015));
    }paths.push(path);
  }
  return paths;
}
function pearlGeometry(count,radius,size,z){
  const points=[],indices=[],octa=[[0,0,1],[1,0,0],[0,1,0],[-1,0,0],[0,-1,0],[0,0,-.8]],faces=[0,1,2,0,2,3,0,3,4,0,4,1,5,2,1,5,3,2,5,4,3,5,1,4];
  for(let i=0;i<count;i++){
    const a=i*TAU/count,c=polar(radius,a,z),r=size*(i%4===0?1.3:1),start=points.length/3;
    for(const p of octa)points.push(c[0]+p[0]*r,c[1]+p[1]*r,c[2]+p[2]*r);
    indices.push(...faces.map(v=>v+start));
  }
  return `<IndexedTriangleSet solid="false" index="${indices.join(' ')}"><Coordinate point="${ornamentalNumbers(points)}"/></IndexedTriangleSet>`;
}
function framePaths(){
  const paths=[];
  for(const s of [4.24,4.34,4.44])for(let rot=0;rot<4;rot++){
    const g=.47,o=.24,base=[[-s,s],[-g,s],[-g,s+o],[-g*.45,s+o]];
    const reflected=base.map(([x,y])=>[-x,y]).reverse();
    for(const p of [base,reflected])paths.push(p.map(([x,y])=>{const a=rot*Math.PI/2;return [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a),-.42];}));
  }return paths;
}
function filigreePaths(samples){
  const paths=[];
  for(const radius of [2.45,2.51,3.17,3.24,4.04,4.11,4.16,4.98,5.08])paths.push(circle(radius,samples));
  for(let i=0;i<96;i++){
    const a=i*TAU/96,r0=i%4===0?4.67:4.83,r1=i%4===0?4.92:4.92;
    paths.push([polar(r0,a),polar(r1,a)]);
    if(i%4===0)paths.push([polar(4.74,a-.015),polar(4.76,a),polar(4.74,a+.015)]);
  }
  for(let i=0;i<32;i++){
    const a=i*TAU/32,points=[];
    for(let j=0;j<=24;j++){
      const t=j/24,theta=a+(t-.5)*TAU/32*.88,r=4.3+.41*Math.sin(Math.PI*t);
      points.push(polar(r,theta));
    }paths.push(points);
  }return paths;
}

export function buildScene(yantra,{quality='high'}={}){
  if(!yantra||!Array.isArray(yantra.triangles)||yantra.triangles.length!==9)throw Error('SCENE_NINE_TRIANGLES_REQUIRED');
  const canonical=yantra.triangles.map(t=>{
    if(!Array.isArray(t.vertices)||t.vertices.length!==3)throw Error('SCENE_THREE_VERTICES_REQUIRED');
    const p=t.vertices.map(v=>xyz(v));p.forEach(v=>v.forEach(finite));return [...p,[...p[0]]];
  });
  const high=quality==='high',segments=high?44:28,ringSegments=high?320:192;
  const lotus8=lotusPaths(8,2.53,3.16,segments),lotus16=lotusPaths(16,3.26,4.02,segments);
  const celestial=lotusPaths(32,4.27,4.91,high?28:18,0);
  const filigree=filigreePaths(ringSegments),frames=framePaths(),guilloche=guillochePaths(high?768:384);
  const pointData=[],pointColors=[],dustCount=high?1400:700;
  for(let i=0;i<dustCount;i++){
    const angle=hash(i*19.1)*TAU,r=2.75+Math.pow(hash(i*11.7+7),.48)*4.5;
    pointData.push(r*Math.cos(angle),r*Math.sin(angle),-.9-hash(i*8.1)*1.5);
    const warm=i%5===0,c=warm?[.85,.54,.28]:[.25,.44,.61];pointColors.push(...c,.12+hash(i*7.3)*.48);
  }
  const geometry=lineGeometry(canonical,{def:'YantraCanonical',coordinateDef:'YantraCoordinates'});
  const coreMesh=ribbonGeometry(canonical,.00265,0,'YantraWireMesh');
  const coreGlow=ribbonGeometry(canonical,.0085,-.001,'YantraGlowMesh');
  const coreAura=ribbonGeometry(canonical,.023,-.002,'YantraAuraMesh');
  const facePaths=(yantra.faces||[]).filter(f=>Array.isArray(f.vertices)&&f.vertices.length>=3).map(f=>[...f.vertices.map(v=>xyz(v)),xyz(f.vertices[0])]);
  const chamberRings=Array.from({length:5},()=>[]);
  for(const f of yantra.faces||[])if(Array.isArray(f.vertices)&&f.vertices.length>=3){const ring=Number.isInteger(f.ring)?clamp(f.ring,0,4):0;chamberRings[ring].push([...f.vertices.map(v=>xyz(v)),xyz(f.vertices[0])]);}
  const all=[];
  all.push(`<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="Interchange" version="4.0"><head><component name="Navigation" level="3"/><component name="Rendering" level="3"/><component name="Shape" level="5"/><component name="Grouping" level="2"/><meta name="title" content="Sri Yantra - Resonance Loom"/><meta name="description" content="Native X3D mandala. Canonical nine-triangle Sri Yantra is supplied by the separately audited construction; artistic ornament is authored. No shader-painted geometry."/><meta name="geometryContract" content="sri-resonance-native-x3d/1"/></head><Scene>`);
  all.push(`<WorldInfo title="Sri Yantra - Resonance Loom"><MetadataString containerField="metadata" name="construction" value="${mf(yantra.construction??'Audited nine-triangle construction')}"/></WorldInfo>`);
  all.push(`<NavigationInfo type='"NONE"' headlight="false"/><Background skyColor="0.005 0.008 0.021"/><OrthoViewpoint DEF="SanctuaryCamera" position="0 0 18" fieldOfView="-5.62 -5.62 5.62 5.62" description="Frontal sanctuary"/><DirectionalLight direction="-0.35 -0.5 -1" intensity="0.5" color="1 0.82 0.62"/><DirectionalLight direction="0.4 0.25 -1" intensity="0.25" color="0.4 0.65 1"/>`);
  all.push(`<Transform DEF="SanctuaryStage">`);
  all.push(`<Shape><Appearance><Material emissiveColor="1 1 1"/><PointProperties pointSizeScaleFactor="1.6" pointSizeMinValue="1" pointSizeMaxValue="2.4"/></Appearance><PointSet><Coordinate point="${numbers(pointData)}"/><ColorRGBA color="${numbers(pointColors)}"/></PointSet></Shape>`);
  all.push(`<Transform DEF="FiligreeRotor" translation="0 0 -0.38">${shape(ribbonGeometry(filigree,.007), 'FiligreeGold',[.49,.35,.16],.43)}</Transform>`);
  all.push(`<Transform DEF="Guilloche">${shape(ribbonGeometry(guilloche,.006,0,'',true),'GuillocheGold',[.43,.44,.29],.32)}${shape(ribbonGeometry(guilloche,.034,-.01,'',true),'GuillocheGlow',[.18,.45,.5],.93)}</Transform>`);
  all.push(`<Transform DEF="Pearls">${shape(pearlGeometry(high?144:96,4.19,.023,-.17),'PearlGold',[.86,.65,.35],.12)}${shape(pearlGeometry(high?96:64,3.215,.014,-.08),'PearlCyan',[.33,.76,.78],.20)}</Transform>`);
  all.push(`<Transform DEF="Bhupura">${shape(ribbonGeometry(frames,.009),'FrameGold',[.54,.39,.22],.46)}</Transform>`);
  all.push(`<Transform DEF="CelestialPetals" translation="0 0 -0.3">${group(celestial,'Celestial',{fill:[.024,.03,.085],edge:[.23,.4,.54],glow:[.16,.25,.41],width:.006})}</Transform>`);
  all.push(`<Transform DEF="LotusSixteen" translation="0 0 -0.21">${group(lotus16,'LotusSixteen',{fill:[.055,.018,.047],edge:[.53,.24,.38],glow:[.39,.12,.24],width:.010})}</Transform>`);
  all.push(`<Transform DEF="LotusEight" translation="0 0 -.11">${group(lotus8,'LotusEight',{fill:[.066,.026,.019],edge:[.80,.49,.22],glow:[.64,.27,.12],width:.012})}</Transform>`);
  for(const [i,radius,color] of [[0,2.48,[.84,.6,.28]],[1,4.09,[.62,.2,.33]],[2,5.14,[.18,.37,.46]]])all.push(`<Transform DEF="BreathHalo${'ABC'[i]}" translation="0 0 ${-.08-i*.1}">${shape(ribbonGeometry([circle(radius,ringSegments)],.010),'Halo'+['Gold','Rose','Cyan'][i],color,.45)}</Transform>`);
  // Geometry DEFs are declared in the front layer. The back layer uses exactly
  // the same native geometry through USE, under a single similarity transform.
  all.push(`<Switch DEF="YantraFrontSwitch" whichChoice="0"><Transform DEF="YantraFront" scale="2.35 2.35 2.35" translation="0 0 0.055">`);
  all.push(shape(geometry,'YantraGold',[.97,.73,.34],.05));
  all.push(`<Shape><Appearance><Material USE="YantraGold"/></Appearance>${coreMesh}</Shape>`);
  all.push(shape(coreGlow,'YantraGlow',[.94,.47,.20],.83));
  all.push(shape(coreAura,'YantraAura',[.82,.29,.19],.97));
  for(let ring=0;ring<5;ring++)all.push(shape(fillGeometry(chamberRings[ring],-.008),'YantraFill'+(ring||''),[[.72,.45,.19],[.57,.23,.20],[.55,.25,.11],[.4,.17,.34],[.12,.38,.40]][ring],.56+ring*.025));
  all.push(`</Transform></Switch>`);
  all.push(`<Switch DEF="YantraBackSwitch" whichChoice="0"><Transform DEF="YantraBack" scale="2.45575 2.45575 2.45575" translation="0 0 -.18"><Shape><Appearance>${material('YantraBackGold',[.43,.16,.29],.68)}</Appearance>${lineGeometry(canonical,{coordinateUse:'YantraCoordinates'})}</Shape><Shape><Appearance>${material('YantraBackGlow',[.42,.13,.29],.94)}</Appearance><IndexedTriangleSet USE="YantraGlowMesh"/></Shape></Transform></Switch>`);
  all.push(`<Transform DEF="Bindu" translation="0 0 .12"><Shape><Appearance>${material('BinduGold',[1,.82,.48],0)}</Appearance><IndexedTriangleSet solid="false" index="0 1 2 0 2 3 0 3 4 0 4 1 5 2 1 5 3 2 5 4 3 5 1 4"><Coordinate point="0 0 .035 .03 0 0 0 .03 0 -.03 0 0 0 -.03 0 0 0 -.025"/></IndexedTriangleSet></Shape></Transform>`);
  all.push(`</Transform></Scene></X3D>`);
  const xml=all.join('\n');
  const defs=[...xml.matchAll(/\bDEF="([^"]+)"/g)].map(m=>m[1]);
  if(new Set(defs).size!==defs.length)throw Error('SCENE_DUPLICATE_DEF');
  return {xml,bindings:SCENE_BINDINGS,stats:{quality:high?'high':'balanced',triangles:9,canonicalVertices:27,canonicalLineVertices:36,
    suppliedChambers:facePaths.length,lotusPetals:[8,16],authoredOuterPetals:32,dustPoints:dustCount,
    chamberRingCounts:chamberRings.map(p=>p.length),authoredPearls:high?240:160,
    circleSegments:ringSegments,circleRelativeChordError:1-Math.cos(Math.PI/ringSegments),
    coordinateNodes:(xml.match(/<Coordinate\b/g)||[]).length,shapes:(xml.match(/<Shape>/g)||[]).length,
    indexedTriangleSets:(xml.match(/<IndexedTriangleSet\b/g)||[]).length,bytes:new TextEncoder().encode(xml).length,
    geometryContract:'sri-resonance-native-x3d/1'}};
}

const caches=new WeakMap();
function handles(scene){
  if(caches.has(scene))return caches.get(scene);
  const names=[SCENE_BINDINGS.root,SCENE_BINDINGS.yantraFront,SCENE_BINDINGS.yantraBack,
    SCENE_BINDINGS.frontSwitch,SCENE_BINDINGS.backSwitch,...SCENE_BINDINGS.petalGroups,...SCENE_BINDINGS.rings,...SCENE_BINDINGS.materials];
  const h=Object.fromEntries(names.map(name=>[name,scene.getNamedNode(name)]));caches.set(scene,h);return h;
}
export function applySceneState(scene,X3D,state={}){
  const h=handles(scene),time=Number.isFinite(state.time)?state.time:0,motion=clamp(state.motion??1);
  const beat=Number.isFinite(state.beat)?state.beat:time*.9,pulse=clamp(state.pulse??Math.pow(.5+.5*Math.cos(beat*TAU),6));
  const breath=clamp(state.breath??(.5+.5*Math.sin(beat*TAU/8))),primary=state.primary??[.86,.30,.38],secondary=state.secondary??[.25,.69,.76],gold=state.gold??[.98,.74,.37];
  const front=clamp(state.yantraFrontOpacity??.96),back=clamp(state.yantraBackOpacity??.28);
  const vec=(x,y,z)=>new X3D.SFVec3f(x,y,z),rotation=a=>new X3D.SFRotation(0,0,1,a);
  const color=(name,c,intensity=1,transparency)=>{h[name].emissiveColor=new X3D.SFColor(...c.map(v=>clamp(v*intensity)));if(transparency!==undefined)h[name].transparency=clamp(transparency);};
  const similarity=(name,s,a=0)=>{h[name].scale=vec(s,s,s);h[name].rotation=rotation(a);};
  similarity('YantraFront',2.35*(1+motion*.006*(breath-.5)));
  similarity('YantraBack',2.45575*(1+motion*.013*(breath-.5)),-motion*.0025*Math.sin(beat*TAU/16));
  h.YantraFrontSwitch.whichChoice=['back','underlay','none'].includes(state.layerMode)?-1:0;
  h.YantraBackSwitch.whichChoice=['front','overlay','none'].includes(state.layerMode)?-1:0;
  const tint=mix(gold,primary,.08+.1*pulse);
  color('YantraGold',tint,.86+.14*pulse,1-front);
  color('YantraGlow',mix(gold,primary,.35),.95,1-front*(.17+.13*pulse));
  color('YantraAura',primary,.9,1-front*(.045+.035*pulse));
  color('YantraBackGold',mix(gold,primary,.55),.87,1-back);
  color('YantraBackGlow',mix(primary,secondary,.35),.9,1-back*.25);
  const chamberColors=[mix(gold,[1,.93,.70],.35),mix(primary,gold,.55),mix([.96,.47,.20],primary,.32),mix(primary,secondary,.27),mix(secondary,gold,.17)];
  chamberColors.forEach((c,i)=>{const wave=.5+.5*Math.sin(beat*TAU/8-i*.75);color('YantraFill'+(i||''),c,.48+.18*wave,1-front*(.36+.12*wave));});
  color('LotusEightFill',mix(gold,primary,.58),.28+.07*breath,.44);
  color('LotusEightEdge',mix(gold,primary,.18),.75+.15*pulse,.10);
  color('LotusEightGlow',primary,.8,.87-.035*pulse);color('LotusEightVein',mix(gold,[1,.85,.66],.3),.55,.48);
  color('LotusSixteenFill',mix(primary,gold,.12),.25+.07*(1-breath),.48);
  color('LotusSixteenEdge',mix(primary,gold,.12),.70+.13*pulse,.15);
  color('LotusSixteenGlow',primary,.75,.89-.025*pulse);color('LotusSixteenVein',mix(primary,gold,.45),.5,.58);
  color('CelestialFill',mix(secondary,gold,.12),.17+.05*breath,.57);color('CelestialEdge',secondary,.58+.12*pulse,.23);color('CelestialGlow',secondary,.7,.93);color('CelestialVein',mix(secondary,gold,.2),.46,.64);
  color('FiligreeGold',mix(gold,secondary,.22),.64,.34);color('FrameGold',gold,.55,.42);
  color('GuillocheGold',mix(gold,secondary,.45),.58+.08*breath,.36);color('GuillocheGlow',secondary,.7,.93-.02*pulse);
  color('PearlGold',mix(gold,[1,.9,.68],.25),.8+.13*pulse,.06);color('PearlCyan',mix(secondary,gold,.25),.73+.13*pulse,.10);
  color('HaloGold',gold,.67,.44-.13*pulse);color('HaloRose',primary,.62,.63-.13*pulse);color('HaloCyan',secondary,.55,.68-.1*pulse);
  color('BinduGold',mix(gold,[1,.96,.78],.45),.92+.08*pulse,0);
  h.LotusEight.rotation=rotation(motion*.008*Math.sin(beat*TAU/16));
  h.LotusSixteen.rotation=rotation(-motion*.012*Math.sin(beat*TAU/24));
  h.CelestialPetals.rotation=rotation(motion*beat*TAU/512);
  h.FiligreeRotor.rotation=rotation(-motion*beat*TAU/1024);
  SCENE_BINDINGS.rings.forEach((name,i)=>similarity(name,1+motion*(.003+i*.002)*Math.sin(beat*TAU/(8+i*4)+i)));
  h.SanctuaryStage.rotation=new X3D.SFRotation(1,0,0,clamp(state.tilt??0,-.7,.7));
  return {beat,pulse,breath,frontOpacity:front,backOpacity:back,geometryMutated:false};
}
