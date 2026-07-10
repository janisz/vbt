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
