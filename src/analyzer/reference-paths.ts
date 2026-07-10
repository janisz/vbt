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
