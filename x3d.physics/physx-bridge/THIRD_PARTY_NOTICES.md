# Third-party notices

Written 2026-11-12. The project's own licence is not chosen yet (SPEC section 10: the user decides).

What the built app (`npm run build` -> `dist/`) contains from others, under which licence, and where the full text is. Development-only tools (Vite, TypeScript, esbuild, Playwright) are not shipped.

| component | licence | where it is used | full text | source of the text |
|---|---|---|---|---|
| NVIDIA PhysX 5.12.0 | BSD-3-Clause | compiled into node_modules/physx-js-webidl/physx-js-webidl.wasm (shipped in the built app as assets/physx-js-webidl-*.wasm) | [licenses/NVIDIA-PhysX-BSD-3-Clause.md](licenses/NVIDIA-PhysX-BSD-3-Clause.md) | https://github.com/NVIDIA-Omniverse/PhysX (LICENSE.md, main branch) |
| physx-js-webidl 2.9.1 | MIT | the WASM bindings and their JavaScript glue (bundled into the built app's worker) | [licenses/physx-js-webidl-MIT.txt](licenses/physx-js-webidl-MIT.txt) | https://github.com/fabmax/physx-js-webidl (LICENSE, main branch; the npm package ships no licence file) |
| X_ITE 16.7.0 | MIT | the X3D browser, vendored into public/vendor/x_ite (with its own LICENSES folder) | [licenses/X_ITE-MIT.md](licenses/X_ITE-MIT.md) | node_modules/x_ite/LICENSE.md |
| ammo.js (Bullet Physics port), inside X_ITE's RigidBodyPhysics component | zlib | X_ITE's built-in engine (the race ghost and plain-X_ITE runs) | [licenses/ammo.js-zlib.txt](licenses/ammo.js-zlib.txt) | https://github.com/kripken/ammo.js (LICENSE, main branch); X_ITE marks it "zlib licensed." |

Not third-party: the impact sounds in `public/sounds/` are synthesised by `tools/make-sounds.ts` (this project); the pegboard texture and the studio environment are generated procedurally. No third-party images or audio are used.

The licence texts in `licenses/` were downloaded on 2026-11-12 with the user's permission (physx-js-webidl, PhysX, ammo.js) or copied from the installed package (X_ITE). `npm run build` copies `licenses/` and this file into `dist/legal/`.

## NVIDIA PhysX 5.12.0 (BSD-3-Clause)

```
BSD 3-Clause License

Copyright (c) 2008-2025, NVIDIA Corporation
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:

 * Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
   
 * Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
   
 * Neither the name of NVIDIA CORPORATION nor the names of its
   contributors may be used to endorse or promote products derived
   from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS "AS IS" AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## physx-js-webidl 2.9.1 (MIT)

```
MIT License

Copyright (c) 2021 Max Thiele

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## X_ITE 16.7.0 (MIT)

```
# The MIT License (MIT)

Copyright (c) 2009 Holger Seelig and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## ammo.js (Bullet Physics port), inside X_ITE's RigidBodyPhysics component (zlib)

```
Copyright (c) 2011 ammo.js contributors

This software is provided 'as-is', without any express or implied
warranty.  In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
   claim that you wrote the original software. If you use this software
   in a product, an acknowledgment in the product documentation would be
   appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.

---

See AUTHORS for list of contributors.
```
