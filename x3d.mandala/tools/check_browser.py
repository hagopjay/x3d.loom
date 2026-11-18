#!/usr/bin/env python3
"""Exercise the source and offline native-X3D UI with Playwright; Chromium path optional."""
import argparse,functools,http.server,json,threading,time,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--chromium');ap.add_argument('--offline',type=Path,default=ROOT/'dist/Sri-Yantra-Resonance-Loom.html');ap.add_argument('--screenshots',type=Path);args=ap.parse_args()
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
 report={'schema':'resonance-browser-witness/1','artifactSha256':hashlib.sha256(args.offline.read_bytes()).hexdigest(),'scope':'Headless Chromium with SwiftShader, en-US; loopback source and file:// standalone. Layout and native-field controls, not target-GPU or acoustic performance.','source':{},'offline':{}}
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--disable-dev-shm-usage'])
  for kind,url in [('source',base+'/'),('offline',args.offline.resolve().as_uri())]:
   page=browser.new_page(viewport={'width':1440,'height':960},locale='en-US',reduced_motion='no-preference');errors=[];requests=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
   page.goto(url);page.wait_for_function('window.__sri?.ready || window.__sri?.error',timeout=45000)
   assert page.evaluate('__sri.ready'),page.evaluate('__sri.error')
   page.wait_for_timeout(600)
   before=page.evaluate('JSON.stringify(Array.from(__sri.scene.getNamedNode("YantraCoordinates").point))')
   result=page.evaluate('({nativeAudit:__sri.nativeAudit,stats:__sri.sceneStats,version:__sri.browser.version,contextBeforeGesture:__sri.sound.context,buttonText:document.querySelector("#begin-sound").innerText})')
   assert result['contextBeforeGesture'] is None
   assert result['nativeAudit']['pass']
   assert ' '.join(result['buttonText'].split())=='Awaken sound ♪',result['buttonText']
   page.click('#studio-open');page.select_option('#palette','lapis');page.select_option('#layers','back');page.wait_for_function('__sri.scene.getNamedNode("YantraFrontSwitch").whichChoice.valueOf()===-1',timeout=15000)
   result['backOnly']=page.evaluate('({front:__sri.scene.getNamedNode("YantraFrontSwitch").whichChoice.valueOf(),back:__sri.scene.getNamedNode("YantraBackSwitch").whichChoice.valueOf()})')
   assert result['backOnly']=={'front':-1,'back':0},result['backOnly']
   page.select_option('#layers','both')
   page.select_option('#quality','balanced');page.wait_for_function('__sri.sceneStats.quality==="balanced"')
   # stats is set only after replaceWorld completes and coordinate audit then runs synchronously.
   assert page.evaluate('JSON.stringify(Array.from(__sri.scene.getNamedNode("YantraCoordinates").point))')==before
   result['balancedStats']=page.evaluate('__sri.sceneStats')
   page.select_option('#quality','high');page.wait_for_function('__sri.sceneStats.quality==="high"');page.wait_for_timeout(200)
   page.check('#comfort');page.wait_for_function('Array.from(__sri.scene.getNamedNode("FiligreeRotor").rotation)[3]===0')
   r1=page.evaluate('Array.from(__sri.scene.getNamedNode("FiligreeRotor").rotation)');page.wait_for_timeout(160);r2=page.evaluate('Array.from(__sri.scene.getNamedNode("FiligreeRotor").rotation)');assert r1==r2
   result['stillnessHoldsRotor']=True
   page.uncheck('#comfort')
   with page.expect_download() as d:page.click('#export-x3d')
   target=ROOT/'.work/browser-export.x3d';target.parent.mkdir(exist_ok=True);d.value.save_as(target)
   xml=target.read_text();assert '<X3D' in xml and 'YantraCoordinates' in xml
   result['exportBytes']=target.stat().st_size
   with page.expect_download() as d:page.click('#export-score')
   score=json.loads(Path(d.value.path()).read_text());assert score['geometrySha256']==page.evaluate('__sri.certificate.canonicalJsonSha256')
   with page.expect_download() as d:page.click('#export-certificate')
   cert=json.loads(Path(d.value.path()).read_text());assert cert['activeChambers']==43
   page.click('#read-guide');page.wait_for_function('document.querySelector("#guide-frame").contentDocument?.body?.textContent.includes("43")');result['fieldGuideLoaded']=True;page.click('#guide-close');page.click('#studio-close')
   page.click('#certificate-open');assert page.locator('#native-audit-card').is_visible();page.click('#certificate-close')
   page.click('#play');a=page.evaluate('__sri.transport.beat()');page.wait_for_timeout(200);b=page.evaluate('__sri.transport.beat()');assert a==b;page.click('#play');result['pauseFrozen']=True
   after=page.evaluate('JSON.stringify(Array.from(__sri.scene.getNamedNode("YantraCoordinates").point))');assert before==after
   result['canonicalPointSha256']=hashlib.sha256(before.encode()).hexdigest();result['canonicalUnchangedAcrossAnimationAndQuality']=True
   if args.screenshots:args.screenshots.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(args.screenshots/(kind+'-final.png')))
   page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200)
   result['phone']=page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,studioVisible:!document.querySelector("#studio").hidden})');assert result['phone']['scrollWidth']==390
   page.click('#studio-open');assert page.locator('#tempo').is_visible()
   if args.screenshots:page.screenshot(path=str(args.screenshots/(kind+'-phone.png')))
   result['pageErrors']=errors;result['externalRequests']=[u for u in requests if not u.startswith(base)]
   assert not errors,errors
   if kind=='offline':assert not requests,requests
   report[kind]=result;page.close()
  browser.close()
 server.shutdown();report['pass']=True;out=ROOT/'docs/browser-validation.json';out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
