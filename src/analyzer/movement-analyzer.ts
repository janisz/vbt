import type { FusedSample, DetectedRep, RepAnalysis, SetAnalysis } from "../types.js";
import { getReferencePath } from "./reference-paths.js";

export function analyzeRep(rep: DetectedRep, samples: FusedSample[]): RepAnalysis {
  const repSamples = samples.filter(
    (s) => s.timestamp >= rep.startTime && s.timestamp <= rep.endTime,
  );

  const concentricPhase = rep.phases.find((p) => p.phase === "concentric");
  const concentricSamples = concentricPhase
    ? repSamples.filter(
        (s) =>
          s.timestamp >= concentricPhase.startTime &&
          s.timestamp <= concentricPhase.endTime,
      )
    : [];

  const concentricVelocities = concentricSamples.map((s) =>
    Math.abs(s.velocity.z),
  );
  const meanConcentricVelocity =
    concentricVelocities.length > 0
      ? concentricVelocities.reduce((a, b) => a + b, 0) /
        concentricVelocities.length
      : 0;
  const peakConcentricVelocity =
    concentricVelocities.length > 0 ? Math.max(...concentricVelocities) : 0;

  const barPath = repSamples.map((s) => ({ x: s.position.x, y: s.position.z }));

  const tilts = repSamples.map((s) => Math.abs(s.tilt.roll));
  const maxTilt =
    tilts.length > 0
      ? (Math.max(...tilts) * 180) / Math.PI
      : 0;

  const stabilityScore = computeStabilityScore(repSamples);

  return {
    repNumber: rep.repNumber,
    meanConcentricVelocity,
    peakConcentricVelocity,
    concentricDuration: rep.concentricDuration,
    eccentricDuration: rep.eccentricDuration,
    barPath,
    maxTilt,
    stabilityScore,
    trajectoryDeviation: 0,
  };
}

export function analyzeSet(reps: RepAnalysis[]): SetAnalysis {
  if (reps.length === 0) {
    return { reps, velocityLoss: 0, estimatedRIR: 0, vbtZone: "unknown", repConsistency: 0 };
  }

  const velocities = reps.map((r) => r.meanConcentricVelocity);
  const fastest = Math.max(...velocities);
  const last = velocities[velocities.length - 1]!;
  const velocityLoss = fastest > 0 ? ((fastest - last) / fastest) * 100 : 0;

  const avgVelocity =
    velocities.reduce((a, b) => a + b, 0) / velocities.length;

  const vbtZone = classifyZone(avgVelocity);
  const estimatedRIR = estimateRIR(velocityLoss);

  const mean = avgVelocity;
  const variance =
    velocities.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
    velocities.length;
  const repConsistency = Math.sqrt(variance);

  return { reps, velocityLoss, estimatedRIR, vbtZone, repConsistency };
}

function classifyZone(mcv: number): string {
  if (mcv < 0.35) return "maximal-strength";
  if (mcv < 0.5) return "accelerative-strength";
  if (mcv < 0.75) return "strength-speed";
  if (mcv < 1.0) return "power";
  return "speed-strength";
}

function estimateRIR(velocityLossPercent: number): number {
  if (velocityLossPercent < 10) return 5;
  if (velocityLossPercent < 20) return 3;
  if (velocityLossPercent < 30) return 2;
  if (velocityLossPercent < 40) return 1;
  return 0;
}

function computeStabilityScore(samples: FusedSample[]): number {
  if (samples.length < 2) return 100;
  const accMagnitudes = samples.map((s) => {
    const a = s.worldAcceleration;
    return Math.sqrt(a.x * a.x + a.y * a.y);
  });
  const mean = accMagnitudes.reduce((a, b) => a + b, 0) / accMagnitudes.length;
  const variance =
    accMagnitudes.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
    accMagnitudes.length;
  const shakeMagnitude = Math.sqrt(variance);

  const score = Math.max(0, Math.min(100, 100 - shakeMagnitude * 200));
  return Math.round(score);
}
