"""Check the ontology side of the style kit with standard RDF tools.

1. Every vocabulary file parses (rdflib).
2. The catalogue (JSON-LD, defaults resolved) becomes RDF and conforms to the SHACL shapes (pyshacl).
3. Deliberately broken styles are rejected.
4. Round trip: the tokens lifted from each compiled X3D world's MetadataSet equal the catalogue's tokens.

Usage: python3 tools/check_rdf.py [out/rdf-receipt.json]     (run from x3d.style/ after bin/build.mjs)
"""
import copy, glob, json, os, subprocess, sys
import xml.etree.ElementTree as ET
import rdflib, pyshacl

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "out", "rdf-receipt.json")
NS = "https://hagopjay.github.io/x3d.loom/ns/style#"
ctx = json.load(open(os.path.join(ROOT, "vocab", "xst.context.jsonld")))["@context"]

# resolved styles (defaults filled in) come from the grammar itself
resolved = json.loads(subprocess.run(["node", "--input-type=module", "-e",
    "import fs from 'node:fs'; import {resolve, flatten} from './src/grammar.mjs';"
    "const c=JSON.parse(fs.readFileSync('styles/catalogue.jsonld'))['@graph'];"
    "console.log(JSON.stringify(c.map(s=>({doc:resolve(s), flat:flatten(s)}))))"], cwd=ROOT, capture_output=True, text=True, check=True).stdout)

def graph(docs):
    g = rdflib.Graph()
    g.parse(data=json.dumps({"@context": ctx, "@graph": docs}), format="json-ld")
    return g

vocab = rdflib.Graph().parse(os.path.join(ROOT, "vocab", "xst.ttl"), format="turtle")
shapes = rdflib.Graph().parse(os.path.join(ROOT, "vocab", "xst.shapes.ttl"), format="turtle")
docs = [r["doc"] for r in resolved]
data = graph(docs)
conforms, _, text = pyshacl.validate(data, shacl_graph=shapes, inference="none")

def broken(name, fn):
    d = copy.deepcopy(docs[0]); fn(d)
    ok, _, _ = pyshacl.validate(graph([d]), shacl_graph=shapes, inference="none")
    return {"case": name, "rejected": not ok}
neg = [broken("part missing (no light)", lambda d: d.pop("light")),
       broken("bad colour (palette.ground = 'navy')", lambda d: d["palette"].__setitem__("ground", "navy")),
       broken("unknown word (surface.model = 'toon')", lambda d: d["surface"].__setitem__("model", "toon")),
       broken("out of range (surface.tint = 1.7)", lambda d: d["surface"].__setitem__("tint", 1.7)),
       broken("bad colour inside a list (categorical[1] = 'red')", lambda d: d["palette"]["categorical"].__setitem__(1, "red")),
       broken("no declared key", lambda d: d.pop("intent"))]

# round trip through the X3D files
rt = []
for r in resolved:
    sid = r["doc"]["@id"].replace("xst:", "")
    path = os.path.join(ROOT, "out", sid + ".x3d")
    if not os.path.exists(path):
        continue
    ms = ET.parse(path).getroot().find(".//MetadataSet[@name='xst:Style']")
    got = {m.get("name"): m.get("value").strip('"') for m in ms.findall("MetadataString")}
    want = {"xst:" + k.replace(".", "_"): v for k, v in r["flat"]}
    diff = [k for k in want if got.get(k) != want[k]]
    roles = sorted({m.get("value").strip('"') for m in ET.parse(path).getroot().iter("MetadataString") if m.get("name") == "xst:role"})
    rt.append({"style": sid, "tokens": len(want), "identical": not diff, "diff": diff[:5], "reference": ms.get("reference"), "roles": roles})

rec = {"instrument": f"rdflib {rdflib.__version__}, pyshacl {pyshacl.__version__}", "vocab_triples": len(vocab), "shape_triples": len(shapes), "triples": len(data), "styles": len(docs),
       "shacl_conforms": bool(conforms), "shacl_report": None if conforms else text[:1500], "negative": neg, "negative_total": len(neg), "negative_caught": sum(n["rejected"] for n in neg),
       "x3d_round_trip": {"worlds": len(rt), "identical": sum(x["identical"] for x in rt), "tokens_each": rt[0]["tokens"] if rt else 0, "rows": rt}}
json.dump(rec, open(out, "w"), indent=1)
print(json.dumps({k: rec[k] for k in ("instrument", "vocab_triples", "shape_triples", "triples", "shacl_conforms", "negative_caught", "negative_total")}))
print("round trip", rec["x3d_round_trip"]["identical"], "/", rec["x3d_round_trip"]["worlds"], "worlds,", rec["x3d_round_trip"]["tokens_each"], "tokens each; roles", rt[0]["roles"] if rt else None)
if not conforms: print(text[:1500])
sys.exit(0 if conforms and rec["negative_caught"] == len(neg) and rec["x3d_round_trip"]["identical"] == len(rt) else 1)
