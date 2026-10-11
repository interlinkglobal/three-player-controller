/**
 * GTD-CHAR-001: optional evidence harness for the upstream Foot IK example.
 * Enable only with /footIK.html?gtdCharProbe=1.
 * Measures the SAME loaded rig/scene in manually matched IK-on / IK-off runs.
 * No browser API in this file purports to measure true GPU time or GPU memory.
 */
const BASELINE_MODEL = Object.freeze({
    name: "Quaternius Universal Animation Library demonstration humanoid (NOT Voight)",
    path: "./glb/ual.glb",
    gitBlobSha: "e236f349526637a5c829c408d48ce9d8fcde9cff",
    gitBlobBytes: 3749364,
    commercialRights: "UNVERIFIED — example asset only; not cleared for GTD distribution",
});

function quantile(sorted, proportion) {
    if (!sorted.length) return null;
    const at = (sorted.length - 1) * proportion;
    const lo = Math.floor(at);
    const hi = Math.ceil(at);
    return Number((sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo)).toFixed(3));
}

function summarize(samples) {
    const sorted = [...samples].sort((a, b) => a - b);
    if (!sorted.length) return { samples: 0, p50: null, p95: null, max: null };
    return { samples: sorted.length, p50: quantile(sorted, 0.5), p95: quantile(sorted, 0.95),
        max: Number(sorted[sorted.length - 1].toFixed(3)) };
}

function inventory(model, animations) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    const joints = new Set();
    let meshes = 0;
    let skinnedMeshes = 0;
    let triangles = 0;
    let vertices = 0;
    let cpuGeometryBytes = 0;

    model.traverse((object) => {
        if (!object.isMesh) return;
        meshes++;
        if (object.isSkinnedMesh) {
            skinnedMeshes++;
            for (const bone of object.skeleton?.bones ?? []) joints.add(bone);
        }
        const geometry = object.geometry;
        if (geometry && !geometries.has(geometry)) {
            geometries.add(geometry);
            const position = geometry.getAttribute("position");
            vertices += position?.count ?? 0;
            triangles += (geometry.index?.count ?? position?.count ?? 0) / 3;
            for (const attr of Object.values(geometry.attributes)) {
                cpuGeometryBytes += attr.array?.byteLength ?? 0;
            }
            cpuGeometryBytes += geometry.index?.array?.byteLength ?? 0;
            for (const morphAttrs of Object.values(geometry.morphAttributes ?? {})) {
                for (const attr of morphAttrs) cpuGeometryBytes += attr.array?.byteLength ?? 0;
            }
        }
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            if (!material || materials.has(material)) continue;
            materials.add(material);
            for (const value of Object.values(material)) {
                if (value?.isTexture) textures.add(value);
            }
        }
    });
    return {
        meshCount: meshes, skinnedMeshCount: skinnedMeshes, uniqueGeometries: geometries.size,
        verticesInUniqueGeometries: vertices, trianglesInUniqueGeometries: Math.round(triangles),
        jointCount: joints.size, uniqueMaterials: materials.size, uniqueTextures: textures.size,
        cpuGeometryBufferBytesApprox: cpuGeometryBytes,
        animations: (animations ?? []).map(({ name, duration, tracks }) =>
            ({ name, durationSeconds: Number(duration.toFixed(3)), trackCount: tracks.length })),
        note: "Counts reflect GLB's model geometry, not full scene rendering. CPU buffer bytes are an estimate; GPU and texture memory are NOT measured.",
    };
}

function graphicsConfiguration(renderer) {
    const canvas = renderer.domElement;
    return {
        browser: navigator.userAgent,
        cssViewportWidth: innerWidth,
        cssViewportHeight: innerHeight,
        devicePixelRatio: devicePixelRatio,
        rendererPixelRatio: renderer.getPixelRatio(),
        framebufferWidth: canvas.width,
        framebufferHeight: canvas.height,
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        deviceMemoryGBReported: navigator.deviceMemory ?? null,
        graphicsAPI: "Three.js WebGL, not GTD Babylon.js",
        memoryNote: "GPU memory, actual GPU execution times and total system memory not available from standard browser APIs.",
    };
}

export function mountGtdCharacterCostProbe({ renderer, player, footIK, model, animations }) {
    const assetInfo = inventory(model, animations);
    const runHistory = [];
    let active = null;
    let lastFrameTime = null;
    let lastUiRefresh = 0;
    const getFootConfig = () => {
        const x = footIK.getOptions();
        return {
            enabled: Boolean(x.enabled),
            predictivePlacement: Boolean(x.predictivePlacement),
            straightPoleEnabled: Boolean(x.straightPoleEnabled),
            debug: Boolean(x.debug),
        };
    };
    const currentScene = () => graphicsConfiguration(renderer);
    const container = document.createElement("section");
    container.setAttribute("aria-label", "GTD character performance trial");
    container.style.cssText = [
        "position:fixed", "bottom:14px", "right:14px", "z-index:9997",
        "max-width:min(220px,calc(100vw - 28px))", "font:12px/1.5 system-ui,sans-serif",
        "background:rgba(18,21,26,.91)", "color:#fff", "border-radius:8px",
        "padding:9px", "box-shadow:0 3px 18px #0007"
    ].join(";");
    const title = document.createElement("strong");
    title.textContent = "GTD-CHAR-001 / Foot IK trial";
    title.style.cssText = "display:block;font-size:12px;margin-bottom:5px";
    const label = document.createElement("div");
    label.textContent = "Ready — choose IK mode, then start";
    label.style.cssText = "margin-bottom:7px;min-height:24px";
    const startButton = document.createElement("button");
    startButton.type = "button";
    startButton.textContent = "Start 15s + 60s";
    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = "Export JSON";
    for (const button of [startButton, exportButton]) {
        button.style.cssText = "margin-right:5px;margin-bottom:4px;padding:5px 7px;cursor:pointer";
    }
    container.append(title, label, startButton, exportButton);
    document.body.appendChild(container);

    function start({ warmupMs = 15000, sampleMs = 60000 } = {}) {
        if (active) return false;
        if (!Number.isFinite(warmupMs) || !Number.isFinite(sampleMs) ||
            warmupMs < 0 || sampleMs < 1000 || sampleMs > 300000) {
            throw new Error("Invalid trial duration (sample must be 1–300 seconds)");
        }
        active = {
            startedAt: performance.now(),
            warmupMs, sampleMs, settings: getFootConfig(), device: currentScene(),
            frameIntervalsMs: [], updateCpuMs: [], renderSubmissionCpuMs: [],
            totalFrameWorkCpuMs: [], sceneDrawCalls: [], sceneTriangles: [],
            longFramesOver50Ms: 0, configChangedFrames: 0, frameCount: 0,
            phase: "warmup",
        };
        lastFrameTime = null;
        startButton.disabled = true;
        label.textContent = "Warm-up running; keep camera and movement matched";
        return true;
    }

    function finish(stoppedEarly = false) {
        if (!active) return null;
        const run = active;
        active = null;
        const result = {
            id: "GTD-CHAR-001-FootIK-trial",
            source: "interlinkglobal/three-player-controller:example/footIK.html",
            recordedAtISO: new Date().toISOString(),
            experimentalAsset: BASELINE_MODEL,
            assetInventory: assetInfo,
            condition: run.settings,
            deviceAtStart: run.device,
            deviceAtEnd: currentScene(),
            warmupMs: run.warmupMs,
            requestedSampleMs: run.sampleMs,
            actualSampleFrames: run.frameCount,
            prematurelyStopped: stoppedEarly,
            settingsChangedDuringSample: run.configChangedFrames > 0,
            frameIntervalMs: summarize(run.frameIntervalsMs),
            controllerUpdateCpuMs: summarize(run.updateCpuMs),
            renderSubmissionCpuMs: summarize(run.renderSubmissionCpuMs),
            totalMainThreadFrameWorkCpuMs: summarize(run.totalFrameWorkCpuMs),
            wholeSceneDrawCalls: summarize(run.sceneDrawCalls),
            wholeSceneSubmittedTriangles: summarize(run.sceneTriangles),
            framesOver50ms: run.longFramesOver50Ms,
            interpretation: [
                "Whole-scene render counters are not per-character cost.",
                "CPU render submission is NOT GPU elapsed time; FPS and frame intervals include scheduling.",
                "Compare matched scene/camera/action/device/graphics conditions, IK off then on.",
                "The demo's Three.js/BVH physics must not be mistaken for GTD's Babylon.js/Rapier cost.",
                "A generated 2D Voight portrait is NOT a rigged humanoid; this model is a disposable baseline.",
            ],
        };
        runHistory.push(result);
        startButton.disabled = false;
        label.textContent = stoppedEarly ? "Stopped early; partial evidence saved" :
            "Trial complete (" + runHistory.length + " recorded)";
        return result;
    }

    function tick({ frameAt, afterUpdateAt, afterRenderAt, drawCalls, triangles }) {
        if (!active) return;
        const run = active;
        const elapsed = afterRenderAt - run.startedAt;
        if (elapsed < run.warmupMs) {
            run.phase = "warmup";
            if (afterRenderAt - lastUiRefresh > 1000) {
                label.textContent = "Warm-up " + Math.max(0, Math.ceil((run.warmupMs - elapsed) / 1000)) + "s";
                lastUiRefresh = afterRenderAt;
            }
            lastFrameTime = afterRenderAt;
            return;
        }
        run.phase = "sample";
        const interval = lastFrameTime === null ? null : afterRenderAt - lastFrameTime;
        lastFrameTime = afterRenderAt;
        if (interval !== null && interval > 0 && interval < 5000) {
            run.frameIntervalsMs.push(interval);
            if (interval > 50) run.longFramesOver50Ms++;
        }
        run.updateCpuMs.push(Math.max(0, afterUpdateAt - frameAt));
        run.renderSubmissionCpuMs.push(Math.max(0, afterRenderAt - afterUpdateAt));
        run.totalFrameWorkCpuMs.push(Math.max(0, afterRenderAt - frameAt));
        run.sceneDrawCalls.push(drawCalls);
        run.sceneTriangles.push(triangles);
        run.frameCount++;
        const cfg = getFootConfig();
        if (Object.keys(cfg).some(key => cfg[key] !== run.settings[key])) run.configChangedFrames++;
        if (afterRenderAt - lastUiRefresh > 1000) {
            label.textContent = "Sampling " + Math.max(0, Math.ceil((run.warmupMs + run.sampleMs - elapsed) / 1000)) + "s";
            lastUiRefresh = afterRenderAt;
        }
        if (elapsed >= run.warmupMs + run.sampleMs) finish(false);
    }

    function report() {
        return {
            experiment: "GTD-CHAR-001 isolated Three.js Foot IK model/animation cost trial",
            scope: "Instrumented demo only; NOT a GTD Meridian benchmark",
            asset: BASELINE_MODEL, inventory: assetInfo,
            liveFootIK: getFootConfig(),
            currentDevice: currentScene(),
            runs: runHistory.slice(),
        };
    }
    function download() {
        const json = JSON.stringify(report(), null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = "gtd-char001-footik-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
    }
    startButton.addEventListener("click", () => start());
    exportButton.addEventListener("click", download);
    const api = { start, stop: () => finish(true), report, download, record: tick,
        dispose: () => { active = null; container.remove(); delete window.__GTD_CHAR_PROBE__; } };
    window.__GTD_CHAR_PROBE__ = api;
    return api;
}
