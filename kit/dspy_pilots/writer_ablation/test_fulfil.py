import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import fulfil


class T(unittest.TestCase):
    X = "<X3D profile='Immersive' version='4.0'><Scene><Shape DEF='a'><Box/></Shape><Shape USE='a'/><TimeSensor loop='false'/></Scene></X3D>"

    def test_pass(self):
        ok, m = fulfil.fulfilled(self.X, {"required_nodes": ["Box"], "min_use": 1, "min_defs": 1, "loop_false": 1})
        self.assertTrue(ok, m)

    def test_each_constraint_can_fail(self):
        for cons in ({"required_nodes": ["Cone"]}, {"min_use": 2}, {"min_routes": 1}, {"min_transforms": 1}, {"min_joints": 1}, {"min_geolocations": 1}):
            self.assertFalse(fulfil.fulfilled(self.X, cons)[0], cons)
        self.assertFalse(fulfil.fulfilled(self.X.replace("loop='false'", ""), {"loop_false": 1})[0])

    def test_unparseable(self):
        self.assertEqual(fulfil.fulfilled("<X3D", {})[1], ["unparseable"])


if __name__ == "__main__":
    unittest.main()
