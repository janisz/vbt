import {
  searchExercises,
  filterByEquipment,
  filterByBodyPart,
  getAllEquipmentTypes,
  getAllBodyParts,
} from "../../exercises/exercises.js";
import type { ExerciseEntry } from "../../exercises/exercises.js";
import type { Router } from "../router.js";
import { escapeHtml } from "../../utils/escape.js";

export function renderExerciseSelect(
  container: HTMLElement,
  router: Router,
): void {
  const equipmentTypes = getAllEquipmentTypes();
  const bodyParts = getAllBodyParts();

  container.innerHTML = `
    <h1>Select Exercise</h1>
    <input type="search" id="ex-search" placeholder="Search exercises..."
      style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--primary);background:var(--surface);color:var(--text);font-size:16px;margin-bottom:8px;" />
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <select id="eq-filter" style="flex:1;padding:8px;border-radius:8px;background:var(--surface);color:var(--text);border:1px solid var(--primary);">
        <option value="">All Equipment</option>
        ${equipmentTypes.map((t) => `<option value="${t}">${t}</option>`).join("")}
      </select>
      <select id="bp-filter" style="flex:1;padding:8px;border-radius:8px;background:var(--surface);color:var(--text);border:1px solid var(--primary);">
        <option value="">All Body Parts</option>
        ${bodyParts.map((p) => `<option value="${p}">${p}</option>`).join("")}
      </select>
    </div>
    <div style="margin-bottom:12px;">
      <input type="number" id="weight-input" placeholder="Weight (kg)" min="0" step="0.5"
        style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--primary);background:var(--surface);color:var(--text);font-size:16px;" />
    </div>
    <ul id="ex-list" class="session-list" style="max-height:50vh;overflow-y:auto;"></ul>
    <button class="btn-secondary mt-8" id="back-btn">Back</button>
  `;

  const searchInput = container.querySelector<HTMLInputElement>("#ex-search")!;
  const eqFilter = container.querySelector<HTMLSelectElement>("#eq-filter")!;
  const bpFilter = container.querySelector<HTMLSelectElement>("#bp-filter")!;
  const list = container.querySelector<HTMLUListElement>("#ex-list")!;

  function render() {
    let results = searchExercises(searchInput.value);
    if (eqFilter.value) results = filterByEquipment(eqFilter.value, results);
    if (bpFilter.value) results = filterByBodyPart(bpFilter.value, results);

    const display = results.slice(0, 50);
    list.innerHTML = display
      .map(
        (e) => `
      <li class="session-item" data-id="${escapeHtml(e.id)}" data-name="${escapeHtml(e.name)}">
        <div>${escapeHtml(e.name)}</div>
        <div class="text-muted">${escapeHtml(e.equipment)} · ${escapeHtml(e.bodyPart)} · ${escapeHtml(e.target)}</div>
      </li>`,
      )
      .join("");

    list.querySelectorAll(".session-item").forEach((el) => {
      el.addEventListener("click", () => {
        const htmlEl = el as HTMLElement;
        const weightInput =
          container.querySelector<HTMLInputElement>("#weight-input")!;
        router.navigate("recording", {
          exerciseId: htmlEl.dataset.id!,
          exerciseName: htmlEl.dataset.name!,
          weight: weightInput.value,
        });
      });
    });
  }

  searchInput.addEventListener("input", render);
  eqFilter.addEventListener("change", render);
  bpFilter.addEventListener("change", render);
  container
    .querySelector("#back-btn")!
    .addEventListener("click", () => router.navigate("home"));

  render();
}
