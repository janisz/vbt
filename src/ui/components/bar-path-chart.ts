import type { RepAnalysis } from "../../types.js";
import { getReferencePath } from "../../analyzer/reference-paths.js";

const REP_COLORS = ["#e94560", "#4caf50", "#2196f3", "#ff9800", "#9c27b0"];

export function renderBarPathChart(
  container: HTMLElement,
  reps: RepAnalysis[],
  exerciseKey: string | null,
): void {
  const paths = reps.filter((r) => r.barPath.length > 1);
  if (paths.length === 0) {
    container.innerHTML = '<p class="text-muted">No bar path data</p>';
    return;
  }

  const allPoints = paths.flatMap((r) => r.barPath);
  const minX = Math.min(...allPoints.map((p) => p.x));
  const maxX = Math.max(...allPoints.map((p) => p.x));
  const minY = Math.min(...allPoints.map((p) => p.y));
  const maxY = Math.max(...allPoints.map((p) => p.y));

  const padX = Math.max((maxX - minX) * 0.2, 0.02);
  const padY = Math.max((maxY - minY) * 0.2, 0.02);
  const vbX = minX - padX;
  const vbY = minY - padY;
  const vbW = maxX - minX + 2 * padX;
  const vbH = maxY - minY + 2 * padY;

  let refPathSvg = "";
  if (exerciseKey) {
    const ref = getReferencePath(exerciseKey);
    if (ref && ref.length > 1) {
      const scaleY = (maxY - minY) || 1;
      const scaled = ref.map((p) => ({
        x: p.x * (maxX - minX || 0.1) + (minX + maxX) / 2,
        y: p.y * scaleY + minY,
      }));
      const d = scaled.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
      refPathSvg = `<path d="${d}" fill="none" stroke="#555" stroke-width="${vbW * 0.008}" stroke-dasharray="${vbW * 0.02}"/>`;
    }
  }

  const repPaths = paths
    .map((r, i) => {
      const color = REP_COLORS[i % REP_COLORS.length]!;
      const d = r.barPath.map((p, j) => `${j === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${vbW * 0.006}" opacity="0.8"/>`;
    })
    .join("");

  container.innerHTML = `
    <svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="100%" style="max-width:300px;transform:scaleY(-1);">
      ${refPathSvg}
      ${repPaths}
    </svg>
  `;
}
