import type { SensorSample, Vec3 } from "../types.js";

type SampleCallback = (sample: SensorSample) => void;

const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 };

export class SensorCollector {
  private callbacks: SampleCallback[] = [];
  private listening = false;
  private handler: ((e: DeviceMotionEvent) => void) | null = null;

  onSample(callback: SampleCallback): void {
    this.callbacks.push(callback);
  }

  isSupported(): boolean {
    return "DeviceMotionEvent" in window;
  }

  async start(): Promise<void> {
    if (this.listening) return;

    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof (DeviceMotionEvent as any).requestPermission === "function"
    ) {
      const permission = await (DeviceMotionEvent as any).requestPermission();
      if (permission !== "granted") {
        throw new Error("Motion sensor permission denied");
      }
    }

    this.handler = (e: DeviceMotionEvent) => this.handleDeviceMotion(e);
    window.addEventListener("devicemotion", this.handler);
    this.listening = true;
  }

  stop(): void {
    if (this.handler) {
      window.removeEventListener("devicemotion", this.handler);
      this.handler = null;
    }
    this.listening = false;
  }

  private handleDeviceMotion(e: DeviceMotionEvent): void {
    const DEG_TO_RAD = Math.PI / 180;

    const sample: SensorSample = {
      timestamp: performance.now(),
      acceleration: e.acceleration
        ? { x: e.acceleration.x ?? 0, y: e.acceleration.y ?? 0, z: e.acceleration.z ?? 0 }
        : ZERO_VEC3,
      accelerationWithGravity: e.accelerationIncludingGravity
        ? {
            x: e.accelerationIncludingGravity.x ?? 0,
            y: e.accelerationIncludingGravity.y ?? 0,
            z: e.accelerationIncludingGravity.z ?? 0,
          }
        : ZERO_VEC3,
      rotationRate: e.rotationRate
        ? {
            x: (e.rotationRate.beta ?? 0) * DEG_TO_RAD,
            y: (e.rotationRate.gamma ?? 0) * DEG_TO_RAD,
            z: (e.rotationRate.alpha ?? 0) * DEG_TO_RAD,
          }
        : ZERO_VEC3,
    };

    for (const cb of this.callbacks) {
      cb(sample);
    }
  }
}
