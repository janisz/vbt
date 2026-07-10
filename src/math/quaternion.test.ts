import { describe, it, expect } from "vitest";
import {
  qFromAxisAngle,
  qMultiply,
  qNormalize,
  qRotateVec3,
  qFromGravity,
  qSlerp,
  qToEuler,
  IDENTITY,
} from "./quaternion.js";
import type { Vec3, Quaternion } from "../types.js";

function expectVec3Close(actual: Vec3, expected: Vec3, precision = 4) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

describe("IDENTITY", () => {
  it("represents no rotation", () => {
    expect(IDENTITY).toEqual({ w: 1, x: 0, y: 0, z: 0 });
  });
});

describe("qFromAxisAngle", () => {
  it("creates quaternion for 90° rotation around Z", () => {
    const q = qFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
    expect(q.w).toBeCloseTo(Math.cos(Math.PI / 4), 5);
    expect(q.z).toBeCloseTo(Math.sin(Math.PI / 4), 5);
  });
});

describe("qMultiply", () => {
  it("identity * q = q", () => {
    const q = qFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 3);
    const result = qMultiply(IDENTITY, q);
    expect(result.w).toBeCloseTo(q.w, 5);
    expect(result.x).toBeCloseTo(q.x, 5);
  });
});

describe("qNormalize", () => {
  it("normalizes a scaled quaternion", () => {
    const q: Quaternion = { w: 2, x: 0, y: 0, z: 0 };
    const n = qNormalize(q);
    expect(n.w).toBeCloseTo(1, 5);
  });
});

describe("qRotateVec3", () => {
  it("rotating (1,0,0) by 90° around Z gives (0,1,0)", () => {
    const q = qFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
    const result = qRotateVec3(q, { x: 1, y: 0, z: 0 });
    expectVec3Close(result, { x: 0, y: 1, z: 0 });
  });

  it("identity rotation leaves vector unchanged", () => {
    const v: Vec3 = { x: 3, y: -1, z: 7 };
    expectVec3Close(qRotateVec3(IDENTITY, v), v);
  });
});

describe("qFromGravity", () => {
  it("phone flat face-up: gravity is (0,0,-9.81) → identity-ish", () => {
    const q = qFromGravity({ x: 0, y: 0, z: -9.81 });
    const down = qRotateVec3(q, { x: 0, y: 0, z: -1 });
    expectVec3Close(down, { x: 0, y: 0, z: -1 }, 2);
  });

  it("phone tilted 90° forward: gravity is (0,9.81,0)", () => {
    const q = qFromGravity({ x: 0, y: 9.81, z: 0 });
    const worldDown = qRotateVec3(q, { x: 0, y: 0, z: -1 });
    expect(worldDown.y).toBeCloseTo(-1, 1);
  });
});

describe("qSlerp", () => {
  it("slerp(a, b, 0) = a", () => {
    const a = IDENTITY;
    const b = qFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
    const result = qSlerp(a, b, 0);
    expect(result.w).toBeCloseTo(a.w, 5);
  });

  it("slerp(a, b, 1) = b", () => {
    const a = IDENTITY;
    const b = qFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
    const result = qSlerp(a, b, 1);
    expect(result.w).toBeCloseTo(b.w, 5);
    expect(result.z).toBeCloseTo(b.z, 5);
  });
});

describe("qToEuler", () => {
  it("identity gives zero angles", () => {
    const euler = qToEuler(IDENTITY);
    expect(euler.roll).toBeCloseTo(0, 5);
    expect(euler.pitch).toBeCloseTo(0, 5);
    expect(euler.yaw).toBeCloseTo(0, 5);
  });

  it("90° around X gives ~90° roll", () => {
    const q = qFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    const euler = qToEuler(q);
    expect(euler.roll).toBeCloseTo(Math.PI / 2, 2);
  });
});
