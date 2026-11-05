import React, { useState, useRef } from 'react';
import { DocumentItem, PrintSettings, SheetPage } from '../types/document';
import { calculateSheetCards, CardLayoutItem } from '../utils/pdfGenerator';
import { ZoomIn, ZoomOut, Maximize2, Download, Image as ImageIcon, Printer } from 'lucide-react';

interface PrintPreviewProps {
  document: DocumentItem | null;
  settings: PrintSettings;
  sheets: SheetPage[];
  currentSheetIndex: number;
  onUpdateCardOffset: (sheetId: string, cardKey: string, offset: { xMm: number; yMm: number }) => void;
  onDownloadPDF: () => void;
  onSaveJPG: () => void;
  onPrint: () => void;
  onSelectSide?: (side: 'front' | 'back') => void;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  document,
  settings,
  sheets,
  currentSheetIndex,
  onUpdateCardOffset,
  onDownloadPDF,
  onSaveJPG,
  onPrint,
  onSelectSide,
}) => {
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const currentSheet = sheets[currentSheetIndex] || { id: '1', pageNumber: 1 };

  const isLandscape = settings.paperOrientation === 'landscape';
  const paperWidthMm = isLandscape ? 297 : 210;
  const paperHeightMm = isLandscape ? 210 : 297;

  // Calculate cards to display on this page
  const cards = calculateSheetCards(document, settings, currentSheetIndex, currentSheet);

  // Dragging cards directly on sheet
  const draggingCardRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; initialOffset: { xMm: number; yMm: number } }>({
    clientX: 0,
    clientY: 0,
    initialOffset: { xMm: 0, yMm: 0 },
  });

  // Base display scale: Map 210mm to ~460px on normal screen
  const baseScale = 2.2; // 1mm = 2.2px at 100% zoom
  const currentScale = (baseScale * zoomPercent) / 100;

  const handleCardPointerDown = (cardKey: string, e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingCardRef.current = cardKey;

    const currentOffset = currentSheet.cardPositions?.[cardKey] || { xMm: 0, yMm: 0 };
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialOffset: { ...currentOffset },
    };
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    if (!draggingCardRef.current) return;
    const cardKey = draggingCardRef.current;
    const { clientX: startX, clientY: startY, initialOffset } = dragStartRef.current;

    const dxMm = (e.clientX - startX) / currentScale;
    const dyMm = (e.clientY - startY) / currentScale;

    onUpdateCardOffset(currentSheet.id, cardKey, {
      xMm: initialOffset.xMm + dxMm,
      yMm: initialOffset.yMm + dyMm,
    });
  };

  const handleCardPointerUp = (e: React.PointerEvent) => {
    if (draggingCardRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
      draggingCardRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/60 rounded-2xl border border-slate-200/80 p-5 shadow-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-600 font-bold text-xs flex items-center justify-center">
            02
          </span>
          <h2 className="text-sm font-bold text-slate-800">Print preview</h2>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500">
            A4 · {isLandscape ? '297 × 210 mm' : '210 × 297 mm'}
          </span>

          {/* Zoom controls */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-1.5 py-0.5 shadow-2xs">
            <button
              onClick={() => setZoomPercent((prev) => Math.max(50, prev - 10))}
              className="p-1 text-slate-500 hover:text-slate-800 text-xs font-bold"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-semibold text-slate-700 px-2 min-w-[42px] text-center font-mono">
              {zoomPercent}%
            </span>
            <button
              onClick={() => setZoomPercent((prev) => Math.min(180, prev + 10))}
              className="p-1 text-slate-500 hover:text-slate-800 text-xs font-bold"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3 bg-slate-200 mx-1" />
            <button
              onClick={() => setZoomPercent(100)}
              className="px-2 py-0.5 text-xs font-medium text-slate-600 hover:text-indigo-600"
            >
              Fit
            </button>
          </div>
        </div>
      </div>

      {/* Dotted Grid Canvas Area */}
      <div
        className="flex-1 my-4 rounded-xl overflow-auto flex items-center justify-center relative p-6 border border-slate-200/60 shadow-inner"
        style={{
          backgroundColor: '#f8fafc',
          backgroundImage: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)',
          backgroundSize: '20px 20px',
        }}
        onPointerMove={handleCardPointerMove}
        onPointerUp={handleCardPointerUp}
      >
        {/* A4 Paper Sheet Representation */}
        <div
          id="printable-a4-sheet"
          className="bg-white rounded-xs shadow-xl relative select-none transition-shadow border border-slate-200"
          style={{
            width: `${paperWidthMm * currentScale}px`,
            height: `${paperHeightMm * currentScale}px`,
            minWidth: `${paperWidthMm * currentScale}px`,
            minHeight: `${paperHeightMm * currentScale}px`,
          }}
        >
          {/* Watermark / Empty placeholder */}
          {cards.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 pointer-events-none select-none">
              <span className="text-5xl font-black tracking-widest text-slate-200">A4</span>
              <span className="text-xs text-slate-400 mt-2">
                Upload or click "Load Sample ID Card" to preview print layout
              </span>
            </div>
          )}

          {/* Cards rendered on A4 sheet */}
          {cards.map((card) => {
            const leftPx = card.xMm * currentScale;
            const topPx = card.yMm * currentScale;
            const widthPx = card.widthMm * currentScale;
            const heightPx = card.heightMm * currentScale;
            const borderRadiusPx = card.rounded ? 3 * currentScale : 0;

            return (
              <div
                key={card.id}
                onPointerDown={(e) => handleCardPointerDown(card.id, e)}
                onClick={() => onSelectSide && onSelectSide(card.side)}
                className="absolute cursor-move group hover:ring-2 hover:ring-indigo-500/70 transition-shadow"
                style={{
                  left: `${leftPx}px`,
                  top: `${topPx}px`,
                  width: `${widthPx}px`,
                  height: `${heightPx}px`,
                  borderRadius: `${borderRadiusPx}px`,
                }}
              >
                {/* Image */}
                <img
                  src={card.imageUrl}
                  alt={card.side}
                  className="w-full h-full object-cover pointer-events-none"
                  style={{
                    borderRadius: `${borderRadiusPx}px`,
                  }}
                />

                {/* Scissor cutting border guideline */}
                {card.cutBorder && (
                  <div
                    className="absolute inset-0 pointer-events-none border border-dashed border-slate-400"
                    style={{
                      borderRadius: `${borderRadiusPx}px`,
                    }}
                  />
                )}

                {/* Hover overlay hint */}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-[10px] text-white px-1.5 py-0.5 rounded backdrop-blur-xs font-mono pointer-events-none">
                  {card.side.toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-3">
          {/* Download PDF (All pages) */}
          <button
            type="button"
            onClick={onDownloadPDF}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-[0.99]"
          >
            <Download className="w-4 h-4" />
            <div className="flex flex-col items-start leading-tight">
              <span>Download PDF</span>
              <span className="text-[10px] font-normal opacity-80">All pages (100% scale)</span>
            </div>
          </button>

          {/* Save JPG (Current page) */}
          <button
            type="button"
            onClick={onSaveJPG}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm shadow-2xs transition-all cursor-pointer active:scale-[0.99]"
          >
            <ImageIcon className="w-4 h-4 text-slate-500" />
            <div className="flex flex-col items-start leading-tight">
              <span>Save JPG</span>
              <span className="text-[10px] font-normal text-slate-400">Current page (300 DPI)</span>
            </div>
          </button>

          {/* Print all pages */}
          <button
            type="button"
            onClick={onPrint}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm shadow-2xs transition-all cursor-pointer active:scale-[0.99]"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <div className="flex flex-col items-start leading-tight">
              <span>Print all pages</span>
              <span className="text-[10px] font-normal text-slate-400">Direct A4 Print</span>
            </div>
          </button>
        </div>

        {/* Footnote text matching the screenshot */}
        <p className="text-[11px] text-slate-400 text-center mt-1">
          Print on A4 at <strong className="text-slate-600">100% / Actual size</strong>, with headers and footers off. Double-sided ID cards are paired on the same sheet. A4 fronts/backs use consecutive pages.
        </p>
      </div>
    </div>
  );
};
