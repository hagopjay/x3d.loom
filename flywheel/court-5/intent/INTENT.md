# Stated intent, version 0

Court 4 missed 17 faults. Nine could have been stated from the file. Eight could not: the file was legal either
way, and only what the author meant decided which was wrong. No checker that reads only the file can close those
eight honestly. So court 5 lets a scene say what it is for, in a form a machine can test, and scores that as its
own arm.

## The form

Intent lines are ordinary `meta` elements in the head, so a scene that carries them is still valid X3D 4.0.

```xml
<meta name="intent:prose" content="When the door is told to open it swings a quarter turn within one second."/>
<meta name="intent" content="send Opener.startTime = now at 0.2s"/>
<meta name="intent" content="after 1.6s: Door.rotation[3] &gt; 1.4"/>
```

| Line | Meaning |
|---|---|
| `intent:prose` | one sentence for a human reader; the play test ignores it |
| `send DEF.field = VALUE at 0.2s` | a stimulus: write the value into the field at that time after loading. VALUE is a number, `true`, `false`, `now`, or a quoted string |
| `after 1.5s: DEF.field changed` | the field differs from its value just after loading |
| `after 1.5s: DEF.field unchanged` | the field equals its value just after loading |
| `after 1.5s: DEF.field == 0 1 0 1.57` | every number within 0.001, or within `tol 0.05` if the line ends that way |
| `after 1.5s: DEF.field[3] > 1.4` | one component, with `>`, `<`, `>=` or `<=` |

Times are seconds of real time after the scene has loaded. `play/play.mjs` implements exactly this table and
reports any line it does not understand; an unknown line is never counted as holding.

## Rules that keep the arm honest

1. **Written once, for the scene the author meant.** The fault and its twin carry byte-for-byte the same intent
   lines. `intent/strip_intent.py` stops if they differ.
2. **The kernel never sees it.** The kernel runs only on copies with every intent line removed.
   `score/run_kernel.py` stops if it is handed a file that still has one.
3. **A catch needs both sides.** The play test catches a fault only when an assertion fails on the fault and every
   assertion holds on its twin. No reader decides it.
4. **The intent says what the scene is for, not what is wrong.** "The door swings a quarter turn" is intent.
   "keyValue must end at 1.5708" is the answer key. The second reader marks every fault whose intent lines give
   the mistake away, and the score is printed with and without them.
5. **Never added to the headline.** The file-only score and the intent score answer different questions and are
   printed side by side.

## What version 0 cannot do

It cannot click, drag or press a key: a pointing or key sensor has to be reached through `send` on the field it
would have written, which skips the sensor itself. It reads fields, not pixels, so it cannot say that something is
visible. It runs in one engine (X_ITE) in real time, so an assertion placed within a few hundredths of a second of
an event can flicker. A scene with no testable intent has `intent:prose` only and is left out of the arm's count.
