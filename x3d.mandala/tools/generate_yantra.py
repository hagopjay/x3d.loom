#!/usr/bin/env python3
"""Build a concentric member of the Huet/Chiodo concurrent Sri Yantra family.

Standard-library Python (3.10+ / 3.13+). Decimal precision is 100 digits. This
selects a named member of a non-unique family, not a universal sacred measure.
The independent DCEL audit is imported only after solving the line constraints.
"""
from __future__ import annotations
import argparse
import csv
from collections import Counter
from decimal import Decimal as D, localcontext
import hashlib
import json
import math
from pathlib import Path
import struct

TRIPLES=((1,2,7),(2,3,7),(1,3,8),(1,4,6),(1,5,9),(4,6,9),
         (2,7,9),(3,7,8),(3,8,9),(4,4,8),(5,5,6),(2,6,6))
APEX_BASE=((8,1),(6,2),(9,3),(1,6),(5,7),(4,8),(2,9))
SOURCES=[
 {'author':'Gerard Huet','year':2002,'title':'Sri Yantra Geometry','doi':'10.1016/S0304-3975(02)00028-2','url':'https://sriyantraresearch.com/References/Gerard%20Huet.pdf','use':'Five-parameter line construction and four-dimensional concurrent family; appendix coordinate relations.'},
 {'author':'Alessandro Chiodo','year':2021,'title':'On the construction of the Sri Yantra','doi':'10.5802/crmath.163','url':'https://www.numdam.org/item/10.5802/crmath.163.pdf','use':'Section 1 conditions (i)-(iii): common circumcircle, seven apex/base incidences, twelve bilateral concurrency triples; non-uniqueness.'}
]

def line(a,b):return (a[1]-b[1],b[0]-a[0],a[0]*b[1]-b[0]*a[1])
def cross_lines(a,b):
    den=a[0]*b[1]-b[0]*a[1]
    if not den:raise ArithmeticError('Parallel defining lines')
    return ((a[1]*b[2]-b[1]*a[2])/den,(a[2]*b[0]-b[2]*a[0])/den)
def horizontal(y):return (D(0),D(1),-y)
def axis(l):return cross_lines(l,(D(1),D(0),D(0)))
def norm(p):return sum(x*x for x in p).sqrt()
def line_distance(p,l):return abs(l[0]*p[0]+l[1]*p[1]+l[2])/norm(l[:2])
def incircle(tri):
    a,b,c=tri
    lengths=[norm((b[0]-c[0],b[1]-c[1])),norm((a[0]-c[0],a[1]-c[1])),norm((a[0]-b[0],a[1]-b[1]))]
    return tuple(sum(lengths[i]*tri[i][k] for i in range(3))/sum(lengths)for k in range(2))

def construct(q,p,xf=D('.126'),xa=D('.187'),j=D('.398')):
    """Unit-diameter working frame O=(0,0), T=(0,1); original math, own implementation."""
    xq=(q*(1-q)).sqrt();xj=(j*(1-j)).sqrt()
    A=(xa,q*xa/xq);H=(j*xq/q,j);I=(xj*(1-q)/(1-j),q);F=(xf,q)
    C=(xa*(q-p)/(q-A[1]),p)
    a=line(F,(D(0),p));e=line((D(0),D(0)),(xq,q));h=line((D(0),D(1)),(xj,j))
    f=line((D(0),q),A);g=line(F,H)
    lowerD=cross_lines(a,f);G=cross_lines(a,h);B=cross_lines(horizontal(j),f)
    c=line((D(0),A[1]),C);M=cross_lines(c,g);d=line(I,B);L=axis(d)
    P=cross_lines(horizontal(p),d);E=cross_lines(horizontal(M[1]),a);i=line(P,E)
    V=axis(g);S=cross_lines(horizontal(V[1]),a);K=cross_lines(horizontal(A[1]),g)
    N=cross_lines(horizontal(lowerD[1]),i);R=cross_lines(horizontal(G[1]),d)
    bottom=cross_lines(horizontal(L[1]),f)
    specs=[(V[1],S[0],p),(G[1],R[0],L[1]),(q,xq,D(0)),(M[1],M[0],A[1]),
           (lowerD[1],N[0],j),(p,P[0],G[1]),(j,xj,D(1)),(A[1],K[0],V[1]),(L[1],bottom[0],q)]
    triangles=[[(D(0),apex),(width,base),(-width,base)]for base,width,apex in specs]
    central=[(D(0),p),lowerD,(-lowerD[0],lowerD[1])]
    residual=(axis(i)[1]-G[1],incircle(central)[1]-D('.5'))
    return triangles,central,residual

def solve():
    q,p=D('.648'),D('.439');trace=[];epsilon=D('1e-35')
    for iteration in range(20):
        _,_,r=construct(q,p);error=max(map(abs,r));trace.append({'iteration':iteration,'maxResidual':str(error)})
        if error<D('1e-85'):break
        rq1=construct(q+epsilon,p)[2];rq0=construct(q-epsilon,p)[2]
        rp1=construct(q,p+epsilon)[2];rp0=construct(q,p-epsilon)[2]
        a,b=(rq1[0]-rq0[0])/(2*epsilon),(rp1[0]-rp0[0])/(2*epsilon)
        c,d=(rq1[1]-rq0[1])/(2*epsilon),(rp1[1]-rp0[1])/(2*epsilon)
        determinant=a*d-b*c
        q-=(d*r[0]-b*r[1])/determinant;p-=(-c*r[0]+a*r[1])/determinant
    else:raise ArithmeticError('Newton iteration did not converge')
    triangles,central,residual=construct(q,p)
    def normalized(t):return [(2*x,2*y-1)for x,y in t]
    return q,p,list(map(normalized,triangles)),normalized(central),trace

def measure(triangles):
    """Constraint residuals in unit-circumradius coordinates; no topology assumption."""
    triples=[]
    for first,base,last in TRIPLES:
        for side,index in [('right',1),('left',2)]:
            a=triangles[first-1];b=triangles[base-1];c=triangles[last-1]
            location=cross_lines(line(a[0],a[index]),line(c[0],c[index]))
            residual=line_distance(location,line(b[1],b[2]))
            triples.append({'downTriangle':first,'baseTriangle':base,'upTriangle':last,'side':side,'point':[str(v)for v in location],'distanceR':str(residual)})
    apex=[abs(triangles[a-1][0][1]-triangles[b-1][1][1])for a,b in APEX_BASE]
    circles=[abs(norm(p)-1)for i in [2,6]for p in triangles[i]]
    reflection=max(max(abs(t[1][0]+t[2][0]),abs(t[1][1]-t[2][1]),abs(t[0][0]))for t in triangles)
    base_y=triangles[4][1][1];central=[triangles[0][0],cross_lines(line(*triangles[0][:2]),horizontal(base_y))]
    central.append((-central[1][0],central[1][1]))
    center=incircle(central)
    maxes={'concurrencyR':max(D(t['distanceR'])for t in triples),'apexBaseIncidenceR':max(apex),
           'circumcircleR':max(circles),'reflectionR':reflection,'centralIncenterOffsetR':norm(center)}
    return {'maxima':{k:str(v)for k,v in maxes.items()},'triples':triples,
            'centralTriangle':[[str(v)for v in p]for p in central],'centralIncenter':[str(v)for v in center]}

def coverage(p,triangle):
    signed=[]
    for a,b in zip(triangle,triangle[1:]+triangle[:1]):signed.append((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))
    return min(signed)>=-1e-12 or max(signed)<=1e-12

def build(output):
    from audit_independent import audit
    with localcontext() as ctx:
        ctx.prec=100;q,p,triangles,central,trace=solve();precise=measure(triangles)
        records=[{'id':f'T{i+1}','orientation':'down'if i<5 else'up','vertices':[[float(v)for v in p]for p in t]}for i,t in enumerate(triangles)]
        f64=[[tuple(D.from_float(v)for v in p)for p in t['vertices']]for t in records]
        f32=[[tuple(D.from_float(struct.unpack('f',struct.pack('f',v))[0])for v in p)for p in t['vertices']]for t in records]
        a64=measure(f64);a32=measure(f32)
        arrangement=audit({'triangles':records},1e-10)
        faces=[];voids=[]
        for f in arrangement['faces']:
            vertices=[arrangement['points'][i]for i in f['vertices']]
            center=[sum(v[k]for v in vertices)/len(vertices)for k in range(2)]
            included=[t['id']for t in records if coverage(center,t['vertices'])]
            item={'vertices':vertices,'coverageDepth':len(included),'area':f['area'],'centroid':center,'coveringTriangles':included}
            if len(included)%2:
                if len(vertices)!=3:raise AssertionError('Unexpected odd-coverage nontriangular cell')
                item['ring']=(9-len(included))//2;faces.append(item)
            else:voids.append(item)
        faces.sort(key=lambda f:(f['ring'],math.atan2(f['centroid'][1],f['centroid'][0])))
        for i,f in enumerate(faces):f['id']=f'Chamber_{i+1:02d}'
        ring_counts=[sum(f['ring']==i for f in faces)for i in range(5)]
        assert ring_counts==[1,8,10,10,14],ring_counts
        assert arrangement['eulerConsistent'] and len(faces)==43
        data={'schema':'yantra-canonical/1','construction':'Concentric Huet-family selection','radius':1,'center':[0,0],
          'triangles':records,'faces':faces,'voids':voids,'ringCountsInnerToOuter':ring_counts,
          'centralTriangle':[[float(v)for v in p]for p in central],
          'parametersDiameterFrame':{'YQ':str(q),'XF':'0.126','YP':str(p),'XA':'0.187','YJ':'0.398'},'sources':SOURCES}
        payload=(json.dumps(data,sort_keys=True,separators=(',',':'))+'\n').encode()
        certificate={'schema':'yantra-certificate/1','construction':data['construction'],'decimalDigits':100,
          'normalization':'Outer circumcircle radius R=1; center (0,0); vertical reflection axis x=0.',
          'selection':'Fix XF=0.126, XA=0.187, YJ=0.398 in Huet unit-diameter frame; solve YQ and YP for concurrency and central incenter concentricity.',
          'nonUniqueness':'The concurrent Huet/Chiodo family has four real degrees of freedom; imposing central incenter concentricity leaves three. Three fixed parameters select this local member. No universal unique perfect shape is claimed.',
          'parametersDiameterFrame':data['parametersDiameterFrame'],
          'bounds':{'float64MaxConstraintResidualR':1e-12,'float32QuantizedMaxConstraintResidualR':1e-7,'arrangementSnapR':1e-10},
          'highPrecision':precise['maxima'],'float64':a64['maxima'],'float32Quantized':a32['maxima'],
          'arrangement':{k:arrangement[k]for k in ['vertices','edges','components','boundedFaces','triangularFaces','faceCornerHistogram','eulerConsistent','maximumSnapClusterDiameter']},
          'activeChambers':len(faces),'evenCoverageVoids':len(voids),'activeRingCountsInnerToOuter':ring_counts,
          'countMeaning':'43 odd-coverage triangular chambers. Full finite-segment arrangement also contains 31 even-coverage voids, including 10 triangular and 21 quadrilateral cells.',
          'actualNativeGpuPrecision':'Float32 quantization is measured separately. Pixel coverage, raster line width and display/postprocessing are not high-precision geometry proofs.',
          'newtonTrace':trace,'canonicalJsonSha256':hashlib.sha256(payload).hexdigest(),'sources':SOURCES}
        assert max(map(D,a64['maxima'].values()))<D('1e-12')
        assert max(map(D,a32['maxima'].values()))<D('1e-7')
        output.mkdir(parents=True,exist_ok=True)
        (output/'yantra.json').write_bytes(payload)
        (output/'yantra-data.js').write_text('// Generated by tools/generate_yantra.py; normalized R=1.\nexport const YANTRA = '+json.dumps(data,separators=(',',':'))+';\nexport const GEOMETRY_CERTIFICATE = '+json.dumps(certificate,separators=(',',':'))+';\n')
        (output/'geometry-certificate.json').write_text(json.dumps(certificate,indent=2)+'\n')
        (output/'geometry-high-precision.json').write_text(json.dumps({'vertices':[[[str(v)for v in p]for p in t]for t in triangles],'audit':precise},indent=2)+'\n')
        (output/'arrangement-audit.json').write_text(json.dumps(arrangement,indent=2)+'\n')
        rows=[]
        for triangle in records:
            apex,right,left=triangle['vertices'];height=abs(apex[1]-right[1]);halfbase=abs(right[0])
            rows.append({'triangle':triangle['id'],'orientation':triangle['orientation'],'apex_y_R':apex[1],
              'base_y_R':right[1],'half_base_R':halfbase,'height_R':height,
              'apex_angle_degrees':math.degrees(2*math.atan2(halfbase,height)),
              'equal_side_R':math.hypot(height,halfbase)})
        with (output/'geometry-measurements.csv').open('w',newline='') as stream:
            writer=csv.DictWriter(stream,fieldnames=rows[0].keys());writer.writeheader();writer.writerows(rows)
        print(json.dumps({'activeChambers':len(faces),'ringCounts':ring_counts,'highPrecision':precise['maxima'],'float64':a64['maxima'],'float32Quantized':a32['maxima'],'canonicalSha256':certificate['canonicalJsonSha256']},indent=2))
    return data,certificate

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parent/'generated');args=parser.parse_args();build(args.output)
