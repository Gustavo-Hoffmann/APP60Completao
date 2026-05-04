import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type ExportPdfArgs = {
  element: HTMLElement;
  filename: string;
  logoUrl?: string;
};

async function loadImageDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        resolve({ dataUrl, width: canvas.width, height: canvas.height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function exportElementToPdf({ element, filename, logoUrl }: ExportPdfArgs) {
  // Remove elementos que não devem aparecer no PDF (ex.: botões de export, navegação).
  // Em vez de mexer no DOM real, clonamos e escondemos no clone.
  const tmp = document.createElement("div");
  tmp.style.position = "fixed";
  tmp.style.left = "-10000px";
  tmp.style.top = "0";
  tmp.style.width = `${element.getBoundingClientRect().width}px`;
  tmp.style.background = "#ffffff";

  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>('[data-export="exclude"]').forEach((node) => {
    node.style.display = "none";
  });

  tmp.appendChild(clone);
  document.body.appendChild(tmp);

  const canvas = await html2canvas(clone, {
    backgroundColor: "#ffffff",
    scale: Math.min(2, window.devicePixelRatio || 1),
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  tmp.remove();

  const pdf = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const marginX = 10;
  const marginTop = 12;
  const marginBottom = 12;
  const contentWidth = pageWidth - marginX * 2;

  let cursorY = marginTop;

  if (logoUrl) {
    const logo = await loadImageDataUrl(logoUrl);
    if (logo) {
      const desiredLogoHeight = 20; // mm (maior, conforme pedido)
      const desiredLogoWidth = (logo.width * desiredLogoHeight) / logo.height;
      const logoWidth = Math.min(desiredLogoWidth, contentWidth);
      const logoHeight = (desiredLogoHeight * logoWidth) / desiredLogoWidth;
      const logoX = (pageWidth - logoWidth) / 2;
      pdf.addImage(logo.dataUrl, "PNG", logoX, cursorY, logoWidth, logoHeight, undefined, "FAST");
      cursorY += logoHeight + 10;
    }
  }

  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const usableHeightFirstPage = pageHeight - cursorY - marginBottom;
  let position = cursorY;
  let heightLeft = imgHeight;

  pdf.addImage(imgData, "PNG", marginX, position, imgWidth, imgHeight, undefined, "FAST");
  heightLeft -= usableHeightFirstPage;

  while (heightLeft > 2) {
    pdf.addPage();
    position = marginTop + (heightLeft - imgHeight);
    pdf.addImage(imgData, "PNG", marginX, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight - marginTop - marginBottom;
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

