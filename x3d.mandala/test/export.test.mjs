import test from 'node:test';import assert from 'node:assert/strict';
import {preserveExportRequirements} from '../src/export.js';
const scene="<Scene><Coordinate DEF='YantraCoordinates' point='0.123456789 -1 0'/></Scene>";
test('native serializer component repair preserves declared version and exact scene payload',()=>{
 const xml="<!DOCTYPE X3D PUBLIC \"ISO//Web3D//DTD X3D 4.1//EN\" \"https://www.web3d.org/specifications/x3d-4.1.dtd\"><X3D version='4.1'><head><component name='Shape' level='4'/></head>"+scene+'</X3D>';
 const out=preserveExportRequirements(xml);assert.equal(out,xml.replace("level='4'","level='5'"));assert.ok(out.includes(scene));
});
test('required Shape level is retained or inserted while other components remain untouched',()=>{
 const base='<X3D version="4.0"><head><component name="Rendering" level="3"/></head>'+scene+'</X3D>';
 const out=preserveExportRequirements(base);assert.ok(out.includes("name='Shape' level='5'"));assert.ok(out.includes('name="Rendering" level="3"'));
 assert.equal(preserveExportRequirements(out),out);
});
test('ambiguous or missing native export headers fail explicitly',()=>{
 assert.throws(()=>preserveExportRequirements('<X3D>'+scene+'</X3D>'),/missing/);
 assert.throws(()=>preserveExportRequirements('<X3D><head><component name="Shape" level="4"/><component name="Shape" level="5"/></head></X3D>'),/Duplicate/);
});
