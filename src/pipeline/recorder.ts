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

export class Recorder {
  private fusion = new FusionEngine();
  private detector: RepDetector | null = null;
  private recording = false;
  private samples: FusedSample[] = [];
  private detectedReps: DetectedRep[] = [];
  private analyzedReps: RepAnalysis[] = [];
  private repCallbacks: Array<(rep: RepAnalysis) => void> = [];
  private lastMovementTime: number | null = null;
  private startTime: number | null = null;

  start(phaseOrder: PhaseOrder): void {
    this.fusion.reset();
    this.detector = new RepDetector(phaseOrder);
    this.samples = [];
    this.detectedReps = [];
    this.analyzedReps = [];
    this.recording = true;
    this.lastMovementTime = null;
    this.startTime = null;
  }

  stop(): SetAnalysis {
    this.recording = false;
    return analyzeSet(this.analyzedReps);
  }

  ingestSample(sample: SensorSample): void {
    if (!this.recording || !this.detector) return;

    if (this.startTime === null) this.startTime = sample.timestamp;

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
    if (!this.recording || this.samples.length === 0 || this.startTime === null) return 0;
    const latest = this.samples[this.samples.length - 1]!.timestamp;
    if (this.lastMovementTime === null) return latest - this.startTime;
    return latest - this.lastMovementTime;
  }
}
