import { getSessions } from "../../storage/db.js";
import type { Router } from "../router.js";

export async function renderHome(
  container: HTMLElement,
  router: Router,
): Promise<void> {
  const sessions = await getSessions();

  container.innerHTML = `
    <h1>VBT</h1>
    <button class="btn-accent" id="start-session">Start Session</button>
    <div class="mt-16">
      <h2>History</h2>
      ${
        sessions.length === 0
          ? '<p class="text-muted">No sessions yet</p>'
          : `<ul class="session-list">${sessions
              .map(
                (s) => `
              <li class="session-item" data-id="${s.id}">
                <div>${new Date(s.date).toLocaleDateString()}</div>
                ${s.notes ? `<div class="text-muted">${s.notes}</div>` : ""}
              </li>`,
              )
              .join("")}</ul>`
      }
    </div>
  `;

  container
    .querySelector("#start-session")!
    .addEventListener("click", () => router.navigate("exercise-select"));

  container.querySelectorAll(".session-item").forEach((el) => {
    el.addEventListener("click", () => {
      const id = (el as HTMLElement).dataset.id!;
      router.navigate("session-detail", { sessionId: id });
    });
  });
}
