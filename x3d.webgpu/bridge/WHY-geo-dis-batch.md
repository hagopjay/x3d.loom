# Why these ten: the rest of the geospatial group, and the DIS component (tracker batch 46)

Nodes: GeoLOD, GeoTouchSensor, GeoProximitySensor, GeoMetadata, EspduTransform, ReceiverPdu, SignalPdu, TransmitterPdu, DISEntityManager, DISEntityTypeMapping.
Rig for every number: Chromium 153.0.8010.12 on SwiftShader (no real GPU), X_ITE 16.6.0 (WebGL2), Babylon 9.32.0 (WebGPU). Pictures are 320 x 240.

## 1. Why these

Batch 45 built the seven geospatial nodes that turn a latitude, longitude and height into a point in the scene. The four here use that conversion: a level of detail that follows the camera, a touch sensor and a proximity sensor that report in geographic terms, and the metadata node. The DIS group is six more nodes with no behaviour to port, so they go together and cost little.

## 2. GeoLOD: one range, two levels

X_ITE 16.6.0 has a single `range` and exactly two levels. On every frame the level is `distance < range ? 1 : 0` (strict), the distance being the length of `center` (through geoSystem and GeoOrigin, like a GeoLocation) in EYE space: a parent scale counts, and so does the camera, not the viewpoint's centre of rotation. Range 0 or less is always level 0, and range and center are read every frame, so a run-time change is followed. `level_changed` starts at -1 and fires before `children`. Level 1 is announced at once, but the root stays on screen until all four child scenes are finished (loaded, failed, or an empty url, which counts as finished and adds nothing). Children are fetched at the first visit to level 1 and never unloaded or fetched twice. `rootNode` wins over `rootUrl`, and `rootUrl` is fetched anyway. The bridge copies all of it; `BR.loadWorld` (kit.js) fetches and parses a file for the node (data: urls work, so the fixtures need no server).

## 3. GeoTouchSensor and GeoProximitySensor: local points read as geographic ones

Both output a geographic reading of a point that is local to the sensor's parent frame, through the sensor's geoSystem and GeoOrigin (`BR.geo.geoOf`). That is the true position only when nothing moves the sensor. Under a GeoLocation 3.3 m east of the origin the touch sensor reports longitude 8.4e-7 degrees, not 3.0e-5. X_ITE does it, so the bridge does it, and the gap is logged.
- GeoTouchSensor's output is `hitGeoCoord_changed` (no `geoCoords_changed`). Hover order: isOver, hitTexCoord, hitNormal, hitPoint, hitGeoCoord. Babylon's meshes carry v flipped, so the bridge reports 1 - v; a pick at (160,120) is half a pixel from X_ITE's, hence the 0.05 tolerance.
- GeoProximitySensor wraps a ProximitySensor: inclusive box, size 0 never, size -1 always. `geoCenter` is copied raw into `center` only when written at run time (the file attribute is ignored) and `center` is plain local metres. On exit the last position outside is announced first. The bridge checks the camera pose every frame; X_ITE needs something else animated to notice an enter.

## 4. DIS: six nodes that store their fields

X_ITE marks the component as not supported. EspduTransform is a Group (translation, rotation, scale stored, never applied); nothing is sent or received and no output ever fires; the PDU nodes, the manager and the mapping hold their fields and draw nothing; the mapping never loads its url. SFTime outputs default to -1 and geoSystem to GD WE. The fixtures assert the silence with `noevent` after two seconds.

## 5. One fix outside the batch

Setting an inputOutput field in the SAI shim raised the page's field callbacks twice (the body hook and the event queue). X_ITE raises one. `reader.js` now marks the call (`R.rx`) and `sai.js` skips the hook's callbacks while it is set. The full sweep (142 picture fixtures and 45 event fixtures, in chunks of 8) passes after it.

## 6. Gaps (logged)

GeoLOD: bounding box and `bboxDisplay` not implemented; no unload (as X_ITE). GeoTouchSensor: a click is press and release together; hitGeoCoord under a Transform or GeoLocation is X_ITE's local-frame reading. GeoProximitySensor: no frame of lag; the exit after disable is sent once where X_ITE sends it twice; user navigation is not simulated. GeoMetadata: url never fetched, summary not interpreted. DIS: no network, no dead reckoning, no `bboxDisplay` wire cube (X_ITE draws one, even for a hidden node).
