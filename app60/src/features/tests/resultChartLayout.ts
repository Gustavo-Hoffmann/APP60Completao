/** Pixels por segundo no eixo X (largura útil do plot); força scroll horizontal em sessões longas. */
export const CHART_SCROLL_PX_PER_SEC = 54;

export function chartInnerPlotWidth(
  xSpanSec: number,
  viewportInnerW: number,
  pxPerSec = CHART_SCROLL_PX_PER_SEC
): number {
  const fromDuration = Math.max(1e-9, xSpanSec) * pxPerSec;
  return Math.max(viewportInnerW, fromDuration);
}
