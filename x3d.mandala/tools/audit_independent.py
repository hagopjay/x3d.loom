#!/usr/bin/env python3
"""Independent finite-segment planar arrangement audit, standard library only.

Input: JSON list of triangles, each [[x,y],[x,y],[x,y]], or an object containing
`triangles`, whose items may be vertex arrays or {id, vertices:[...]} records.
It counts bounded faces by a DCEL-style directed-edge walk; three-sided faces
are counted only after removing collinear edge-subdivision vertices. No face
count is built into this algorithm. Snap tolerance is explicit in source units.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import copy
import json
import math
from pathlib import Path
import struct

def cross(a,b):return a[0]*b[1]-a[1]*b[0]
def sub(a,b):return a[0]-b[0],a[1]-b[1]
def norm(a):return math.hypot(*a)

def inside_polygon(p,vertices):
    inside=False
    for a,b in zip(vertices,vertices[1:]+vertices[:1]):
        if (a[1]>p[1])!=(b[1]>p[1]):
            if p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]:inside=not inside
    return inside

def interior_point(vertices,tolerance):
    # The area centroid is interior for the convex Sri Yantra cells. Preserve
    # generic audit behavior for a concave polygon by checking before using it.
    twice=sum(cross(a,b) for a,b in zip(vertices,vertices[1:]+vertices[:1]))
    center=tuple(sum((a[k]+b[k])*cross(a,b) for a,b in zip(vertices,vertices[1:]+vertices[:1]))/(3*twice) for k in [0,1])
    if inside_polygon(center,vertices):return center
    for a,b in zip(vertices,vertices[1:]+vertices[:1]):
        d=sub(b,a);length=norm(d)
        for fraction in [1e-4,1e-3,.01,.05]:
            step=max(tolerance*10,length*fraction)
            p=((a[0]+b[0])/2-d[1]*step/length,(a[1]+b[1])/2+d[0]*step/length)
            if inside_polygon(p,vertices):return p
    raise RuntimeError('Could not find an interior face sample')

def inside_triangle(p,vertices):
    signs=[cross(sub(vertices[(i+1)%3],vertices[i]),sub(p,vertices[i])) for i in range(3)]
    return min(signs)>0 or max(signs)<0

def unpack(document):
    items=document.get('triangles',document) if isinstance(document,dict) else document
    if isinstance(items,dict):items=[dict(id=k,vertices=v) for k,v in items.items()]
    result=[]
    for i,item in enumerate(items):
        if isinstance(item,dict):
            name=item.get('id',item.get('name',str(i)))
            vertices=item.get('vertices',item.get('points',item.get('coords')))
        else:name=str(i);vertices=item
        if len(vertices)!=3:raise ValueError('Expected three vertices: '+str(name))
        points=[tuple(map(float,p[:2])) for p in vertices]
        if not all(math.isfinite(v) for p in points for v in p):raise ValueError('Nonfinite coordinate')
        result.append((str(name),points))
    return result

def audit(document,tolerance=1e-9):
    triangles=unpack(document)
    segments=[]
    for name,pts in triangles:
        for i in range(3):segments.append({'id':name+':'+str(i),'triangle':name,'a':pts[i],'b':pts[(i+1)%3]})
    cuts=[[(0.,s['a']),(1.,s['b'])] for s in segments]
    parallel=0;collinear=[]
    for i,s in enumerate(segments):
        a=s['a'];r=sub(s['b'],a)
        for j in range(i+1,len(segments)):
            t=segments[j];b=t['a'];q=sub(t['b'],b);den=cross(r,q)
            if abs(den)<=1e-14*norm(r)*norm(q):
                parallel+=1
                if abs(cross(sub(b,a),r))<=tolerance*norm(r):
                    collinear.append([s['id'],t['id']])
                    for point in [t['a'],t['b']]:
                        delta=sub(point,a);u=(delta[0]*r[0]+delta[1]*r[1])/(norm(r)**2)
                        if -tolerance<=u<=1+tolerance:cuts[i].append((max(0.,min(1.,u)),point))
                    for point in [s['a'],s['b']]:
                        delta=sub(point,b);v=(delta[0]*q[0]+delta[1]*q[1])/(norm(q)**2)
                        if -tolerance<=v<=1+tolerance:cuts[j].append((max(0.,min(1.,v)),point))
                continue
            u=cross(sub(b,a),q)/den;v=cross(sub(b,a),r)/den
            eps=tolerance/max(min(norm(r),norm(q)),tolerance)
            if -eps<=u<=1+eps and -eps<=v<=1+eps:
                u=max(0.,min(1.,u));v=max(0.,min(1.,v))
                p=(a[0]+u*r[0],a[1]+u*r[1]);cuts[i].append((u,p));cuts[j].append((v,p))
    nodes=[];buckets=defaultdict(list);clusters=[]
    def intern(p):
        key=math.floor(p[0]/tolerance),math.floor(p[1]/tolerance)
        for dx in [-1,0,1]:
            for dy in [-1,0,1]:
                for idx in buckets[key[0]+dx,key[1]+dy]:
                    if norm(sub(p,nodes[idx]))<=tolerance:clusters[idx].append(p);return idx
        idx=len(nodes);nodes.append(p);clusters.append([p]);buckets[key].append(idx);return idx
    edges=set();owners=defaultdict(set);node_segments=defaultdict(set)
    for s,items in zip(segments,cuts):
        path=[]
        for _,p in sorted(items):
            idx=intern(p);node_segments[idx].add(s['id'])
            if not path or path[-1]!=idx:path.append(idx)
        for a,b in zip(path,path[1:]):
            e=tuple(sorted((a,b)))
            if a!=b:edges.add(e);owners[e].add(s['id'])
    graph=defaultdict(set)
    for a,b in edges:graph[a].add(b);graph[b].add(a)
    ordered={a:sorted(ns,key=lambda b:math.atan2(nodes[b][1]-nodes[a][1],nodes[b][0]-nodes[a][0])) for a,ns in graph.items()}
    visited=set();faces=[]
    def simplify(poly):
        changed=True
        while changed and len(poly)>3:
            changed=False;out=[]
            for i,b in enumerate(poly):
                a=poly[i-1];c=poly[(i+1)%len(poly)]
                ab=sub(nodes[b],nodes[a]);bc=sub(nodes[c],nodes[b]);length=max(norm(ab),norm(bc),tolerance)
                if abs(cross(ab,bc))<=tolerance*length and ab[0]*bc[0]+ab[1]*bc[1]>=0:changed=True
                else:out.append(b)
            poly=out
        return poly
    for a,b in sorted((a,b) for e in edges for a,b in [e,e[::-1]]):
        if (a,b) in visited:continue
        start=(a,b);edge=start;poly=[]
        for _ in range(len(edges)*2+1):
            if edge in visited:
                if edge!=start:raise RuntimeError('Face walk joined a previously visited half-edge')
                break
            visited.add(edge);u,v=edge;poly.append(u);neighbors=ordered[v];k=neighbors.index(u)
            edge=(v,neighbors[(k-1)%len(neighbors)])
        else:raise RuntimeError('Nonterminating face walk')
        area=sum(cross(nodes[poly[i]],nodes[poly[(i+1)%len(poly)]] ) for i in range(len(poly)))/2
        simple=simplify(poly)
        faces.append({'area':area,'vertices':simple,'subdividedVertices':len(poly),'corners':len(simple)})
    bounded=[f for f in faces if f['area']>tolerance*tolerance]
    # Count connected components for the Euler characteristic independently.
    remaining=set(graph);components=0
    while remaining:
        components+=1;todo=[remaining.pop()]
        while todo:
            for other in graph[todo.pop()]:
                if other in remaining:remaining.remove(other);todo.append(other)
    segment_by_id={s['id']:s for s in segments}
    multi=[]
    for idx,ss in node_segments.items():
        lines=[]
        for name in sorted(ss):
            s=segment_by_id[name];d=sub(s['b'],s['a']);length=norm(d);normal=(-d[1]/length,d[0]/length)
            if normal[0]<-1e-12 or abs(normal[0])<1e-12 and normal[1]<0:normal=(-normal[0],-normal[1])
            constant=normal[0]*s['a'][0]+normal[1]*s['a'][1]
            if not any(norm(sub(normal,n))<1e-9 and abs(constant-c)<tolerance for n,c in lines):lines.append((normal,constant))
        if len(lines)>=3:multi.append({'point':nodes[idx],'segments':sorted(ss),'lineCount':len(lines)})
    cluster_diameter=max((max((norm(sub(a,b)) for a in ps for b in ps),default=0.) for ps in clusters),default=0.)
    hist=dict(sorted(Counter(f['corners'] for f in bounded).items()))
    coverage_hist=Counter();odd_faces=[]
    for face in bounded:
        coords=[nodes[idx] for idx in face['vertices']];sample=interior_point(coords,tolerance)
        covering=[name for name,triangle in triangles if inside_triangle(sample,triangle)]
        face['coordinates']=coords;face['interiorSample']=sample;face['coveringTriangles']=covering;face['coverage']=len(covering)
        face['oddCoverage']=len(covering)%2==1
        coverage_hist[len(covering)]+=1
        if face['oddCoverage']:odd_faces.append(face)
    odd_hist=dict(sorted(Counter(f['corners'] for f in odd_faces).items()))
    chambers=[f for f in odd_faces if f['corners']==3]
    chamber_layers=dict(sorted(Counter(f['coverage'] for f in chambers).items()))
    return {'source':'Independent finite-segment arrangement/DCEL audit','snapTolerance':tolerance,
        'triangleCount':len(triangles),'segmentCount':len(segments),'vertices':len(nodes),'edges':len(edges),
        'components':components,'boundedFaces':len(bounded),'triangularFaces':hist.get(3,0),
        'faceCornerHistogram':hist,'eulerExpectedBoundedFaces':len(edges)-len(nodes)+components,
        'eulerConsistent':len(bounded)==len(edges)-len(nodes)+components,
        'coverageHistogram':dict(sorted(coverage_hist.items())),
        'oddCoverageFaces':len(odd_faces),'oddCoverageCornerHistogram':odd_hist,
        'oddTriangularChambers':len(chambers),'chambersByCoverage':chamber_layers,
        'chamberCountsOutsideIn':list(chamber_layers.values()),
        'chambers':chambers,
        'multiLineIntersections':multi,'multiLineIntersectionCount':len(multi),
        'offAxisMultiLineIntersectionCount':sum(abs(p['point'][0])>tolerance*10 for p in multi),
        'maximumSnapClusterDiameter':cluster_diameter,'collinearSegmentPairs':collinear,
        'points':nodes,'faces':bounded}

def controls(document):
    """Reproduce healthy/faulted twins and representation-precision probes."""
    canonical=copy.deepcopy(document);triangles=unpack(canonical)
    # Normalize a supported input representation for controlled coordinate edits.
    canonical={'triangles':[{'id':name,'vertices':[list(p) for p in pts]} for name,pts in triangles]}
    cases=[]
    for tolerance in [1e-6,1e-8,1e-10,1e-12]:
        result=audit(canonical,tolerance)
        cases.append({'kind':'canonical','snapTolerance':tolerance,
            'oddChambers':result['oddTriangularChambers'],'countsOutsideIn':result['chamberCountsOutsideIn'],
            'boundedFaces':result['boundedFaces'],'euler':result['eulerConsistent']})
    for kind in ['reflection_fault','symmetric_width_fault']:
        bad=copy.deepcopy(canonical);bad['triangles'][0]['vertices'][1][0]+=1e-4
        if kind.startswith('symmetric'):bad['triangles'][0]['vertices'][2][0]-=1e-4
        result=audit(bad,1e-9)
        cases.append({'kind':kind,'delta':1e-4,'oddChambers':result['oddTriangularChambers'],
            'oddFaces':result['oddCoverageFaces'],'oddCornerHistogram':result['oddCoverageCornerHistogram'],
            'boundedFaces':result['boundedFaces'],'multilinePoints':result['multiLineIntersectionCount']})
    quantized=copy.deepcopy(canonical)
    for triangle in quantized['triangles']:
        triangle['vertices']=[[struct.unpack('f',struct.pack('f',v))[0] for v in p] for p in triangle['vertices']]
    result=audit(quantized,1e-6)
    cases.append({'kind':'binary32_quantization','snapTolerance':1e-6,
        'oddChambers':result['oddTriangularChambers'],'countsOutsideIn':result['chamberCountsOutsideIn'],
        'boundedFaces':result['boundedFaces']})
    expected=audit(canonical,1e-10)['multiLineIntersections']
    def incidence_residual(candidate):
        ts=unpack(candidate);segments={name+':'+str(i):(pts[i],pts[(i+1)%3]) for name,pts in ts for i in range(3)}
        worst=0.
        for node in expected:
            lines=[]
            for name in node['segments']:
                a,b=segments[name];d=sub(b,a);length=norm(d);normal=(-d[1]/length,d[0]/length)
                lines.append((*normal,normal[0]*a[0]+normal[1]*a[1]))
            aa=sum(a*a for a,b,c in lines);bb=sum(b*b for a,b,c in lines);ab=sum(a*b for a,b,c in lines)
            ac=sum(a*c for a,b,c in lines);bc=sum(b*c for a,b,c in lines);det=aa*bb-ab*ab
            point=((ac*bb-bc*ab)/det,(bc*aa-ac*ab)/det)
            worst=max(worst,max(abs(a*point[0]+b*point[1]-c) for a,b,c in lines))
        return worst
    return {'scope':'Independent standard-library geometric audit; normalized source units',
        'cases':cases,'float64WorstIncidenceLineDistance':incidence_residual(canonical),
        'binary32WorstIncidenceLineDistance':incidence_residual(quantized)}

def self_test():
    single=[[[0,0],[2,0],[1,1]]]
    disjoint=single+[[[3,0],[5,0],[4,1]]]
    star=[[[0,0],[2,0],[1,2]],[[0,1.3],[2,1.3],[1,-.7]]]
    a=audit(single);b=audit(disjoint);c=audit(star)
    assert a['boundedFaces']==1 and a['oddTriangularChambers']==1 and a['eulerConsistent']
    assert b['boundedFaces']==2 and b['components']==2 and b['eulerConsistent']
    assert c['boundedFaces']==7 and c['oddTriangularChambers']==6 and c['faceCornerHistogram']=={3:6,6:1}
    reversed_star=[[list(p) for p in reversed(triangle)] for triangle in reversed(star)]
    d=audit(reversed_star)
    assert d['boundedFaces']==c['boundedFaces'] and d['oddTriangularChambers']==c['oddTriangularChambers']
    return {'singleTriangle':True,'disconnectedTriangles':True,'starOfDavidSixTipsAndHexagon':True,'orientationAndOrderInvariant':True}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('input',type=Path,nargs='?');p.add_argument('--output',type=Path);p.add_argument('--tolerance',type=float,default=1e-9);p.add_argument('--controls',action='store_true');p.add_argument('--self-test',action='store_true');args=p.parse_args()
    if args.self_test:print(json.dumps(self_test(),indent=2));return
    if not args.input:p.error('an input JSON file is required unless --self-test is used')
    document=json.loads(args.input.read_text())
    result=controls(document) if args.controls else audit(document,args.tolerance)
    rendered=json.dumps(result,indent=2)+'\n'
    if args.output:args.output.write_text(rendered)
    print(json.dumps({k:v for k,v in result.items() if k not in ['points','faces','chambers','multiLineIntersections']},indent=2))

if __name__=='__main__':main()
