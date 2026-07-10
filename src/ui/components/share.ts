const BG_COLOR = "#1a1a2e";
const SCALE = 2;

export async function shareResults(
  container: HTMLElement,
  summary: string,
): Promise<void> {
  const svgs = container.querySelectorAll<SVGSVGElement>("svg");
  const files: File[] = [];
  for (let i = 0; i < svgs.length; i++) {
    const file = await svgToPng(svgs[i]!, `vbt-chart-${i + 1}.png`);
    if (file) files.push(file);
  }

  if (files.length > 0 && navigator.canShare?.({ files })) {
    await navigator.share({ text: summary, files });
  } else {
    for (const file of files) downloadFile(file);
  }
}

async function svgToPng(
  svg: SVGSVGElement,
  filename: string,
): Promise<File | null> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const rect = svg.getBoundingClientRect();
  const w = rect.width || 300;
  const h = rect.height || 300;

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = w * SCALE;
    canvas.height = h * SCALE;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!pngBlob) return null;
    return new File([pngBlob], filename, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}
