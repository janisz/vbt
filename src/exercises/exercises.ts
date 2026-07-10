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
