# x3d.springbone 0.1.0

Spring bones for X3D: hair, ponytails, tails, ears, cloth strips, chains and antennae that follow the animation late and settle by themselves. They are written as two plain X3D 4.0 PROTOs, so any browser with Scripting runs them. The same solver is ported to Blender and to Unity.

- `SPEC.md`: the behaviour in our own words (clean room, section 0), the tuning maths, the colliders, how bones are written, the X3D binding, how this differs from the Unity package, and Daz Genesis notes.
- `src/springbone-core.js`: the solver, one file with no dependencies (Node or browser).
- `src/x3d-script-glue.js` plus `tools/build.mjs`: these write `x3d/SpringBone.x3d` (the PROTOs) and `x3d/springbone-script.js`.
- `test/witnesses.mjs`: 14 rows checked against closed-form damped-spring answers. 11 of them have a planted fault that must fail. Run them with `node --test test/witnesses.test.mjs`.
- `browser/live.mjs`: runs X_ITE 16.8.1 in headless Chromium. It checks that the example steps and that an SAI replay matches the Node hashes. Run it with `NODE_PATH=$(npm root -g) node browser/live.mjs`.
- `tools/golden.mjs`: `results/golden.json`, the shared trace that the Python twin (x3d-blender-io) and the C# twin (x3d.unity_io) must reproduce.
- `tools/make_demo.mjs`: the Demo 87 scene (x3d.demo `docs/demos/spring-bone/v1`).
- `profiles/daz-genesis.json`: suggested chains for Genesis 8 and 9. The bone names are Suspected until checked on a real export.

## Use it

```xml
<ExternProtoDeclare name='SpringBoneChain' url='"SpringBone.x3d#SpringBoneChain" "https://hagopjay.github.io/x3d.demo/demos/spring-bone/v1/x3d/SpringBone.x3d#SpringBoneChain"'> ... </ExternProtoDeclare>
<ProtoInstance name='SpringBoneChain' DEF='Hair'>
  <fieldValue name='roots'><HAnimJoint USE='hanim_hair_1'/></fieldValue>
  <fieldValue name='ancestors'><HAnimHumanoid USE='hanim_Ada'/><HAnimJoint USE='hanim_humanoid_root'/> ... </fieldValue>
  <fieldValue name='springModel' value='FORCE'/>
  <fieldValue name='frequency' value='1.6'/>
  <fieldValue name='dampingRatio' value='0.3'/>
</ProtoInstance>
```

`tools/build.mjs` prints the full ExternProtoDeclare (`externDecls(url)`).

Licence: MIT. Learnings: `../LEARNINGS-springbone.md`, failure modes 586 to 594.
