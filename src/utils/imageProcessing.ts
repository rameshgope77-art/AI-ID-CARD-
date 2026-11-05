import { CardSideData, CropBox, DocSetupType } from '../types/document';

/**
 * Loads an image from URL or data URL and returns HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Renders the cropped, rotated, and filtered image to a high-res canvas
 * and returns the Data URL (JPEG/PNG)
 */
export async function renderProcessedImage(sideData: CardSideData): Promise<string> {
  const img = await loadImage(sideData.originalUrl);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return sideData.originalUrl;

  const totalAngle = (sideData.rotation + sideData.fineRotation) * (Math.PI / 180);

  // Source bounding box on original image
  const crop = sideData.cropBox || { x: 0, y: 0, width: 1, height: 1 };
  const sx = Math.max(0, crop.x * img.naturalWidth);
  const sy = Math.max(0, crop.y * img.naturalHeight);
  const sw = Math.min(img.naturalWidth - sx, crop.width * img.naturalWidth);
  const sh = Math.min(img.naturalHeight - sy, crop.height * img.naturalHeight);

  // Intermediate canvas to hold the cropped region
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.max(1, Math.round(sw));
  cropCanvas.height = Math.max(1, Math.round(sh));
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) return sideData.originalUrl;

  cropCtx.drawImage(img, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height);

  // Now handle rotation
  const cos = Math.abs(Math.cos(totalAngle));
  const sin = Math.abs(Math.sin(totalAngle));
  const rotW = Math.round(cropCanvas.width * cos + cropCanvas.height * sin);
  const rotH = Math.round(cropCanvas.width * sin + cropCanvas.height * cos);

  canvas.width = Math.max(1, rotW);
  canvas.height = Math.max(1, rotH);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(totalAngle);
  ctx.drawImage(cropCanvas, -cropCanvas.width / 2, -cropCanvas.height / 2);
  ctx.restore();

  // Apply filters (Brightness, Contrast, Grayscale/Black & White, Detail)
  applyCanvasFilters(ctx, canvas.width, canvas.height, {
    brightness: sideData.brightness,
    contrast: sideData.contrast,
    isBW: sideData.isBW,
    isDetail: sideData.isDetail,
  });

  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Filter application with direct pixel manipulation for high quality text clarity
 */
function applyCanvasFilters(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opts: { brightness: number; contrast: number; isBW: boolean; isDetail: boolean }
) {
  const { brightness, contrast, isBW, isDetail } = opts;
  if (brightness === 100 && contrast === 100 && !isBW && !isDetail) return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Precompute contrast multiplier: factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
  // Where contrast is mapped to range -128 to 128 (100% -> 0)
  const cVal = ((contrast - 100) / 100) * 128;
  const factor = (259 * (cVal + 255)) / (255 * (259 - cVal) || 1);
  const bFactor = (brightness - 100) * 1.28; // brightness shift

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Brightness
    r += bFactor;
    g += bFactor;
    b += bFactor;

    // Contrast
    r = factor * (r - 128) + 128;
    g = factor * (g - 128) + 128;
    b = factor * (b - 128) + 128;

    // Black & white / Xerox doc mode
    if (isBW) {
      // High-clarity perceptual grayscale
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      // Slight S-curve for crisp black text on white paper
      const textBoost = gray > 140 ? Math.min(255, gray * 1.1) : Math.max(0, gray * 0.85);
      r = textBoost;
      g = textBoost;
      b = textBoost;
    }

    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  // If Detail is enabled, apply a subtle 3x3 unsharp mask / sharpen filter
  if (isDetail && width > 4 && height > 4) {
    sharpenImageData(imgData, width, height);
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * 3x3 Convolution Sharpen Kernel for crisp document text
 */
function sharpenImageData(imgData: ImageData, width: number, height: number) {
  const src = new Uint8ClampedArray(imgData.data);
  const dst = imgData.data;

  // Kernel:
  //  0  -0.5   0
  // -0.5  3.0 -0.5
  //  0  -0.5   0
  const centerWeight = 2.4;
  const sideWeight = -0.35;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const val =
          src[idx + c] * centerWeight +
          (src[((y - 1) * width + x) * 4 + c] +
            src[((y + 1) * width + x) * 4 + c] +
            src[(y * width + (x - 1)) * 4 + c] +
            src[(y * width + (x + 1)) * 4 + c]) *
            sideWeight;
        dst[idx + c] = Math.max(0, Math.min(255, val));
      }
    }
  }
}

/**
 * Calls backend Gemini AI endpoint to detect document bounding box
 */
export async function detectDocumentWithAI(
  imageBase64: string,
  docType: DocSetupType
): Promise<{ cropBox: CropBox; rotationAngle: number; detectedType: string }> {
  try {
    const res = await fetch('/api/ai-crop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, docType }),
    });

    if (!res.ok) {
      throw new Error(`AI API returned status ${res.status}`);
    }

    const data = await res.json();
    if (data.box) {
      const { ymin, xmin, ymax, xmax } = data.box;
      return {
        cropBox: {
          x: Math.max(0, xmin / 1000),
          y: Math.max(0, ymin / 1000),
          width: Math.min(1, (xmax - xmin) / 1000),
          height: Math.min(1, (ymax - ymin) / 1000),
        },
        rotationAngle: data.rotationAngle || 0,
        detectedType: data.detectedDocType || 'ID Card',
      };
    }
  } catch (err) {
    console.warn('Backend AI auto-crop failed, using client edge detector fallback:', err);
  }

  // Fast client-side fallback if backend error
  return clientSideEdgeDetection(imageBase64, docType);
}

/**
 * Client-side edge detection fallback using Sobel gradient and bounding box clustering
 */
export async function clientSideEdgeDetection(
  imageBase64: string,
  docType: DocSetupType
): Promise<{ cropBox: CropBox; rotationAngle: number; detectedType: string }> {
  const img = await loadImage(imageBase64);
  const sampleW = 200;
  const sampleH = Math.round((sampleW / img.naturalWidth) * img.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      cropBox: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
      rotationAngle: 0,
      detectedType: 'Document',
    };
  }

  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  // Find threshold for document paper vs background
  let minX = sampleW,
    minY = sampleH,
    maxX = 0,
    maxY = 0;
  const edgePoints: { x: number; y: number }[] = [];

  for (let y = 5; y < sampleH - 5; y++) {
    for (let x = 5; x < sampleW - 5; x++) {
      const idx = (y * sampleW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Check difference with adjacent pixels (gradient magnitude)
      const rRight = data[((y * sampleW) + (x + 1)) * 4];
      const lumRight = 0.299 * rRight + 0.587 * data[((y * sampleW) + (x + 1)) * 4 + 1] + 0.114 * data[((y * sampleW) + (x + 1)) * 4 + 2];
      const lumDown = 0.299 * data[(((y + 1) * sampleW) + x) * 4] + 0.587 * data[(((y + 1) * sampleW) + x) * 4 + 1] + 0.114 * data[(((y + 1) * sampleW) + x) * 4 + 2];

      const diff = Math.abs(lum - lumRight) + Math.abs(lum - lumDown);
      if (diff > 45) {
        edgePoints.push({ x, y });
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (edgePoints.length < 50 || maxX <= minX || maxY <= minY) {
    // Center crop with target aspect ratio
    const targetAspect = docType === 'id_card' ? 85.6 / 54 : 210 / 297;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let w = 0.88;
    let h = 0.88;
    if (imgAspect > targetAspect) {
      w = (0.88 * targetAspect) / imgAspect;
    } else {
      h = (0.88 * imgAspect) / targetAspect;
    }
    return {
      cropBox: {
        x: (1 - w) / 2,
        y: (1 - h) / 2,
        width: w,
        height: h,
      },
      rotationAngle: 0,
      detectedType: docType === 'id_card' ? 'ID Card' : 'Document',
    };
  }

  // Margin buffer
  const normMinX = Math.max(0, (minX - 4) / sampleW);
  const normMinY = Math.max(0, (minY - 4) / sampleH);
  const normMaxX = Math.min(1, (maxX + 4) / sampleW);
  const normMaxY = Math.min(1, (maxY + 4) / sampleH);

  return {
    cropBox: {
      x: normMinX,
      y: normMinY,
      width: Math.min(1 - normMinX, Math.max(0.2, normMaxX - normMinX)),
      height: Math.min(1 - normMinY, Math.max(0.2, normMaxY - normMinY)),
    },
    rotationAngle: 0,
    detectedType: docType === 'id_card' ? 'ID Card' : 'Document',
  };
}

/**
 * Creates realistic demo/sample ID cards (Front and Back) with photo, chip, barcode, and text
 * so users can test all features without having to search for a real ID card file!
 */
export function generateSampleIDCard(side: 'front' | 'back'): string {
  const canvas = document.createElement('canvas');
  // High res 85.6mm x 54mm equivalent (approx 1011 x 638 px @ 300dpi)
  canvas.width = 1011;
  canvas.height = 638;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background gradient: Soft tricolor / government card aura
  const grad = ctx.createLinearGradient(0, 0, 1011, 638);
  if (side === 'front') {
    grad.addColorStop(0, '#fef3c7'); // warm ivory
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, '#e0e7ff'); // subtle blue
  } else {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.7, '#f8fafc');
    grad.addColorStop(1, '#f1f5f9');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1011, 638);

  // Guilloche / micro-pattern lines
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.07)';
  ctx.lineWidth = 1;
  for (let i = -638; i < 1011 + 638; i += 18) {
    ctx.beginPath();
    ctx.arc(i, 319, 450, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Header band
  const headerGrad = ctx.createLinearGradient(0, 0, 1011, 0);
  headerGrad.addColorStop(0, '#ea580c'); // Saffron
  headerGrad.addColorStop(0.5, '#ffffff');
  headerGrad.addColorStop(1, '#16a34a'); // Green
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, 1011, 14);

  // Header Top Bar
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 14, 1011, 72);

  // Emblem circle
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(60, 50, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏛️', 60, 57);

  // Header Text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(side === 'front' ? 'GOVERNMENT OF INDIA / भारत सरकार' : 'UNIQUE IDENTIFICATION AUTHORITY', 105, 45);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(side === 'front' ? 'NATIONAL IDENTITY & RESIDENT CARD' : 'Help Line: 1947 | www.uidai.gov.in', 105, 68);

  if (side === 'front') {
    // Photo box
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(55, 120, 210, 260, 8);
    ctx.fill();
    ctx.stroke();

    // User portrait avatar
    const photoGrad = ctx.createLinearGradient(55, 120, 265, 380);
    photoGrad.addColorStop(0, '#cbd5e1');
    photoGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = photoGrad;
    ctx.beginPath();
    ctx.roundRect(65, 130, 190, 240, 6);
    ctx.fill();

    // Silhouette head & shoulders
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(160, 210, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(160, 330, 75, 55, 0, 0, Math.PI, true);
    ctx.fill();

    // Smart chip
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(55, 410, 90, 70, 6);
    ctx.fill();
    ctx.stroke();
    // Chip contact lines
    ctx.strokeStyle = '#b45309';
    ctx.strokeRect(70, 420, 60, 50);

    // Hologram seal
    const holoGrad = ctx.createRadialGradient(210, 445, 5, 210, 445, 35);
    holoGrad.addColorStop(0, '#fbcfe8');
    holoGrad.addColorStop(0.5, '#a7f3d0');
    holoGrad.addColorStop(1, '#93c5fd');
    ctx.fillStyle = holoGrad;
    ctx.beginPath();
    ctx.arc(210, 445, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VALID', 210, 450);

    // Text fields
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '14px sans-serif';
    ctx.fillText('NAME / नाम:', 305, 150);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('RAMESH GOPE', 305, 185);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px sans-serif';
    ctx.fillText('DOB / जन्म तिथि:', 305, 230);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('15/08/1994', 305, 258);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px sans-serif';
    ctx.fillText('GENDER / लिंग:', 560, 230);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('MALE / पुरुष', 560, 258);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px sans-serif';
    ctx.fillText('CARD NUMBER / पहचान पत्र संख्या:', 305, 315);
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 36px monospace';
    ctx.fillText('5489  7201  3392', 305, 360);

    // Slogan bottom
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 560, 1011, 78);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('मेरा आधार, मेरी पहचान · PROOF OF IDENTITY', 505, 608);
  } else {
    // BACK OF ID CARD
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '14px sans-serif';
    ctx.fillText('ADDRESS / पता:', 65, 135);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('S/O: Mohan Gope, House No. 42, Main Road,', 65, 170);
    ctx.fillText('Sector 4, Bokaro Steel City, Jharkhand - 827004', 65, 202);

    // QR Code Mock
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.fillRect(680, 120, 260, 260);
    ctx.strokeRect(680, 120, 260, 260);

    // QR code pattern
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(705, 145, 60, 60);
    ctx.fillRect(855, 145, 60, 60);
    ctx.fillRect(705, 295, 60, 60);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(720, 160, 30, 30);
    ctx.fillRect(870, 160, 30, 30);
    ctx.fillRect(720, 310, 30, 30);
    // Random QR dots
    ctx.fillStyle = '#0f172a';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if ((r * 7 + c * 13) % 3 === 0) {
          ctx.fillRect(780 + c * 8, 220 + r * 8, 6, 6);
        }
      }
    }

    // Barcode at bottom
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(65, 410, 580, 100);
    ctx.strokeStyle = '#000000';
    for (let x = 80; x < 620; x += (x % 5 === 0 ? 6 : 3)) {
      ctx.lineWidth = (x % 7 === 0) ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(x, 420);
      ctx.lineTo(x, 485);
      ctx.stroke();
    }
    ctx.fillStyle = '#000000';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('IND-ID-994820148-CR80', 350, 502);

    // Bottom strip
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 560, 1011, 78);
    ctx.fillStyle = '#475569';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('This card is valid throughout the territory of India. Please keep it safe.', 505, 608);
  }

  return canvas.toDataURL('image/jpeg', 0.95);
}
