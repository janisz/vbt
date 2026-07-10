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
