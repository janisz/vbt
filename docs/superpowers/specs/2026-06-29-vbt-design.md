# VBT — Velocity Based Training Web App

A client-only PWA that turns a smartphone mounted on a barbell into a velocity-based training tool. Uses the phone's accelerometer and gyroscope to measure bar velocity, detect fatigue, and analyze movement quality — no external hardware required.

## Goals

- Measure mean/peak concentric velocity per rep with accuracy approaching dedicated IMU devices (~0.01–0.05 m/s bias)
- Detect fatigue via velocity loss across a set and estimate reps in reserve
- Analyze movement quality: bar path, symmetry/tilt, stability, trajectory deviation from exercise-specific ideals
- Run entirely in the browser with no backend, store data locally, share results via screenshots

## Non-Goals (MVP)

- Camera/optical-flow-assisted tracking (architecture supports it, not implemented yet)
- Real-time audio/visual cues during the set
- Smartwatch pairing (Garmin, Apple Watch)
- Cable machine exercises
- Backend, accounts, cloud sync
- Exercise auto-detection

## Tech Stack

- Vanilla TypeScript + PWA (no framework)
- DeviceMotion API (cross-browser) with Generic Sensor API (Android Chrome) as preferred source when available
- IndexedDB for local persistence
- Wake Lock API to prevent screen sleep during recording

## Exercise Data

Exercise metadata sourced from [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) — 1,324 exercises with names, body parts, equipment types, muscle groups, instructions (multilingual), and animated GIFs.

For MVP, the user selects from the full exercise catalog (filtered by equipment type), but **movement quality analysis** (bar path reference, trajectory deviation) is only available for barbell compounds with well-studied ideal paths: squat, bench press, deadlift, overhead press. All other exercises get velocity tracking and fatigue metrics only.

This gives users immediate value for any exercise while keeping the quality analysis accurate where research supports it.

## Architecture

```
Phone Sensors → Sensor Collector → Sensor Fusion Engine → Rep Detector → Movement Analyzer → UI
                                                                                            ↕
                                                                                      Storage Layer (IndexedDB)
```

### Sensor Collector

Abstracts over two browser APIs:
- **Generic Sensor API** (preferred on Android Chrome): `Accelerometer`, `Gyroscope`, `AbsoluteOrientationSensor` — configurable sampling rate
- **DeviceMotion events** (fallback, required for iOS/Firefox): `devicemotion` event with `acceleration`, `accelerationIncludingGravity`, `rotationRate`

Normalizes both into a common stream of timestamped samples:

```typescript
interface SensorSample {
  timestamp: number             // ms, performance.now()
  acceleration: Vec3            // m/s², device-local, gravity-subtracted
  accelerationWithGravity: Vec3 // m/s², device-local, includes gravity
  rotationRate: Vec3            // rad/s, device-local
}
```

Target sampling rate: 60–100Hz. The collector buffers samples and emits them to the fusion engine.

Designed with a plugin interface so a future camera-based optical flow module can provide an additional velocity estimate without changing downstream modules.

### Sensor Fusion Engine

The phone can be mounted on the bar in any orientation. The fusion engine resolves this by tracking orientation and transforming all data into a stable world frame.

**Step 1 — Orientation tracking (complementary filter):**
- Gyroscope integrated over time gives short-term rotation (accurate but drifts)
- Accelerometer gravity vector gives absolute "down" reference (noisy during movement but no drift)
- Blended via complementary filter: `orientation = α × gyro_integrated + (1-α) × accel_gravity` where α ≈ 0.96–0.98
- Produces a continuous rotation quaternion: device frame → world frame

**Step 2 — World-frame linear acceleration:**
- Rotate raw acceleration by orientation quaternion into world coordinates
- Subtract gravity (9.81 m/s² downward) to isolate linear acceleration
- Vertical axis now always aligns with gravity regardless of phone mounting

**Step 3 — Velocity via integration with drift correction:**
- Trapezoidal integration of vertical acceleration → velocity
- **Zero-velocity updates (ZUPT):** rep detector signals stillness periods back to the fusion engine; during these windows, velocity is forced to zero — prevents drift accumulating across reps
- High-pass filter removes low-frequency drift within a single rep

**Step 4 — Lateral movement (bar path and symmetry):**
- Horizontal acceleration components → lateral and fore/aft movement
- Double-integrate for position (bar path reconstruction)
- Roll/pitch from orientation quaternion → bar tilt (symmetry indicator)

### Rep Detector

State machine operating on the fused world-frame vertical velocity signal:

```
IDLE → ECCENTRIC → CONCENTRIC → PAUSE → ECCENTRIC → ...
```

- **IDLE → movement:** vertical velocity exceeds threshold (~0.05 m/s) sustained for ~50ms
- **Eccentric phase:** downward velocity (bar descending)
- **Concentric phase:** upward velocity (bar ascending) — primary VBT measurement window
- **Phase transition:** velocity crosses zero at the turnaround point
- **Rep complete → PAUSE:** velocity near zero for >200ms

Exercise-specific phase ordering:
- Most exercises: eccentric first (squat, bench press, overhead press, cable exercises)
- Deadlift and similar pull-from-floor movements: concentric first
- Default: eccentric first; user can toggle if needed

Edge cases:
- **Paused reps:** long zero-velocity between eccentric/concentric — rep doesn't end until bar returns to start position
- **Touch-and-go deadlifts:** short pause at bottom — minimum pause threshold is tunable
- **Failed reps:** velocity stalls or reverses during concentric — flagged but recorded

Output per rep: start/end timestamps, phase boundaries, concentric duration, eccentric duration, pause duration at turnaround.

### Movement Analyzer

Consumes rep detector output plus the full fused sensor stream.

**Per-rep velocity metrics:**
- Mean concentric velocity (MCV) — the primary VBT metric
- Peak concentric velocity

**Per-set metrics:**
- Velocity loss: `(fastest_rep_MCV - last_rep_MCV) / fastest_rep_MCV × 100`
- Estimated RIR (reps in reserve) from velocity loss curve using published load-velocity profiles
- VBT zone classification based on MCV (maximal strength, accelerative strength, strength-speed, power, speed-strength)
- Rep-to-rep consistency (standard deviation of MCV)

**Movement quality metrics (per rep):**
- **Bar path:** reconstructed 2D trajectory (vertical + fore/aft) from double-integrated horizontal acceleration
- **Bar tilt (symmetry):** roll angle from orientation data. Sustained tilt >5° during concentric flags an imbalance
- **Stability score:** high-frequency vibration magnitude from accelerometer (band-pass ~5–20Hz). More shake = less control
- **Trajectory deviation:** average perpendicular distance from exercise-specific reference path, normalized by range of motion

**Exercise-specific reference paths:**
- Squat: nearly vertical
- Bench press: J-curve (slight arc back toward rack)
- Deadlift: slight S-curve
- Overhead press: vertical with slight forward start

Stored as simple polyline templates. Deviation computed as average perpendicular distance.

## Data Model

### Session

```typescript
interface Session {
  id: string            // UUID
  date: number          // timestamp
  notes?: string
}
```

### Set

```typescript
interface WorkoutSet {
  id: string
  sessionId: string
  exerciseId: string    // ID from exercise dataset (e.g. "0154")
  exerciseName: string  // human-readable name
  weight?: number       // kg, user-entered
  timestamp: number
  reps: Rep[]
  velocityLoss: number  // percentage
  estimatedRIR: number
  vbtZone: string
}
```

### Rep

```typescript
interface Rep {
  repNumber: number
  meanConcentricVelocity: number    // m/s
  peakConcentricVelocity: number    // m/s
  concentricDuration: number        // ms
  eccentricDuration: number         // ms
  barPath: Array<{x: number, y: number}>  // trajectory points
  maxTilt: number                   // degrees
  stabilityScore: number            // 0-100
  trajectoryDeviation: number       // mm
}
```

Raw sensor data is kept only for the current/most recent set (debugging, replay). Older raw data is discarded.

## UI Flow

Four views, designed for quick gym use.

### 1. Home / Session View
- "Start Session" button
- List of past sessions with date, exercise count, summary stats
- Tap a past session to review its sets

### 2. Exercise Selection
- Searchable list from the exercise dataset, filterable by equipment type and body part
- Recent/favorite exercises shown at top for quick access
- Optional weight input (numeric keypad)
- "Mount phone and tap Start" — big start button, then 5-second countdown to give the user time to mount and get in position

### 3. Recording (Active Set)
- Minimal: pulsing "Recording..." indicator and rep counter
- Phone is on the bar — nobody is looking at this screen
- Stops automatically after >5 seconds of no movement, or user taps "Stop" after unmounting

### 4. Post-Set Results
- **Top card:** rep count, best MCV, velocity loss %, estimated RIR, VBT zone badge
- **Velocity chart:** horizontal bar graph, one bar per rep colored by VBT zone, trend line showing velocity decay
- **Bar path:** 2D trajectory overlay, all reps stacked, ideal path shown as dashed reference
- **Quality indicators:** tilt, stability, trajectory deviation — each with colored dot (green/yellow/red) and value
- "Save & New Set" and "End Session" buttons

Designed to be screenshot-friendly: clean layout, all key metrics in one screen, dark background, app watermark in corner.

### PWA Behavior
- Installable to home screen
- Works offline
- Wake Lock API keeps screen on during recording

## Future Enhancements (Not MVP)

- Camera optical flow as supplementary velocity source
- Real-time audio feedback during sets (velocity drop warnings, tilt alerts)
- Smartwatch pairing (heart rate, wrist acceleration as second data point)
- Cable machine exercises
- Export to JSON/CSV
- Shareable session links
- Exercise auto-detection from movement pattern
- Load-velocity profile building per user per exercise
