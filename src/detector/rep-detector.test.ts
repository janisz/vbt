import { describe, it, expect, beforeEach } from "vitest";
import { RepDetector } from "./rep-detector.js";
import type { FusedSample, Vec3, Quaternion, DetectedRep } from "../types.js";

const IDENTITY_Q: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

function makeFused(timestamp: number, vz: number): FusedSample {
  return {
    timestamp,
    worldAcceleration: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: vz },
    position: { x: 0, y: 0, z: 0 },
    orientation: IDENTITY_Q,
    tilt: { roll: 0, pitch: 0 },
  };
}

function feedVelocityProfile(
  detector: RepDetector,
  profile: Array<[number, number]>,
): DetectedRep[] {
  const reps: DetectedRep[] = [];
  for (const [ts, vz] of profile) {
    const rep = detector.processSample(makeFused(ts, vz));
    if (rep) reps.push(rep);
  }
  return reps;
}

describe("RepDetector", () => {
  let detector: RepDetector;

  beforeEach(() => {
    detector = new RepDetector("eccentric-first");
  });

  it("starts in idle phase", () => {
    expect(detector.getCurrentPhase()).toBe("idle");
  });

  it("detects a single eccentric-first rep", () => {
    const profile: Array<[number, number]> = [
      [0, 0],
      [100, 0],
      [200, -0.3],
      [300, -0.5],
      [400, -0.3],
      [500, 0],
      [600, 0.4],
      [700, 0.6],
      [800, 0.3],
      [900, 0.05],
      [1000, 0],
      [1300, 0],
    ];

    const reps = feedVelocityProfile(detector, profile);
    expect(reps).toHaveLength(1);
    expect(reps[0]!.repNumber).toBe(1);
    expect(reps[0]!.concentricDuration).toBeGreaterThan(0);
    expect(reps[0]!.eccentricDuration).toBeGreaterThan(0);
  });

  it("detects concentric-first rep (deadlift)", () => {
    detector = new RepDetector("concentric-first");

    const profile: Array<[number, number]> = [
      [0, 0],
      [100, 0],
      [200, 0.3],
      [300, 0.5],
      [400, 0.3],
      [500, 0],
      [600, -0.4],
      [700, -0.3],
      [800, -0.05],
      [900, 0],
      [1200, 0],
    ];

    const reps = feedVelocityProfile(detector, profile);
    expect(reps).toHaveLength(1);
    expect(reps[0]!.repNumber).toBe(1);
  });

  it("detects two consecutive reps", () => {
    const rep = [
      [-0.3, -0.5, -0.3, 0, 0.4, 0.6, 0.3, 0.05, 0, 0, 0],
    ];
    const profile: Array<[number, number]> = [];
    let t = 0;
    for (let r = 0; r < 2; r++) {
      for (const v of rep[0]!) {
        profile.push([t, v]);
        t += 100;
      }
    }
    const reps = feedVelocityProfile(detector, profile);
    expect(reps).toHaveLength(2);
    expect(reps[1]!.repNumber).toBe(2);
  });

  it("ignores small noise below velocity threshold", () => {
    const profile: Array<[number, number]> = [
      [0, 0],
      [100, 0.02],
      [200, -0.03],
      [300, 0.01],
      [400, 0],
    ];
    const reps = feedVelocityProfile(detector, profile);
    expect(reps).toHaveLength(0);
    expect(detector.getCurrentPhase()).toBe("idle");
  });

  it("isStill returns true when velocity near zero", () => {
    detector.processSample(makeFused(0, 0));
    detector.processSample(makeFused(100, 0));
    expect(detector.isStill()).toBe(true);
  });

  it("isStill returns false during movement", () => {
    detector.processSample(makeFused(0, 0));
    detector.processSample(makeFused(100, 0.5));
    expect(detector.isStill()).toBe(false);
  });

  it("reset returns to idle", () => {
    detector.processSample(makeFused(0, 0));
    detector.processSample(makeFused(100, -0.5));
    detector.reset();
    expect(detector.getCurrentPhase()).toBe("idle");
  });
});
