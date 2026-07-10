import type { SensorSample, FusedSample, Vec3, Quaternion } from "../types.js";
import {
  IDENTITY,
  qFromGravity,
  qNormalize,
  qMultiply,
  qFromAxisAngle,
  qRotateVec3,
  qSlerp,
  qToEuler,
} from "../math/quaternion.js";

const ALPHA = 0.97;

export class FusionEngine {
  private orientation: Quaternion = IDENTITY;
  private velocity: Vec3 = { x: 0, y: 0, z: 0 };
  private position: Vec3 = { x: 0, y: 0, z: 0 };
  private lastTimestamp: number | null = null;

  process(sample: SensorSample): FusedSample {
    const dt =
      this.lastTimestamp !== null
        ? (sample.timestamp - this.lastTimestamp) / 1000
        : 0;
    this.lastTimestamp = sample.timestamp;

    this.updateOrientation(sample, dt);

    const worldAccel = qRotateVec3(this.orientation, sample.acceleration);

    if (dt > 0) {
      this.velocity.x += worldAccel.x * dt;
      this.velocity.y += worldAccel.y * dt;
      this.velocity.z += worldAccel.z * dt;

      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      this.position.z += this.velocity.z * dt;
    }

    const euler = qToEuler(this.orientation);

    return {
      timestamp: sample.timestamp,
      worldAcceleration: { ...worldAccel },
      velocity: { ...this.velocity },
      position: { ...this.position },
      orientation: { ...this.orientation },
      tilt: { roll: euler.roll, pitch: euler.pitch },
    };
  }

  applyZUPT(): void {
    this.velocity = { x: 0, y: 0, z: 0 };
  }

  reset(): void {
    this.orientation = IDENTITY;
    this.velocity = { x: 0, y: 0, z: 0 };
    this.position = { x: 0, y: 0, z: 0 };
    this.lastTimestamp = null;
  }

  private updateOrientation(sample: SensorSample, dt: number): void {
    const gravityQ = qFromGravity(sample.accelerationWithGravity);

    if (dt > 0) {
      const rr = sample.rotationRate;
      const angle = Math.sqrt(rr.x * rr.x + rr.y * rr.y + rr.z * rr.z) * dt;
      if (angle > 1e-8) {
        const axis: Vec3 = {
          x: rr.x / (angle / dt),
          y: rr.y / (angle / dt),
          z: rr.z / (angle / dt),
        };
        const gyroQ = qMultiply(
          this.orientation,
          qFromAxisAngle(axis, angle),
        );
        this.orientation = qNormalize(qSlerp(gravityQ, gyroQ, ALPHA));
      } else {
        this.orientation = qNormalize(
          qSlerp(gravityQ, this.orientation, ALPHA),
        );
      }
    } else {
      this.orientation = gravityQ;
    }
  }
}
