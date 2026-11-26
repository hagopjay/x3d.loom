# Blind classification (written before opening KEY)
| # | code | mistake | class | conf | X3D node.field (S) |
|1|MESH_PRIMITIVE_NO_TANGENT_SPACE|normal-mapped material but no tangents|D|medium|X3D has no tangent attribute|
|2|MESH_PRIMITIVE_INDEXED_SEMANTIC_CONTINUITY|TEXCOORD_n/COLOR_n index gap|D|medium||
|3|ACCESSOR_INVALID_FLOAT|NaN/Inf in float data|S|high|Coordinate.point, Normal.vector|
|4|UNRESOLVED_REFERENCE|dangling reference|S|high|USE naming missing DEF; ROUTE to unknown DEF|
|5|ACCESSOR_SMALL_BYTESTRIDE|stride too small|B|high||
|6|GLB_UNEXPECTED_FIRST_CHUNK|first GLB chunk not JSON|B|high||
|7|IMAGE_UNRECOGNIZED_FORMAT|image bytes not PNG/JPEG|S|low|ImageTexture.url target (needs file access)|
|8|DUPLICATE_ELEMENTS|duplicate entry in unique-array|S|medium|duplicate DEF / repeated child USE|
|9|UNSUPPORTED_EXTENSION|unknown extension|S|low|unknown node/component/profile|
|10|UNSATISFIED_DEPENDENCY|extension property needs another|S|low|field requiring sibling field|
|11|GLB_UNKNOWN_CHUNK_TYPE|unknown chunk|B|high||
|12|ACCESSOR_USAGE_OVERRIDE|accessor used as both index and vertex|B|medium||
|13|MATERIAL_ALPHA_CUTOFF_INVALID_MODE|alphaCutoff set, mode not MASK|S|high|Appearance.alphaMode/alphaCutoff (4.0)|
|14|INVALID_INDEX|index out of range|S|high|IndexedFaceSet.coordIndex vs Coordinate.point|
|15|GLB_EMPTY_BIN_CHUNK|empty BIN chunk|B|high||
|16|NODE_WEIGHTS_INVALID|weights count != morph targets|F|medium|no morph targets in 4.0|
|17|ANIMATION_CHANNEL_TARGET_NODE_WEIGHTS_NO_MORPHS|animate weights without morphs|F|medium||
|18|NODE_SKIN_NO_SCENE|skinned node not in a scene|D|low||
|19|ROTATION_NON_UNIT|non-unit quaternion|S|high|Transform.rotation zero/unnormalised axis|
|20|KHR_MATERIALS_VOLUME_NO_TRANSMISSION|volume w/o transmission|F|low-med (4.1 has it, 4.0 not)||
|21|KHR_MATERIALS_IRIDESCENCE_THICKNESS_TEXTURE_UNUSED|thickness texture unused|F|low-med||
|22|KHR_LIGHTS_PUNCTUAL_LIGHT_SPOT_ANGLES|outer<=inner cone|S|high|SpotLight.beamWidth > cutOffAngle|
|23|KHR_MATERIALS_ANISOTROPY_ANISOTROPY_TEXTURE_TEXCOORD|texcoord missing for texture|F|medium||
|24|CAMERA_XMAG_YMAG_NEGATIVE|ortho mag <=0|S|medium|OrthoViewpoint.fieldOfView|
|25|MULTIPLE_EXTENSIONS|several extensions on one object|D|low||
|26|ACCESSOR_OFFSET_ALIGNMENT|misaligned offset|B|high||
|27|GLB_CHUNK_LENGTH_UNALIGNED|chunk length not 4-aligned|B|high||
|28|ACCESSOR_VECTOR3_NON_UNIT|non-unit normals|S|high|Normal.vector|
|29|INVALID_URI|malformed URI|S|high|url fields|
|30|KHR_MATERIALS_VARIANTS_NON_UNIQUE_VARIANT|duplicate variant name|F|medium||
