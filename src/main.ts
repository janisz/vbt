import "./ui/styles.css";
import { Router } from "./ui/router.js";
import { renderHome } from "./ui/views/home.js";
import { openDB } from "./storage/db.js";

async function init() {
  await openDB();
  const app = document.querySelector<HTMLDivElement>("#app")!;
  const router = new Router();

  router.on("home", () => renderHome(app, router));
  router.on("exercise-select", () => {
    app.innerHTML = "<h1>Exercise Select</h1><p>Coming soon</p>";
  });

  router.navigate("home");
}

init();
