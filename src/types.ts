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
