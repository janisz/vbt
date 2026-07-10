import { describe, it, expect, beforeEach } from "vitest";
import { FusionEngine } from "./engine.js";
import type { SensorSample, Vec3 } from "../types.js";

function makeSample(
  timestamp: number,
  accel: Vec3 = { x: 0, y: 0, z: 0 },
  accelWithGravity: Vec3 = { x: 0, y: 0, z: -9.81 },
  rotationRate: Vec3 = { x: 0, y: 0, z: 0 },
): SensorSample {
  return { timestamp, acceleration: accel, accelerationWithGravity: accelWithGravity, rotationRate };
}

describe("FusionEngine", () => {
  let engine: FusionEngine;

  beforeEach(() => {
    engine = new FusionEngine();
  });

  it("returns zero velocity and position for stationary phone", () => {
    const fused = engine.process(makeSample(0));
    expect(fused.velocity.x).toBeCloseTo(0, 2);
    expect(fused.velocity.y).toBeCloseTo(0, 2);
    expect(fused.velocity.z).toBeCloseTo(0, 2);
  });

  it("integrates upward acceleration into positive vertical velocity", () => {
    engine.process(makeSample(0));
    const accelUp: Vec3 = { x: 0, y: 0, z: 2 };
    const gravUp: Vec3 = { x: 0, y: 0, z: 2 - 9.81 };
    const fused = engine.process(makeSample(100, accelUp, gravUp));
    expect(fused.velocity.z).toBeGreaterThan(0);
  });

  it("ZUPT resets velocity to zero", () => {
    engine.process(makeSample(0));
    const accelUp: Vec3 = { x: 0, y: 0, z: 2 };
    const gravUp: Vec3 = { x: 0, y: 0, z: 2 - 9.81 };
    const before = engine.process(makeSample(100, accelUp, gravUp));
    expect(Math.abs(before.velocity.z)).toBeGreaterThan(0);
    engine.applyZUPT();
    const after = engine.process(makeSample(200));
    expect(Math.abs(after.velocity.z)).toBeLessThan(Math.abs(before.velocity.z));
  });

  it("handles phone mounted sideways via gravity orientation", () => {
    const sidewaysGravity: Vec3 = { x: -9.81, y: 0, z: 0 };
    engine.process(makeSample(0, { x: 0, y: 0, z: 0 }, sidewaysGravity));

    const deviceAccel: Vec3 = { x: 2, y: 0, z: 0 };
    const deviceGrav: Vec3 = { x: 2 - 9.81, y: 0, z: 0 };
    const fused = engine.process(makeSample(100, deviceAccel, deviceGrav));

    expect(Math.abs(fused.velocity.z)).toBeGreaterThan(0.005);
  });

  it("provides roll/pitch tilt from orientation", () => {
    const fused = engine.process(
      makeSample(0, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -9.81 }),
    );
    expect(fused.tilt.roll).toBeCloseTo(0, 1);
    expect(fused.tilt.pitch).toBeCloseTo(0, 1);
  });

  it("reset clears all accumulated state", () => {
    engine.process(makeSample(0));
    engine.process(makeSample(100, { x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -4.81 }));
    engine.reset();
    const fused = engine.process(makeSample(200));
    expect(fused.velocity.z).toBeCloseTo(0, 2);
  });
});
