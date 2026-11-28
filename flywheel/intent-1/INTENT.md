# Stated intent, version 1

Blind court 5 (`../court-5/RESULTS.md`) found that 21 new rules gained nothing on unseen mistakes, while a few lines
of stated intent, played in a real engine, caught 11 of the 12 kernel-missed mistakes that had one. Version 0 of
the grammar (`../court-5/intent/INTENT.md`) could only read fields over time, so only 22 of 76 scenes could state
anything. Version 1 adds structure, pixels and real input. `play.mjs` in this folder implements exactly this page.
The frozen court 5 play test is left as it was.

## Where intent lives

Either in the scene head, as before, or in a file beside the scene so that someone other than the scene's author
can write it without touching the scene:

```xml
<meta name="intent:prose" content="When the door is told to open it swings a quarter turn within one second."/>
<meta name="intent" content="after 1.6s: Door.rotation[3] &gt; 1.4"/>
```

```
# set-a/pair-03.intent   one line per statement, # starts a comment
click 0.5 0.5 at 0.5s
after 1.8s: Door.rotation[3] > 1.4
```

## Lines

`WHEN` is `at load:` (0.3 s after the scene has loaded) or `after 1.5s:`. Times are seconds of real time after
loading. Screen positions `X Y` run from `0 0` (top left) to `1 1` (bottom right) of a 640 by 480 view through the
scene's first bound Viewpoint. Colours are `r g b` from 0 to 1.

| Line | Meaning |
|---|---|
| `send DEF.field = VALUE at 0.2s` | stimulus: write a number, `true`, `false`, `now` or a quoted string into a field |
| `click X Y at 0.5s` | stimulus: a real mouse press and release at that point |
| `drag X Y to X2 Y2 at 0.5s` | stimulus: press, move in ten steps, release |
| `key NAME at 0.5s` | stimulus: a real key press (`a`, `Enter`, `ArrowUp`, `F1`) |
| `WHEN DEF.field changed` / `unchanged` | against its value just after loading |
| `WHEN DEF.field == 0 1 0 1.57` | every number within 0.001, or `tol 0.05` at the end; `!=` is the opposite; text compares as text |
| `WHEN DEF.field[3] > 1.4` | one component with `>`, `<`, `>=`, `<=`; without `[i]` the first number |
| `WHEN DEF.field.length == 4` | number of values in a multi-valued field, any comparison |
| `WHEN count(Shape) >= 2` | nodes of that type reachable from the scene root, each counted once |
| `WHEN pixel X Y == r g b` | mean of a 5 by 5 patch, each channel within 0.15 or `tol`; `!=` is the opposite |
| `WHEN pixel X Y brighter than pixel X2 Y2` | or `darker`; compares mean luminance |
| `WHEN pixels != 0 0 0 cover > 0.05` | share of the whole view that matches (`==`) or does not match (`!=`) a colour |

A line the play test does not understand is reported and never counted as holding.

## Rules

Rules 1 to 5 of version 0 stand: one intent for the fault and its twin, the kernel never sees it, a catch needs
the fault to fail and the twin to hold, intent says what the scene is for and not what is wrong, and the intent
score is never added to the file-only score. Version 1 adds:

6. **Numbers are compared as numbers.** Version 0 compared an array as text and failed a legal file in court 5.
7. **A catch has to repeat.** Real time and real pixels can flicker. A result counts only if it is the same in
   every one of three plays.
8. **A budget.** At most eight statements a scene. Intent is a few claims about purpose, not a recording of
   everything the scene does.

## What version 1 still cannot do

It cannot hear sound, cannot follow a link out of the scene, cannot move the camera except through the scene's own
nodes, and it sees one engine (X_ITE) at one view size. A pixel statement depends on that engine's lighting, so
it should name a broad fact (lit or dark, red or blue, covers a tenth of the view) and not an exact shade.
