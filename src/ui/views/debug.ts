import { SensorCollector } from "../../sensors/collector.js";
import { FusionEngine } from "../../fusion/engine.js";
import { RepDetector } from "../../detector/rep-detector.js";
import type { Router } from "../router.js";
import type { SensorSample, FusedSample } from "../../types.js";

const MAX_SPARKLINE = 100;
const UI_UPDATE_MS = 100;

function fmt(v: number): string {
  return v.toFixed(3);
}

function vec3Row(label: string, x: number, y: number, z: number): string {
  return `<tr><td>${label}</td><td>${fmt(x)}</td><td>${fmt(y)}</td><td>${fmt(z)}</td></tr>`;
}

export function renderDebug(
  container: HTMLElement,
  router: Router,
): void {
  container.innerHTML = `
    <h1>Sensor Debug</h1>
    <div id="debug-status" class="text-muted">Starting sensors...</div>
    <div class="card" style="margin-top:12px;">
      <h2>Raw Sensor</h2>
      <table id="raw-table" style="width:100%;font-family:monospace;font-size:13px;">
        <tr><th></th><th>X</th><th>Y</th><th>Z</th></tr>
      </table>
    </div>
    <div class="card">
      <h2>Fused Output</h2>
      <table id="fused-table" style="width:100%;font-family:monospace;font-size:13px;">
        <tr><th></th><th>X</th><th>Y</th><th>Z</th></tr>
      </table>
    </div>
    <div class="card">
      <h2>State</h2>
      <div id="state-info" style="font-family:monospace;font-size:13px;"></div>
    </div>
    <div class="card">
      <h2>Vertical Velocity</h2>
      <div id="sparkline"></div>
    </div>
    <div class="gap-8 mt-16">
      <input type="text" id="debug-label" placeholder="Label (e.g. squats-10)"
        style="flex:1;padding:12px;border-radius:8px;border:1px solid var(--primary);background:var(--surface);color:var(--text);font-size:16px;" />
      <button class="btn-accent" id="debug-save">Save JSON</button>
      <button class="btn-secondary" id="debug-stop">Stop</button>
    </div>
  `;

  const rawTable = container.querySelector<HTMLTableElement>("#raw-table")!;
  const fusedTable = container.querySelector<HTMLTableElement>("#fused-table")!;
  const stateInfo = container.querySelector<HTMLElement>("#state-info")!;
  const sparklineEl = container.querySelector<HTMLElement>("#sparkline")!;
  const statusEl = container.querySelector<HTMLElement>("#debug-status")!;

  const collector = new SensorCollector();
  const fusion = new FusionEngine();
  const detector = new RepDetector("eccentric-first");

  let lastRaw: SensorSample | null = null;
  let lastFused: FusedSample | null = null;
  let sampleCount = 0;
  let repCount = 0;
  let zuptCount = 0;
  let accelMag = 0;
  let stillSince: number | null = null;
  let startTime = performance.now();
  const velocityHistory: number[] = [];
  const allRawSamples: SensorSample[] = [];
  let uiInterval: number | null = null;

  collector.onSample((sample) => {
    sampleCount++;
    lastRaw = sample;

    accelMag = Math.sqrt(
      sample.acceleration.x ** 2 +
      sample.acceleration.y ** 2 +
      sample.acceleration.z ** 2,
    );

    if (accelMag < 0.5) {
      if (stillSince === null) stillSince = sample.timestamp;
      if (sample.timestamp - stillSince > 100) {
        fusion.applyZUPT();
        zuptCount++;
      }
    } else {
      stillSince = null;
    }

    allRawSamples.push(sample);

    lastFused = fusion.process(sample);
    const rep = detector.processSample(lastFused);
    if (rep) repCount++;

    velocityHistory.push(lastFused.velocity.y);
    if (velocityHistory.length > MAX_SPARKLINE) velocityHistory.shift();
  });

  function updateUI() {
    const elapsed = (performance.now() - startTime) / 1000;
    const rate = elapsed > 0 ? (sampleCount / elapsed).toFixed(1) : "0";

    if (lastRaw) {
      rawTable.innerHTML = `
        <tr><th></th><th>X</th><th>Y</th><th>Z</th></tr>
        ${vec3Row("Accel", lastRaw.acceleration.x, lastRaw.acceleration.y, lastRaw.acceleration.z)}
        ${vec3Row("Accel+G", lastRaw.accelerationWithGravity.x, lastRaw.accelerationWithGravity.y, lastRaw.accelerationWithGravity.z)}
        ${vec3Row("Gyro", lastRaw.rotationRate.x, lastRaw.rotationRate.y, lastRaw.rotationRate.z)}
      `;
    }

    if (lastFused) {
      const vMag = Math.sqrt(
        lastFused.velocity.x ** 2 +
        lastFused.velocity.y ** 2 +
        lastFused.velocity.z ** 2,
      );
      fusedTable.innerHTML = `
        <tr><th></th><th>X</th><th>Y</th><th>Z</th></tr>
        ${vec3Row("World Accel", lastFused.worldAcceleration.x, lastFused.worldAcceleration.y, lastFused.worldAcceleration.z)}
        ${vec3Row("Velocity", lastFused.velocity.x, lastFused.velocity.y, lastFused.velocity.z)}
        ${vec3Row("Position", lastFused.position.x, lastFused.position.y, lastFused.position.z)}
      `;

      stateInfo.innerHTML = `
        <div>Accel mag: ${fmt(accelMag)} m/s² ${accelMag < 0.3 ? "🟢 still" : "🔴 moving"}</div>
        <div>Speed: ${fmt(vMag)} m/s</div>
        <div>Roll: ${fmt(lastFused.tilt.roll * 180 / Math.PI)}° &nbsp; Pitch: ${fmt(lastFused.tilt.pitch * 180 / Math.PI)}°</div>
        <div>Phase: ${detector.getCurrentPhase()}</div>
        <div>Reps: ${repCount} &nbsp; ZUPTs: ${zuptCount}</div>
        <div>Rate: ${rate} samples/s &nbsp; Total: ${allRawSamples.length}</div>
      `;
    } else {
      stateInfo.innerHTML = `<div>Rate: ${rate} samples/s</div><div>Waiting for data...</div>`;
    }

    renderSparkline(sparklineEl, velocityHistory);
  }

  const secure = location.protocol === "https:" || location.hostname === "localhost";
  statusEl.textContent = secure
    ? "Starting sensors..."
    : `⚠ Not a secure context (${location.protocol}//${location.hostname}). Sensors require HTTPS.`;

  collector.start().then(() => {
    statusEl.textContent = "Sensors active";
    uiInterval = window.setInterval(updateUI, UI_UPDATE_MS);
  }).catch((err) => {
    statusEl.textContent = `Sensor error: ${err instanceof Error ? err.message : String(err)}`;
  });

  container.querySelector("#debug-save")!.addEventListener("click", () => {
    const labelInput = container.querySelector<HTMLInputElement>("#debug-label")!;
    const label = labelInput.value.trim() || "debug";
    const blob = new Blob(
      [JSON.stringify({ label, samples: allRawSamples }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vbt-${label}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    statusEl.textContent = `Saved ${allRawSamples.length} samples as ${a.download}`;
  });

  container.querySelector("#debug-stop")!.addEventListener("click", () => {
    if (uiInterval !== null) clearInterval(uiInterval);
    collector.stop();
    router.navigate("home");
  });
}

function renderSparkline(el: HTMLElement, data: number[]): void {
  if (data.length < 2) {
    el.innerHTML = '<span class="text-muted">Collecting...</span>';
    return;
  }

  const w = 280;
  const h = 80;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 0.01;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  const zeroY = h - ((0 - min) / range) * h;

  el.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;">
      <line x1="0" y1="${zeroY}" x2="${w}" y2="${zeroY}" stroke="#555" stroke-width="0.5" stroke-dasharray="4"/>
      <polyline points="${points}" fill="none" stroke="#e94560" stroke-width="1.5"/>
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:#888;">
      <span>${min.toFixed(2)}</span>
      <span>${max.toFixed(2)} m/s</span>
    </div>
  `;
}
