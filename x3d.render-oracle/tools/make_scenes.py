#!/usr/bin/env python3
"""Writes scenes/*.x3d: 12 lit, coloured, asymmetric scenes for the render oracle (step 3). No EnvironmentLight, no headlight tricks except where named.
usage: make_scenes.py OUTDIR"""
import sys, pathlib
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="Full" version="4.0"><head><meta name="title" content="%s"/><meta name="description" content="%s"/></head><Scene>\n'
def mat(c, **k): return '<Material diffuseColor="%s" %s/>' % (c, ' '.join(f'{a}="{b}"' for a, b in k.items()))
def shape(geo, m, extra=''): return f'<Shape><Appearance>{m}{extra}</Appearance>{geo}</Shape>'
def T(t, body, r='', s=''): return f'<Transform translation="{t}" {"rotation=%r" % r if r else ""} {"scale=%r" % s if s else ""}>{body}</Transform>'.replace("'", '"')
VP = '<Viewpoint position="0 0.6 7" orientation="1 0 0 -0.08" fieldOfView="0.7854"/>\n<Background skyColor="0.08 0.1 0.16"/>\n'
NAV = '<NavigationInfo headlight="false" type=\'"NONE"\'/>\n'
S = {}
S['dir_diffuse_colour'] = ('Red box, green cone, one DirectionalLight from the upper left', NAV + VP + '<DirectionalLight direction="0.6 -0.7 -0.5" intensity="1" color="1 0.95 0.9"/>' +
    T('-1.6 -0.2 0', shape('<Box size="1.6 1.2 1"/>', mat('0.9 0.15 0.1')), '0 1 0 0.5') + T('1.4 -0.3 0.4', shape('<Cone bottomRadius="0.9" height="1.8"/>', mat('0.1 0.7 0.2'))))
S['dir_specular'] = ('Off-centre blue sphere with a specular highlight', NAV + VP + '<DirectionalLight direction="-0.5 -0.4 -0.8" intensity="1"/>' +
    T('0.9 0.2 0', shape('<Sphere radius="1.3"/>', mat('0.1 0.2 0.8', specularColor='1 1 1', shininess='0.6'))))
S['point_attenuation'] = ('Point light with attenuation next to a yellow sphere and a purple box', NAV + VP + '<PointLight location="-1 2 2.5" attenuation="1 0.1 0.05" intensity="2" color="1 1 1" radius="30"/>' +
    T('-1.7 0 0', shape('<Sphere radius="1"/>', mat('0.9 0.8 0.1'))) + T('1.6 -0.2 0', shape('<Box size="1.5 1.5 1.5"/>', mat('0.6 0.2 0.7')), '0 1 0 0.7'))
S['spot_cone'] = ('Spot light on a tilted white slab and a small orange box', NAV + VP + '<SpotLight location="0 3 3" direction="0.1 -0.7 -0.7" beamWidth="0.3" cutOffAngle="0.6" intensity="3" radius="30"/>' +
    T('0 -1 0', shape('<Box size="5 0.2 3"/>', mat('0.85 0.85 0.85'))) + T('0.8 -0.4 0.3', shape('<Box size="0.7 0.7 0.7"/>', mat('0.95 0.5 0.1')), '0 1 0 0.4'))
S['headlight_coloured'] = ('Default headlight on a tilted teal cylinder and a magenta sphere', VP + '<NavigationInfo headlight="true" type=\'"NONE"\'/>' +
    T('-1.5 0 0', shape('<Cylinder radius="0.8" height="2.2"/>', mat('0.05 0.6 0.6')), '1 0 1 0.6') + T('1.5 -0.4 0.5', shape('<Sphere radius="0.8"/>', mat('0.8 0.1 0.6'))))
S['transform_nest'] = ('Nested rotated and scaled boxes in three colours, one DirectionalLight', NAV + VP + '<DirectionalLight direction="-0.4 -0.8 -0.6" intensity="1"/>' +
    T('-1.2 0.3 0', shape('<Box size="1.5 1.5 1.5"/>', mat('0.85 0.2 0.2')) + T('1.4 0 0', shape('<Box size="1 1 1"/>', mat('0.2 0.85 0.2')) + T('1 0.2 0', shape('<Box size="1 1 1"/>', mat('0.2 0.2 0.9')), '0 0 1 0.5'), '0 1 0 0.6', '0.8 1.2 1'), '0 1 0 0.3'))
S['emissive_ambient'] = ('Emissive and ambient terms: dim directional light, emissive grey box, ambient-heavy red sphere', NAV + VP + '<DirectionalLight direction="0 -1 -0.3" intensity="0.4" ambientIntensity="0.5"/>' +
    T('-1.4 0 0', shape('<Box size="1.4 1.4 1.4"/>', mat('0.2 0.2 0.2', emissiveColor='0.5 0.35 0.1'))) + T('1.4 0 0', shape('<Sphere radius="1"/>', mat('0.8 0.1 0.1', ambientIntensity='0.9'))))
S['transparency'] = ('Two overlapping spheres, the near one half transparent', NAV + VP + '<DirectionalLight direction="-0.3 -0.5 -0.8" intensity="1"/>' +
    T('-0.5 0 -0.8', shape('<Sphere radius="1.2"/>', mat('0.1 0.7 0.2'))) + T('0.6 0.1 0.5', shape('<Sphere radius="1.2"/>', mat('0.9 0.2 0.2', transparency='0.5'))))
S['texture_pixel'] = ('Asymmetric 4x4 PixelTexture on a box, directional light', NAV + VP + '<DirectionalLight direction="-0.3 -0.6 -0.7" intensity="1"/>' +
    T('0 0 0', shape('<Box size="2.4 2.4 2.4"/>', mat('1 1 1'), '<PixelTexture image="4 4 3 0xff0000 0x00ff00 0x0000ff 0xffffff 0x000000 0xffff00 0x00ffff 0xff00ff 0x808080 0xff8000 0x8000ff 0x00ff80 0x400000 0x004000 0x000040 0xc0c0c0" repeatS="false" repeatT="false"/>'), '0 1 0 0.6'))
S['physical_direct'] = ('PhysicalMaterial copper-like metal and rough red, DirectionalLight only, no environment', NAV + VP + '<DirectionalLight direction="-0.4 -0.5 -0.8" intensity="2"/>' +
    T('-1.5 0 0', shape('<Sphere radius="1.1"/>', '<PhysicalMaterial baseColor="0.95 0.55 0.35" metallic="1" roughness="0.35"/>')) + T('1.5 0 0', shape('<Box size="1.6 1.6 1.6"/>', '<PhysicalMaterial baseColor="0.8 0.1 0.1" metallic="0" roughness="0.8"/>'), '0 1 0 0.6'))
S['fog_linear'] = ('Linear fog over boxes receding in depth', NAV + VP + '<Fog color="0.7 0.75 0.85" fogType="LINEAR" visibilityRange="14"/><DirectionalLight direction="-0.3 -0.6 -0.7" intensity="1"/>' +
    ''.join(T(f'{-2 + i * 1.0} {-0.5 + 0.2 * i} {-i * 3}', shape('<Box size="1.2 1.8 1.2"/>', mat('0.85 0.35 0.15'))) for i in range(5)))
S['ifs_smooth'] = ('Asymmetric IndexedFaceSet with creaseAngle, directional light', NAV + VP + '<DirectionalLight direction="-0.5 -0.6 -0.6" intensity="1"/>' +
    T('0 -0.3 0', shape('<IndexedFaceSet creaseAngle="1.0" coordIndex="0 1 2 -1 0 2 3 -1 0 3 4 -1 0 4 1 -1 1 4 3 2 -1"><Coordinate point="0 1.6 0.2 -1.4 -0.8 1 1.6 -0.7 1.2 1.2 -0.9 -1.3 -1.5 -0.6 -1.1"/></IndexedFaceSet>', mat('0.9 0.7 0.2'))))
for k, (d, body) in S.items():
    (out / f'lit_{k}.x3d').write_text(HEAD % ('lit_' + k, d) + body + '\n</Scene></X3D>\n')
print(len(S), 'scenes')
