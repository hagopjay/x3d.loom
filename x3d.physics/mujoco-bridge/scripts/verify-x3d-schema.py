#!/usr/bin/env python3
"""Optional offline X3D 4.0 XML Schema verification. Requires Python lxml."""
from pathlib import Path
import json
import datetime
import zipfile
from lxml import etree
root=Path(__file__).resolve().parent.parent
parser=etree.XMLParser(resolve_entities=False,no_network=True)
schema=etree.XMLSchema(etree.parse(str(root/'docs/schemas/x3d-4.0.xsd'),parser))
report={'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Official X3D 4.0 XML Schema grammar. Does not establish behavior, rendering or RigidBodyPhysics conformance.','source':'https://www.web3d.org/specifications/x3d-4.0.xsd','checks':[]}
inputs=[('standalone sample',(root/'samples/contact-arm.x3d').read_bytes())]
with zipfile.ZipFile(root/'samples/contact-arm-experiment.zip') as z:
    inputs.append(('packaged scene',z.read('x3d/scene.x3d')))
for name,data in inputs:
    document=etree.fromstring(data,parser)
    valid=schema.validate(document)
    report['checks'].append({'name':name,'status':'pass' if valid else 'fail','errors':[str(e) for e in schema.error_log]})
    print(('PASS ' if valid else 'FAIL ')+name)
    if not valid:print(schema.error_log)
report['summary']={'passed':sum(c['status']=='pass' for c in report['checks']),'failed':sum(c['status']=='fail' for c in report['checks'])}
(root/'validation/x3d-schema-results.json').write_text(json.dumps(report,indent=2))
raise SystemExit(1 if report['summary']['failed'] else 0)
