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
  process.stdout.write(json);
}

main();
