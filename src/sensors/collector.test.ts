import { describe, it, expect, vi, beforeEach } from "vitest";
import { SensorCollector } from "./collector.js";
import type { SensorSample } from "../types.js";

function mockDeviceMotionEvent(overrides: Partial<DeviceMotionEventInit> = {}): DeviceMotionEvent {
  const defaults = {
    acceleration: { x: 1, y: 2, z: 3 },
    accelerationIncludingGravity: { x: 1, y: 2, z: -6.81 },
    rotationRate: { alpha: 0.1, beta: 0.2, gamma: 0.3 },
    interval: 16,
  };
  const init = { ...defaults, ...overrides };
  const event = new DeviceMotionEvent("devicemotion", init);
  Object.defineProperty(event, "acceleration", { value: init.acceleration, writable: false });
  Object.defineProperty(event, "accelerationIncludingGravity", {
    value: init.accelerationIncludingGravity,
    writable: false
  });
  Object.defineProperty(event, "rotationRate", { value: init.rotationRate, writable: false });
  return event;
}

describe("SensorCollector", () => {
  let collector: SensorCollector;

  beforeEach(() => {
    collector = new SensorCollector();
  });

  it("emits normalized SensorSample from devicemotion event", () => {
    const samples: SensorSample[] = [];
    collector.onSample((s) => samples.push(s));

    const event = mockDeviceMotionEvent();
    window.dispatchEvent(event);

    // Before start, should not collect
    expect(samples).toHaveLength(0);
  });

  it("does not emit samples after stop()", async () => {
    const samples: SensorSample[] = [];
    collector.onSample((s) => samples.push(s));
    await collector.start();
    collector.stop();

    window.dispatchEvent(mockDeviceMotionEvent());
    expect(samples).toHaveLength(0);
  });

  it("normalizes DeviceMotionEvent into SensorSample", async () => {
    const samples: SensorSample[] = [];
    collector.onSample((s) => samples.push(s));
    await collector.start();

    const event = mockDeviceMotionEvent();
    window.dispatchEvent(event);

    expect(samples).toHaveLength(1);
    const s = samples[0]!;
    expect(s.acceleration.x).toBe(1);
    expect(s.acceleration.y).toBe(2);
    expect(s.acceleration.z).toBe(3);
    expect(s.rotationRate.x).toBeCloseTo(0.2 * (Math.PI / 180));
    expect(s.rotationRate.y).toBeCloseTo(0.3 * (Math.PI / 180));
    expect(s.rotationRate.z).toBeCloseTo(0.1 * (Math.PI / 180));
    expect(s.timestamp).toBeGreaterThan(0);
  });

  it("handles null acceleration gracefully", async () => {
    const samples: SensorSample[] = [];
    collector.onSample((s) => samples.push(s));
    await collector.start();

    const event = new DeviceMotionEvent("devicemotion", {
      acceleration: null,
      accelerationIncludingGravity: { x: 0, y: 0, z: -9.81 },
      rotationRate: null,
      interval: 16,
    });
    window.dispatchEvent(event);

    expect(samples).toHaveLength(1);
    expect(samples[0]!.acceleration).toEqual({ x: 0, y: 0, z: 0 });
    expect(samples[0]!.rotationRate).toEqual({ x: 0, y: 0, z: 0 });
  });
});
