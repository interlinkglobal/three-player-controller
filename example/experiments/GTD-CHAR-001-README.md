# GTD-CHAR-001 — Foot IK Cost Experiment

**Scope:** An isolated, opt-in experiment in this fork's existing Three.js Foot IK demo. No GTD code, assets or production deployment are changed.

## Open the instrumented scene

```bash
git checkout experiment/gtd-char001-footik-cost
npm ci
npm run dev
```

Open `http://localhost:5173/three-player-controller/footIK.html?gtdCharProbe=1` in the browser. The normal `footIK.html` remains unchanged without the query parameter.

The scene uses the existing **Universal Animation Library `ual.glb`** rig and course. The 3D model is **not Voight**. The approved Voight image sheets are 2D, and cannot replace it until a rigged 3D model exists. No third-party asset has been copied into GTD.

## Collect real costs

1. Keep browser/device, window size, pixel ratio, lighting, camera view and walking route fixed. Avoid background tabs, recording or other GPU-heavy tasks.
2. In Foot IK Controls, **disable Foot IK** and leave other switches unchanged; run the same walking/stair circuit with **Start 15s + 60s**. Wait until completion.
3. **Enable Foot IK**, preserve all other conditions, repeat the circuit and sample.
4. Click **Export JSON**, attach the exported report and matching screenshots. Repeat on mobile and desktop. If results vary, perform three runs per mode and compare distributions; also try predictive placement on/off as a separate controlled comparison.
5. Compare p50/p95 frame intervals, controller-update CPU, CPU render submission, scene draw calls/triangles, long frames, and visible feet/ground contact. Include original render settings and browser/device metadata in interpretation.

The menu is deliberately compact at bottom right. The browser console also exposes `window.__GTD_CHAR_PROBE__.report()`, `.download()` and `.start({warmupMs:15000,sampleMs:60000})`. Do not change IK settings *during* a recorded sample; reports flag condition changes.

## Evidence status and limits

- **Verified from the committed Git tree:** `ual.glb` 3,749,364 bytes (blob `e236f349526637a5c829c408d48ce9d8fcde9cff`). The report inventories actual glTF geometry, rig, animation clips and materials after loading.
- **Actual FPS, CPU render/update, draw calls, device memory and visual acceptance:** **NOT YET MEASURED**; collected only by running the branch on a device.
- Reported CPU submission duration is **not GPU elapsed time**. Geometry-buffer bytes are an estimate; GPU RAM, total app memory and GPU power are **not measured**. Scene draw calls cannot be attributed entirely to the character. The screenshot FPS counter alone is insufficient to quantify an IK penalty.
- The experiment executes in **Three.js with its own collision/BVH system**; results are feasibility evidence, not a validated Babylon.js/Rapier Meridian benchmark.
- Bundled demonstration art rights have **not** been cleared for GTD commercial use. Preserve the fork's own licensing terms; do not promote this temporary model as Voight.

**Decision:** This experiment accelerates Stage 3 feasibility evidence, **without** replacing Stage 1's approved Voight visual design, Stage 2 rights verification or the required later real Meridian A/B benchmark.
