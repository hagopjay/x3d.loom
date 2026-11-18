#!/usr/bin/env python3
"""Exercise the actual instrument's Web Audio and shared-clock boundaries.

Requires Python Playwright and a Chromium executable. The default target is
the built standalone HTML via file://. --source checks the source application
using an HTTP server in the same process. No audio recording is retained.
"""
import argparse
import asyncio
import functools
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
DEFAULT_STANDALONE=ROOT.parents[1]/'delivery/Sri-Yantra-Resonance-Loom.html'

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

async def validate(args,port):
    checks=[];errors=[];external=[]
    def check(name,condition,observed=None):
        checks.append({'name':name,'pass':bool(condition),'observed':observed})
        if not condition:raise AssertionError(name+': '+str(observed))
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        page=await browser.new_page(viewport={'width':1280,'height':900},locale='en-US')
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) and not r.url.startswith(f'http://127.0.0.1:{port}/') else None)
        target=f'http://127.0.0.1:{port}/' if args.source else args.standalone.resolve().as_uri()
        await page.goto(target,wait_until='load')
        await page.wait_for_function('window.__sri?.ready||window.__sri?.error',timeout=90000)
        check('native X3D instrument is ready',await page.evaluate('__sri.ready'),await page.evaluate('__sri.error'))
        initial=await page.evaluate('({sound:__sri.sound.stats(),beat:__sri.transport.beat(),phase:__sri.state.beat})')
        check('instrument has no AudioContext or scheduled notes before a user gesture',not initial['sound']['enabled'] and initial['sound']['muted'] and initial['sound']['scheduledNotes']==0,initial)
        await page.locator('#begin-sound').click()
        await page.wait_for_function('__sri.sound.context?.state==="running"&&!__sri.sound.muted',timeout=30000)
        await page.evaluate('''()=>{const s=__sri.sound;window.__audioWitness=s.context.createAnalyser();s.compressor.connect(__audioWitness);}''')
        await page.wait_for_function('__sri.sound.stats().scheduledNotes>=2',timeout=30000)
        await page.wait_for_timeout(150)
        audible=await page.evaluate('''()=>{const data=new Float32Array(__audioWitness.fftSize);__audioWitness.getFloatTimeDomainData(data);return {sound:__sri.sound.stats(),rms:Math.sqrt(data.reduce((s,v)=>s+v*v,0)/data.length),maxAbs:Math.max(...data.map(Math.abs)),time:__sri.transport.time(),beat:__sri.transport.beat(),visualBeat:__sri.state.beat};}''')
        check('explicit gesture creates a running native audio graph',audible['sound']['enabled'] and audible['sound']['contextState']=='running' and audible['sound']['clock']=='audio',audible['sound'])
        check('native audio graph produces nonzero sampled output',audible['rms']>1e-6,{'rms':audible['rms'],'maxAbs':audible['maxAbs']})
        check('visual state samples the shared audio-clock phase',abs(audible['beat']-audible['visualBeat'])<.3,{'transportBeat':audible['beat'],'visualBeat':audible['visualBeat'],'allowedFrameObservationLagBeats':.3})

        # The live test changes tempo atomically to measure continuity, followed
        # by a real focused slider key action to check the DOM binding.
        tempo=await page.evaluate('''()=>{const t=__sri.transport,before={time:t.time(),beat:t.beat()};t.setTempo(72);__sri.sound.tick();return {before,after:{time:t.time(),beat:t.beat()},bpm:t.bpm};}''')
        check('live tempo change preserves current beat and transport time',tempo['bpm']==72 and abs(tempo['after']['beat']-tempo['before']['beat'])<.02 and abs(tempo['after']['time']-tempo['before']['time'])<.02,tempo)
        await page.locator('#play').click()
        frozen=await page.evaluate('({time:__sri.transport.time(),beat:__sri.transport.beat(),state:__sri.transport.state})')
        await page.wait_for_timeout(250)
        later=await page.evaluate('({time:__sri.transport.time(),beat:__sri.transport.beat(),state:__sri.transport.state})')
        check('pause freezes the actual common audiovisual transport',frozen==later and later['state']=='paused',{'before':frozen,'after':later})
        await page.locator('#studio-open').click()
        await page.locator('#tempo').press('End')
        check('tempo slider reaches the native scheduler',await page.evaluate('__sri.transport.bpm')==100)
        await page.locator('#root').select_option('108')
        await page.locator('#volume').press('End')
        controls=await page.evaluate('({root:__sri.sound.rootHz,volume:__sri.sound.volume,limit:__sri.sound.stats().maxMasterGain})')
        check('tuning and level controls reach the bounded sound graph',controls=={'root':108,'volume':1,'limit':.22},controls)
        await page.locator('#studio-close').click()
        await page.locator('#play').click()
        await page.wait_for_function('__sri.transport.state==="running"',timeout=10000)
        peak_voices=0
        for _ in range(8):
            await page.wait_for_timeout(100)
            peak_voices=max(peak_voices,await page.evaluate('__sri.sound.stats().activeVoices'))
        check('native pluck voices stay inside the allocation bound',peak_voices<=12,{'observedPeakActiveVoices':peak_voices,'voiceCap':12})
        muted=await page.evaluate('''()=>{const t=__sri.transport,before={time:t.time(),beat:t.beat()};__sri.sound.setMuted(true);return {before,after:{time:t.time(),beat:t.beat()},clock:t.clock};}''')
        check('mute changes clock ownership without a phase reset',muted['clock']=='performance' and abs(muted['after']['beat']-muted['before']['beat'])<.02 and abs(muted['after']['time']-muted['before']['time'])<.02,muted)
        await page.wait_for_timeout(500)
        silent=await page.evaluate('''()=>{const data=new Float32Array(__audioWitness.fftSize);__audioWitness.getFloatTimeDomainData(data);return {rms:Math.sqrt(data.reduce((s,v)=>s+v*v,0)/data.length),beat:__sri.transport.beat(),time:__sri.transport.time()};}''')
        check('muting silences the graph while the visual phase advances',silent['beat']>muted['after']['beat'] and silent['rms']<audible['rms']*.15,{'mutedRms':silent['rms'],'initialRms':audible['rms'],'beatAdvanced':silent['beat']-muted['after']['beat']})
        before_unmute=await page.evaluate('({time:__sri.transport.time(),beat:__sri.transport.beat(),wall:performance.now()/1000})')
        await page.locator('#sound').click()
        after_unmute=await page.evaluate('({time:__sri.transport.time(),beat:__sri.transport.beat(),wall:performance.now()/1000,clock:__sri.transport.clock,muted:__sri.sound.muted})')
        time_error=(after_unmute['time']-before_unmute['time'])-(after_unmute['wall']-before_unmute['wall'])
        check('sound button resumes audio clock at the advancing visual phase',after_unmute['clock']=='audio' and not after_unmute['muted'] and abs(time_error)<.08,{'before':before_unmute,'after':after_unmute,'wallVsTransportTransitionErrorSeconds':time_error})
        await page.wait_for_timeout(150)
        final=await page.evaluate('__sri.sound.stats()')
        await page.evaluate('__sri.sound.dispose()')
        check('dispose closes the actual audio context',await page.evaluate('__sri.sound.context.state')=='closed')
        check('no page or console errors',not errors,errors)
        check('standalone sound uses no external network assets',not external,external)
        report={'status':'pass','target':'source' if args.source else 'standalone file://','artifactSha256':None if args.source else hashlib.sha256(args.standalone.read_bytes()).hexdigest(),'browser':browser.version,'locale':'en-US','scope':'Native Web Audio graph, sampled signal and transport behavior in headless Chromium. Playwright mutes hardware output; no human listening, sound-pressure, perceptual-latency or acoustic-quality claim. X3D uses SwiftShader.','checks':checks,'nativeSignal':{'rms':audible['rms'],'maxAbs':audible['maxAbs']},'peakActiveVoices':peak_voices,'finalSoundStats':final,'errors':errors,'externalRequests':external}
        args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report,indent=2))
        await browser.close()

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--browser',default='/tmp/chromium');p.add_argument('--source',action='store_true');p.add_argument('--standalone',type=Path,default=DEFAULT_STANDALONE);p.add_argument('--output',type=Path,default=ROOT/'docs/audio-browser-validation.json');args=p.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:asyncio.run(validate(args,server.server_port))
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
