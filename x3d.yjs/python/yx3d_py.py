"""A Python peer for yx3d: the x3d_mcp side of the co-editing story, on pycrdt (a Yjs-compatible CRDT).
Reads and edits the same layout the JS core writes (see src/yx3d.js): x3d.nodes is a Map uid -> Map{type, def, use, at, fields: Map, kids: Array}.
An LLM agent behind x3d_mcp can join a session by exchanging Yjs updates (bytes) with any JS peer.
"""
from pycrdt import Doc, Map, Array

class Peer:
    def __init__(self, update: bytes | None = None):
        self.doc = Doc()
        self.nodes = self.doc.get("x3d.nodes", type=Map)
        self.routes = self.doc.get("x3d.routes", type=Map)
        if update:
            self.doc.apply_update(update)

    def apply(self, update: bytes):
        self.doc.apply_update(update)

    def diff_since(self, state_vector: bytes) -> bytes:
        return self.doc.get_update(state_vector)

    def find_def(self, name: str):
        for uid, n in self.nodes.items():
            if n.get("def") == name:
                return uid
        return None

    def set_field(self, def_name: str, field: str, value: str):
        uid = self.find_def(def_name)
        if uid is None:
            raise KeyError(f"no node DEF {def_name}")
        self.nodes[uid]["fields"][field] = str(value)

    def get_field(self, def_name: str, field: str):
        uid = self.find_def(def_name)
        return None if uid is None else self.nodes[uid]["fields"].get(field)
