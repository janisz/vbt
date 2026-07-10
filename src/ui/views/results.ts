import type { SetAnalysis, Session, WorkoutSet } from "../../types.js";
import { saveSession, saveSet } from "../../storage/db.js";
import { renderVelocityChart } from "../components/velocity-chart.js";
import { renderBarPathChart } from "../components/bar-path-chart.js";
import type { Router } from "../router.js";

function qualityDot(value: number, thresholds: [number, number]): string {
  const color =
    value <= thresholds[0]
      ? "var(--green)"
      : value <= thresholds[1]
        ? "var(--yellow)"
        : "var(--red)";
  return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;"></span>`;
}

let currentSessionId: string | null = null;

export function renderResults(
  container: HTMLElement,
  router: Router,
  params: Record<string, string>,
): void {
  const analysis: SetAnalysis = JSON.parse(params.setAnalysis ?? "{}");
  const exerciseId = params.exerciseId ?? "";
  const exerciseName = params.exerciseName ?? "";
  const weight = params.weight ? parseFloat(params.weight) : undefined;

  const bestMCV =
    analysis.reps.length > 0
      ? Math.max(...analysis.reps.map((r) => r.meanConcentricVelocity))
      : 0;

  const avgTilt =
    analysis.reps.length > 0
      ? analysis.reps.reduce((s, r) => s + r.maxTilt, 0) / analysis.reps.length
      : 0;
  const avgStability =
    analysis.reps.length > 0
      ? analysis.reps.reduce((s, r) => s + r.stabilityScore, 0) / analysis.reps.length
      : 0;
  const avgDeviation =
    analysis.reps.length > 0
      ? analysis.reps.reduce((s, r) => s + r.trajectoryDeviation, 0) / analysis.reps.length
      : 0;

  const exerciseKey = mapExerciseKey(exerciseName);

  container.innerHTML = `
    <div class="card">
      <h2>${exerciseName}${weight ? ` — ${weight}kg` : ""}</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
        <div><div class="text-muted">Reps</div><div style="font-size:24px;font-weight:700;">${analysis.reps.length}</div></div>
        <div><div class="text-muted">Best MCV</div><div style="font-size:24px;font-weight:700;">${bestMCV.toFixed(2)} m/s</div></div>
        <div><div class="text-muted">Velocity Loss</div><div style="font-size:24px;font-weight:700;">${analysis.velocityLoss.toFixed(0)}%</div></div>
        <div><div class="text-muted">Est. RIR</div><div style="font-size:24px;font-weight:700;">${analysis.estimatedRIR}</div></div>
      </div>
      <div style="margin-top:8px;text-align:center;">
        <span style="background:var(--primary);padding:4px 12px;border-radius:16px;font-size:13px;">${analysis.vbtZone}</span>
      </div>
    </div>

    <div class="card">
      <h2>Velocity per Rep</h2>
      <div id="velocity-chart"></div>
    </div>

    <div class="card">
      <h2>Bar Path</h2>
      <div id="bar-path-chart"></div>
    </div>

    <div class="card">
      <h2>Movement Quality</h2>
      <div class="gap-8">
        <div>${qualityDot(avgTilt, [3, 5])} Tilt: ${avgTilt.toFixed(1)}°</div>
        <div>${qualityDot(100 - avgStability, [15, 30])} Stability: ${avgStability.toFixed(0)}/100</div>
        <div>${qualityDot(avgDeviation, [10, 25])} Trajectory: ${avgDeviation.toFixed(1)}mm</div>
      </div>
    </div>

    <div class="gap-8 mt-16">
      <button class="btn-accent" id="save-new">Save & New Set</button>
      <button class="btn-secondary" id="end-session">End Session</button>
    </div>
    <div style="text-align:center;margin-top:24px;opacity:0.3;font-size:12px;">VBT</div>
  `;

  renderVelocityChart(
    container.querySelector("#velocity-chart")!,
    analysis.reps,
  );
  renderBarPathChart(
    container.querySelector("#bar-path-chart")!,
    analysis.reps,
    exerciseKey,
  );

  container.querySelector("#save-new")!.addEventListener("click", async () => {
    await saveCurrentSet(analysis, exerciseId, exerciseName, weight);
    router.navigate("exercise-select");
  });

  container
    .querySelector("#end-session")!
    .addEventListener("click", async () => {
      await saveCurrentSet(analysis, exerciseId, exerciseName, weight);
      currentSessionId = null;
      router.navigate("home");
    });
}

async function saveCurrentSet(
  analysis: SetAnalysis,
  exerciseId: string,
  exerciseName: string,
  weight?: number,
): Promise<void> {
  if (!currentSessionId) {
    currentSessionId = crypto.randomUUID();
    await saveSession({ id: currentSessionId, date: Date.now() });
  }
  await saveSet({
    id: crypto.randomUUID(),
    sessionId: currentSessionId,
    exerciseId,
    exerciseName,
    weight,
    timestamp: Date.now(),
    reps: analysis.reps,
    velocityLoss: analysis.velocityLoss,
    estimatedRIR: analysis.estimatedRIR,
    vbtZone: analysis.vbtZone,
  });
}

function mapExerciseKey(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes("squat")) return "squat";
  if (lower.includes("bench")) return "bench_press";
  if (lower.includes("deadlift")) return "deadlift";
  if (lower.includes("overhead") || lower.includes("shoulder press"))
    return "overhead_press";
  return null;
}
