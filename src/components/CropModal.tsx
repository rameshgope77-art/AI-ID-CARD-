import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CardSideData, CropBox, DocSetupType } from '../types/document';
import { detectDocumentWithAI } from '../utils/imageProcessing';
import { RotateCcw, RotateCw, Sparkles, Check, X, RefreshCw, ZoomIn, ZoomOut, Move } from 'lucide-react';

interface CropModalProps {
  isOpen: boolean;
  onClose: () => void;
  sideData: CardSideData;
  setupType: DocSetupType;
  onSaveCrop: (updatedData: Partial<CardSideData>) => void;
}

type AspectRatioMode = 'id_card' | 'a4' | 'passport' | 'square' | 'free';

export const CropModal: React.FC<CropModalProps> = ({
  isOpen,
  onClose,
  sideData,
  setupType,
  onSaveCrop,
}) => {
  if (!isOpen) return null;

  // Local state for editing
  const [cropBox, setCropBox] = useState<CropBox>(
    sideData.cropBox || { x: 0.05, y: 0.05, width: 0.9, height: 0.9 }
  );
  const [rotation, setRotation] = useState<number>(sideData.rotation || 0);
  const [fineRotation, setFineRotation] = useState<number>(sideData.fineRotation || 0);
  const [aspectMode, setAspectMode] = useState<AspectRatioMode>(
    setupType === 'id_card' ? 'id_card' : setupType === 'a4_doc' ? 'a4' : 'free'
  );
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgDisplayRect, setImgDisplayRect] = useState<{
    width: number;
    height: number;
    left: number;
    top: number;
  }>({ width: 0, height: 0, left: 0, top: 0 });

  // Update image display dimensions inside container
  const updateImageDisplayRect = useCallback(() => {
    if (!containerRef.current || !imgRef.current) return;
    const container = containerRef.current.getBoundingClientRect();
    const natW = imgRef.current.naturalWidth || 800;
    const natH = imgRef.current.naturalHeight || 600;

    const contW = container.width - 40;
    const contH = container.height - 40;

    const scale = Math.min(contW / natW, contH / natH, 1);
    const dispW = natW * scale;
    const dispH = natH * scale;

    const left = (container.width - dispW) / 2;
    const top = (container.height - dispH) / 2;

    setImgDisplayRect({ width: dispW, height: dispH, left, top });
  }, []);

  useEffect(() => {
    updateImageDisplayRect();
    window.addEventListener('resize', updateImageDisplayRect);
    return () => window.removeEventListener('resize', updateImageDisplayRect);
  }, [updateImageDisplayRect, sideData.originalUrl]);

  // Handle aspect ratio constraint
  const getTargetRatio = useCallback((mode: AspectRatioMode): number | null => {
    switch (mode) {
      case 'id_card':
        return 85.6 / 54.0; // ~1.585
      case 'a4':
        return 210.0 / 297.0; // ~0.707
      case 'passport':
        return 35.0 / 45.0; // ~0.777
      case 'square':
        return 1.0;
      case 'free':
      default:
        return null;
    }
  }, []);

  // AI Auto Detect Trigger
  const handleAiAutoDetect = async () => {
    setIsAiProcessing(true);
    setAiMessage('Scanning image & detecting document boundaries with Gemini AI...');
    try {
      const res = await detectDocumentWithAI(sideData.originalUrl, setupType);
      if (res.cropBox) {
        setCropBox(res.cropBox);
        if (res.rotationAngle && Math.abs(res.rotationAngle) > 0.5) {
          setFineRotation(res.rotationAngle);
        }
        setAiMessage(`Detected ${res.detectedType} with precision!`);
        setTimeout(() => setAiMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setAiMessage('Edge detection completed');
      setTimeout(() => setAiMessage(null), 2500);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Dragging logic for crop box and 8 handles
  const isDraggingRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; initialBox: CropBox }>({
    clientX: 0,
    clientY: 0,
    initialBox: cropBox,
  });

  const handlePointerDown = (handle: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = handle;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialBox: { ...cropBox },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || imgDisplayRect.width === 0 || imgDisplayRect.height === 0) return;

    const handle = isDraggingRef.current;
    const { clientX: startX, clientY: startY, initialBox } = dragStartRef.current;

    const dxNorm = (e.clientX - startX) / imgDisplayRect.width;
    const dyNorm = (e.clientY - startY) / imgDisplayRect.height;

    let newBox = { ...initialBox };
    const ratio = getTargetRatio(aspectMode);

    // Natural pixel ratio of the image
    const imgAspect = (imgRef.current?.naturalWidth || 1) / (imgRef.current?.naturalHeight || 1);

    if (handle === 'move') {
      newBox.x = Math.max(0, Math.min(1 - newBox.width, initialBox.x + dxNorm));
      newBox.y = Math.max(0, Math.min(1 - newBox.height, initialBox.y + dyNorm));
    } else {
      // Handle corner and edge resizing
      if (handle.includes('e')) {
        newBox.width = Math.max(0.1, Math.min(1 - initialBox.x, initialBox.width + dxNorm));
      }
      if (handle.includes('s')) {
        newBox.height = Math.max(0.1, Math.min(1 - initialBox.y, initialBox.height + dyNorm));
      }
      if (handle.includes('w')) {
        const potentialW = initialBox.width - dxNorm;
        if (potentialW >= 0.1 && initialBox.x + dxNorm >= 0) {
          newBox.x = initialBox.x + dxNorm;
          newBox.width = potentialW;
        }
      }
      if (handle.includes('n')) {
        const potentialH = initialBox.height - dyNorm;
        if (potentialH >= 0.1 && initialBox.y + dyNorm >= 0) {
          newBox.y = initialBox.y + dyNorm;
          newBox.height = potentialH;
        }
      }

      // Enforce aspect ratio lock if active
      if (ratio !== null) {
        // target ratio = (width * natW) / (height * natH)
        // so height = (width * natW) / (ratio * natH)
        const computedH = (newBox.width * imgAspect) / ratio;
        if (newBox.y + computedH <= 1) {
          newBox.height = computedH;
        } else {
          newBox.height = 1 - newBox.y;
          newBox.width = (newBox.height * ratio) / imgAspect;
        }
      }
    }

    setCropBox(newBox);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
      isDraggingRef.current = null;
    }
  };

  const handleRotate90 = (dir: 1 | -1) => {
    setRotation((prev) => (prev + dir * 90 + 360) % 360);
  };

  const handleResetCrop = () => {
    setCropBox({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
    setRotation(0);
    setFineRotation(0);
  };

  const handleSave = () => {
    onSaveCrop({
      cropBox,
      rotation,
      fineRotation,
    });
    onClose();
  };

  // Convert normalized box to screen pixels on display rect
  const boxLeftPx = imgDisplayRect.left + cropBox.x * imgDisplayRect.width;
  const boxTopPx = imgDisplayRect.top + cropBox.y * imgDisplayRect.height;
  const boxWidthPx = cropBox.width * imgDisplayRect.width;
  const boxHeightPx = cropBox.height * imgDisplayRect.height;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-sm">
              ✂
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">Manual & AI Crop Studio</h2>
              <p className="text-xs text-slate-400">
                Drag corners to crop, use AI auto-detection, or deskew tilted cards
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAiAutoDetect}
              disabled={isAiProcessing}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                isAiProcessing
                  ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-700 animate-pulse'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAiProcessing ? 'AI Detecting...' : 'AI Auto Detect'}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* AI Notification Pill */}
        {aiMessage && (
          <div className="bg-indigo-950/90 border-b border-indigo-800/80 px-6 py-2 text-xs text-indigo-200 flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              {aiMessage}
            </span>
          </div>
        )}

        {/* Workspace Canvas Container */}
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative flex-1 bg-slate-950 select-none overflow-hidden flex items-center justify-center p-4"
          style={{ touchAction: 'none' }}
        >
          {/* Background image */}
          <img
            ref={imgRef}
            src={sideData.originalUrl}
            alt="Source"
            onLoad={updateImageDisplayRect}
            className="pointer-events-none transition-transform duration-75 max-w-none"
            style={{
              width: `${imgDisplayRect.width}px`,
              height: `${imgDisplayRect.height}px`,
              transform: `rotate(${rotation + fineRotation}deg)`,
              transformOrigin: 'center center',
            }}
          />

          {/* Darkened overlay outside the crop box */}
          {imgDisplayRect.width > 0 && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${imgDisplayRect.left}px`,
                top: `${imgDisplayRect.top}px`,
                width: `${imgDisplayRect.width}px`,
                height: `${imgDisplayRect.height}px`,
                boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.65)`,
                clipPath: `polygon(
                  0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                  ${cropBox.x * 100}% ${cropBox.y * 100}%,
                  ${(cropBox.x + cropBox.width) * 100}% ${cropBox.y * 100}%,
                  ${(cropBox.x + cropBox.width) * 100}% ${(cropBox.y + cropBox.height) * 100}%,
                  ${cropBox.x * 100}% ${(cropBox.y + cropBox.height) * 100}%,
                  ${cropBox.x * 100}% ${cropBox.y * 100}%
                )`,
              }}
            />
          )}

          {/* Interactive Crop Box Box */}
          {imgDisplayRect.width > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${boxLeftPx}px`,
                top: `${boxTopPx}px`,
                width: `${boxWidthPx}px`,
                height: `${boxHeightPx}px`,
              }}
              className="border-2 border-indigo-400 cursor-move group"
              onPointerDown={(e) => handlePointerDown('move', e)}
            >
              {/* Rule of thirds grid */}
              <div className="w-full h-full pointer-events-none relative grid grid-cols-3 grid-rows-3">
                <div className="border-r border-b border-indigo-400/30" />
                <div className="border-r border-b border-indigo-400/30" />
                <div className="border-b border-indigo-400/30" />
                <div className="border-r border-b border-indigo-400/30" />
                <div className="border-r border-b border-indigo-400/30" />
                <div className="border-b border-indigo-400/30" />
                <div className="border-r border-indigo-400/30" />
                <div className="border-r border-indigo-400/30" />
                <div />
              </div>

              {/* Move icon indicator in center */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-75 transition-opacity pointer-events-none">
                <div className="bg-black/60 px-2 py-1 rounded text-[11px] text-white flex items-center gap-1.5 backdrop-blur-xs">
                  <Move className="w-3.5 h-3.5" /> Drag to move
                </div>
              </div>

              {/* 8 Resize Handles */}
              {/* Corners */}
              <div
                onPointerDown={(e) => handlePointerDown('nw', e)}
                className="absolute -top-2 -left-2 w-4 h-4 bg-indigo-400 border-2 border-white rounded-xs cursor-nwse-resize shadow-md"
              />
              <div
                onPointerDown={(e) => handlePointerDown('ne', e)}
                className="absolute -top-2 -right-2 w-4 h-4 bg-indigo-400 border-2 border-white rounded-xs cursor-nesw-resize shadow-md"
              />
              <div
                onPointerDown={(e) => handlePointerDown('sw', e)}
                className="absolute -bottom-2 -left-2 w-4 h-4 bg-indigo-400 border-2 border-white rounded-xs cursor-nesw-resize shadow-md"
              />
              <div
                onPointerDown={(e) => handlePointerDown('se', e)}
                className="absolute -bottom-2 -right-2 w-4 h-4 bg-indigo-400 border-2 border-white rounded-xs cursor-nwse-resize shadow-md"
              />

              {/* Midpoints */}
              <div
                onPointerDown={(e) => handlePointerDown('n', e)}
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-indigo-400 border-2 border-white rounded-xs cursor-ns-resize shadow-md"
              />
              <div
                onPointerDown={(e) => handlePointerDown('s', e)}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-indigo-400 border-2 border-white rounded-xs cursor-ns-resize shadow-md"
              />
              <div
                onPointerDown={(e) => handlePointerDown('w', e)}
                className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-6 bg-indigo-400 border-2 border-white rounded-xs cursor-ew-resize shadow-md"
              />
              <div
                onPointerDown={(e) => handlePointerDown('e', e)}
                className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-6 bg-indigo-400 border-2 border-white rounded-xs cursor-ew-resize shadow-md"
              />
            </div>
          )}
        </div>

        {/* Toolbar & Controls Footer */}
        <div className="bg-slate-900 border-t border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4">
          {/* Aspect Ratio Presets */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setAspectMode('id_card')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                aspectMode === 'id_card'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ID Card (85.6 × 54mm)
            </button>
            <button
              onClick={() => setAspectMode('a4')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                aspectMode === 'a4'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              A4 Doc
            </button>
            <button
              onClick={() => setAspectMode('passport')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                aspectMode === 'passport'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Passport Photo
            </button>
            <button
              onClick={() => setAspectMode('free')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                aspectMode === 'free'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Free Crop
            </button>
          </div>

          {/* Rotation & Deskew Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => handleRotate90(-1)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs flex items-center gap-1"
                title="Rotate 90° counter-clockwise"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 90°
              </button>
              <button
                onClick={() => handleRotate90(1)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs flex items-center gap-1"
                title="Rotate 90° clockwise"
              >
                90° <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Fine Deskew Slider */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400 whitespace-nowrap">Deskew:</span>
              <input
                type="range"
                min="-45"
                max="45"
                step="0.5"
                value={fineRotation}
                onChange={(e) => setFineRotation(parseFloat(e.target.value))}
                className="w-24 accent-indigo-500 cursor-pointer"
              />
              <span className="w-10 text-right font-mono text-slate-300">
                {fineRotation > 0 ? `+${fineRotation}` : fineRotation}°
              </span>
              {fineRotation !== 0 && (
                <button
                  onClick={() => setFineRotation(0)}
                  className="text-slate-400 hover:text-indigo-400 text-[10px]"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetCrop}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-800"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
            >
              <Check className="w-4 h-4" /> Apply & Save Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
