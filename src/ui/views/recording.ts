import { SensorCollector } from "../../sensors/collector.js";
import { Recorder } from "../../pipeline/recorder.js";
import type { Router } from "../router.js";
import type { PhaseOrder } from "../../types.js";

const COUNTDOWN_SECONDS = 5;
const AUTO_STOP_IDLE_MS = 5000;
const IDLE_CHECK_INTERVAL_MS = 500;

export function renderRecording(
  container: HTMLElement,
  router: Router,
  params: Record<string, string>,
): void {
  const exerciseId = params.exerciseId ?? "";
  const exerciseName = params.exerciseName ?? "Unknown";
  const weight = params.weight ? parseFloat(params.weight) : undefined;
  const phaseOrder: PhaseOrder =
    exerciseName.toLowerCase().includes("deadlift")
      ? "concentric-first"
      : "eccentric-first";

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;text-align:center;">
      <h2>${exerciseName}</h2>
      ${weight ? `<div class="text-muted">${weight} kg</div>` : ""}
      <div id="countdown" style="font-size:72px;font-weight:700;margin:32px 0;"></div>
      <div id="status" style="font-size:20px;margin-bottom:16px;"></div>
      <div id="rep-count" style="font-size:48px;font-weight:700;margin-bottom:32px;">0</div>
      <button class="btn-accent" id="stop-btn" style="display:none;">Stop</button>
    </div>
  `;

  const countdownEl = container.querySelector<HTMLElement>("#countdown")!;
  const statusEl = container.querySelector<HTMLElement>("#status")!;
  const repCountEl = container.querySelector<HTMLElement>("#rep-count")!;
  const stopBtn = container.querySelector<HTMLButtonElement>("#stop-btn")!;

  const collector = new SensorCollector();
  const recorder = new Recorder();
  let idleTimer: number | null = null;
  let wakeLock: WakeLockSentinel | null = null;

  async function acquireWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen");
      }
    } catch { /* non-critical */ }
  }

  function releaseWakeLock() {
    wakeLock?.release();
    wakeLock = null;
  }

  function startCountdown() {
    let remaining = COUNTDOWN_SECONDS;
    countdownEl.textContent = String(remaining);
    statusEl.textContent = "Mount phone on bar";

    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        countdownEl.textContent = "";
        startRecording();
      } else {
        countdownEl.textContent = String(remaining);
      }
    }, 1000);
  }

  async function startRecording() {
    statusEl.textContent = "Recording...";
    stopBtn.style.display = "block";
    await acquireWakeLock();

    recorder.start(phaseOrder);
    recorder.onRepDetected(() => {
      repCountEl.textContent = String(recorder.getRepCount());
    });

    collector.onSample((sample) => recorder.ingestSample(sample));
    await collector.start();

    idleTimer = window.setInterval(() => {
      if (recorder.getIdleDurationMs() > AUTO_STOP_IDLE_MS && recorder.getRepCount() > 0) {
        stopRecording();
      }
    }, IDLE_CHECK_INTERVAL_MS);
  }

  function stopRecording() {
    if (idleTimer !== null) clearInterval(idleTimer);
    collector.stop();
    const result = recorder.stop();
    releaseWakeLock();

    router.navigate("results", {
      exerciseId,
      exerciseName,
      weight: weight?.toString() ?? "",
      setAnalysis: JSON.stringify(result),
    });
  }

  stopBtn.addEventListener("click", stopRecording);
  startCountdown();
}
