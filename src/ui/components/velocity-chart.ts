import type { RepAnalysis } from "../../types.js";
import { classifyZone } from "../../analyzer/movement-analyzer.js";

const ZONE_COLORS: Record<string, string> = {
  "maximal-strength": "#f44336",
  "accelerative-strength": "#ff9800",
  "strength-speed": "#ffeb3b",
  power: "#4caf50",
  "speed-strength": "#2196f3",
};

export function renderVelocityChart(
  container: HTMLElement,
  reps: RepAnalysis[],
): void {
  if (reps.length === 0) {
    container.innerHTML = '<p class="text-muted">No reps recorded</p>';
    return;
  }

  const maxV = Math.max(...reps.map((r) => r.meanConcentricVelocity), 0.1);
  const barHeight = 28;
  const gap = 6;
  const labelWidth = 36;
  const valueWidth = 60;
  const chartWidth = 300;
  const svgWidth = labelWidth + chartWidth + valueWidth;
  const svgHeight = reps.length * (barHeight + gap);

  const bars = reps
    .map((r, i) => {
      const y = i * (barHeight + gap);
      const width = (r.meanConcentricVelocity / maxV) * chartWidth;
      const zone = classifyZone(r.meanConcentricVelocity);
      const color = ZONE_COLORS[zone] ?? "#888";
      return `
        <text x="${labelWidth - 4}" y="${y + barHeight / 2 + 5}" text-anchor="end" fill="#888" font-size="12">R${r.repNumber}</text>
        <rect x="${labelWidth}" y="${y}" width="${width}" height="${barHeight}" rx="4" fill="${color}" />
        <text x="${labelWidth + width + 6}" y="${y + barHeight / 2 + 5}" fill="#eee" font-size="13" font-weight="600">${r.meanConcentricVelocity.toFixed(2)}</text>
      `;
    })
    .join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" style="max-width:${svgWidth}px;">
      ${bars}
    </svg>
  `;
}
