#!/usr/bin/env python3
"""Generates fault/twin/decoy scenes and helper media for set c. Run: python3 harness/gen.py"""
import json, os, struct, wave, math
from PIL import Image, ImageDraw

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

HEAD = """<?xml version="1.0" encoding="UTF-8"?>
<X3D profile='Immersive' version='4.0' xmlns:xsd='http://www.w3.org/2001/XMLSchema-instance' xsd:noNamespaceSchemaLocation='https://www.web3d.org/specifications/x3d-4.0.xsd'>
  <head>
{comps}{metas}  </head>
  <Scene>
{body}  </Scene>
</X3D>
"""

def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace("'", '&apos;')

def doc(comps, prose, intents, body):
    c = ''.join("    <component name='%s' level='%d'/>\n" % x for x in comps)
    m = "    <meta name='intent:prose' content='%s'/>\n" % esc(prose)
    for i in intents:
        m += "    <meta name='intent' content='%s'/>\n" % esc(i)
    return HEAD.format(comps=c, metas=m, body=body.strip('\n') + '\n')

PAIRS = []
def pair(comps, prose, intents, body, fault, twin, says=None, **man):
    man["fault"] = says
    PAIRS.append(dict(comps=comps, prose=prose, intents=intents, body=body, fault=fault, twin=twin, man=man))

# 01 ------------------------------------------------------------------
pair([("Lighting", 3)], "A ceiling lamp fixture lights the table and the floor of a small room; the viewer's headlight is off.", [], """
    <NavigationInfo headlight='false'/>
    <Background skyColor='0.05 0.05 0.08'/>
    <Viewpoint description='Room' position='0 2 9' orientation='1 0 0 -0.15'/>
    <Transform DEF='CeilingLamp' translation='0 4 0'>
      <DirectionalLight DEF='LampLight' direction='-0.3 -1 -0.4' intensity='1'@@/>
      <Shape>
        <Appearance>
          <Material diffuseColor='0 0 0' emissiveColor='1 1 0.8'/>
        </Appearance>
        <Sphere radius='0.2'/>
      </Shape>
    </Transform>
    <Transform DEF='Table' translation='0 0.5 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.8 0.3 0.2'/>
        </Appearance>
        <Box size='2 1 1'/>
      </Shape>
    </Transform>
    <Transform DEF='Floor' translation='0 -0.05 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.7 0.7 0.7'/>
        </Appearance>
        <Box size='8 0.1 8'/>
      </Shape>
    </Transform>
""", "", " global='true'",
     category="light scope",
     says="The DirectionalLight sits inside the lamp fixture's Transform with the default global='false', so it lights only the fixture's own children and not the table or floor.",
     viewer_sees="Only the glowing lamp bulb; the table and floor stay black.",
     spec="legal, plays wrong",
     nearest_prior="P077: there the scene has no light at all; here a light exists but its scope excludes the objects it is meant to light.")

# 02 ------------------------------------------------------------------
pair([("Lighting", 3)], "A lantern on a pole lights the three pillars standing five metres around it; the viewer's headlight is off.", [], """
    <NavigationInfo headlight='false'/>
    <Background skyColor='0.02 0.02 0.05'/>
    <Viewpoint description='Courtyard' position='0 3 14' orientation='1 0 0 -0.12'/>
    <PointLight DEF='Lantern' location='0 3 0' color='1 0.9 0.7' radius='@@'/>
    <Transform translation='0 1.5 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.3 0.3 0.3'/>
        </Appearance>
        <Cylinder radius='0.05' height='3'/>
      </Shape>
    </Transform>
    <Transform translation='-5 1 0'>
      <Shape DEF='Pillar'>
        <Appearance>
          <Material diffuseColor='0.8 0.8 0.75'/>
        </Appearance>
        <Cylinder radius='0.4' height='2'/>
      </Shape>
    </Transform>
    <Transform translation='5 1 0'>
      <Shape USE='Pillar'/>
    </Transform>
    <Transform translation='0 1 -5'>
      <Shape USE='Pillar'/>
    </Transform>
""", "3", "12",
     category="light radius",
     says="The PointLight radius is 3, less than the distance to any pillar, so the light reaches none of them.",
     viewer_sees="The pillars are black against the dark sky; only the part of the pole near the lantern is lit.",
     spec="legal, plays wrong",
     nearest_prior="P077: closest listed lighting fault (no light at all); here the light is on but its radius ends before the lit objects.")

# 03 ------------------------------------------------------------------
pair([], "A copper-coloured ball with a physically based surface.", [], """
    <Background skyColor='0.2 0.2 0.25'/>
    <Viewpoint description='Ball' position='0 0 5'/>
    <DirectionalLight direction='-0.4 -0.6 -1' global='true'/>
    <Shape DEF='Ball'>
      <Appearance>
        <PhysicalMaterial @@='0.85 0.45 0.2' metallic='0.1' roughness='0.5'/>
      </Appearance>
      <Sphere radius='1.2'/>
    </Shape>
""", "diffuseColor", "baseColor",
     category="physical material",
     says="PhysicalMaterial is given a diffuseColor attribute; it has no such field (its colour field is baseColor), so the colour is dropped.",
     viewer_sees="A white ball instead of a copper one.",
     spec="error per the X3D standard (PhysicalMaterial has no diffuseColor field; Shape component, PhysicalMaterial interface)",
     nearest_prior="P031: a PhysicalMaterial value out of range; here a field from the classic Material is used on the physical one.")

# 04 ------------------------------------------------------------------
pair([], "A yellow line chart with two grey axes drawn against the default black background.", [], """
    <Viewpoint description='Chart' position='2 1.5 7'/>
    <Shape DEF='Axes'>
      <Appearance>
        <Material diffuseColor='0 0 0' emissiveColor='0.6 0.6 0.6'/>
      </Appearance>
      <IndexedLineSet coordIndex='0 1 -1 0 2 -1'>
        <Coordinate point='0 0 0 4 0 0 0 3 0'/>
      </IndexedLineSet>
    </Shape>
    <Shape DEF='Curve'>
      <Appearance>
        <LineProperties linewidthScaleFactor='3'/>
        <Material @@/>
      </Appearance>
      <IndexedLineSet coordIndex='0 1 2 3 4 -1'>
        <Coordinate point='0 0.5 0 1 1.5 0 2 1 0 3 2.5 0 4 2 0'/>
      </IndexedLineSet>
    </Shape>
""", "diffuseColor='1 0.8 0'", "diffuseColor='0 0 0' emissiveColor='1 0.8 0'",
     category="material on lines",
     says="The curve's colour is put in diffuseColor; lines are not lit and take their colour from emissiveColor, which is left black.",
     viewer_sees="The axes are visible but the curve is black on black, so it cannot be seen.",
     spec="legal, plays wrong",
     nearest_prior="none: no listed mistake concerns the colour of line geometry.")

# 05 ------------------------------------------------------------------
pair([], "A square tile carries a two by two red and white checker pattern.", [], """
    <Background skyColor='0.1 0.1 0.3'/>
    <Viewpoint description='Tile' position='0 0 4'/>
    <Shape DEF='Tile'>
      <Appearance>
        <PixelTexture image='2 2 3 0xFF0000 0xFFFFFF 0xFFFFFF@@'>
          <TextureProperties magnificationFilter='NEAREST_PIXEL' minificationFilter='NEAREST_PIXEL'/>
        </PixelTexture>
      </Appearance>
      <Box size='2 2 0.1'/>
    </Shape>
""", "", " 0xFF0000",
     category="texture pixels",
     says="The PixelTexture image declares 2 x 2 pixels but lists only three pixel values.",
     viewer_sees="No checker pattern (the texture is rejected or the last pixel is undefined).",
     spec="error per the X3D standard (SFImage: width*height pixel values shall follow the three header numbers)",
     nearest_prior="P067: a count mismatch in TextureCoordinate; here the mismatch is in the pixel data of the image itself.")

# 06 ------------------------------------------------------------------
pair([], "A wall is covered with a brick picture repeated four times across and four times up.", [], """
    <Background skyColor='0.3 0.4 0.5'/>
    <Viewpoint description='Wall' position='0 0 6'/>
    <Shape DEF='Wall'>
      <Appearance>
        <ImageTexture DEF='Bricks' url='"helper-bricks.png"' @@/>
        <TextureTransform scale='4 4'/>
      </Appearance>
      <Box size='4 4 0.2'/>
    </Shape>
""", "repeatS='false' repeatT='false'", "repeatS='true' repeatT='true'",
     category="texture repeat",
     says="repeatS and repeatT are false, so texture coordinates beyond 0..1 are clamped and the picture cannot tile.",
     viewer_sees="One small copy of the brick picture in a corner with its edge pixels smeared across the rest of the wall.",
     spec="legal, plays wrong",
     nearest_prior="P112: there the TextureTransform scale was inverted; here the scale is right but repetition is switched off on the texture.")

# 07 ------------------------------------------------------------------
pair([], "A signboard shows the arrow picture upright, with the arrow pointing up.", [], """
    <Background skyColor='0.2 0.2 0.2'/>
    <Viewpoint description='Sign' position='0 0 5'/>
    <Shape DEF='Signboard'>
      <Appearance>
        <ImageTexture url='"helper-arrow.png"'/>
      </Appearance>
      <IndexedFaceSet coordIndex='0 1 2 3 -1' texCoordIndex='0 1 2 3 -1' solid='false'>
        <Coordinate point='-1.5 -1.5 0 1.5 -1.5 0 1.5 1.5 0 -1.5 1.5 0'/>
        <TextureCoordinate point='@@'/>
      </IndexedFaceSet>
    </Shape>
""", "0 1 1 1 1 0 0 0", "0 0 1 0 1 1 0 1",
     category="texture coordinates",
     says="The texture coordinates assume the image origin is at the top left; X3D puts t=0 at the bottom, so the picture is mapped upside down.",
     viewer_sees="The arrow points down.",
     spec="legal, plays wrong",
     nearest_prior="P067: too few texture coordinates; here the count is right but the vertical axis is inverted.")

# 08 ------------------------------------------------------------------
pair([], "A square panel whose four corners are red, green, blue and yellow, blending smoothly across the face.", [], """
    <Background skyColor='0.15 0.15 0.15'/>
    <Viewpoint description='Panel' position='0 0 5'/>
    <Shape DEF='Panel'>
      <IndexedFaceSet coordIndex='0 1 2 3 -1' solid='false'>
        <Coordinate point='-1.5 -1.5 0 1.5 -1.5 0 1.5 1.5 0 -1.5 1.5 0'/>
        <@@ color='1 0 0 1  0 1 0 1  0 0 1 1  1 1 0 1'/>
      </IndexedFaceSet>
    </Shape>
""", "Color", "ColorRGBA",
     category="colour per vertex",
     says="Four-component RGBA values are written into a Color node, which holds three-component colours, so the 16 numbers are regrouped as five and a third wrong colours.",
     viewer_sees="The corners show the wrong colours (red, yellow-ish, magenta, and so on) or the colours are rejected.",
     spec="error per the X3D standard (MFColor values are triples; 16 numbers is not a whole number of colours)",
     nearest_prior="P106: colours applied per vertex instead of per face; here the colour tuples themselves have the wrong arity for the node.")

# 09 ------------------------------------------------------------------
pair([], "A blue-tinted glass pane stands in front of a yellow ball, and the ball is seen through the tint.", [], """
    <Background skyColor='0.9 0.9 0.9'/>
    <Viewpoint description='Window' position='0 0 7'/>
    <Shape DEF='Ball'>
      <Appearance>
        <Material diffuseColor='1 0.9 0.1'/>
      </Appearance>
      <Sphere radius='1'/>
    </Shape>
    <Transform translation='0 0 2'>
      <Shape DEF='Pane'>
        <Appearance alphaMode='@@'>
          <Material diffuseColor='0.1 0.2 0.9' transparency='0.7'/>
        </Appearance>
        <Box size='3.5 3.5 0.05'/>
      </Shape>
    </Transform>
""", "MASK", "BLEND",
     category="transparency and blending",
     says="The pane's Appearance uses alphaMode MASK; with the default alphaCutoff 0.5 its alpha of 0.3 is below the cutoff, so the whole pane is discarded.",
     viewer_sees="No pane at all: the ball is seen untinted against the bright background.",
     spec="legal, plays wrong",
     nearest_prior="P111: transparency 1 used for opaque; here the transparency value is right but the alpha mode discards the surface.")

# 10 ------------------------------------------------------------------
pair([], "A station sign shows the words Platform 9 on one line.", ["after 2s: Sign.textBounds[0] > 1"], """
    <Background skyColor='0.1 0.15 0.3'/>
    <Viewpoint description='Sign' position='2 0.3 7'/>
    <Shape>
      <Appearance>
        <Material diffuseColor='1 1 1'/>
      </Appearance>
      <Text DEF='Sign' string=@@>
        <FontStyle family='"SANS"' size='1'/>
      </Text>
    </Shape>
""", "'Platform 9'", "'\"Platform 9\"'",
     category="text string",
     says="The Text string is written as bare words; it is an MFString and each string must be enclosed in double quotes.",
     viewer_sees="No sign text, or the words split into separate lines.",
     spec="error per the X3D standard (XML encoding: MFString values are quoted strings)",
     nearest_prior="none: no listed mistake concerns string quoting.")

# 11 ------------------------------------------------------------------
pair([], "The title GALLERY is centred left to right above the middle of the doorway.", ["after 2s: Title.origin[0] < -0.5"], """
    <Background skyColor='0.25 0.2 0.15'/>
    <Viewpoint description='Entrance' position='0 1.5 9'/>
    <Transform DEF='Doorway' translation='0 1 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.4 0.25 0.1'/>
        </Appearance>
        <Box size='1.2 2 0.1'/>
      </Shape>
    </Transform>
    <Transform translation='0 2.4 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='1 1 0.9'/>
        </Appearance>
        <Text DEF='Title' string='"GALLERY"'>
          <FontStyle family='"SANS"' size='0.8' justify='"@@"'/>
        </Text>
      </Shape>
    </Transform>
""", "CENTER", "MIDDLE",
     category="font style",
     says="FontStyle justify is \"CENTER\", which is not one of the allowed values (BEGIN, FIRST, MIDDLE, END).",
     viewer_sees="The title starts at the doorway's centre line and runs off to the right instead of being centred.",
     spec="error per the X3D standard (FontStyle justify enumeration)",
     nearest_prior="none: no listed mistake concerns FontStyle.")

# 12 ------------------------------------------------------------------
pair([], "A row of red posts recedes into pale mist, each post fainter than the one before, the farthest almost gone.", [], """
    <Background skyColor='0.8 0.8 0.85'/>
    <Viewpoint description='Along the posts' position='-3 1.5 4' orientation='0 1 0 -0.25'/>
    <Fog DEF='Mist' color='0.8 0.8 0.85' fogType='LINEAR'@@/>
    <Transform translation='0 1 -5'>
      <Shape DEF='Post'>
        <Appearance>
          <Material diffuseColor='0.8 0.1 0.1'/>
        </Appearance>
        <Cylinder radius='0.3' height='2'/>
      </Shape>
    </Transform>
    <Transform translation='0 1 -15'>
      <Shape USE='Post'/>
    </Transform>
    <Transform translation='0 1 -25'>
      <Shape USE='Post'/>
    </Transform>
    <Transform translation='0 1 -35'>
      <Shape USE='Post'/>
    </Transform>
    <Transform translation='0 1 -45'>
      <Shape USE='Post'/>
    </Transform>
""", "", " visibilityRange='50'",
     category="fog",
     says="The Fog has a colour and type but no visibilityRange; the default 0 means no fog at all.",
     viewer_sees="All posts are equally vivid red; there is no mist.",
     spec="legal, plays wrong",
     nearest_prior="P094: a sensor left at a disabling default size; here the node and field are different (Fog range) though the pattern of a disabling default is similar.")

# 13 ------------------------------------------------------------------
pair([], "An evening sky: deep blue overhead fading to orange at the horizon, above dark ground.", [], """
    <Background DEF='Evening' skyAngle='1.1 1.5708' skyColor='@@' groundAngle='1.5708' groundColor='0.08 0.08 0.08 0.15 0.12 0.1'/>
    <Viewpoint description='Horizon' position='0 1.6 0'/>
    <Transform translation='0 0.5 -8'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.2 0.2 0.2'/>
        </Appearance>
        <Box size='1 1 1'/>
      </Shape>
    </Transform>
""", "1 0.5 0.1 0.4 0.4 0.7 0.02 0.05 0.3", "0.02 0.05 0.3 0.4 0.4 0.7 1 0.5 0.1",
     category="background",
     says="The sky colours are listed from the horizon upward; skyColor starts at the zenith, so the gradient is upside down.",
     viewer_sees="Deep blue at the horizon and orange straight overhead.",
     spec="legal, plays wrong",
     nearest_prior="P039: the number of sky colours did not match the angles; here the count is right and the order is reversed.")

# 14 ------------------------------------------------------------------
pair([("Lighting", 3)], "A ball hovers over a floor and the sun throws its shadow on the floor; the viewer's headlight is off.", [], """
    <NavigationInfo headlight='false'/>
    <Background skyColor='0.5 0.6 0.8'/>
    <Viewpoint description='Floor' position='0 4 10' orientation='1 0 0 -0.3'/>
    <DirectionalLight DEF='Sun' direction='-0.5 -1 -0.3' global='true' shadowIntensity='0.8'@@/>
    <Transform translation='0 1.5 0'>
      <Shape DEF='Ball'>
        <Appearance>
          <Material diffuseColor='0.9 0.2 0.2'/>
        </Appearance>
        <Sphere radius='0.7'/>
      </Shape>
    </Transform>
    <Transform translation='0 -0.05 0'>
      <Shape DEF='Floor'>
        <Appearance>
          <Material diffuseColor='0.85 0.85 0.8'/>
        </Appearance>
        <Box size='10 0.1 10'/>
      </Shape>
    </Transform>
""", "", " shadows='true'",
     category="shadows",
     says="The light sets shadowIntensity but leaves shadows at its default false, so no shadow is cast.",
     viewer_sees="The floor is evenly lit with no shadow under the ball.",
     spec="legal, plays wrong",
     nearest_prior="none: no listed mistake concerns shadows.")

# 15 ------------------------------------------------------------------
pair([], "A vase stands thirty metres east of the origin and the viewer examines it by orbiting around it.", [], """
    <NavigationInfo type='"EXAMINE" "ANY"'/>
    <Background skyColor='0.3 0.3 0.35'/>
    <Viewpoint DEF='VaseView' description='Vase' position='30 1 8'@@/>
    <Transform DEF='Vase' translation='30 1 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.2 0.6 0.7'/>
        </Appearance>
        <Cylinder radius='0.6' height='2'/>
      </Shape>
      <Transform translation='0 1.3 0'>
        <Shape>
          <Appearance>
            <Material diffuseColor='0.2 0.6 0.7'/>
          </Appearance>
          <Cone bottomRadius='0.9' height='0.6'/>
        </Shape>
      </Transform>
    </Transform>
""", "", " centerOfRotation='30 1 0'",
     category="viewpoint",
     says="The Viewpoint keeps the default centerOfRotation 0 0 0 although the vase is at 30 1 0, so examining orbits around empty space thirty metres away.",
     viewer_sees="On the first drag the vase swings out of view instead of turning in place.",
     spec="legal, plays wrong",
     nearest_prior="P114: a viewpoint looking the wrong way; here the view is right at load and the orbit centre is wrong.")

# 16 ------------------------------------------------------------------
pair([("Navigation", 3)], "A floor plan seen straight from above in a parallel view eight metres wide and six metres deep, showing all four corner blocks.", [], """
    <Background skyColor='0.95 0.95 0.95'/>
    <OrthoViewpoint DEF='Plan' description='Plan' position='0 10 0' orientation='1 0 0 -1.5708' fieldOfView='@@'/>
    <Transform translation='-3 0.5 -2'>
      <Shape DEF='Block'>
        <Appearance>
          <Material diffuseColor='0.2 0.3 0.8'/>
        </Appearance>
        <Box size='1 1 1'/>
      </Shape>
    </Transform>
    <Transform translation='3 0.5 -2'>
      <Shape USE='Block'/>
    </Transform>
    <Transform translation='-3 0.5 2'>
      <Shape USE='Block'/>
    </Transform>
    <Transform translation='3 0.5 2'>
      <Shape USE='Block'/>
    </Transform>
    <Transform translation='0 0.5 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.8 0.5 0.1'/>
        </Appearance>
        <Cylinder radius='0.8' height='1'/>
      </Shape>
    </Transform>
""", "-4 4 -3 3", "-4 -3 4 3",
     category="orthographic viewpoint",
     says="The OrthoViewpoint fieldOfView is written as left right bottom top; the field order is minX minY maxX maxY, so the box is read as x from -4 to -3 and y from 4 to 3.",
     viewer_sees="A distorted or empty view instead of the 8 by 6 plan with four corner blocks.",
     spec="legal, plays wrong",
     nearest_prior="P076: a perspective fieldOfView given in degrees; here it is the four-number orthographic window with its components in the wrong order.")

# 17 ------------------------------------------------------------------
pair([], "From the terrace the viewer sees the near railing and, across the water, the two distant towers on the far shore.", [], """
    <NavigationInfo type='"EXAMINE" "ANY"' visibilityLimit='@@'/>
    <Background skyColor='0.5 0.7 0.9'/>
    <Viewpoint description='Terrace' position='0 1.6 0'/>
    <Transform DEF='Railing' translation='0 0.9 -3'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.5 0.35 0.2'/>
        </Appearance>
        <Box size='6 0.1 0.1'/>
      </Shape>
    </Transform>
    <Transform translation='-8 8 -60'>
      <Shape DEF='Tower'>
        <Appearance>
          <Material diffuseColor='0.85 0.8 0.7'/>
        </Appearance>
        <Box size='4 16 4'/>
      </Shape>
    </Transform>
    <Transform translation='8 8 -60'>
      <Shape USE='Tower'/>
    </Transform>
""", "25", "150",
     category="navigation settings",
     says="visibilityLimit is 25, so the far clipping plane lies in front of the towers at 60 metres.",
     viewer_sees="The railing and empty sky; the towers are clipped away.",
     spec="legal, plays wrong",
     nearest_prior="P037: an object placed absurdly far away; here the object is at a sensible distance and the navigation setting cuts it off.")

# 18 ------------------------------------------------------------------
FINE = """      <Shape DEF='GlobeFine'>
        <Appearance>
          <Material diffuseColor='0.2 0.5 0.9'/>
        </Appearance>
        <Sphere radius='1'/>
      </Shape>
"""
MED = """      <Shape DEF='GlobeMedium'>
        <Appearance>
          <Material diffuseColor='0.2 0.5 0.9'/>
        </Appearance>
        <Cylinder radius='0.9' height='1.8'/>
      </Shape>
"""
COARSE = """      <Shape DEF='GlobeCoarse'>
        <Appearance>
          <Material diffuseColor='0.2 0.5 0.9'/>
        </Appearance>
        <Box size='1.6 1.6 1.6'/>
      </Shape>
"""
pair([], "A globe is drawn as a smooth sphere when the viewer is close, as a simpler drum at middle distance and as a plain box from far away; the view starts close.", [], """
    <Background skyColor='0.1 0.1 0.15'/>
    <Viewpoint description='Close' position='0 0 6'/>
    <LOD DEF='Globe' range='12 30'>
@@    </LOD>
""", COARSE + MED + FINE, FINE + MED + COARSE,
     category="level of detail",
     says="The LOD children are listed coarsest first; the first child is the one shown nearest, so the versions are used in reverse.",
     viewer_sees="A box when close and the smooth sphere only when far away.",
     spec="legal, plays wrong",
     nearest_prior="P060: the LOD range values were out of order; here the range is right and the children are in the wrong order.")

# 19 ------------------------------------------------------------------
pair([], "The camera flies in towards a tower that stands a hundred metres east of the origin, and on arrival the tower is shown in its finest version.",
     ["send Approach.startTime = now at 0.2s", "after 3.5s: TowerDetail.level_changed == 0"], """
    <Background skyColor='0.6 0.75 0.9'/>
    <Viewpoint DEF='Camera' description='Approach' position='100 2 60'/>
    <LOD DEF='TowerDetail' range='15 40'@@>
      <Transform translation='100 0 0'>
        <Shape>
          <Appearance DEF='Stone'>
            <Material diffuseColor='0.7 0.65 0.6'/>
          </Appearance>
          <Cylinder radius='1' height='4'/>
        </Shape>
        <Transform translation='0 2.75 0'>
          <Shape>
            <Appearance>
              <Material diffuseColor='0.7 0.2 0.15'/>
            </Appearance>
            <Cone bottomRadius='1.3' height='1.5'/>
          </Shape>
        </Transform>
      </Transform>
      <Transform translation='100 0 0'>
        <Shape>
          <Appearance USE='Stone'/>
          <Cylinder radius='1' height='4'/>
        </Shape>
      </Transform>
      <Transform translation='100 0 0'>
        <Shape>
          <Appearance USE='Stone'/>
          <Box size='2 4 2'/>
        </Shape>
      </Transform>
    </LOD>
    <TimeSensor DEF='Approach' cycleInterval='2'/>
    <PositionInterpolator DEF='Path' key='0 1' keyValue='100 2 60 100 2 6'/>
    <ROUTE fromNode='Approach' fromField='fraction_changed' toNode='Path' toField='set_fraction'/>
    <ROUTE fromNode='Path' fromField='value_changed' toNode='Camera' toField='set_position'/>
""", "", " center='100 0 0'",
     category="level of detail",
     says="The LOD keeps its default center 0 0 0 although every level is drawn a hundred metres away, so the distance is measured to the origin and never falls inside the first range.",
     viewer_sees="The tower stays a plain box even when the camera is right in front of it.",
     spec="legal, plays wrong",
     nearest_prior="P120: a Transform turning about the wrong point because center was omitted; here it is the LOD's distance reference point, a different node and effect.")

# 20 ------------------------------------------------------------------
pair([], "A radio on a table at the far end of a long hall hums, and a visitor standing in front of the radio hears it.", [], """
    <Background skyColor='0.2 0.2 0.25'/>
    <Viewpoint description='At the radio' position='40 1.2 4'/>
    <Transform DEF='Radio' translation='40 1 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.6 0.1 0.1'/>
        </Appearance>
        <Box size='0.8 0.5 0.3'/>
      </Shape>
    </Transform>
    <Transform DEF='Table' translation='40 0.35 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0.5 0.35 0.2'/>
        </Appearance>
        <Box size='1.6 0.7 0.9'/>
      </Shape>
    </Transform>
    <Sound DEF='Hum'@@ minFront='2' minBack='2' maxFront='10' maxBack='10'>
      <AudioClip DEF='HumClip' url='"helper-tone.wav"' loop='true'/>
    </Sound>
""", "", " location='40 1 0'",
     category="sound placement",
     says="The Sound is a sibling of the radio's Transform and has no location, so it is emitted at the origin with a ten-metre reach, forty metres from the radio and the visitor.",
     viewer_sees="Silence at the radio; the hum is only heard near the empty origin.",
     spec="legal, plays wrong",
     nearest_prior="P092: a sensor placed in the wrong part of the tree; here it is a sound source positioned away from the object it belongs to.")

# decoys --------------------------------------------------------------
DECOYS = []
def decoy(comps, prose, intents, body, **man):
    DECOYS.append(dict(comps=comps, prose=prose, intents=intents, body=body, man=man))

decoy([("Lighting", 3)], "Two display cases, each lit only by its own lamp, one warm and one cool; the viewer's headlight is off.", [], """
    <NavigationInfo headlight='false'/>
    <Background skyColor='0.03 0.03 0.03'/>
    <Viewpoint description='Cases' position='0 1 8'/>
    <Transform DEF='WarmCase' translation='-2 0 0'>
      <DirectionalLight direction='0.3 -1 -0.5' color='1 0.7 0.4'/>
      <Shape>
        <Appearance DEF='Plaster'>
          <Material diffuseColor='0.9 0.9 0.9'/>
        </Appearance>
        <Sphere radius='1'/>
      </Shape>
    </Transform>
    <Transform DEF='CoolCase' translation='2 0 0'>
      <DirectionalLight direction='-0.3 -1 -0.5' color='0.4 0.7 1'/>
      <Shape>
        <Appearance USE='Plaster'/>
        <Sphere radius='1'/>
      </Shape>
    </Transform>
""", category="light scope", intent="each case is lit only by its own scoped light",
      why_suspicious="The headlight is off and both lights are non-global (the default), which often leaves a scene dark; here each light sits in the same group as the shape it is meant to light, so the scoping is exactly what is wanted.")

decoy([], "A two-line signpost with a blank line between NORTH and SOUTH, centred on its post and always facing the viewer.", ["after 2s: Post.origin[0] < -0.5"], """
    <Background skyColor='0.2 0.3 0.2'/>
    <Viewpoint description='Signpost' position='0 0 9'/>
    <Billboard axisOfRotation='0 0 0'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0 0 0' emissiveColor='1 1 1'/>
        </Appearance>
        <Text DEF='Post' string='"NORTH" "" "SOUTH"'>
          <FontStyle family='"SANS"' justify='"MIDDLE" "MIDDLE"' size='1' spacing='0.9'/>
        </Text>
      </Shape>
    </Billboard>
""", category="text", intent="three text lines (the middle one blank) centred both ways",
      why_suspicious="An empty string inside the MFString, a Billboard with axisOfRotation 0 0 0 and a diffuse-black emissive material all look like slips; the empty string is a legal blank line, the zero axis means viewer-aligned, and the emissive colour keeps the text bright.")

decoy([], "A telephoto view of a small red cube from eighty metres, under a sky with a single band and no far clipping limit.", [], """
    <NavigationInfo type='"EXAMINE" "ANY"' visibilityLimit='0' avatarSize='0.25 1.6 0.75'/>
    <Background skyAngle='1.5708' skyColor='0.1 0.2 0.6 0.7 0.8 1' groundColor='0.2 0.2 0.2'/>
    <Viewpoint description='Telephoto' position='0 0 80' fieldOfView='0.05' centerOfRotation='0 0 0'/>
    <Shape>
      <Appearance>
        <Material diffuseColor='0.9 0.1 0.1'/>
      </Appearance>
      <Box size='1 1 1'/>
    </Shape>
""", category="viewpoint and background", intent="a narrow field of view from far away frames the cube",
      why_suspicious="visibilityLimit 0 looks like a zero clip distance but means no limit; fieldOfView 0.05 looks like a typo but is a legal narrow angle that frames the cube from 80 m; one sky angle with two colours is the correct n+1 pairing.")

decoy([], "A beacon is shown in detail up close, simplified further off, and not drawn at all once the camera has backed far away.",
      ["send Retreat.startTime = now at 0.2s", "after 3.5s: Beacon.level_changed == 2"], """
    <Background skyColor='0.1 0.1 0.2'/>
    <Viewpoint DEF='Camera' description='Retreat' position='0 0 5'/>
    <LOD DEF='Beacon' range='20 50' forceTransitions='true'>
      <Shape>
        <Appearance>
          <Material diffuseColor='0 0 0' emissiveColor='1 0.6 0.1'/>
        </Appearance>
        <Sphere radius='0.8'/>
      </Shape>
      <Shape>
        <Appearance>
          <Material diffuseColor='0 0 0' emissiveColor='1 0.6 0.1'/>
        </Appearance>
        <Box size='1.2 1.2 1.2'/>
      </Shape>
      <Group/>
    </LOD>
    <TimeSensor DEF='Retreat' cycleInterval='2'/>
    <PositionInterpolator DEF='Path' key='0 1' keyValue='0 0 5 0 0 90'/>
    <ROUTE fromNode='Retreat' fromField='fraction_changed' toNode='Path' toField='set_fraction'/>
    <ROUTE fromNode='Path' fromField='value_changed' toNode='Camera' toField='set_position'/>
""", category="level of detail", intent="the last level is deliberately empty so the beacon vanishes beyond 50 m",
      why_suspicious="An empty Group as the last LOD child and two range values for three children look like an unfinished node; an empty last level is the standard way to cull by distance and n-1 ranges for n children is correct.")

decoy([], "A grey checkerboard tile repeated four times each way with crisp pixel edges, next to a zigzag made of one red and one green stroke.", [], """
    <Background skyColor='0.1 0.1 0.3'/>
    <Viewpoint description='Tile and strokes' position='1.5 0 7'/>
    <Shape DEF='Checker'>
      <Appearance>
        <PixelTexture image='2 2 1 0xFF 0x40 0x40 0xFF'>
          <TextureProperties boundaryModeS='REPEAT' boundaryModeT='REPEAT' magnificationFilter='NEAREST_PIXEL' minificationFilter='NEAREST_PIXEL'/>
        </PixelTexture>
        <TextureTransform scale='4 4'/>
      </Appearance>
      <Box size='2 2 0.1'/>
    </Shape>
    <Shape DEF='Strokes'>
      <IndexedLineSet colorPerVertex='false' coordIndex='0 1 2 -1 2 3 4 -1'>
        <Coordinate point='2 -1 0 2.5 1 0 3 -1 0 3.5 1 0 4 -1 0'/>
        <Color color='1 0 0 0 1 0'/>
      </IndexedLineSet>
    </Shape>
""", category="texture and line colour", intent="an unlit one-component texture tiled by a texture transform, and per-polyline colours",
      why_suspicious="A textured Shape with no Material, a PixelTexture with one-byte pixels, a line set with no Appearance at all and two colours for five vertices all look incomplete; each is legal: the texture is shown unlit, intensity pixels are one byte, and with colorPerVertex false there is one colour per polyline.")


def media():
    # brick picture with a distinctive frame so clamping is visible
    im = Image.new('RGB', (64, 64), (170, 60, 40))
    d = ImageDraw.Draw(im)
    for y in (0, 32):
        d.line([(0, y), (63, y)], fill=(220, 220, 210), width=3)
    for x in (0, 32):
        d.line([(x, 0), (x, 32)], fill=(220, 220, 210), width=3)
    d.line([(16, 32), (16, 63)], fill=(220, 220, 210), width=3)
    d.line([(48, 32), (48, 63)], fill=(220, 220, 210), width=3)
    im.save(os.path.join(OUT, 'helper-bricks.png'))
    # arrow pointing up: white arrow on blue, green strip along the bottom
    im = Image.new('RGB', (64, 64), (20, 40, 160))
    d = ImageDraw.Draw(im)
    d.polygon([(32, 6), (52, 30), (12, 30)], fill=(255, 255, 255))
    d.rectangle([26, 30, 38, 50], fill=(255, 255, 255))
    d.rectangle([0, 56, 63, 63], fill=(20, 180, 60))
    im.save(os.path.join(OUT, 'helper-arrow.png'))
    with wave.open(os.path.join(OUT, 'helper-tone.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000)
        w.writeframes(b''.join(struct.pack('<h', int(6000 * math.sin(2 * math.pi * 110 * i / 8000))) for i in range(8000)))


def main():
    media()
    meta = {}
    for n, p in enumerate(PAIRS, 1):
        assert p['body'].count('@@') == 1, n
        for kind, key in (('fault', 'fault'), ('twin', 'twin')):
            name = '%s-%02d.x3d' % (kind, n)
            with open(os.path.join(OUT, name), 'w') as f:
                f.write(doc(p['comps'], p['prose'], p['intents'], p['body'].replace('@@', p[key])))
        meta['fault-%02d.x3d' % n] = dict(p['man'], twin='twin-%02d.x3d' % n, prose=p['prose'], intents=p['intents'])
    for n, p in enumerate(DECOYS, 1):
        name = 'decoy-%02d.x3d' % n
        with open(os.path.join(OUT, name), 'w') as f:
            f.write(doc(p['comps'], p['prose'], p['intents'], p['body']))
        meta[name] = dict(p['man'], prose=p['prose'], intents=p['intents'])
    with open(os.path.join(OUT, 'harness', 'meta.json'), 'w') as f:
        json.dump(meta, f, indent=1)

main()
