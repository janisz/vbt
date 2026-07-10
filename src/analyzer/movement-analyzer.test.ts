import { describe, it, expect } from "vitest";
import { analyzeRep, analyzeSet } from "./movement-analyzer.js";
import { getReferencePath } from "./reference-paths.js";
import type { FusedSample, DetectedRep, Quaternion } from "../types.js";

const ID_Q: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

function makeFusedSamples(
  startTime: number,
  count: number,
  intervalMs: number,
  velocities: number[],
): FusedSample[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: startTime + i * intervalMs,
    worldAcceleration: { x: 0, y: 0, z: 0 },
    velocity: { x: 0.01 * i, y: 0, z: velocities[i] ?? 0 },
    position: { x: 0.001 * i, y: 0, z: 0.01 * i },
    orientation: ID_Q,
    tilt: { roll: 0.02 * i, pitch: 0 },
  }));
}

describe("analyzeRep", () => {
  it("calculates mean and peak concentric velocity", () => {
    const rep: DetectedRep = {
      repNumber: 1,
      startTime: 0,
      endTime: 600,
      phases: [
        { phase: "eccentric", startTime: 0, endTime: 300 },
        { phase: "concentric", startTime: 300, endTime: 600 },
      ],
      concentricDuration: 300,
      eccentricDuration: 300,
      pauseDuration: 0,
    };
    const velocities = [
      -0.2, -0.4, -0.3, // eccentric (indices 0-2)
      0.3, 0.5, 0.4,    // concentric (indices 3-5)
    ];
    const samples = makeFusedSamples(0, 6, 100, velocities);
    const result = analyzeRep(rep, samples);

    expect(result.meanConcentricVelocity).toBeCloseTo(0.4, 1);
    expect(result.peakConcentricVelocity).toBeCloseTo(0.5, 1);
    expect(result.repNumber).toBe(1);
  });

  it("calculates bar path from position data", () => {
    const rep: DetectedRep = {
      repNumber: 1,
      startTime: 0,
      endTime: 300,
      phases: [{ phase: "concentric", startTime: 0, endTime: 300 }],
      concentricDuration: 300,
      eccentricDuration: 0,
      pauseDuration: 0,
    };
    const samples = makeFusedSamples(0, 4, 100, [0.3, 0.4, 0.5, 0.3]);
    const result = analyzeRep(rep, samples);

    expect(result.barPath.length).toBeGreaterThan(0);
  });

  it("computes stability score from tilt variance", () => {
    const rep: DetectedRep = {
      repNumber: 1,
      startTime: 0,
      endTime: 300,
      phases: [{ phase: "concentric", startTime: 0, endTime: 300 }],
      concentricDuration: 300,
      eccentricDuration: 0,
      pauseDuration: 0,
    };
    const samples = makeFusedSamples(0, 4, 100, [0.3, 0.4, 0.5, 0.3]);
    const result = analyzeRep(rep, samples);

    expect(result.stabilityScore).toBeGreaterThanOrEqual(0);
    expect(result.stabilityScore).toBeLessThanOrEqual(100);
  });
});

describe("analyzeSet", () => {
  it("calculates velocity loss between fastest and last rep", () => {
    const reps = [
      { repNumber: 1, meanConcentricVelocity: 0.5, peakConcentricVelocity: 0.6, concentricDuration: 300, eccentricDuration: 300, barPath: [], maxTilt: 0, stabilityScore: 90, trajectoryDeviation: 0 },
      { repNumber: 2, meanConcentricVelocity: 0.45, peakConcentricVelocity: 0.55, concentricDuration: 320, eccentricDuration: 300, barPath: [], maxTilt: 1, stabilityScore: 88, trajectoryDeviation: 0 },
      { repNumber: 3, meanConcentricVelocity: 0.4, peakConcentricVelocity: 0.5, concentricDuration: 350, eccentricDuration: 310, barPath: [], maxTilt: 2, stabilityScore: 85, trajectoryDeviation: 0 },
    ];
    const result = analyzeSet(reps);
    expect(result.velocityLoss).toBeCloseTo(20, 0);
  });

  it("classifies VBT zone from mean velocity", () => {
    const reps = [
      { repNumber: 1, meanConcentricVelocity: 0.3, peakConcentricVelocity: 0.4, concentricDuration: 300, eccentricDuration: 300, barPath: [], maxTilt: 0, stabilityScore: 90, trajectoryDeviation: 0 },
    ];
    const result = analyzeSet(reps);
    expect(result.vbtZone).toBe("maximal-strength");
  });

  it("estimates RIR from velocity loss", () => {
    const reps = [
      { repNumber: 1, meanConcentricVelocity: 0.5, peakConcentricVelocity: 0.6, concentricDuration: 300, eccentricDuration: 300, barPath: [], maxTilt: 0, stabilityScore: 90, trajectoryDeviation: 0 },
      { repNumber: 2, meanConcentricVelocity: 0.25, peakConcentricVelocity: 0.3, concentricDuration: 500, eccentricDuration: 400, barPath: [], maxTilt: 5, stabilityScore: 60, trajectoryDeviation: 10 },
    ];
    const result = analyzeSet(reps);
    expect(result.estimatedRIR).toBeLessThanOrEqual(2);
  });
});

describe("getReferencePath", () => {
  it("returns a path for squat", () => {
    const path = getReferencePath("squat");
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(1);
  });

  it("returns null for unknown exercises", () => {
    expect(getReferencePath("unknown-exercise-xyz")).toBeNull();
  });
});
