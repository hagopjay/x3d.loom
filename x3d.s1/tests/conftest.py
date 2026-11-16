import os
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
FIXTURES = os.path.join(os.path.dirname(HERE), "fixtures")


def fixture(name: str) -> str:
    return os.path.join(FIXTURES, name)
