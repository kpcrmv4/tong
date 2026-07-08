import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';

export const A4_DIMENSIONS = {
  portrait: {
    width: 2480,
    height: 3508,
    mmWidth: 210,
    mmHeight: 297
  },
  landscape: {
    width: 3508,
    height: 2480,
    mmWidth: 297,
    mmHeight: 210
  }
};

export function validateA4(element: HTMLElement, isLandscape: boolean = false): boolean {
  if (!element) return false;

  // Basic validation to ensure the element has some dimensionality.
  // We'll enforce A4 proportions through CSS in the A4PageContainer.
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  return true;
}

export const isIOS = () => {
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
  ].includes(navigator.platform)
    // iPad on iOS 13 detection
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
    // Check userAgent directly for iOS devices
    || (/iPad|iPhone|iPod/.test(navigator.userAgent));
};

export interface ExportA4Options {
  element: HTMLElement;
  prefix?: string;
  isLandscape?: boolean;
  paperSize?: 'A4' | 'A5';
}

export interface ExportA4PagesOptions {
  elements: HTMLElement[];
  prefix?: string;
  isLandscape?: boolean;
  paperSize?: 'A4' | 'A5';
}

function waitForImageReady(img: HTMLImageElement, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }

    const done = () => {
      window.clearTimeout(timer);
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
      resolve();
    };

    const timer = window.setTimeout(done, timeoutMs);
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Cannot read image file'));
    reader.readAsDataURL(blob);
  });
}

function isHttpImageSrc(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

async function inlineImageForExport(img: HTMLImageElement): Promise<void> {
  const rawSrc = img.getAttribute('src') || '';
  if (!rawSrc || rawSrc.startsWith('data:') || rawSrc.startsWith('blob:')) {
    await waitForImageReady(img);
    return;
  }

  img.loading = 'eager';
  img.decoding = 'sync';

  if (!isHttpImageSrc(rawSrc)) {
    await waitForImageReady(img);
    return;
  }

  // QR/รูปจาก URL ภายนอกต้องถูกแปลงเป็น data:image ก่อนจับภาพ
  // เพื่อแก้ปัญหา Safari/iPad และ canvas cross-origin ตอน export เป็น PNG
  img.crossOrigin = 'anonymous';

  try {
    const absoluteSrc = new URL(rawSrc, window.location.href).toString();
    const response = await fetch(absoluteSrc, { mode: 'cors', cache: 'force-cache' });
    if (!response.ok) throw new Error(`Failed to load image: ${response.status}`);

    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('This URL is not an image');

    const dataUrl = await blobToDataUrl(blob);
    if (dataUrl) img.src = dataUrl;
  } catch (error) {
    console.warn('Cannot convert image to data URL before export. Will try to wait for original image instead:', rawSrc, error);
  }

  await waitForImageReady(img);
}

async function prepareImagesForExport(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  if (images.length === 0) return;

  await Promise.all(images.map(img => inlineImageForExport(img as HTMLImageElement)));
}

function getPaperMm(paperSize: 'A4' | 'A5' = 'A4', isLandscape: boolean = false) {
  const base = paperSize === 'A5'
    ? { width: 148, height: 210 }
    : { width: 210, height: 297 };

  return isLandscape
    ? { width: base.height, height: base.width, format: paperSize.toLowerCase() as 'a4' | 'a5' }
    : { width: base.width, height: base.height, format: paperSize.toLowerCase() as 'a4' | 'a5' };
}

function showGeneratedImageOverlay(imageData: string, filename: string): void {
  const existing = document.getElementById('a4-image-result-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'a4-image-result-overlay';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'background:var(--ui-overlay)',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:16px',
    'box-sizing:border-box'
  ].join(';');

  overlay.innerHTML = `
    <div style="width:min(960px,100%); max-height:96dvh; overflow:auto; background:var(--ui-surface); color:var(--text-main); border-radius:24px; border:1px solid var(--ui-border); box-shadow:var(--ui-shadow-soft); padding:16px; font-family:Sarabun,system-ui,sans-serif;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px;">
        <div>
          <div style="font-weight:900; font-size:16px;">สร้างภาพเอกสารสำเร็จ</div>
          <div style="font-size:12px; color:var(--text-soft); font-weight:700;">บน iPad/iPhone ให้แตะค้างที่รูปภาพเพื่อบันทึก หรือกดปุ่มดาวน์โหลดด้านล่าง</div>
        </div>
        <span role="button" data-close="1" style="display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--ui-border); background:var(--ui-surface); color:var(--text-main); border-radius:999px; width:40px; height:40px; font-size:22px; line-height:1; cursor:pointer;">×</span>
      </div>
      <div style="border:1px solid var(--ui-border); border-radius:18px; background:var(--app-bg); padding:10px; text-align:center;">
        <img src="${imageData}" alt="${filename}" style="max-width:100%; height:auto; display:block; margin:0 auto; border-radius:12px; background:var(--ui-surface);" />
      </div>
      <a download="${filename}" href="${imageData}" style="margin-top:12px; min-height:44px; display:flex; align-items:center; justify-content:center; border-radius:16px; background:var(--ui-primary); color:var(--ui-on-primary); font-weight:900; text-decoration:none;">ดาวน์โหลดภาพ PNG</a>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target === overlay || target.dataset.close === '1') {
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
}

async function captureElementToPng(options: ExportA4Options): Promise<string> {
  const { element, isLandscape = false } = options;

  if (!validateA4(element, isLandscape)) {
    throw new Error('Document size is not standard A4/A5 or error loading layout');
  }

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const originalTransform = element.style.transform;
  const originalTransition = element.style.transition;
  element.style.transition = 'none';
  element.style.transform = 'none';

  try {
    await prepareImagesForExport(element);
    await new Promise(resolve => setTimeout(resolve, 150));

    return await htmlToImage.toPng(element, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
      includeQueryParams: true,
      style: {
        transform: 'none',
        transition: 'none'
      }
    });
  } finally {
    element.style.transform = originalTransform;
    element.style.transition = originalTransition;
  }
}

async function captureElementsToPngs(options: ExportA4PagesOptions): Promise<string[]> {
  const { elements, prefix = 'DOCUMENT', isLandscape = false, paperSize = 'A4' } = options;

  const validElements = elements.filter(Boolean);
  if (!elements || validElements.length === 0) {
    throw new Error('No document pages to export');
  }

  const imageList: string[] = [];

  for (const element of validElements) {
    const imageData = await captureElementToPng({
      element,
      prefix,
      isLandscape,
      paperSize
    });

    imageList.push(imageData);
  }

  return imageList;
}

function buildExportFilename(prefix: string, ext: 'png' | 'pdf'): string {
  const safePrefix = (prefix || 'DOCUMENT').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'DOCUMENT';
  const d = new Date();
  const dateStr = d.toISOString().replace(/T/, '-').replace(/:/g, '').split('.')[0];
  return `${safePrefix}-${dateStr}.${ext}`;
}

export async function exportA4ToImage(options: ExportA4Options): Promise<void> {
  const { prefix = 'DOCUMENT' } = options;

  try {
    const imageData = await captureElementToPng(options);
    const filename = buildExportFilename(prefix, 'png');

    if (isIOS()) {
      // ไม่ใช้ป๊อปอัปแล้ว เพื่อเลี่ยง Safari/iPad popup blocker หลัง async export
      showGeneratedImageOverlay(imageData, filename);
      return;
    }

    const link = document.createElement('a');
    link.download = filename;
    link.href = imageData;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error exporting A4/A5 to image:', error);
    throw error;
  }
}

export async function exportA4ToPdf(options: ExportA4Options): Promise<void> {
  const { prefix = 'DOCUMENT', isLandscape = false, paperSize = 'A4' } = options;

  try {
    const imageData = await captureElementToPng(options);
    const paper = getPaperMm(paperSize, isLandscape);
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: paper.format
    });

    pdf.addImage(imageData, 'PNG', 0, 0, paper.width, paper.height, undefined, 'FAST');
    pdf.save(buildExportFilename(prefix, 'pdf'));
  } catch (error) {
    console.error('Error exporting A4/A5 to PDF:', error);
    throw error;
  }
}

export function printA4Element(element: HTMLElement, isLandscape: boolean = false, paperSize: 'A4' | 'A5' = 'A4'): void {
  const paper = getPaperMm(paperSize, isLandscape);

  // Create an invisible iframe for printing to bypass popup blockers
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    alert('Cannot create print window. Please try again.');
    document.body.removeChild(iframe);
    return;
  }

  const content = element.innerHTML;

  doc.open();
  doc.write(`
    <html>
      <head>
        <title>พิมพ์เอกสาร</title>
        <meta charset="utf-8"/>
        <style>
          body {
            font-family: 'Sarabun', 'Prompt', sans-serif;
            margin: 0;
            padding: 0;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @media print {
            body {
              padding: 0;
              margin: 0;
            }

            @page {
              size: ${paperSize === 'A5' ? (isLandscape ? 'A5 landscape' : 'A5 portrait') : (isLandscape ? 'A4 landscape' : 'A4 portrait')};
              margin: 0 !important;
            }
          }
        </style>
      </head>
      <body>
        <div style="width: ${paper.width}mm; min-height: ${paper.height}mm; box-sizing: border-box; overflow: hidden; page-break-after: always; position: relative; background: #ffffff;">
          ${content}
        </div>
        <script>
          setTimeout(() => {
            window.print();
            setTimeout(function() {
              window.frameElement.remove();
            }, 1000);
          }, 300);
        </script>
      </body>
    </html>
  `);
  doc.close();
}

export async function exportA4PagesToPdf(options: ExportA4PagesOptions): Promise<void> {
  const { prefix = 'DOCUMENT', isLandscape = false, paperSize = 'A4' } = options;

  try {
    const imageList = await captureElementsToPngs(options);
    const paper = getPaperMm(paperSize, isLandscape);

    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: paper.format
    });

    imageList.forEach((imageData, index) => {
      if (index > 0) {
        pdf.addPage(paper.format, isLandscape ? 'landscape' : 'portrait');
      }

      pdf.addImage(imageData, 'PNG', 0, 0, paper.width, paper.height, undefined, 'FAST');
    });

    pdf.save(buildExportFilename(prefix, 'pdf'));
  } catch (error) {
    console.error('Error exporting multiple A4/A5 pages to PDF:', error);
    throw error;
  }
}

export async function exportA4PagesToImages(options: ExportA4PagesOptions): Promise<void> {
  const { prefix = 'DOCUMENT', elements } = options;

  try {
    const imageList = await captureElementsToPngs(options);

    if (isIOS()) {
      const firstImage = imageList[0];
      if (firstImage) {
        showGeneratedImageOverlay(firstImage, buildExportFilename(`${prefix}-PAGE-01`, 'png'));
      }

      if (imageList.length > 1) {
        alert('iPad/iPhone may block downloading multiple files at once. The system is showing the first page. Please save one by one if necessary.');
      }

      return;
    }

    imageList.forEach((imageData, index) => {
      const pageNo = String(index + 1).padStart(2, '0');
      const filename = buildExportFilename(`${prefix}-PAGE-${pageNo}`, 'png');

      const link = document.createElement('a');
      link.download = filename;
      link.href = imageData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  } catch (error) {
    console.error('Error exporting multiple A4/A5 pages to images:', error);
    throw error;
  }
}

export function printA4Elements(
  elements: HTMLElement[],
  isLandscape: boolean = false,
  paperSize: 'A4' | 'A5' = 'A4'
): void {
  const validElements = elements.filter(Boolean);

  if (validElements.length === 0) {
    alert('No document pages to print.');
    return;
  }

  const paper = getPaperMm(paperSize, isLandscape);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    alert('Cannot create print window. Please try again.');
    document.body.removeChild(iframe);
    return;
  }

  const pagesHtml = validElements.map(element => `
    <div class="a4-print-page">
      ${element.innerHTML}
    </div>
  `).join('');

  doc.open();
  doc.write(`
    <html>
      <head>
        <title>พิมพ์เอกสาร</title>
        <meta charset="utf-8"/>
        <style>
          body {
            font-family: 'Sarabun', 'Prompt', sans-serif;
            margin: 0;
            padding: 0;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .a4-print-page {
            width: ${paper.width}mm;
            min-height: ${paper.height}mm;
            box-sizing: border-box;
            overflow: hidden;
            page-break-after: always;
            break-after: page;
            position: relative;
            background: #ffffff;
          }

          .a4-print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          @media print {
            body {
              padding: 0;
              margin: 0;
            }

            @page {
              size: ${paperSize === 'A5' ? (isLandscape ? 'A5 landscape' : 'A5 portrait') : (isLandscape ? 'A4 landscape' : 'A4 portrait')};
              margin: 0 !important;
            }
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
        <script>
          setTimeout(() => {
            window.print();
            setTimeout(function() {
              window.frameElement.remove();
            }, 1000);
          }, 300);
        </script>
      </body>
    </html>
  `);
  doc.close();
}
