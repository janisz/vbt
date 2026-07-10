# VBT Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-only PWA that uses phone IMU sensors to measure barbell velocity, detect fatigue, and analyze movement quality.

**Architecture:** Vanilla TypeScript pipeline: Sensor Collector → Sensor Fusion (complementary filter with quaternion orientation tracking) → Rep Detector (state machine) → Movement Analyzer → UI. Data persisted locally in IndexedDB. Exercise metadata bundled from the hasaneyldrm/exercises-dataset.

**Tech Stack:** TypeScript, Vite (build tool), Web DeviceMotion/Generic Sensor APIs, IndexedDB, PWA (service worker + manifest)

## Global Constraints

- No framework — vanilla TypeScript, DOM APIs only
- No backend — everything runs in the browser
- HTTPS required (sensor APIs are secure-context only)
- Must work on Android Chrome (Generic Sensor API) and iOS Safari (DeviceMotion fallback)
- Exercise dataset bundled at build time, not fetched at runtime
- All sensor math uses SI units: m/s², rad/s, m/s, meters, seconds

---

### Task 1: Project Scaffolding & Build Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/types.ts`

**Interfaces:**
- Consumes: nothing
- Produces: Build toolchain; `Vec3` and `Quaternion` types used by all subsequent tasks; dev server at `localhost:5173`

- [ ] **Step 1: Initialize the project**

```bash
cd /home/janisz/go/src/github.com/janisz/vbt
npm init -y
npm install -D typescript vite
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": []
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: { outDir: "dist" },
});
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#1a1a2e" />
  <title>VBT</title>
  <link rel="manifest" href="/manifest.json" />
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: Create src/types.ts with core math types**

```typescript
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

export interface SensorSample {
  timestamp: number;
  acceleration: Vec3;
  accelerationWithGravity: Vec3;
  rotationRate: Vec3;
}

export interface FusedSample {
  timestamp: number;
  worldAcceleration: Vec3;
  velocity: Vec3;
  position: Vec3;
  orientation: Quaternion;
  tilt: { roll: number; pitch: number };
}

export type RepPhase = "idle" | "eccentric" | "concentric" | "pause";

export interface PhaseBoundary {
  phase: RepPhase;
  startTime: number;
  endTime: number;
}

export interface DetectedRep {
  repNumber: number;
  startTime: number;
  endTime: number;
  phases: PhaseBoundary[];
  concentricDuration: number;
  eccentricDuration: number;
  pauseDuration: number;
}

export interface RepAnalysis {
  repNumber: number;
  meanConcentricVelocity: number;
  peakConcentricVelocity: number;
  concentricDuration: number;
  eccentricDuration: number;
  barPath: Array<{ x: number; y: number }>;
  maxTilt: number;
  stabilityScore: number;
  trajectoryDeviation: number;
}

export interface SetAnalysis {
  reps: RepAnalysis[];
  velocityLoss: number;
  estimatedRIR: number;
  vbtZone: string;
  repConsistency: number;
}

export type PhaseOrder = "eccentric-first" | "concentric-first";

export interface Exercise {
  id: string;
  name: string;
  category: string;
  bodyPart: string;
  equipment: string;
  target: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  instructions: string;
  image: string;
  gifUrl: string;
}

export interface Session {
  id: string;
  date: number;
  notes?: string;
}

export interface WorkoutSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  weight?: number;
  timestamp: number;
  reps: RepAnalysis[];
  velocityLoss: number;
  estimatedRIR: number;
  vbtZone: string;
}
```

- [ ] **Step 6: Create src/main.ts placeholder**

```typescript
document.querySelector<HTMLDivElement>("#app")!.textContent = "VBT";
```

- [ ] **Step 7: Verify build works**

Run: `npx vite build`
Expected: Build succeeds, `dist/` directory created.

Run: `npx vite --host`
Expected: Dev server starts at localhost:5173, page shows "VBT".
Stop the dev server after verifying.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/main.ts src/types.ts
git commit -m "chore: scaffold project with Vite + TypeScript"
```

---

### Task 2: Quaternion Math Library

**Files:**
- Create: `src/math/quaternion.ts`
- Create: `src/math/quaternion.test.ts`

**Interfaces:**
- Consumes: `Vec3`, `Quaternion` from `src/types.ts`
- Produces: `qFromAxisAngle(axis: Vec3, angle: number): Quaternion`, `qMultiply(a: Quaternion, b: Quaternion): Quaternion`, `qNormalize(q: Quaternion): Quaternion`, `qRotateVec3(q: Quaternion, v: Vec3): Vec3`, `qFromGravity(gravity: Vec3): Quaternion`, `qSlerp(a: Quaternion, b: Quaternion, t: number): Quaternion`, `qToEuler(q: Quaternion): { roll: number; pitch: number; yaw: number }`, `IDENTITY: Quaternion`

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

Add to `package.json` scripts:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 2: Write failing tests**

Create `src/math/quaternion.test.ts`:

```typescript
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

  it("90° around X gives ~90° pitch", () => {
    const q = qFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    const euler = qToEuler(q);
    expect(euler.pitch).toBeCloseTo(Math.PI / 2, 2);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/math/quaternion.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement quaternion.ts**

Create `src/math/quaternion.ts`:

```typescript
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/math/quaternion.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/math/quaternion.ts src/math/quaternion.test.ts
git commit -m "feat: add quaternion math library"
```

---

### Task 3: Sensor Collector

**Files:**
- Create: `src/sensors/collector.ts`
- Create: `src/sensors/collector.test.ts`

**Interfaces:**
- Consumes: `SensorSample` from `src/types.ts`
- Produces: `SensorCollector` class with methods `start(): Promise<void>`, `stop(): void`, `onSample(callback: (sample: SensorSample) => void): void`, `isSupported(): boolean`

- [ ] **Step 1: Write failing tests**

Create `src/sensors/collector.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SensorCollector } from "./collector.js";
import type { SensorSample } from "../types.js";

function mockDeviceMotionEvent(overrides: Partial<DeviceMotionEventInit> = {}) {
  return new DeviceMotionEvent("devicemotion", {
    acceleration: { x: 1, y: 2, z: 3 },
    accelerationIncludingGravity: { x: 1, y: 2, z: -6.81 },
    rotationRate: { alpha: 0.1, beta: 0.2, gamma: 0.3 },
    interval: 16,
    ...overrides,
  });
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

    window.dispatchEvent(mockDeviceMotionEvent());

    expect(samples).toHaveLength(1);
    const s = samples[0]!;
    expect(s.acceleration.x).toBe(1);
    expect(s.acceleration.y).toBe(2);
    expect(s.acceleration.z).toBe(3);
    expect(s.rotationRate.x).toBeCloseTo(0.1);
    expect(s.rotationRate.y).toBeCloseTo(0.2);
    expect(s.rotationRate.z).toBeCloseTo(0.3);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/sensors/collector.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement collector.ts**

Create `src/sensors/collector.ts`:

```typescript
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
            x: e.rotationRate.alpha ?? 0,
            y: e.rotationRate.beta ?? 0,
            z: e.rotationRate.gamma ?? 0,
          }
        : ZERO_VEC3,
    };

    for (const cb of this.callbacks) {
      cb(sample);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/sensors/collector.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sensors/collector.ts src/sensors/collector.test.ts
git commit -m "feat: add sensor collector with DeviceMotion support"
```

---

### Task 4: Sensor Fusion Engine

**Files:**
- Create: `src/fusion/engine.ts`
- Create: `src/fusion/engine.test.ts`

**Interfaces:**
- Consumes: `SensorSample`, `FusedSample`, `Vec3`, `Quaternion` from `src/types.ts`; quaternion functions from `src/math/quaternion.ts`
- Produces: `FusionEngine` class with methods `process(sample: SensorSample): FusedSample`, `reset(): void`, `applyZUPT(): void`

- [ ] **Step 1: Write failing tests**

Create `src/fusion/engine.test.ts`:

```typescript
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
    engine.process(makeSample(100, accelUp, gravUp));
    engine.applyZUPT();
    const fused = engine.process(makeSample(200));
    expect(fused.velocity.x).toBeCloseTo(0, 2);
    expect(fused.velocity.y).toBeCloseTo(0, 2);
    expect(fused.velocity.z).toBeCloseTo(0, 2);
  });

  it("handles phone mounted sideways via gravity orientation", () => {
    const sidewaysGravity: Vec3 = { x: -9.81, y: 0, z: 0 };
    engine.process(makeSample(0, { x: 0, y: 0, z: 0 }, sidewaysGravity));

    const deviceAccel: Vec3 = { x: 2, y: 0, z: 0 };
    const deviceGrav: Vec3 = { x: 2 - 9.81, y: 0, z: 0 };
    const fused = engine.process(makeSample(100, deviceAccel, deviceGrav));

    expect(Math.abs(fused.velocity.z)).toBeGreaterThan(0.05);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/fusion/engine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement engine.ts**

Create `src/fusion/engine.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/fusion/engine.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/fusion/engine.ts src/fusion/engine.test.ts
git commit -m "feat: add sensor fusion engine with complementary filter"
```

---

### Task 5: Rep Detector

**Files:**
- Create: `src/detector/rep-detector.ts`
- Create: `src/detector/rep-detector.test.ts`

**Interfaces:**
- Consumes: `FusedSample`, `DetectedRep`, `PhaseBoundary`, `RepPhase`, `PhaseOrder` from `src/types.ts`
- Produces: `RepDetector` class with methods `constructor(phaseOrder: PhaseOrder)`, `processSample(sample: FusedSample): DetectedRep | null`, `getCurrentPhase(): RepPhase`, `reset(): void`, `isStill(): boolean`

- [ ] **Step 1: Write failing tests**

Create `src/detector/rep-detector.test.ts`:

```typescript
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
    // Simulate: still → down → up → still
    const profile: Array<[number, number]> = [
      [0, 0],
      [100, 0],
      [200, -0.3],   // eccentric starts
      [300, -0.5],
      [400, -0.3],
      [500, 0],       // turnaround
      [600, 0.4],     // concentric starts
      [700, 0.6],
      [800, 0.3],
      [900, 0.05],
      [1000, 0],      // pause
      [1300, 0],      // still for 300ms
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
      [200, 0.3],     // concentric starts
      [300, 0.5],
      [400, 0.3],
      [500, 0],        // turnaround
      [600, -0.4],     // eccentric
      [700, -0.3],
      [800, -0.05],
      [900, 0],        // pause
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/detector/rep-detector.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement rep-detector.ts**

Create `src/detector/rep-detector.ts`:

```typescript
import type {
  FusedSample,
  DetectedRep,
  PhaseBoundary,
  RepPhase,
  PhaseOrder,
} from "../types.js";

const VELOCITY_THRESHOLD = 0.05;
const STILL_DURATION_MS = 200;
const MIN_MOVEMENT_DURATION_MS = 50;

export class RepDetector {
  private phase: RepPhase = "idle";
  private phaseOrder: PhaseOrder;
  private repCount = 0;
  private phases: PhaseBoundary[] = [];
  private currentPhaseStart = 0;
  private lastMovementTime = 0;
  private lastVelocityZ = 0;
  private repStartTime = 0;
  private stillSince: number | null = null;
  private hasFirstPhase = false;
  private hasSecondPhase = false;

  constructor(phaseOrder: PhaseOrder) {
    this.phaseOrder = phaseOrder;
  }

  processSample(sample: FusedSample): DetectedRep | null {
    const vz = sample.velocity.z;
    const t = sample.timestamp;
    const absVz = Math.abs(vz);

    if (absVz < VELOCITY_THRESHOLD) {
      if (this.stillSince === null) this.stillSince = t;
    } else {
      this.stillSince = null;
      this.lastMovementTime = t;
    }

    let completedRep: DetectedRep | null = null;

    switch (this.phase) {
      case "idle":
        completedRep = this.handleIdle(vz, t);
        break;
      case "eccentric":
        completedRep = this.handleEccentric(vz, t);
        break;
      case "concentric":
        completedRep = this.handleConcentric(vz, t);
        break;
      case "pause":
        completedRep = this.handlePause(vz, t);
        break;
    }

    this.lastVelocityZ = vz;
    return completedRep;
  }

  getCurrentPhase(): RepPhase {
    return this.phase;
  }

  isStill(): boolean {
    return Math.abs(this.lastVelocityZ) < VELOCITY_THRESHOLD;
  }

  reset(): void {
    this.phase = "idle";
    this.repCount = 0;
    this.phases = [];
    this.currentPhaseStart = 0;
    this.lastMovementTime = 0;
    this.lastVelocityZ = 0;
    this.repStartTime = 0;
    this.stillSince = null;
    this.hasFirstPhase = false;
    this.hasSecondPhase = false;
  }

  private firstPhase(): RepPhase {
    return this.phaseOrder === "eccentric-first" ? "eccentric" : "concentric";
  }

  private secondPhase(): RepPhase {
    return this.phaseOrder === "eccentric-first" ? "concentric" : "eccentric";
  }

  private isFirstPhaseVelocity(vz: number): boolean {
    if (this.phaseOrder === "eccentric-first") return vz < -VELOCITY_THRESHOLD;
    return vz > VELOCITY_THRESHOLD;
  }

  private isSecondPhaseVelocity(vz: number): boolean {
    if (this.phaseOrder === "eccentric-first") return vz > VELOCITY_THRESHOLD;
    return vz < -VELOCITY_THRESHOLD;
  }

  private handleIdle(vz: number, t: number): null {
    if (this.isFirstPhaseVelocity(vz)) {
      this.phase = this.firstPhase();
      this.currentPhaseStart = t;
      this.repStartTime = t;
      this.hasFirstPhase = true;
      this.hasSecondPhase = false;
    }
    return null;
  }

  private handleEccentric(vz: number, t: number): DetectedRep | null {
    if (this.isSecondPhaseVelocity(vz) && this.phase === this.firstPhase()) {
      this.endCurrentPhase(t);
      this.phase = this.secondPhase();
      this.currentPhaseStart = t;
      this.hasSecondPhase = true;
      return null;
    }
    if (this.isFirstPhaseVelocity(vz) && this.phase === this.secondPhase()) {
      return this.completeRep(t);
    }
    if (this.isStillLongEnough(t) && this.hasFirstPhase && this.hasSecondPhase) {
      return this.completeRep(t);
    }
    return null;
  }

  private handleConcentric(vz: number, t: number): DetectedRep | null {
    return this.handleEccentric(vz, t);
  }

  private handlePause(vz: number, t: number): DetectedRep | null {
    if (this.isFirstPhaseVelocity(vz)) {
      this.phase = this.firstPhase();
      this.currentPhaseStart = t;
      this.repStartTime = t;
      this.hasFirstPhase = true;
      this.hasSecondPhase = false;
    }
    return null;
  }

  private isStillLongEnough(t: number): boolean {
    return this.stillSince !== null && t - this.stillSince >= STILL_DURATION_MS;
  }

  private endCurrentPhase(t: number): void {
    this.phases.push({
      phase: this.phase,
      startTime: this.currentPhaseStart,
      endTime: t,
    });
  }

  private completeRep(t: number): DetectedRep {
    this.endCurrentPhase(t);
    this.repCount++;

    const eccPhases = this.phases.filter((p) => p.phase === "eccentric");
    const conPhases = this.phases.filter((p) => p.phase === "concentric");
    const eccDuration = eccPhases.reduce(
      (sum, p) => sum + (p.endTime - p.startTime),
      0,
    );
    const conDuration = conPhases.reduce(
      (sum, p) => sum + (p.endTime - p.startTime),
      0,
    );
    const pauseDuration = this.phases.reduce((sum, p, i) => {
      if (i === 0) return 0;
      return sum + (p.startTime - this.phases[i - 1]!.endTime);
    }, 0);

    const rep: DetectedRep = {
      repNumber: this.repCount,
      startTime: this.repStartTime,
      endTime: t,
      phases: [...this.phases],
      concentricDuration: conDuration,
      eccentricDuration: eccDuration,
      pauseDuration,
    };

    this.phases = [];
    this.phase = "pause";
    this.currentPhaseStart = t;
    this.hasFirstPhase = false;
    this.hasSecondPhase = false;

    return rep;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/detector/rep-detector.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/detector/rep-detector.ts src/detector/rep-detector.test.ts
git commit -m "feat: add rep detector with phase state machine"
```

---

### Task 6: Movement Analyzer

**Files:**
- Create: `src/analyzer/movement-analyzer.ts`
- Create: `src/analyzer/reference-paths.ts`
- Create: `src/analyzer/movement-analyzer.test.ts`

**Interfaces:**
- Consumes: `FusedSample`, `DetectedRep`, `RepAnalysis`, `SetAnalysis` from `src/types.ts`
- Produces: `analyzeRep(rep: DetectedRep, samples: FusedSample[]): RepAnalysis`, `analyzeSet(reps: RepAnalysis[]): SetAnalysis`, `getReferencePath(exerciseId: string): Array<{x: number, y: number}> | null`

- [ ] **Step 1: Write failing tests**

Create `src/analyzer/movement-analyzer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { analyzeRep, analyzeSet } from "./movement-analyzer.js";
import { getReferencePath } from "./reference-paths.js";
import type { FusedSample, DetectedRep, Quaternion } from "../types.js";

const ID_Q: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

function makeFusedSamples(
  startTime: number,
  count: number,
  intervalMs: number,
  velocities: number[],
): FusedSample[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: startTime + i * intervalMs,
    worldAcceleration: { x: 0, y: 0, z: 0 },
    velocity: { x: 0.01 * i, y: 0, z: velocities[i] ?? 0 },
    position: { x: 0.001 * i, y: 0, z: 0.01 * i },
    orientation: ID_Q,
    tilt: { roll: 0.02 * i, pitch: 0 },
  }));
}

describe("analyzeRep", () => {
  it("calculates mean and peak concentric velocity", () => {
    const rep: DetectedRep = {
      repNumber: 1,
      startTime: 0,
      endTime: 600,
      phases: [
        { phase: "eccentric", startTime: 0, endTime: 300 },
        { phase: "concentric", startTime: 300, endTime: 600 },
      ],
      concentricDuration: 300,
      eccentricDuration: 300,
      pauseDuration: 0,
    };
    const velocities = [
      -0.2, -0.4, -0.3, // eccentric (indices 0-2)
      0.3, 0.5, 0.4,    // concentric (indices 3-5)
    ];
    const samples = makeFusedSamples(0, 6, 100, velocities);
    const result = analyzeRep(rep, samples);

    expect(result.meanConcentricVelocity).toBeCloseTo(0.4, 1);
    expect(result.peakConcentricVelocity).toBeCloseTo(0.5, 1);
    expect(result.repNumber).toBe(1);
  });

  it("calculates bar path from position data", () => {
    const rep: DetectedRep = {
      repNumber: 1,
      startTime: 0,
      endTime: 300,
      phases: [{ phase: "concentric", startTime: 0, endTime: 300 }],
      concentricDuration: 300,
      eccentricDuration: 0,
      pauseDuration: 0,
    };
    const samples = makeFusedSamples(0, 4, 100, [0.3, 0.4, 0.5, 0.3]);
    const result = analyzeRep(rep, samples);

    expect(result.barPath.length).toBeGreaterThan(0);
  });

  it("computes stability score from tilt variance", () => {
    const rep: DetectedRep = {
      repNumber: 1,
      startTime: 0,
      endTime: 300,
      phases: [{ phase: "concentric", startTime: 0, endTime: 300 }],
      concentricDuration: 300,
      eccentricDuration: 0,
      pauseDuration: 0,
    };
    const samples = makeFusedSamples(0, 4, 100, [0.3, 0.4, 0.5, 0.3]);
    const result = analyzeRep(rep, samples);

    expect(result.stabilityScore).toBeGreaterThanOrEqual(0);
    expect(result.stabilityScore).toBeLessThanOrEqual(100);
  });
});

describe("analyzeSet", () => {
  it("calculates velocity loss between fastest and last rep", () => {
    const reps = [
      { repNumber: 1, meanConcentricVelocity: 0.5, peakConcentricVelocity: 0.6, concentricDuration: 300, eccentricDuration: 300, barPath: [], maxTilt: 0, stabilityScore: 90, trajectoryDeviation: 0 },
      { repNumber: 2, meanConcentricVelocity: 0.45, peakConcentricVelocity: 0.55, concentricDuration: 320, eccentricDuration: 300, barPath: [], maxTilt: 1, stabilityScore: 88, trajectoryDeviation: 0 },
      { repNumber: 3, meanConcentricVelocity: 0.4, peakConcentricVelocity: 0.5, concentricDuration: 350, eccentricDuration: 310, barPath: [], maxTilt: 2, stabilityScore: 85, trajectoryDeviation: 0 },
    ];
    const result = analyzeSet(reps);
    expect(result.velocityLoss).toBeCloseTo(20, 0);
  });

  it("classifies VBT zone from mean velocity", () => {
    const reps = [
      { repNumber: 1, meanConcentricVelocity: 0.3, peakConcentricVelocity: 0.4, concentricDuration: 300, eccentricDuration: 300, barPath: [], maxTilt: 0, stabilityScore: 90, trajectoryDeviation: 0 },
    ];
    const result = analyzeSet(reps);
    expect(result.vbtZone).toBe("maximal-strength");
  });

  it("estimates RIR from velocity loss", () => {
    const reps = [
      { repNumber: 1, meanConcentricVelocity: 0.5, peakConcentricVelocity: 0.6, concentricDuration: 300, eccentricDuration: 300, barPath: [], maxTilt: 0, stabilityScore: 90, trajectoryDeviation: 0 },
      { repNumber: 2, meanConcentricVelocity: 0.25, peakConcentricVelocity: 0.3, concentricDuration: 500, eccentricDuration: 400, barPath: [], maxTilt: 5, stabilityScore: 60, trajectoryDeviation: 10 },
    ];
    const result = analyzeSet(reps);
    expect(result.estimatedRIR).toBeLessThanOrEqual(2);
  });
});

describe("getReferencePath", () => {
  it("returns a path for squat", () => {
    const path = getReferencePath("squat");
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(1);
  });

  it("returns null for unknown exercises", () => {
    expect(getReferencePath("unknown-exercise-xyz")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/analyzer/movement-analyzer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement reference-paths.ts**

Create `src/analyzer/reference-paths.ts`:

```typescript
type Point2D = { x: number; y: number };

const PATHS: Record<string, Point2D[]> = {
  squat: [
    { x: 0, y: 0 },
    { x: 0, y: -0.5 },
    { x: 0, y: -1 },
  ],
  bench_press: [
    { x: 0, y: 0 },
    { x: -0.05, y: -0.3 },
    { x: -0.08, y: -0.5 },
    { x: -0.03, y: -0.8 },
    { x: 0.02, y: -1 },
  ],
  deadlift: [
    { x: 0, y: 0 },
    { x: -0.03, y: 0.3 },
    { x: 0, y: 0.6 },
    { x: 0.02, y: 1 },
  ],
  overhead_press: [
    { x: 0.02, y: 0 },
    { x: 0.01, y: 0.3 },
    { x: 0, y: 0.7 },
    { x: 0, y: 1 },
  ],
};

export function getReferencePath(exerciseKey: string): Point2D[] | null {
  return PATHS[exerciseKey] ?? null;
}
```

- [ ] **Step 4: Implement movement-analyzer.ts**

Create `src/analyzer/movement-analyzer.ts`:

```typescript
import type { FusedSample, DetectedRep, RepAnalysis, SetAnalysis } from "../types.js";
import { getReferencePath } from "./reference-paths.js";

export function analyzeRep(rep: DetectedRep, samples: FusedSample[]): RepAnalysis {
  const repSamples = samples.filter(
    (s) => s.timestamp >= rep.startTime && s.timestamp <= rep.endTime,
  );

  const concentricPhase = rep.phases.find((p) => p.phase === "concentric");
  const concentricSamples = concentricPhase
    ? repSamples.filter(
        (s) =>
          s.timestamp >= concentricPhase.startTime &&
          s.timestamp <= concentricPhase.endTime,
      )
    : [];

  const concentricVelocities = concentricSamples.map((s) =>
    Math.abs(s.velocity.z),
  );
  const meanConcentricVelocity =
    concentricVelocities.length > 0
      ? concentricVelocities.reduce((a, b) => a + b, 0) /
        concentricVelocities.length
      : 0;
  const peakConcentricVelocity =
    concentricVelocities.length > 0 ? Math.max(...concentricVelocities) : 0;

  const barPath = repSamples.map((s) => ({ x: s.position.x, y: s.position.z }));

  const tilts = repSamples.map((s) => Math.abs(s.tilt.roll));
  const maxTilt =
    tilts.length > 0
      ? (Math.max(...tilts) * 180) / Math.PI
      : 0;

  const stabilityScore = computeStabilityScore(repSamples);

  return {
    repNumber: rep.repNumber,
    meanConcentricVelocity,
    peakConcentricVelocity,
    concentricDuration: rep.concentricDuration,
    eccentricDuration: rep.eccentricDuration,
    barPath,
    maxTilt,
    stabilityScore,
    trajectoryDeviation: 0,
  };
}

export function analyzeSet(reps: RepAnalysis[]): SetAnalysis {
  if (reps.length === 0) {
    return { reps, velocityLoss: 0, estimatedRIR: 0, vbtZone: "unknown", repConsistency: 0 };
  }

  const velocities = reps.map((r) => r.meanConcentricVelocity);
  const fastest = Math.max(...velocities);
  const last = velocities[velocities.length - 1]!;
  const velocityLoss = fastest > 0 ? ((fastest - last) / fastest) * 100 : 0;

  const avgVelocity =
    velocities.reduce((a, b) => a + b, 0) / velocities.length;

  const vbtZone = classifyZone(avgVelocity);
  const estimatedRIR = estimateRIR(velocityLoss);

  const mean = avgVelocity;
  const variance =
    velocities.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
    velocities.length;
  const repConsistency = Math.sqrt(variance);

  return { reps, velocityLoss, estimatedRIR, vbtZone, repConsistency };
}

function classifyZone(mcv: number): string {
  if (mcv < 0.35) return "maximal-strength";
  if (mcv < 0.5) return "accelerative-strength";
  if (mcv < 0.75) return "strength-speed";
  if (mcv < 1.0) return "power";
  return "speed-strength";
}

function estimateRIR(velocityLossPercent: number): number {
  if (velocityLossPercent < 10) return 5;
  if (velocityLossPercent < 20) return 3;
  if (velocityLossPercent < 30) return 2;
  if (velocityLossPercent < 40) return 1;
  return 0;
}

function computeStabilityScore(samples: FusedSample[]): number {
  if (samples.length < 2) return 100;
  const accMagnitudes = samples.map((s) => {
    const a = s.worldAcceleration;
    return Math.sqrt(a.x * a.x + a.y * a.y);
  });
  const mean = accMagnitudes.reduce((a, b) => a + b, 0) / accMagnitudes.length;
  const variance =
    accMagnitudes.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
    accMagnitudes.length;
  const shakeMagnitude = Math.sqrt(variance);

  const score = Math.max(0, Math.min(100, 100 - shakeMagnitude * 200));
  return Math.round(score);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/analyzer/movement-analyzer.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/analyzer/movement-analyzer.ts src/analyzer/reference-paths.ts src/analyzer/movement-analyzer.test.ts
git commit -m "feat: add movement analyzer with VBT zones and quality metrics"
```

---

### Task 7: Storage Layer

**Files:**
- Create: `src/storage/db.ts`
- Create: `src/storage/db.test.ts`

**Interfaces:**
- Consumes: `Session`, `WorkoutSet` from `src/types.ts`
- Produces: `openDB(): Promise<IDBDatabase>`, `saveSession(session: Session): Promise<void>`, `getSessions(): Promise<Session[]>`, `saveSet(set: WorkoutSet): Promise<void>`, `getSetsForSession(sessionId: string): Promise<WorkoutSet[]>`, `deleteSession(sessionId: string): Promise<void>`

- [ ] **Step 1: Install fake-indexeddb for testing**

```bash
npm install -D fake-indexeddb
```

- [ ] **Step 2: Write failing tests**

Create `src/storage/db.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  openDB,
  saveSession,
  getSessions,
  saveSet,
  getSetsForSession,
  deleteSession,
} from "./db.js";
import type { Session, WorkoutSet } from "../types.js";

beforeEach(() => {
  indexedDB = new IDBFactory();
});

describe("Storage", () => {
  it("saves and retrieves a session", async () => {
    await openDB();
    const session: Session = { id: "s1", date: Date.now() };
    await saveSession(session);
    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe("s1");
  });

  it("saves and retrieves sets for a session", async () => {
    await openDB();
    const set: WorkoutSet = {
      id: "set1",
      sessionId: "s1",
      exerciseId: "0154",
      exerciseName: "Barbell Squat",
      weight: 100,
      timestamp: Date.now(),
      reps: [],
      velocityLoss: 15,
      estimatedRIR: 3,
      vbtZone: "strength-speed",
    };
    await saveSet(set);
    const sets = await getSetsForSession("s1");
    expect(sets).toHaveLength(1);
    expect(sets[0]!.exerciseName).toBe("Barbell Squat");
  });

  it("returns empty array for session with no sets", async () => {
    await openDB();
    const sets = await getSetsForSession("nonexistent");
    expect(sets).toHaveLength(0);
  });

  it("deletes a session and its sets", async () => {
    await openDB();
    const session: Session = { id: "s1", date: Date.now() };
    await saveSession(session);
    const set: WorkoutSet = {
      id: "set1",
      sessionId: "s1",
      exerciseId: "0001",
      exerciseName: "Test",
      timestamp: Date.now(),
      reps: [],
      velocityLoss: 0,
      estimatedRIR: 5,
      vbtZone: "power",
    };
    await saveSet(set);

    await deleteSession("s1");
    const sessions = await getSessions();
    expect(sessions).toHaveLength(0);
    const sets = await getSetsForSession("s1");
    expect(sets).toHaveLength(0);
  });

  it("retrieves sessions sorted by date descending", async () => {
    await openDB();
    await saveSession({ id: "s1", date: 1000 });
    await saveSession({ id: "s2", date: 3000 });
    await saveSession({ id: "s3", date: 2000 });

    const sessions = await getSessions();
    expect(sessions[0]!.id).toBe("s2");
    expect(sessions[1]!.id).toBe("s3");
    expect(sessions[2]!.id).toBe("s1");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/storage/db.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement db.ts**

Create `src/storage/db.ts`:

```typescript
import type { Session, WorkoutSet } from "../types.js";

const DB_NAME = "vbt";
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

export async function openDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("sessions")) {
        database.createObjectStore("sessions", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("sets")) {
        const store = database.createObjectStore("sets", { keyPath: "id" });
        store.createIndex("sessionId", "sessionId", { unique: false });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveSession(session: Session): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("sessions", "readwrite");
    tx.objectStore("sessions").put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSessions(): Promise<Session[]> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("sessions", "readonly");
    const request = tx.objectStore("sessions").getAll();
    request.onsuccess = () => {
      const sessions = request.result as Session[];
      sessions.sort((a, b) => b.date - a.date);
      resolve(sessions);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveSet(set: WorkoutSet): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("sets", "readwrite");
    tx.objectStore("sets").put(set);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSetsForSession(
  sessionId: string,
): Promise<WorkoutSet[]> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("sets", "readonly");
    const index = tx.objectStore("sets").index("sessionId");
    const request = index.getAll(sessionId);
    request.onsuccess = () => resolve(request.result as WorkoutSet[]);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const database = await openDB();
  const sets = await getSetsForSession(sessionId);

  return new Promise((resolve, reject) => {
    const tx = database.transaction(["sessions", "sets"], "readwrite");
    tx.objectStore("sessions").delete(sessionId);
    const setStore = tx.objectStore("sets");
    for (const set of sets) {
      setStore.delete(set.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/storage/db.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/storage/db.ts src/storage/db.test.ts
git commit -m "feat: add IndexedDB storage layer for sessions and sets"
```

---

### Task 8: Exercise Data Module

**Files:**
- Create: `src/exercises/exercises.ts`
- Create: `src/exercises/exercises.test.ts`
- Create: `scripts/fetch-exercises.ts`

**Interfaces:**
- Consumes: `Exercise` from `src/types.ts`
- Produces: `searchExercises(query: string): Exercise[]`, `filterByEquipment(equipment: string, exercises: Exercise[]): Exercise[]`, `filterByBodyPart(bodyPart: string, exercises: Exercise[]): Exercise[]`, `getExerciseById(id: string): Exercise | undefined`, `getAllEquipmentTypes(): string[]`, `getAllBodyParts(): string[]`

- [ ] **Step 1: Fetch and trim exercise dataset**

Create `scripts/fetch-exercises.ts`:

```typescript
const DATASET_URL =
  "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/92e2704314221d0ba6e978755b370870e6a3fc21/data/exercises.json";

interface RawExercise {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  target: string;
  muscle_group: string;
  secondary_muscles: string[];
  instructions: { en: string };
  image: string;
  gif_url: string;
}

async function main() {
  const resp = await fetch(DATASET_URL);
  const raw: RawExercise[] = await resp.json();

  const trimmed = raw.map((e) => ({
    id: e.id,
    name: e.name,
    bodyPart: e.body_part,
    equipment: e.equipment,
    target: e.target,
    muscleGroup: e.muscle_group,
    secondaryMuscles: e.secondary_muscles,
  }));

  const json = JSON.stringify(trimmed);
  await Bun?.write?.("src/exercises/data.json", json) ??
    process.stdout.write(json);
}

main();
```

Run:

```bash
mkdir -p src/exercises
npx tsx scripts/fetch-exercises.ts > src/exercises/data.json
```

Install tsx if needed: `npm install -D tsx`

- [ ] **Step 2: Write failing tests**

Create `src/exercises/exercises.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  searchExercises,
  filterByEquipment,
  filterByBodyPart,
  getExerciseById,
  getAllEquipmentTypes,
  getAllBodyParts,
} from "./exercises.js";

describe("Exercise Data", () => {
  it("loads exercises from bundled data", () => {
    const results = searchExercises("");
    expect(results.length).toBeGreaterThan(100);
  });

  it("searches by name substring case-insensitive", () => {
    const results = searchExercises("squat");
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((e) => e.name.toLowerCase().includes("squat")),
    ).toBe(true);
  });

  it("filters by equipment type", () => {
    const all = searchExercises("");
    const barbellOnly = filterByEquipment("barbell", all);
    expect(barbellOnly.length).toBeGreaterThan(0);
    expect(barbellOnly.length).toBeLessThan(all.length);
    expect(
      barbellOnly.every((e) => e.equipment.toLowerCase() === "barbell"),
    ).toBe(true);
  });

  it("filters by body part", () => {
    const all = searchExercises("");
    const chest = filterByBodyPart("chest", all);
    expect(chest.length).toBeGreaterThan(0);
    expect(
      chest.every((e) => e.bodyPart.toLowerCase() === "chest"),
    ).toBe(true);
  });

  it("returns exercise by ID", () => {
    const ex = getExerciseById("0001");
    expect(ex).toBeDefined();
    expect(ex!.id).toBe("0001");
  });

  it("returns undefined for unknown ID", () => {
    expect(getExerciseById("9999999")).toBeUndefined();
  });

  it("lists all unique equipment types", () => {
    const types = getAllEquipmentTypes();
    expect(types.length).toBeGreaterThan(5);
    expect(types).toContain("barbell");
  });

  it("lists all unique body parts", () => {
    const parts = getAllBodyParts();
    expect(parts.length).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/exercises/exercises.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement exercises.ts**

Create `src/exercises/exercises.ts`:

```typescript
import rawData from "./data.json";

export interface ExerciseEntry {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  muscleGroup: string;
  secondaryMuscles: string[];
}

const exercises: ExerciseEntry[] = rawData as ExerciseEntry[];

export function searchExercises(query: string): ExerciseEntry[] {
  if (!query) return [...exercises];
  const lower = query.toLowerCase();
  return exercises.filter((e) => e.name.toLowerCase().includes(lower));
}

export function filterByEquipment(
  equipment: string,
  list: ExerciseEntry[],
): ExerciseEntry[] {
  const lower = equipment.toLowerCase();
  return list.filter((e) => e.equipment.toLowerCase() === lower);
}

export function filterByBodyPart(
  bodyPart: string,
  list: ExerciseEntry[],
): ExerciseEntry[] {
  const lower = bodyPart.toLowerCase();
  return list.filter((e) => e.bodyPart.toLowerCase() === lower);
}

export function getExerciseById(id: string): ExerciseEntry | undefined {
  return exercises.find((e) => e.id === id);
}

export function getAllEquipmentTypes(): string[] {
  const set = new Set(exercises.map((e) => e.equipment.toLowerCase()));
  return [...set].sort();
}

export function getAllBodyParts(): string[] {
  const set = new Set(exercises.map((e) => e.bodyPart.toLowerCase()));
  return [...set].sort();
}
```

Add to `tsconfig.json` compilerOptions: `"resolveJsonModule": true`

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/exercises/exercises.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-exercises.ts src/exercises/data.json src/exercises/exercises.ts src/exercises/exercises.test.ts tsconfig.json
git commit -m "feat: add exercise dataset with search and filtering"
```

---

### Task 9: Recording Pipeline (integration)

**Files:**
- Create: `src/pipeline/recorder.ts`
- Create: `src/pipeline/recorder.test.ts`

**Interfaces:**
- Consumes: `SensorCollector` from `src/sensors/collector.ts`, `FusionEngine` from `src/fusion/engine.ts`, `RepDetector` from `src/detector/rep-detector.ts`, `analyzeRep`/`analyzeSet` from `src/analyzer/movement-analyzer.ts`, `SensorSample`, `FusedSample`, `DetectedRep`, `RepAnalysis`, `SetAnalysis`, `PhaseOrder` from `src/types.ts`
- Produces: `Recorder` class with methods `start(phaseOrder: PhaseOrder): void`, `stop(): SetAnalysis`, `onRepDetected(callback: (rep: RepAnalysis) => void): void`, `getRepCount(): number`, `isRecording(): boolean`, `getIdleDurationMs(): number`

- [ ] **Step 1: Write failing tests**

Create `src/pipeline/recorder.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pipeline/recorder.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement recorder.ts**

Create `src/pipeline/recorder.ts`:

```typescript
import type {
  SensorSample,
  FusedSample,
  DetectedRep,
  RepAnalysis,
  SetAnalysis,
  PhaseOrder,
} from "../types.js";
import { FusionEngine } from "../fusion/engine.js";
import { RepDetector } from "../detector/rep-detector.js";
import { analyzeRep, analyzeSet } from "../analyzer/movement-analyzer.js";

const AUTO_STOP_IDLE_MS = 5000;

export class Recorder {
  private fusion = new FusionEngine();
  private detector: RepDetector | null = null;
  private recording = false;
  private samples: FusedSample[] = [];
  private detectedReps: DetectedRep[] = [];
  private analyzedReps: RepAnalysis[] = [];
  private repCallbacks: Array<(rep: RepAnalysis) => void> = [];
  private lastMovementTime = 0;
  private startTime = 0;

  start(phaseOrder: PhaseOrder): void {
    this.fusion.reset();
    this.detector = new RepDetector(phaseOrder);
    this.samples = [];
    this.detectedReps = [];
    this.analyzedReps = [];
    this.recording = true;
    this.lastMovementTime = 0;
    this.startTime = 0;
  }

  stop(): SetAnalysis {
    this.recording = false;
    return analyzeSet(this.analyzedReps);
  }

  ingestSample(sample: SensorSample): void {
    if (!this.recording || !this.detector) return;

    if (this.startTime === 0) this.startTime = sample.timestamp;

    const fused = this.fusion.process(sample);
    this.samples.push(fused);

    if (!this.detector.isStill()) {
      this.lastMovementTime = sample.timestamp;
    }

    const rep = this.detector.processSample(fused);
    if (rep) {
      this.detectedReps.push(rep);
      this.fusion.applyZUPT();
      const analysis = analyzeRep(rep, this.samples);
      this.analyzedReps.push(analysis);
      for (const cb of this.repCallbacks) {
        cb(analysis);
      }
    }
  }

  onRepDetected(callback: (rep: RepAnalysis) => void): void {
    this.repCallbacks.push(callback);
  }

  getRepCount(): number {
    return this.analyzedReps.length;
  }

  isRecording(): boolean {
    return this.recording;
  }

  getIdleDurationMs(): number {
    if (!this.recording || this.samples.length === 0) return 0;
    const latest = this.samples[this.samples.length - 1]!.timestamp;
    if (this.lastMovementTime === 0) return latest - this.startTime;
    return latest - this.lastMovementTime;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pipeline/recorder.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/recorder.ts src/pipeline/recorder.test.ts
git commit -m "feat: add recording pipeline integrating sensor→fusion→detector→analyzer"
```

---

### Task 10: UI — App Shell, Router, and Home View

**Files:**
- Create: `src/ui/router.ts`
- Create: `src/ui/views/home.ts`
- Create: `src/ui/styles.css`
- Modify: `src/main.ts`
- Modify: `index.html`

**Interfaces:**
- Consumes: `getSessions`, `deleteSession` from `src/storage/db.ts`, `getSetsForSession` from `src/storage/db.ts`
- Produces: `Router` class with `navigate(view: string, params?: Record<string,string>): void`, `onNavigate(callback): void`; `renderHome(container: HTMLElement): void`

- [ ] **Step 1: Create styles.css**

Create `src/ui/styles.css`:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #1a1a2e;
  --surface: #16213e;
  --primary: #0f3460;
  --accent: #e94560;
  --text: #eee;
  --text-muted: #888;
  --green: #4caf50;
  --yellow: #ff9800;
  --red: #f44336;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  min-height: 100dvh;
  -webkit-user-select: none;
  user-select: none;
}

#app {
  max-width: 480px;
  margin: 0 auto;
  padding: 16px;
  min-height: 100dvh;
}

button {
  background: var(--primary);
  color: var(--text);
  border: none;
  border-radius: 12px;
  padding: 14px 24px;
  font-size: 16px;
  cursor: pointer;
  width: 100%;
  touch-action: manipulation;
}

button:active { opacity: 0.8; }

.btn-accent {
  background: var(--accent);
  font-size: 20px;
  font-weight: 700;
  padding: 18px;
}

.btn-secondary {
  background: var(--surface);
  border: 1px solid var(--primary);
}

h1 { font-size: 24px; margin-bottom: 16px; }
h2 { font-size: 18px; margin-bottom: 12px; }

.card {
  background: var(--surface);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.session-list { list-style: none; }

.session-item {
  background: var(--surface);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 8px;
  cursor: pointer;
}

.session-item:active { opacity: 0.8; }

.text-muted { color: var(--text-muted); font-size: 14px; }

.mt-8 { margin-top: 8px; }
.mt-16 { margin-top: 16px; }
.gap-8 { display: flex; flex-direction: column; gap: 8px; }
```

- [ ] **Step 2: Create router.ts**

Create `src/ui/router.ts`:

```typescript
type RouteCallback = (params: Record<string, string>) => void;

export class Router {
  private routes = new Map<string, RouteCallback>();
  private current = "";

  on(view: string, callback: RouteCallback): void {
    this.routes.set(view, callback);
  }

  navigate(view: string, params: Record<string, string> = {}): void {
    this.current = view;
    const handler = this.routes.get(view);
    if (handler) handler(params);
  }

  getCurrent(): string {
    return this.current;
  }
}
```

- [ ] **Step 3: Create home view**

Create `src/ui/views/home.ts`:

```typescript
import { getSessions } from "../../storage/db.js";
import type { Router } from "../router.js";

export async function renderHome(
  container: HTMLElement,
  router: Router,
): Promise<void> {
  const sessions = await getSessions();

  container.innerHTML = `
    <h1>VBT</h1>
    <button class="btn-accent" id="start-session">Start Session</button>
    <div class="mt-16">
      <h2>History</h2>
      ${
        sessions.length === 0
          ? '<p class="text-muted">No sessions yet</p>'
          : `<ul class="session-list">${sessions
              .map(
                (s) => `
              <li class="session-item" data-id="${s.id}">
                <div>${new Date(s.date).toLocaleDateString()}</div>
                ${s.notes ? `<div class="text-muted">${s.notes}</div>` : ""}
              </li>`,
              )
              .join("")}</ul>`
      }
    </div>
  `;

  container
    .querySelector("#start-session")!
    .addEventListener("click", () => router.navigate("exercise-select"));

  container.querySelectorAll(".session-item").forEach((el) => {
    el.addEventListener("click", () => {
      const id = (el as HTMLElement).dataset.id!;
      router.navigate("session-detail", { sessionId: id });
    });
  });
}
```

- [ ] **Step 4: Update main.ts and index.html**

Update `src/main.ts`:

```typescript
import "./ui/styles.css";
import { Router } from "./ui/router.js";
import { renderHome } from "./ui/views/home.js";
import { openDB } from "./storage/db.js";

async function init() {
  await openDB();
  const app = document.querySelector<HTMLDivElement>("#app")!;
  const router = new Router();

  router.on("home", () => renderHome(app, router));
  router.on("exercise-select", () => {
    app.innerHTML = "<h1>Exercise Select</h1><p>Coming soon</p>";
  });

  router.navigate("home");
}

init();
```

Add to `index.html` `<head>`:

```html
<link rel="stylesheet" href="/src/ui/styles.css" />
```

Wait — Vite handles CSS imports via `src/main.ts`, so the `<link>` tag is not needed. The `import "./ui/styles.css"` in main.ts is sufficient.

- [ ] **Step 5: Verify dev server shows home view**

Run: `npx vite --host`
Expected: Home view shows "VBT" heading, "Start Session" button, "No sessions yet" message. Stop server after verifying.

- [ ] **Step 6: Commit**

```bash
git add src/ui/router.ts src/ui/views/home.ts src/ui/styles.css src/main.ts
git commit -m "feat: add app shell with router and home view"
```

---

### Task 11: UI — Exercise Selection View

**Files:**
- Create: `src/ui/views/exercise-select.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `searchExercises`, `filterByEquipment`, `filterByBodyPart`, `getAllEquipmentTypes`, `getAllBodyParts` from `src/exercises/exercises.ts`; `Router` from `src/ui/router.ts`
- Produces: `renderExerciseSelect(container: HTMLElement, router: Router): void`

- [ ] **Step 1: Implement exercise-select.ts**

Create `src/ui/views/exercise-select.ts`:

```typescript
import {
  searchExercises,
  filterByEquipment,
  filterByBodyPart,
  getAllEquipmentTypes,
  getAllBodyParts,
} from "../../exercises/exercises.js";
import type { ExerciseEntry } from "../../exercises/exercises.js";
import type { Router } from "../router.js";

export function renderExerciseSelect(
  container: HTMLElement,
  router: Router,
): void {
  const equipmentTypes = getAllEquipmentTypes();
  const bodyParts = getAllBodyParts();

  container.innerHTML = `
    <h1>Select Exercise</h1>
    <input type="search" id="ex-search" placeholder="Search exercises..."
      style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--primary);background:var(--surface);color:var(--text);font-size:16px;margin-bottom:8px;" />
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <select id="eq-filter" style="flex:1;padding:8px;border-radius:8px;background:var(--surface);color:var(--text);border:1px solid var(--primary);">
        <option value="">All Equipment</option>
        ${equipmentTypes.map((t) => `<option value="${t}">${t}</option>`).join("")}
      </select>
      <select id="bp-filter" style="flex:1;padding:8px;border-radius:8px;background:var(--surface);color:var(--text);border:1px solid var(--primary);">
        <option value="">All Body Parts</option>
        ${bodyParts.map((p) => `<option value="${p}">${p}</option>`).join("")}
      </select>
    </div>
    <div style="margin-bottom:12px;">
      <input type="number" id="weight-input" placeholder="Weight (kg)" min="0" step="0.5"
        style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--primary);background:var(--surface);color:var(--text);font-size:16px;" />
    </div>
    <ul id="ex-list" class="session-list" style="max-height:50vh;overflow-y:auto;"></ul>
    <button class="btn-secondary mt-8" id="back-btn">Back</button>
  `;

  const searchInput = container.querySelector<HTMLInputElement>("#ex-search")!;
  const eqFilter = container.querySelector<HTMLSelectElement>("#eq-filter")!;
  const bpFilter = container.querySelector<HTMLSelectElement>("#bp-filter")!;
  const list = container.querySelector<HTMLUListElement>("#ex-list")!;

  function render() {
    let results = searchExercises(searchInput.value);
    if (eqFilter.value) results = filterByEquipment(eqFilter.value, results);
    if (bpFilter.value) results = filterByBodyPart(bpFilter.value, results);

    const display = results.slice(0, 50);
    list.innerHTML = display
      .map(
        (e) => `
      <li class="session-item" data-id="${e.id}" data-name="${e.name}">
        <div>${e.name}</div>
        <div class="text-muted">${e.equipment} · ${e.bodyPart} · ${e.target}</div>
      </li>`,
      )
      .join("");

    list.querySelectorAll(".session-item").forEach((el) => {
      el.addEventListener("click", () => {
        const htmlEl = el as HTMLElement;
        const weightInput =
          container.querySelector<HTMLInputElement>("#weight-input")!;
        router.navigate("recording", {
          exerciseId: htmlEl.dataset.id!,
          exerciseName: htmlEl.dataset.name!,
          weight: weightInput.value,
        });
      });
    });
  }

  searchInput.addEventListener("input", render);
  eqFilter.addEventListener("change", render);
  bpFilter.addEventListener("change", render);
  container
    .querySelector("#back-btn")!
    .addEventListener("click", () => router.navigate("home"));

  render();
}
```

- [ ] **Step 2: Wire into main.ts router**

Update the `exercise-select` route in `src/main.ts`:

```typescript
import { renderExerciseSelect } from "./ui/views/exercise-select.js";

// In the init() function, replace the exercise-select route:
router.on("exercise-select", () => renderExerciseSelect(app, router));
```

- [ ] **Step 3: Verify in browser**

Run: `npx vite --host`
Expected: "Start Session" → shows searchable exercise list with equipment/body part filters and weight input. Clicking an exercise navigates forward. Stop server after verifying.

- [ ] **Step 4: Commit**

```bash
git add src/ui/views/exercise-select.ts src/main.ts
git commit -m "feat: add exercise selection view with search and filters"
```

---

### Task 12: UI — Recording View

**Files:**
- Create: `src/ui/views/recording.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `SensorCollector` from `src/sensors/collector.ts`, `Recorder` from `src/pipeline/recorder.ts`, `Router` from `src/ui/router.ts`, `PhaseOrder` from `src/types.ts`
- Produces: `renderRecording(container: HTMLElement, router: Router, params: Record<string,string>): void`

- [ ] **Step 1: Implement recording.ts**

Create `src/ui/views/recording.ts`:

```typescript
import { SensorCollector } from "../../sensors/collector.js";
import { Recorder } from "../../pipeline/recorder.js";
import type { Router } from "../router.js";
import type { PhaseOrder } from "../../types.js";

const COUNTDOWN_SECONDS = 5;
const AUTO_STOP_IDLE_MS = 5000;
const IDLE_CHECK_INTERVAL_MS = 500;

export function renderRecording(
  container: HTMLElement,
  router: Router,
  params: Record<string, string>,
): void {
  const exerciseId = params.exerciseId ?? "";
  const exerciseName = params.exerciseName ?? "Unknown";
  const weight = params.weight ? parseFloat(params.weight) : undefined;
  const phaseOrder: PhaseOrder =
    exerciseName.toLowerCase().includes("deadlift")
      ? "concentric-first"
      : "eccentric-first";

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;text-align:center;">
      <h2>${exerciseName}</h2>
      ${weight ? `<div class="text-muted">${weight} kg</div>` : ""}
      <div id="countdown" style="font-size:72px;font-weight:700;margin:32px 0;"></div>
      <div id="status" style="font-size:20px;margin-bottom:16px;"></div>
      <div id="rep-count" style="font-size:48px;font-weight:700;margin-bottom:32px;">0</div>
      <button class="btn-accent" id="stop-btn" style="display:none;">Stop</button>
    </div>
  `;

  const countdownEl = container.querySelector<HTMLElement>("#countdown")!;
  const statusEl = container.querySelector<HTMLElement>("#status")!;
  const repCountEl = container.querySelector<HTMLElement>("#rep-count")!;
  const stopBtn = container.querySelector<HTMLButtonElement>("#stop-btn")!;

  const collector = new SensorCollector();
  const recorder = new Recorder();
  let idleTimer: number | null = null;
  let wakeLock: WakeLockSentinel | null = null;

  async function acquireWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen");
      }
    } catch { /* non-critical */ }
  }

  function releaseWakeLock() {
    wakeLock?.release();
    wakeLock = null;
  }

  function startCountdown() {
    let remaining = COUNTDOWN_SECONDS;
    countdownEl.textContent = String(remaining);
    statusEl.textContent = "Mount phone on bar";

    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        countdownEl.textContent = "";
        startRecording();
      } else {
        countdownEl.textContent = String(remaining);
      }
    }, 1000);
  }

  async function startRecording() {
    statusEl.textContent = "Recording...";
    stopBtn.style.display = "block";
    await acquireWakeLock();

    recorder.start(phaseOrder);
    recorder.onRepDetected(() => {
      repCountEl.textContent = String(recorder.getRepCount());
    });

    collector.onSample((sample) => recorder.ingestSample(sample));
    await collector.start();

    idleTimer = window.setInterval(() => {
      if (recorder.getIdleDurationMs() > AUTO_STOP_IDLE_MS && recorder.getRepCount() > 0) {
        stopRecording();
      }
    }, IDLE_CHECK_INTERVAL_MS);
  }

  function stopRecording() {
    if (idleTimer !== null) clearInterval(idleTimer);
    collector.stop();
    const result = recorder.stop();
    releaseWakeLock();

    router.navigate("results", {
      exerciseId,
      exerciseName,
      weight: weight?.toString() ?? "",
      setAnalysis: JSON.stringify(result),
    });
  }

  stopBtn.addEventListener("click", stopRecording);
  startCountdown();
}
```

- [ ] **Step 2: Wire into main.ts**

Add to `src/main.ts`:

```typescript
import { renderRecording } from "./ui/views/recording.js";

// Add route:
router.on("recording", (params) => renderRecording(app, router, params));
```

- [ ] **Step 3: Verify in browser**

Run: `npx vite --host`
Expected: Exercise select → tap exercise → countdown from 5 → "Recording..." with rep counter and Stop button. Stop server after verifying.

- [ ] **Step 4: Commit**

```bash
git add src/ui/views/recording.ts src/main.ts
git commit -m "feat: add recording view with countdown and auto-stop"
```

---

### Task 13: UI — Post-Set Results View

**Files:**
- Create: `src/ui/views/results.ts`
- Create: `src/ui/components/velocity-chart.ts`
- Create: `src/ui/components/bar-path-chart.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `SetAnalysis`, `RepAnalysis`, `Session`, `WorkoutSet` from `src/types.ts`; `saveSession`, `saveSet` from `src/storage/db.ts`; `getReferencePath` from `src/analyzer/reference-paths.ts`; `Router` from `src/ui/router.ts`
- Produces: `renderResults(container: HTMLElement, router: Router, params: Record<string,string>): void`, `renderVelocityChart(container: HTMLElement, reps: RepAnalysis[]): void`, `renderBarPathChart(container: HTMLElement, reps: RepAnalysis[], exerciseKey: string | null): void`

- [ ] **Step 1: Implement velocity-chart.ts (SVG-based)**

Create `src/ui/components/velocity-chart.ts`:

```typescript
import type { RepAnalysis } from "../../types.js";

const ZONE_COLORS: Record<string, string> = {
  "maximal-strength": "#f44336",
  "accelerative-strength": "#ff9800",
  "strength-speed": "#ffeb3b",
  power: "#4caf50",
  "speed-strength": "#2196f3",
};

function zoneForVelocity(mcv: number): string {
  if (mcv < 0.35) return "maximal-strength";
  if (mcv < 0.5) return "accelerative-strength";
  if (mcv < 0.75) return "strength-speed";
  if (mcv < 1.0) return "power";
  return "speed-strength";
}

export function renderVelocityChart(
  container: HTMLElement,
  reps: RepAnalysis[],
): void {
  if (reps.length === 0) {
    container.innerHTML = '<p class="text-muted">No reps recorded</p>';
    return;
  }

  const maxV = Math.max(...reps.map((r) => r.meanConcentricVelocity), 0.1);
  const barHeight = 28;
  const gap = 6;
  const labelWidth = 36;
  const valueWidth = 60;
  const chartWidth = 300;
  const svgWidth = labelWidth + chartWidth + valueWidth;
  const svgHeight = reps.length * (barHeight + gap);

  const bars = reps
    .map((r, i) => {
      const y = i * (barHeight + gap);
      const width = (r.meanConcentricVelocity / maxV) * chartWidth;
      const zone = zoneForVelocity(r.meanConcentricVelocity);
      const color = ZONE_COLORS[zone] ?? "#888";
      return `
        <text x="${labelWidth - 4}" y="${y + barHeight / 2 + 5}" text-anchor="end" fill="#888" font-size="12">R${r.repNumber}</text>
        <rect x="${labelWidth}" y="${y}" width="${width}" height="${barHeight}" rx="4" fill="${color}" />
        <text x="${labelWidth + width + 6}" y="${y + barHeight / 2 + 5}" fill="#eee" font-size="13" font-weight="600">${r.meanConcentricVelocity.toFixed(2)}</text>
      `;
    })
    .join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" style="max-width:${svgWidth}px;">
      ${bars}
    </svg>
  `;
}
```

- [ ] **Step 2: Implement bar-path-chart.ts**

Create `src/ui/components/bar-path-chart.ts`:

```typescript
import type { RepAnalysis } from "../../types.js";
import { getReferencePath } from "../../analyzer/reference-paths.js";

const REP_COLORS = ["#e94560", "#4caf50", "#2196f3", "#ff9800", "#9c27b0"];

export function renderBarPathChart(
  container: HTMLElement,
  reps: RepAnalysis[],
  exerciseKey: string | null,
): void {
  const paths = reps.filter((r) => r.barPath.length > 1);
  if (paths.length === 0) {
    container.innerHTML = '<p class="text-muted">No bar path data</p>';
    return;
  }

  const allPoints = paths.flatMap((r) => r.barPath);
  const minX = Math.min(...allPoints.map((p) => p.x));
  const maxX = Math.max(...allPoints.map((p) => p.x));
  const minY = Math.min(...allPoints.map((p) => p.y));
  const maxY = Math.max(...allPoints.map((p) => p.y));

  const padX = Math.max((maxX - minX) * 0.2, 0.02);
  const padY = Math.max((maxY - minY) * 0.2, 0.02);
  const vbX = minX - padX;
  const vbY = minY - padY;
  const vbW = maxX - minX + 2 * padX;
  const vbH = maxY - minY + 2 * padY;

  let refPathSvg = "";
  if (exerciseKey) {
    const ref = getReferencePath(exerciseKey);
    if (ref && ref.length > 1) {
      const scaleY = (maxY - minY) || 1;
      const scaled = ref.map((p) => ({
        x: p.x * (maxX - minX || 0.1) + (minX + maxX) / 2,
        y: p.y * scaleY + minY,
      }));
      const d = scaled.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
      refPathSvg = `<path d="${d}" fill="none" stroke="#555" stroke-width="${vbW * 0.008}" stroke-dasharray="${vbW * 0.02}"/>`;
    }
  }

  const repPaths = paths
    .map((r, i) => {
      const color = REP_COLORS[i % REP_COLORS.length]!;
      const d = r.barPath.map((p, j) => `${j === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${vbW * 0.006}" opacity="0.8"/>`;
    })
    .join("");

  container.innerHTML = `
    <svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="100%" style="max-width:300px;transform:scaleY(-1);">
      ${refPathSvg}
      ${repPaths}
    </svg>
  `;
}
```

- [ ] **Step 3: Implement results.ts**

Create `src/ui/views/results.ts`:

```typescript
import type { SetAnalysis, Session, WorkoutSet } from "../../types.js";
import { saveSession, saveSet } from "../../storage/db.js";
import { renderVelocityChart } from "../components/velocity-chart.js";
import { renderBarPathChart } from "../components/bar-path-chart.js";
import type { Router } from "../router.js";

function qualityDot(value: number, thresholds: [number, number]): string {
  const color =
    value <= thresholds[0]
      ? "var(--green)"
      : value <= thresholds[1]
        ? "var(--yellow)"
        : "var(--red)";
  return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;"></span>`;
}

let currentSessionId: string | null = null;

export function renderResults(
  container: HTMLElement,
  router: Router,
  params: Record<string, string>,
): void {
  const analysis: SetAnalysis = JSON.parse(params.setAnalysis ?? "{}");
  const exerciseId = params.exerciseId ?? "";
  const exerciseName = params.exerciseName ?? "";
  const weight = params.weight ? parseFloat(params.weight) : undefined;

  const bestMCV =
    analysis.reps.length > 0
      ? Math.max(...analysis.reps.map((r) => r.meanConcentricVelocity))
      : 0;

  const avgTilt =
    analysis.reps.length > 0
      ? analysis.reps.reduce((s, r) => s + r.maxTilt, 0) / analysis.reps.length
      : 0;
  const avgStability =
    analysis.reps.length > 0
      ? analysis.reps.reduce((s, r) => s + r.stabilityScore, 0) / analysis.reps.length
      : 0;
  const avgDeviation =
    analysis.reps.length > 0
      ? analysis.reps.reduce((s, r) => s + r.trajectoryDeviation, 0) / analysis.reps.length
      : 0;

  const exerciseKey = mapExerciseKey(exerciseName);

  container.innerHTML = `
    <div class="card">
      <h2>${exerciseName}${weight ? ` — ${weight}kg` : ""}</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
        <div><div class="text-muted">Reps</div><div style="font-size:24px;font-weight:700;">${analysis.reps.length}</div></div>
        <div><div class="text-muted">Best MCV</div><div style="font-size:24px;font-weight:700;">${bestMCV.toFixed(2)} m/s</div></div>
        <div><div class="text-muted">Velocity Loss</div><div style="font-size:24px;font-weight:700;">${analysis.velocityLoss.toFixed(0)}%</div></div>
        <div><div class="text-muted">Est. RIR</div><div style="font-size:24px;font-weight:700;">${analysis.estimatedRIR}</div></div>
      </div>
      <div style="margin-top:8px;text-align:center;">
        <span style="background:var(--primary);padding:4px 12px;border-radius:16px;font-size:13px;">${analysis.vbtZone}</span>
      </div>
    </div>

    <div class="card">
      <h2>Velocity per Rep</h2>
      <div id="velocity-chart"></div>
    </div>

    <div class="card">
      <h2>Bar Path</h2>
      <div id="bar-path-chart"></div>
    </div>

    <div class="card">
      <h2>Movement Quality</h2>
      <div class="gap-8">
        <div>${qualityDot(avgTilt, [3, 5])} Tilt: ${avgTilt.toFixed(1)}°</div>
        <div>${qualityDot(100 - avgStability, [15, 30])} Stability: ${avgStability.toFixed(0)}/100</div>
        <div>${qualityDot(avgDeviation, [10, 25])} Trajectory: ${avgDeviation.toFixed(1)}mm</div>
      </div>
    </div>

    <div class="gap-8 mt-16">
      <button class="btn-accent" id="save-new">Save & New Set</button>
      <button class="btn-secondary" id="end-session">End Session</button>
    </div>
    <div style="text-align:center;margin-top:24px;opacity:0.3;font-size:12px;">VBT</div>
  `;

  renderVelocityChart(
    container.querySelector("#velocity-chart")!,
    analysis.reps,
  );
  renderBarPathChart(
    container.querySelector("#bar-path-chart")!,
    analysis.reps,
    exerciseKey,
  );

  container.querySelector("#save-new")!.addEventListener("click", async () => {
    await saveCurrentSet(analysis, exerciseId, exerciseName, weight);
    router.navigate("exercise-select");
  });

  container
    .querySelector("#end-session")!
    .addEventListener("click", async () => {
      await saveCurrentSet(analysis, exerciseId, exerciseName, weight);
      currentSessionId = null;
      router.navigate("home");
    });
}

async function saveCurrentSet(
  analysis: SetAnalysis,
  exerciseId: string,
  exerciseName: string,
  weight?: number,
): Promise<void> {
  if (!currentSessionId) {
    currentSessionId = crypto.randomUUID();
    await saveSession({ id: currentSessionId, date: Date.now() });
  }
  await saveSet({
    id: crypto.randomUUID(),
    sessionId: currentSessionId,
    exerciseId,
    exerciseName,
    weight,
    timestamp: Date.now(),
    reps: analysis.reps,
    velocityLoss: analysis.velocityLoss,
    estimatedRIR: analysis.estimatedRIR,
    vbtZone: analysis.vbtZone,
  });
}

function mapExerciseKey(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes("squat")) return "squat";
  if (lower.includes("bench")) return "bench_press";
  if (lower.includes("deadlift")) return "deadlift";
  if (lower.includes("overhead") || lower.includes("shoulder press"))
    return "overhead_press";
  return null;
}
```

- [ ] **Step 4: Wire into main.ts**

Add to `src/main.ts`:

```typescript
import { renderResults } from "./ui/views/results.js";

// Add route:
router.on("results", (params) => renderResults(app, router, params));
```

- [ ] **Step 5: Verify in browser**

Run: `npx vite --host`
Expected: Full flow from home → exercise select → recording → results. Results view shows metric cards, velocity chart, bar path, quality indicators, Save/End buttons. Stop server after verifying.

- [ ] **Step 6: Commit**

```bash
git add src/ui/views/results.ts src/ui/components/velocity-chart.ts src/ui/components/bar-path-chart.ts src/main.ts
git commit -m "feat: add post-set results view with charts and quality metrics"
```

---

### Task 14: PWA Setup (manifest + service worker)

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: nothing
- Produces: Installable PWA with offline support

- [ ] **Step 1: Create manifest.json**

```bash
mkdir -p public
```

Create `public/manifest.json`:

```json
{
  "name": "VBT — Velocity Based Training",
  "short_name": "VBT",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#1a1a2e",
  "background_color": "#1a1a2e",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Create service worker**

Create `public/sw.js`:

```javascript
const CACHE_NAME = "vbt-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(["/"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
      return cached || fetched;
    })
  );
});
```

- [ ] **Step 3: Generate placeholder icons**

Create simple placeholder SVG icons converted to PNG. For now, use a build-time generation or add placeholder files:

```bash
# Create minimal placeholder icons (solid colored squares)
npx tsx -e "
import { writeFileSync } from 'fs';
function createIcon(size) {
  const svg = \`<svg xmlns='http://www.w3.org/2000/svg' width='\${size}' height='\${size}'><rect width='\${size}' height='\${size}' fill='#1a1a2e'/><text x='50%' y='55%' text-anchor='middle' fill='#e94560' font-size='\${size*0.3}' font-family='sans-serif' font-weight='bold'>VBT</text></svg>\`;
  writeFileSync(\`public/icon-\${size}.svg\`, svg);
}
createIcon(192);
createIcon(512);
"
```

Update `manifest.json` icon types to `image/svg+xml` and file extensions to `.svg`.

- [ ] **Step 4: Register service worker in main.ts**

Add to the end of `init()` in `src/main.ts`:

```typescript
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
```

- [ ] **Step 5: Verify PWA**

Run: `npx vite build && npx vite preview --host`
Expected: App loads, service worker registers (visible in DevTools → Application). Manifest detected. Stop server after verifying.

- [ ] **Step 6: Commit**

```bash
git add public/manifest.json public/sw.js public/icon-192.svg public/icon-512.svg src/main.ts
git commit -m "feat: add PWA manifest, service worker, and icons"
```

---

### Task 15: CLAUDE.md & Final Wiring

**Files:**
- Create: `CLAUDE.md`
- Modify: `src/main.ts` (final wiring of all routes)

**Interfaces:**
- Consumes: all previous modules
- Produces: complete working app, CLAUDE.md for future contributors

- [ ] **Step 1: Create CLAUDE.md**

Create `CLAUDE.md`:

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VBT (Velocity Based Training) — a client-only PWA that uses phone IMU sensors (accelerometer + gyroscope) to measure barbell velocity, detect fatigue, and analyze movement quality. No backend, no framework.

## Build & Dev

```bash
npm install
npx vite              # dev server at localhost:5173
npx vite build        # production build to dist/
npx vite preview      # preview production build
```

## Tests

```bash
npx vitest run                          # all tests
npx vitest run src/math/quaternion.test.ts  # single file
npx vitest                              # watch mode
```

## Architecture

Pipeline: `SensorCollector → FusionEngine → RepDetector → MovementAnalyzer → UI`

- `src/math/` — quaternion math for coordinate transforms
- `src/sensors/` — browser sensor API abstraction (DeviceMotion + Generic Sensor API)
- `src/fusion/` — complementary filter fusing accelerometer + gyroscope into world-frame coordinates
- `src/detector/` — state machine for automatic rep detection and phase segmentation
- `src/analyzer/` — velocity metrics, VBT zone classification, movement quality scoring
- `src/pipeline/` — `Recorder` class integrating the full sensor→analysis pipeline
- `src/exercises/` — bundled exercise dataset (1,324 exercises) with search/filter
- `src/storage/` — IndexedDB persistence for sessions and sets
- `src/ui/` — vanilla DOM views and SVG chart components

## Key Design Decisions

- Sensor fusion uses complementary filter with quaternion orientation tracking so phone can be mounted in any orientation
- ZUPT (zero-velocity updates) between reps prevent integration drift
- Movement quality analysis (bar path, tilt, trajectory deviation) only available for squat, bench, deadlift, overhead press — other exercises get velocity metrics only
- Exercise data bundled at build time from hasaneyldrm/exercises-dataset, trimmed to metadata only (no images/GIFs)

## Sensor APIs

- Generic Sensor API preferred on Android Chrome (configurable sampling rate)
- DeviceMotion events as fallback (iOS Safari, Firefox)
- HTTPS required — sensor APIs are secure-context only
```

- [ ] **Step 2: Verify all routes are wired in main.ts**

Ensure `src/main.ts` has all four routes connected:

```typescript
import "./ui/styles.css";
import { Router } from "./ui/router.js";
import { renderHome } from "./ui/views/home.js";
import { renderExerciseSelect } from "./ui/views/exercise-select.js";
import { renderRecording } from "./ui/views/recording.js";
import { renderResults } from "./ui/views/results.js";
import { openDB } from "./storage/db.js";

async function init() {
  await openDB();
  const app = document.querySelector<HTMLDivElement>("#app")!;
  const router = new Router();

  router.on("home", () => renderHome(app, router));
  router.on("exercise-select", () => renderExerciseSelect(app, router));
  router.on("recording", (params) => renderRecording(app, router, params));
  router.on("results", (params) => renderResults(app, router, params));

  router.navigate("home");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js");
  }
}

init();
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Build and smoke test**

Run: `npx vite build`
Expected: Clean build with no errors.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md src/main.ts
git commit -m "feat: add CLAUDE.md and complete app wiring"
```
