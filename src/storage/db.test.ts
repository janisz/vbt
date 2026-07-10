import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  openDB,
  saveSession,
  getSessions,
  saveSet,
  getSetsForSession,
  deleteSession,
  resetDB,
} from "./db.js";
import type { Session, WorkoutSet } from "../types.js";

beforeEach(() => {
  indexedDB = new IDBFactory();
  resetDB();
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
