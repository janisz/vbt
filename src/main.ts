import "./ui/styles.css";
import { Router } from "./ui/router.js";
import { renderHome } from "./ui/views/home.js";
import { renderExerciseSelect } from "./ui/views/exercise-select.js";
import { renderRecording } from "./ui/views/recording.js";
import { openDB } from "./storage/db.js";

async function init() {
  await openDB();
  const app = document.querySelector<HTMLDivElement>("#app")!;
  const router = new Router();

  router.on("home", () => renderHome(app, router));
  router.on("exercise-select", () => renderExerciseSelect(app, router));
  router.on("recording", (params) => renderRecording(app, router, params));

  router.navigate("home");
}

init();
