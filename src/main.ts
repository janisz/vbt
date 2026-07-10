import "./ui/styles.css";
import { Router } from "./ui/router.js";
import { renderHome } from "./ui/views/home.js";
import { renderExerciseSelect } from "./ui/views/exercise-select.js";
import { openDB } from "./storage/db.js";

async function init() {
  await openDB();
  const app = document.querySelector<HTMLDivElement>("#app")!;
  const router = new Router();

  router.on("home", () => renderHome(app, router));
  router.on("exercise-select", () => renderExerciseSelect(app, router));

  router.navigate("home");
}

init();
