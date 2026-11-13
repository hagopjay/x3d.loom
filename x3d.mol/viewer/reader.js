/* x3d.mol reader: X3D 4.0 text -> a plain model. No Babylon in here, so the same model can feed any body.
   It reads only what src/build.py writes: IndexedTriangleSet (with Normal, Color, FloatVertexAttribute), Transform + Sphere / Cylinder,
   Billboard + Text, IndexedFaceSet, Viewpoint, DirectionalLight, and the WorldInfo MetadataSet. Anything else is counted in model.skipped. */
(function (root) {
  "use strict";
  const f32 = (s) => Float32Array.from(s.trim().split(/\s+/), Number);
  const mfstring = (v) => [...v.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\(.)/g, "$1"));

  function parseX3D(text) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("not well-formed XML: " + doc.querySelector("parsererror").textContent.slice(0, 120));
    const model = { title: "", meta: {}, meshes: [], zinc: [], bonds: [], labels: [], cages: [], viewpoints: [], lights: [], skipped: {}, headMeta: {} };
    const skip = (n) => { model.skipped[n] = (model.skipped[n] || 0) + 1; };
    for (const m of doc.querySelectorAll("head > meta")) model.headMeta[m.getAttribute("name")] = m.getAttribute("content");
    const wi = doc.querySelector("WorldInfo");
    model.title = wi ? wi.getAttribute("title") : "";
    for (const m of doc.querySelectorAll("WorldInfo > MetadataSet > *")) {
      const name = m.getAttribute("name"), v = m.getAttribute("value") || "";
      model.meta[name] = m.tagName === "MetadataString" ? mfstring(v) : f32(v);
    }
    const sc = doc.querySelector("Scene");
    const walk = (el, pendingLabel) => {
      for (const ch of el.children) {
        switch (ch.tagName) {
          case "WorldInfo": case "NavigationInfo": case "Background": break;
          case "DirectionalLight":
            model.lights.push({ name: ch.getAttribute("DEF"), dir: f32(ch.getAttribute("direction")), intensity: +ch.getAttribute("intensity"), color: f32(ch.getAttribute("color")) }); break;
          case "Viewpoint":
            model.viewpoints.push({ description: ch.getAttribute("description"), position: f32(ch.getAttribute("position")), orientation: f32(ch.getAttribute("orientation")),
              center: f32(ch.getAttribute("centerOfRotation")), fov: +ch.getAttribute("fieldOfView") }); break;
          case "Shape": shape(ch, null); break;
          case "Transform": {
            const def = ch.getAttribute("DEF") || "";
            const t = f32(ch.getAttribute("translation") || "0 0 0");
            const sph = ch.querySelector(":scope > Shape > Sphere"), cyl = ch.querySelector(":scope > Shape > Cylinder"), bb = ch.querySelector(":scope > Billboard");
            if (sph) model.zinc.push({ def, pos: t, radius: +sph.getAttribute("radius"), tag: def.replace(/^Zn_/, "") });
            else if (cyl) {
              const r = f32(ch.getAttribute("rotation") || "1 0 0 0"), h = +cyl.getAttribute("height"), ax = r.slice(0, 3), a = r[3];
              const c = Math.cos(a), s = Math.sin(a), k = [ax[0], ax[1], ax[2]];
              // Rodrigues: rotate +Y by axis-angle
              const y = [0, 1, 0], kxy = [k[1] * y[2] - k[2] * y[1], k[2] * y[0] - k[0] * y[2], k[0] * y[1] - k[1] * y[0]], kd = k[0] * y[0] + k[1] * y[1] + k[2] * y[2];
              const d = [0, 1, 2].map((i) => y[i] * c + kxy[i] * s + k[i] * kd * (1 - c));
              const mat = ch.querySelector("PhysicalMaterial");
              const glow = +cyl.getAttribute("radius") > 0.06, m = def.match(/^Bond_(.+)_(\d+)$/);
              model.bonds.push({ def, site: m ? m[1] : "", index: m ? +m[2] : 0, a: [0, 1, 2].map((i) => t[i] - d[i] * h / 2), b: [0, 1, 2].map((i) => t[i] + d[i] * h / 2), length: h, glow,
                radius: +cyl.getAttribute("radius"), emissive: mat ? f32(mat.getAttribute("emissiveColor")) : [0, 0, 0] });
            } else if (bb) {
              const tx = bb.querySelector("Text");
              model.labels.push({ pos: t, text: mfstring(tx.getAttribute("string"))[0] });
            } else walk(ch);
            break;
          }
          case "Group": walk(ch); break;
          default: skip(ch.tagName);
        }
      }
    };
    const shape = (sh) => {
      const def = sh.getAttribute("DEF") || "";
      const its = sh.querySelector("IndexedTriangleSet"), ifs = sh.querySelector("IndexedFaceSet");
      if (its) {
        const attrs = {};
        for (const a of its.querySelectorAll("FloatVertexAttribute")) attrs[a.getAttribute("name")] = f32(a.getAttribute("value"));
        const idx = Uint32Array.from(its.getAttribute("index").trim().split(/\s+/), Number);
        model.meshes.push({ def, positions: f32(its.querySelector("Coordinate").getAttribute("point")), normals: f32(its.querySelector("Normal").getAttribute("vector")),
          colors: f32(its.querySelector("Color").getAttribute("color")), indices: idx, attrs });
      } else if (ifs && def.startsWith("Cage_")) {
        model.cages.push({ def, tag: def.replace(/^Cage_/, ""), points: f32(ifs.querySelector("Coordinate").getAttribute("point")) });
      } else skip("Shape/" + (sh.firstElementChild && sh.firstElementChild.nextElementSibling ? sh.firstElementChild.nextElementSibling.tagName : "?"));
    };
    walk(sc);
    // sites JSON from metadata
    model.sites = model.meta.sites ? JSON.parse(model.meta.sites[0]) : [];
    return model;
  }
  root.XMolReader = { parseX3D, mfstring };
})(typeof window !== "undefined" ? window : globalThis);
