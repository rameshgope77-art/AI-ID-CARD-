import { jsPDF } from 'jspdf';
import { DocumentItem, PrintSettings, SheetPage } from '../types/document';
import { loadImage } from './imageProcessing';

export interface CardLayoutItem {
  id: string;
  side: 'front' | 'back';
  imageUrl: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rounded: boolean;
  cutBorder: boolean;
  scalePercent: number;
}

/**
 * Calculates card placement on an A4 sheet based on layout settings
 */
export function calculateSheetCards(
  doc: DocumentItem | null,
  settings: PrintSettings,
  pageIndex: number,
  sheet: SheetPage
): CardLayoutItem[] {
  if (!doc) return [];

  const items: CardLayoutItem[] = [];
  const orientation = settings.paperOrientation;
  const isLandscape = orientation === 'landscape';
  const pageWidthMm = isLandscape ? 297 : 210;
  const pageHeightMm = isLandscape ? 210 : 297;

  // Determine standard card dimensions
  let baseWidthMm = 85.6;
  let baseHeightMm = 54.0;

  if (doc.setupType === 'a4_doc') {
    // A4 document scaled with margins
    baseWidthMm = 210 - settings.marginMm * 2;
    baseHeightMm = 297 - settings.marginMm * 2;
  }

  const frontData = doc.front;
  const backData = doc.back;

  // Calculate layout items based on layout mode
  const { layout, marginMm, gapMm, cutBorder, rounded } = settings;

  // Manual offsets if user dragged card
  const getOffset = (cardKey: string) => {
    return sheet.cardPositions?.[cardKey] || { xMm: 0, yMm: 0 };
  };

  if (doc.setupType === 'id_card') {
    const scale = (frontData?.printScale || 100) / 100;
    const cardW = baseWidthMm * scale;
    const cardH = baseHeightMm * scale;

    if (layout === 'front_above_back') {
      // Centered or left-aligned with margin
      const startX = marginMm > 0 ? marginMm : (pageWidthMm - cardW) / 2;
      let startY = marginMm > 0 ? marginMm : 15;

      if (frontData) {
        const offset = getOffset('front');
        items.push({
          id: 'front',
          side: 'front',
          imageUrl: frontData.croppedUrl || frontData.originalUrl,
          xMm: startX + offset.xMm,
          yMm: startY + offset.yMm,
          widthMm: cardW,
          heightMm: cardH,
          rounded,
          cutBorder,
          scalePercent: frontData.printScale,
        });
      }

      if (backData && doc.isDoubleSided) {
        const backY = startY + cardH + gapMm;
        const offset = getOffset('back');
        items.push({
          id: 'back',
          side: 'back',
          imageUrl: backData.croppedUrl || backData.originalUrl,
          xMm: startX + offset.xMm,
          yMm: backY + offset.yMm,
          widthMm: cardW,
          heightMm: cardH,
          rounded,
          cutBorder,
          scalePercent: backData.printScale,
        });
      }
    } else if (layout === 'side_by_side') {
      const startX = marginMm > 0 ? marginMm : (pageWidthMm - (cardW * 2 + gapMm)) / 2;
      const startY = marginMm > 0 ? marginMm : 20;

      if (frontData) {
        const offset = getOffset('front');
        items.push({
          id: 'front',
          side: 'front',
          imageUrl: frontData.croppedUrl || frontData.originalUrl,
          xMm: startX + offset.xMm,
          yMm: startY + offset.yMm,
          widthMm: cardW,
          heightMm: cardH,
          rounded,
          cutBorder,
          scalePercent: frontData.printScale,
        });
      }

      if (backData && doc.isDoubleSided) {
        const backX = startX + cardW + gapMm;
        const offset = getOffset('back');
        items.push({
          id: 'back',
          side: 'back',
          imageUrl: backData.croppedUrl || backData.originalUrl,
          xMm: backX + offset.xMm,
          yMm: startY + offset.yMm,
          widthMm: cardW,
          heightMm: cardH,
          rounded,
          cutBorder,
          scalePercent: backData.printScale,
        });
      }
    } else if (layout === 'front_only' && frontData) {
      const startX = marginMm > 0 ? marginMm : (pageWidthMm - cardW) / 2;
      const startY = marginMm > 0 ? marginMm : 20;
      const offset = getOffset('front');
      items.push({
        id: 'front',
        side: 'front',
        imageUrl: frontData.croppedUrl || frontData.originalUrl,
        xMm: startX + offset.xMm,
        yMm: startY + offset.yMm,
        widthMm: cardW,
        heightMm: cardH,
        rounded,
        cutBorder,
        scalePercent: frontData.printScale,
      });
    } else if (layout === 'back_only' && backData) {
      const startX = marginMm > 0 ? marginMm : (pageWidthMm - cardW) / 2;
      const startY = marginMm > 0 ? marginMm : 20;
      const offset = getOffset('back');
      items.push({
        id: 'back',
        side: 'back',
        imageUrl: backData.croppedUrl || backData.originalUrl,
        xMm: startX + offset.xMm,
        yMm: startY + offset.yMm,
        widthMm: cardW,
        heightMm: cardH,
        rounded,
        cutBorder,
        scalePercent: backData.printScale,
      });
    } else if (layout === 'grid_copies') {
      // Repeat copies across grid (e.g. 5 or 8 copies on single A4 sheet)
      const count = Math.max(1, Math.min(10, settings.copies));
      const cols = isLandscape ? 3 : 2;
      const activeCard = frontData || backData;

      if (activeCard) {
        for (let i = 0; i < count; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = marginMm + col * (cardW + gapMm);
          const y = marginMm + row * (cardH + gapMm);
          const key = `copy_${i}`;
          const offset = getOffset(key);

          items.push({
            id: key,
            side: 'front',
            imageUrl: activeCard.croppedUrl || activeCard.originalUrl,
            xMm: x + offset.xMm,
            yMm: y + offset.yMm,
            widthMm: cardW,
            heightMm: cardH,
            rounded,
            cutBorder,
            scalePercent: activeCard.printScale,
          });
        }
      }
    }
  } else if (doc.setupType === 'a4_doc') {
    // Full A4 document
    const activeDoc = pageIndex === 0 ? frontData : backData;
    if (activeDoc) {
      const offset = getOffset('a4');
      items.push({
        id: 'a4',
        side: pageIndex === 0 ? 'front' : 'back',
        imageUrl: activeDoc.croppedUrl || activeDoc.originalUrl,
        xMm: marginMm + offset.xMm,
        yMm: marginMm + offset.yMm,
        widthMm: pageWidthMm - marginMm * 2,
        heightMm: pageHeightMm - marginMm * 2,
        rounded: false,
        cutBorder,
        scalePercent: activeDoc.printScale,
      });
    }
  } else {
    // Custom size / Slip / Receipt
    const activeDoc = frontData || backData;
    if (activeDoc) {
      const cardW = 80;
      const cardH = 120;
      const offset = getOffset('custom');
      items.push({
        id: 'custom',
        side: 'front',
        imageUrl: activeDoc.croppedUrl || activeDoc.originalUrl,
        xMm: marginMm + offset.xMm,
        yMm: marginMm + offset.yMm,
        widthMm: cardW,
        heightMm: cardH,
        rounded,
        cutBorder,
        scalePercent: activeDoc.printScale,
      });
    }
  }

  return items;
}

/**
 * Downloads a high-resolution, millimeter-accurate PDF ready for printing on A4 paper
 */
export async function downloadDocumentPDF(
  doc: DocumentItem | null,
  settings: PrintSettings,
  sheets: SheetPage[]
): Promise<void> {
  if (!doc) {
    alert('Please upload or select a document first.');
    return;
  }

  const orientation = settings.paperOrientation === 'landscape' ? 'l' : 'p';
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const activeSheets = sheets.length > 0 ? sheets : [{ id: '1', pageNumber: 1 }];

  for (let sIdx = 0; sIdx < activeSheets.length; sIdx++) {
    if (sIdx > 0) {
      pdf.addPage('a4', orientation);
    }

    const cards = calculateSheetCards(doc, settings, sIdx, activeSheets[sIdx]);

    for (const card of cards) {
      try {
        const img = await loadImage(card.imageUrl);
        // Add card image to PDF
        pdf.addImage(img, 'JPEG', card.xMm, card.yMm, card.widthMm, card.heightMm, undefined, 'FAST');

        // Draw cutting border guide if enabled
        if (card.cutBorder) {
          pdf.setDrawColor(140, 140, 140);
          pdf.setLineWidth(0.25);
          pdf.setLineDashPattern([2, 1.5], 0);

          if (card.rounded) {
            // Draw rounded rectangle border with 3mm corner radius
            pdf.roundedRect(card.xMm, card.yMm, card.widthMm, card.heightMm, 3, 3, 'S');
          } else {
            pdf.rect(card.xMm, card.yMm, card.widthMm, card.heightMm, 'S');
          }

          // Reset dash pattern
          pdf.setLineDashPattern([], 0);
        }
      } catch (err) {
        console.error('Failed to add card image to PDF:', err);
      }
    }
  }

  const filename = `${doc.name.replace(/\s+/g, '_')}_A4_Print.pdf`;
  pdf.save(filename);
}

/**
 * Exports current A4 sheet as high-resolution 300 DPI JPEG image
 */
export async function saveSheetAsJPG(
  doc: DocumentItem | null,
  settings: PrintSettings,
  sheet: SheetPage,
  pageIndex: number
): Promise<void> {
  if (!doc) {
    alert('Please upload or select a document first.');
    return;
  }

  const isLandscape = settings.paperOrientation === 'landscape';
  const widthMm = isLandscape ? 297 : 210;
  const heightMm = isLandscape ? 210 : 297;

  // 300 DPI calculation: 1 mm = 11.811 pixels
  const dpiScale = 11.811;
  const canvasW = Math.round(widthMm * dpiScale);
  const canvasH = Math.round(heightMm * dpiScale);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Crisp white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const cards = calculateSheetCards(doc, settings, pageIndex, sheet);

  for (const card of cards) {
    try {
      const img = await loadImage(card.imageUrl);
      const xPx = card.xMm * dpiScale;
      const yPx = card.yMm * dpiScale;
      const wPx = card.widthMm * dpiScale;
      const hPx = card.heightMm * dpiScale;

      ctx.save();
      if (card.rounded) {
        const radiusPx = 3 * dpiScale;
        ctx.beginPath();
        ctx.roundRect(xPx, yPx, wPx, hPx, radiusPx);
        ctx.clip();
      }
      ctx.drawImage(img, xPx, yPx, wPx, hPx);
      ctx.restore();

      if (card.cutBorder) {
        ctx.save();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        if (card.rounded) {
          ctx.beginPath();
          ctx.roundRect(xPx, yPx, wPx, hPx, 3 * dpiScale);
          ctx.stroke();
        } else {
          ctx.strokeRect(xPx, yPx, wPx, hPx);
        }
        ctx.restore();
      }
    } catch (err) {
      console.error('Error rendering card to JPG canvas:', err);
    }
  }

  // Trigger download
  const dataUrl = canvas.toDataURL('image/jpeg', 0.96);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `A4_Page_${pageIndex + 1}_Print.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
