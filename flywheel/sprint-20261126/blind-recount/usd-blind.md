# Blind classification (written before opening KEY)
| # | Rule | Mistake (my reading) | Class | Conf | X3D node.field |
|1|DJ.010 check-robot-relationships|robot link/joint relationship targets inconsistent|F|low||
|2|VG.018 mesh-unused-topology|mesh has points never referenced by faces|S|med|IndexedFaceSet coordIndex vs Coordinate.point|
|3|PS.002 joint-sensor-articulation-root|joint/sensor not under an articulation root|F|med||
|4|EL.001 nominal-voltage-required|electrical asset lacks nominal voltage|F|low||
|5|SubsetMaterialBindFamilyName|GeomSubset family name wrong for material bind|D|med||
|6|RP.003 render-var-source-name|RenderVar sourceName missing/invalid|F|low||
|7|HI.010 undefined-prims|prims with no type (over/untyped)|D|med||
|8|MaterialBindingCollectionValidator|collection-based material binding malformed|D|med||
|9|AV.008 conditional-presence|UNKNOWN (guess: field required only when another present)|P|low||
|10|SPL.004 splat-has-orientations|Gaussian splat missing orientations|F|med||
|11|NP.007 relative-paths|asset paths absolute, not relative|S|med|ImageTexture/Inline/AudioClip.url|
|12|AV.010 variation-stability|UNKNOWN (guess: variants unstable)|D|low||
|13|WeldChecker|duplicate unwelded vertices|S|med|Coordinate.point|
|14|ZeroAreaFaceChecker|degenerate zero-area faces|S|high|IndexedFaceSet.coordIndex|
|15|COCO.001 coco-labels|semantic labels not COCO taxonomy|P|low||
|16|gripper-site-api|gripper site API schema missing|F|high||
|17|NVM.001 material-attributes|MDL material attrs invalid|F|med||
|18|SR.001 metadata-whitelist|metadata keys outside allowed list|P|med||
|19|newton-mimic-api|Newton mimic joint API missing|F|high||
|20|RC.008 robot-type|robot type attribute missing|F|med||
|21|hash-object-format|packaging hash format|P|med||
|22|material-assignment|geometry has no material bound|S|med|Shape.appearance / Appearance.material|
|23|SPL.001 splat-prim-type|splat prim wrong type|F|med||
|24|RV.004 newton-variant-set|Newton variant set missing|D|med||
|25|NormalsValidChecker|zero-length/NaN/mismatched normals|S|high|Normal.vector, IFS.normalIndex|
|26|RV.007 mujoco-variant-set|MuJoCo variant set missing|D|med||
|27|EncapsulationChecker|gprims nested under gprims|D|med||
|28|VG.002 usdgeom-extent|extent missing/wrong|S|med|bboxSize/bboxCenter on Group/Shape|
|29|material-texture-colorspace-mdl|MDL texture colorspace wrong|F|med||
|30|mujoco-mesh-collision-api|MuJoCo mesh collision API missing|D|low||
