// X_ITE16.8.0's serializer reports Shape4 for this scene, although its
// PointProperties requires Shape5. Preserve the application's declared minimum
// without changing version, nodes, coordinate precision or the geometry payload.
export function preserveExportRequirements(xml){
  const head=/<head>([\s\S]*?)<\/head>/.exec(xml);
  if(!head)throw new Error('Native export is missing its X3D head.');
  let count=0;
  let body=head[1].replace(/<component\b[^>]*\/>/g,tag=>{
    if(!/\bname\s*=\s*(['"])Shape\1/.test(tag))return tag;
    count++;
    if(!/\blevel\s*=\s*(['"])\d+\1/.test(tag))throw new Error('Invalid Shape component declaration.');
    return tag.replace(/\blevel\s*=\s*(['"])(\d+)\1/,(_,quote,level)=>'level='+quote+Math.max(5,Number(level))+quote);
  });
  if(count>1)throw new Error('Duplicate Shape component declarations in native export.');
  if(count===0)body+="    <component name='Shape' level='5'/>\n  ";
  return xml.slice(0,head.index)+'<head>'+body+'</head>'+xml.slice(head.index+head[0].length);
}
