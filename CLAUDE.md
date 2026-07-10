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
