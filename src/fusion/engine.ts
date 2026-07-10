import type { SensorSample, FusedSample, Vec3, Quaternion } from "../types.js";
import AHRS from "ahrs";
import KalmanFilter from "kalmanjs";
import { IDENTITY, qFromGravity, qRotateVec3, qToEuler } from "../math/quaternion.js";

export class FusionEngine {
  private ahrs: AHRS;
  private kfX: KalmanFilter;
  private kfY: KalmanFilter;
  private kfZ: KalmanFilter;
  private orientation: Quaternion = IDENTITY;
  private velocity: Vec3 = { x: 0, y: 0, z: 0 };
  private position: Vec3 = { x: 0, y: 0, z: 0 };
  private lastTimestamp: number | null = null;

  constructor() {
    this.ahrs = new AHRS({ sampleInterval: 16, algorithm: "Madgwick", beta: 0.4 });
    this.kfX = new KalmanFilter({ R: 1, Q: 3 });
    this.kfY = new KalmanFilter({ R: 1, Q: 3 });
    this.kfZ = new KalmanFilter({ R: 1, Q: 3 });
  }

  process(sample: SensorSample): FusedSample {
    const dt =
      this.lastTimestamp !== null
        ? (sample.timestamp - this.lastTimestamp) / 1000
        : 0;
    this.lastTimestamp = sample.timestamp;

    if (dt > 0) {
      const g = sample.accelerationWithGravity;
      const r = sample.rotationRate;
      this.ahrs.update(r.x, r.y, r.z, g.x / 9.81, g.y / 9.81, g.z / 9.81, undefined, undefined, undefined, dt);
      const q = this.ahrs.getQuaternion();
      if (!isNaN(q.w)) {
        this.orientation = { w: q.w, x: q.x, y: q.y, z: q.z };
      } else {
        this.orientation = qFromGravity(sample.accelerationWithGravity);
        this.ahrs = new AHRS({ sampleInterval: 16, algorithm: "Madgwick", beta: 0.4 });
      }
    } else {
      this.orientation = qFromGravity(sample.accelerationWithGravity);
    }

    const worldAccelRaw = qRotateVec3(this.orientation, sample.acceleration);
    const worldAccel: Vec3 = {
      x: this.kfX.filter(worldAccelRaw.x),
      y: this.kfY.filter(worldAccelRaw.y),
      z: this.kfZ.filter(worldAccelRaw.z),
    };

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
    this.ahrs = new AHRS({ sampleInterval: 16, algorithm: "Madgwick", beta: 0.4 });
    this.kfX = new KalmanFilter({ R: 1, Q: 3 });
    this.kfY = new KalmanFilter({ R: 1, Q: 3 });
    this.kfZ = new KalmanFilter({ R: 1, Q: 3 });
    this.orientation = IDENTITY;
    this.velocity = { x: 0, y: 0, z: 0 };
    this.position = { x: 0, y: 0, z: 0 };
    this.lastTimestamp = null;
  }
}
