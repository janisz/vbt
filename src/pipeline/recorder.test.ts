import { describe, it, expect, beforeEach } from "vitest";
import { Recorder } from "./recorder.js";
import type { SensorSample, Vec3 } from "../types.js";

function makeSample(
  timestamp: number,
  accel: Vec3 = { x: 0, y: 0, z: 0 },
  gravity: Vec3 = { x: 0, y: 0, z: -9.81 },
): SensorSample {
  return {
    timestamp,
    acceleration: accel,
    accelerationWithGravity: gravity,
    rotationRate: { x: 0, y: 0, z: 0 },
  };
}

describe("Recorder", () => {
  let recorder: Recorder;

  beforeEach(() => {
    recorder = new Recorder();
  });

  it("starts in non-recording state", () => {
    expect(recorder.isRecording()).toBe(false);
  });

  it("tracks recording state", () => {
    recorder.start("eccentric-first");
    expect(recorder.isRecording()).toBe(true);
    recorder.stop();
    expect(recorder.isRecording()).toBe(false);
  });

  it("processes sensor samples through the full pipeline", () => {
    recorder.start("eccentric-first");

    // Feed stationary samples
    recorder.ingestSample(makeSample(0));
    recorder.ingestSample(makeSample(100));

    expect(recorder.getRepCount()).toBe(0);
  });

  it("returns empty set analysis when stopped with no reps", () => {
    recorder.start("eccentric-first");
    recorder.ingestSample(makeSample(0));
    const result = recorder.stop();
    expect(result.reps).toHaveLength(0);
    expect(result.velocityLoss).toBe(0);
  });

  it("tracks idle duration", () => {
    recorder.start("eccentric-first");
    recorder.ingestSample(makeSample(0));
    recorder.ingestSample(makeSample(5000));
    expect(recorder.getIdleDurationMs()).toBeGreaterThanOrEqual(4000);
  });
});
