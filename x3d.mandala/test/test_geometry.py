#!/usr/bin/env python3
"""Controls for the construction, separate from independent topology controls."""
from decimal import Decimal as D, localcontext
import copy
import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from generate_yantra import solve,measure,TRIPLES,APEX_BASE,line,cross_lines,horizontal

class ConstructionControls(unittest.TestCase):
    def setUp(self):
        self.context=localcontext();self.context.__enter__().prec=100
        self.q,self.p,self.triangles,self.central,self.trace=solve()
    def tearDown(self):self.context.__exit__(None,None,None)
    def test_all_declared_constraints_and_concentric_incenter(self):
        m=measure(self.triangles)
        self.assertEqual(len(m['triples']),24)
        self.assertTrue(all(D(v)<D('1e-80')for v in m['maxima'].values()),m['maxima'])
        self.assertEqual(len(TRIPLES),12);self.assertEqual(len(APEX_BASE),7)
    def test_all_triple_intersections_are_on_finite_segments(self):
        for i,j,k in TRIPLES:
            for side in [1,2]:
                a,b,c=self.triangles[i-1],self.triangles[j-1],self.triangles[k-1]
                point=cross_lines(line(a[0],a[side]),line(c[0],c[side]))
                for u,v in [(a[0],a[side]),(b[1],b[2]),(c[0],c[side])]:
                    delta=[v[l]-u[l]for l in range(2)];den=sum(z*z for z in delta)
                    t=sum((point[l]-u[l])*delta[l]for l in range(2))/den
                    self.assertGreaterEqual(t,D('-1e-80'));self.assertLessEqual(t,D(1)+D('1e-80'))
    def test_roundtrip_binary64_stays_within_declared_error(self):
        rounded=[[tuple(D.from_float(float(v))for v in p)for p in t]for t in self.triangles]
        self.assertTrue(all(D(v)<D('1e-12')for v in measure(rounded)['maxima'].values()))
    def test_perturbed_width_cannot_claim_precision_or_symmetry(self):
        changed=copy.deepcopy(self.triangles);p=list(changed[0][1]);p[0]+=D('0.0001');changed[0][1]=tuple(p)
        m=measure(changed)['maxima'];self.assertGreater(D(m['concurrencyR']),D('1e-6'));self.assertEqual(D(m['reflectionR']),D('0.0001'))
    def test_solution_is_locally_solved_not_a_rounded_reference_table(self):
        self.assertNotEqual(self.q,D('.668'));self.assertNotEqual(self.p,D('.463'))
        self.assertGreater(len(self.trace),2);self.assertLess(D(self.trace[-1]['maxResidual']),D('1e-85'))

if __name__=='__main__':unittest.main()
