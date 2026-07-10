import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Recorder } from "./recorder.js";
import type { SensorSample } from "../types.js";

interface RecordedData {
  label: string;
  samples: SensorSample[];
}

function loadFixture(filename: string): RecordedData {
  const path = resolve(__dirname, "../../data", filename);
  return JSON.parse(readFileSync(path, "utf-8"));
}

describe("Recorder integration with real sensor data", () => {
  it("detects reps from recorded bodyweight squats", () => {
    const data = loadFixture("vbt-Squats-10-1783692344889.json");
    const recorder = new Recorder();
    recorder.start("eccentric-first");

    const detectedReps: number[] = [];
    recorder.onRepDetected((rep) => {
      detectedReps.push(rep.repNumber);
    });

    for (const sample of data.samples) {
      recorder.ingestSample(sample);
    }

    const result = recorder.stop();

    expect(result.reps.length).toBeGreaterThanOrEqual(5);
    expect(result.reps.length).toBeLessThanOrEqual(15);

    for (const rep of result.reps) {
      expect(rep.meanConcentricVelocity).toBeGreaterThan(0);
      expect(rep.peakConcentricVelocity).toBeGreaterThan(0);
      expect(rep.concentricDuration).toBeGreaterThan(0);
      expect(rep.eccentricDuration).toBeGreaterThan(0);
    }
  });

  it("callback fires for every detected rep", () => {
    const data = loadFixture("vbt-Squats-10-1783692344889.json");
    const recorder = new Recorder();
    recorder.start("eccentric-first");

    let callbackCount = 0;
    recorder.onRepDetected(() => {
      callbackCount++;
    });

    for (const sample of data.samples) {
      recorder.ingestSample(sample);
    }

    const result = recorder.stop();
    expect(callbackCount).toBe(result.reps.length);
  });

  it("rep velocities are within realistic range for bodyweight squats", () => {
    const data = loadFixture("vbt-Squats-10-1783692344889.json");
    const recorder = new Recorder();
    recorder.start("eccentric-first");

    for (const sample of data.samples) {
      recorder.ingestSample(sample);
    }

    const result = recorder.stop();

    for (const rep of result.reps) {
      expect(rep.meanConcentricVelocity).toBeLessThan(3.0);
      expect(rep.peakConcentricVelocity).toBeLessThan(5.0);
    }
  });
});
