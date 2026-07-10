import type { Vec3, Quaternion } from "../types.js";

export const IDENTITY: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

export function qFromAxisAngle(axis: Vec3, angle: number): Quaternion {
  const half = angle / 2;
  const s = Math.sin(half);
  return { w: Math.cos(half), x: axis.x * s, y: axis.y * s, z: axis.z * s };
}

export function qMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function qNormalize(q: Quaternion): Quaternion {
  const len = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
  if (len < 1e-10) return IDENTITY;
  return { w: q.w / len, x: q.x / len, y: q.y / len, z: q.z / len };
}

export function qRotateVec3(q: Quaternion, v: Vec3): Vec3 {
  const qv: Quaternion = { w: 0, x: v.x, y: v.y, z: v.z };
  const qConj: Quaternion = { w: q.w, x: -q.x, y: -q.y, z: -q.z };
  const result = qMultiply(qMultiply(q, qv), qConj);
  return { x: result.x, y: result.y, z: result.z };
}

export function qFromGravity(gravity: Vec3): Quaternion {
  const len = Math.sqrt(
    gravity.x * gravity.x + gravity.y * gravity.y + gravity.z * gravity.z,
  );
  if (len < 1e-10) return IDENTITY;
  const gn: Vec3 = {
    x: gravity.x / len,
    y: gravity.y / len,
    z: gravity.z / len,
  };

  const worldDown: Vec3 = { x: 0, y: 0, z: -1 };
  const dot = gn.x * worldDown.x + gn.y * worldDown.y + gn.z * worldDown.z;

  if (dot > 0.9999) return IDENTITY;
  if (dot < -0.9999) return { w: 0, x: 1, y: 0, z: 0 };

  const cross: Vec3 = {
    x: gn.y * worldDown.z - gn.z * worldDown.y,
    y: gn.z * worldDown.x - gn.x * worldDown.z,
    z: gn.x * worldDown.y - gn.y * worldDown.x,
  };
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  const crossLen = Math.sqrt(
    cross.x * cross.x + cross.y * cross.y + cross.z * cross.z,
  );
  if (crossLen < 1e-10) return IDENTITY;
  const axis: Vec3 = {
    x: cross.x / crossLen,
    y: cross.y / crossLen,
    z: cross.z / crossLen,
  };
  return qFromAxisAngle(axis, angle);
}

export function qSlerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let dot = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
  let b2 = b;
  if (dot < 0) {
    dot = -dot;
    b2 = { w: -b.w, x: -b.x, y: -b.y, z: -b.z };
  }
  if (dot > 0.9995) {
    return qNormalize({
      w: a.w + t * (b2.w - a.w),
      x: a.x + t * (b2.x - a.x),
      y: a.y + t * (b2.y - a.y),
      z: a.z + t * (b2.z - a.z),
    });
  }
  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;
  return {
    w: wa * a.w + wb * b2.w,
    x: wa * a.x + wb * b2.x,
    y: wa * a.y + wb * b2.y,
    z: wa * a.z + wb * b2.z,
  };
}

export function qToEuler(q: Quaternion): {
  roll: number;
  pitch: number;
  yaw: number;
} {
  const sinr = 2 * (q.w * q.x + q.y * q.z);
  const cosr = 1 - 2 * (q.x * q.x + q.y * q.y);
  const roll = Math.atan2(sinr, cosr);

  const sinp = 2 * (q.w * q.y - q.z * q.x);
  const pitch = Math.abs(sinp) >= 1
    ? (Math.sign(sinp) * Math.PI) / 2
    : Math.asin(sinp);

  const siny = 2 * (q.w * q.z + q.x * q.y);
  const cosy = 1 - 2 * (q.y * q.y + q.z * q.z);
  const yaw = Math.atan2(siny, cosy);

  return { roll, pitch, yaw };
}
