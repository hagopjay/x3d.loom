"""Build a GaussianSplats page from src/viewer-v3.tpl.html.
python3 -I src/build-v3.py SCENE.x3d OUT.html [--title T --h1 H --sub S]
No scene is embedded in this repository except demo/splat-test.x3d (procedural, made by src/gen-splat-test.py);
the page is built from whatever X3D 4.1 file with a GaussianSplats node you pass."""
import json, pathlib, sys, argparse
here = pathlib.Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument('scene'); ap.add_argument('out')
ap.add_argument('--title', default='Gaussian splats on WebGPU'); ap.add_argument('--h1', default='X3D Gaussian splats on WebGPU')
ap.add_argument('--sub', default='A scene written as X3D 4.1 with a GaussianSplats node. This page parses it, sorts the splats on the GPU and draws them with WebGPU.')
ap.add_argument('--about', action='append', default=[])
a = ap.parse_args()
tpl = (here / 'viewer-v3.tpl.html').read_text()
x3d = pathlib.Path(a.scene).read_text().strip()
assert '</script' not in x3d.lower()
# ComposedShader ports are not used on this page; the template still names their keys
KEYS = dict(tracks='da010848-2732de59', towers='e899d3ba-71ea799c', shells='2318d20e-451c1b62', flash='1bc84a9f-b6fcc411', haze='07e052cf-7ecaed2f')
about = ['The splats are read from the X3D itself: positions, linear scales, orientations (x y z w), opacities and the degree-0 colour coefficient. Colour is 0.5 + 0.28209 × coefficient, as in the reference renderer.',
         'Each frame the page sorts the splats by view depth on the GPU (a bitonic network in a compute shader, only when the view changes), then draws each as a camera-facing quad with a Gaussian falloff. The covariance and the 3-sigma quad follow the reference renderer, X_ITE.',
         'Spherical-harmonic degrees above 0 and view-dependent colour are not drawn. Drag to look around, scroll to change the lens, 1 2 … viewpoints, Space pause, S source, H hide.',
         'Nothing here is timed for a benchmark, and nothing is sent.'] + a.about
frag = tpl
for k, v in dict(TITLE=a.title, H1=a.h1, SUB=a.sub, MARQUE='', LEGEND='', LOGHINT='Viewpoint binds show here.', STANDALONE='x3d.webgpu/demo/pantheon-splats.html',
                 ARIA='X3D Gaussian-splat scene drawn with WebGPU',
                 ABOUT='\n'.join('        <li>' + x + '</li>' for x in about)).items():
    frag = frag.replace('@@' + k + '@@', v)
OPTS = dict(splatsOnly=True, caption='X3D Gaussian splats on WebGPU · render of a splat scene', look='authored', displayReferred=False, tonemap='exp', bloom=0.0, bloomThreshold=0.8, exposure=1.0, glare=0.0, saturation=1.0, contrast=1.0, grade='luminance', quality='balanced',
            hdrGain=1.0, plainGain=1.0, floorY=None, zoomIn=0.08, zoomOut=4, particleLabel='Particles', particleRange=[100, 250000], partGain=1.0, partGainHDR=1.0,
            startAtCycle=False, lineWidthPx=1.1, clock=None, clockLabel='Time', slowMotion=False, tourDwell=12, tourOnStart=False)
frag = frag.replace('@@OPTS@@', json.dumps(OPTS))
for r, k in KEYS.items(): frag = frag.replace(f'@@KEY_{r}@@', k)
frag = frag.replace('@@X3D@@', x3d)
cut = frag.index('\n<div id="stage">')
head, body = frag[:cut], frag[cut:]
pathlib.Path(a.out).write_text('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                               + head + '\n</head>\n<body>' + body + '\n</body>\n</html>\n')
print(a.out, len(frag))
