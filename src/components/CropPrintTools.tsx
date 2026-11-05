import React from 'react';
import {
  DocumentItem,
  DocumentSide,
  PrintSettings,
  SheetPage,
  CardSideData,
  LayoutMode,
  PaperOrientation,
} from '../types/document';
import {
  Scissors,
  Sparkles,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface CropPrintToolsProps {
  document: DocumentItem | null;
  activeSide: DocumentSide;
  onChangeActiveSide: (side: DocumentSide) => void;
  settings: PrintSettings;
  onChangeSettings: (settings: Partial<PrintSettings>) => void;
  sheets: SheetPage[];
  currentSheetIndex: number;
  onSelectSheetIndex: (index: number) => void;
  onAddSheet: () => void;
  onDeleteSheet: (index: number) => void;
  onResetAll: () => void;
  onOpenCrop: (side: DocumentSide) => void;
  onAutoCrop: (side: DocumentSide) => void;
  isAutoCropping: boolean;
  onUpdateActiveSideData: (updates: Partial<CardSideData>) => void;
  onResetTone: () => void;
  onResetSheetOffsets: () => void;
  onResetCopySize: () => void;
  onRemoveDocument: () => void;
  onClearTab: () => void;
}

export const CropPrintTools: React.FC<CropPrintToolsProps> = ({
  document,
  activeSide,
  onChangeActiveSide,
  settings,
  onChangeSettings,
  sheets,
  currentSheetIndex,
  onSelectSheetIndex,
  onAddSheet,
  onDeleteSheet,
  onResetAll,
  onOpenCrop,
  onAutoCrop,
  isAutoCropping,
  onUpdateActiveSideData,
  onResetTone,
  onResetSheetOffsets,
  onResetCopySize,
  onRemoveDocument,
  onClearTab,
}) => {
  const currentSideData = activeSide === 'front' ? document?.front : document?.back;

  const handleRotate = (dir: 1 | -1) => {
    if (!currentSideData) return;
    const currentRot = currentSideData.rotation || 0;
    const newRot = (currentRot + dir * 90 + 360) % 360;
    onUpdateActiveSideData({ rotation: newRot });
  };

  const handleScaleChange = (delta: number) => {
    if (!currentSideData) return;
    const currentScale = currentSideData.printScale || 100;
    const newScale = Math.max(50, Math.min(150, currentScale + delta));
    onUpdateActiveSideData({ printScale: newScale });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col gap-5 text-slate-800 text-xs">
      {/* 03 Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <span className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-600 font-bold text-xs flex items-center justify-center">
          03
        </span>
        <h2 className="text-sm font-bold text-slate-800">Crop & print tools</h2>
      </div>

      {/* Sheets Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Sheets</span>
            <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full text-[10px]">
              {sheets.length} {sheets.length === 1 ? 'page' : 'pages'}
            </span>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <button
              disabled={currentSheetIndex <= 0}
              onClick={() => onSelectSheetIndex(currentSheetIndex - 1)}
              className="p-1 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-medium min-w-[70px] text-center">
              {sheets.length === 0
                ? 'No page yet'
                : `Page ${currentSheetIndex + 1} of ${sheets.length}`}
            </span>
            <button
              disabled={currentSheetIndex >= sheets.length - 1}
              onClick={() => onSelectSheetIndex(currentSheetIndex + 1)}
              className="p-1 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Sheets action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onAddSheet}
            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-700 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3 text-indigo-600" /> + Page
          </button>
          <button
            type="button"
            disabled={sheets.length <= 1}
            onClick={() => onDeleteSheet(currentSheetIndex)}
            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-700 transition-colors disabled:opacity-40 cursor-pointer"
          >
            Delete page
          </button>
          <button
            type="button"
            onClick={onResetAll}
            className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-700 transition-colors cursor-pointer"
          >
            Reset all
          </button>
        </div>
      </div>

      {/* Select document and Side tabs */}
      <div className="flex items-center gap-2">
        <select className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 text-xs focus:ring-1 focus:ring-indigo-500">
          <option>{document ? document.name : 'Select document'}</option>
        </select>

        <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => onChangeActiveSide('front')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              activeSide === 'front'
                ? 'bg-white text-indigo-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Front
          </button>
          <button
            type="button"
            disabled={!document?.isDoubleSided}
            onClick={() => onChangeActiveSide('back')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              activeSide === 'back'
                ? 'bg-white text-indigo-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            } disabled:opacity-40`}
          >
            Back
          </button>
        </div>
      </div>

      {/* Action Tools Grid */}
      <div className="flex flex-col gap-2">
        {/* Row 1: Crop | Auto crop | Reset tone */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!currentSideData}
            onClick={() => onOpenCrop(activeSide)}
            className="flex items-center justify-center gap-1.5 py-2 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-semibold text-slate-700 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5 text-indigo-600" />
            <span>Crop</span>
          </button>

          <button
            type="button"
            disabled={!currentSideData || isAutoCropping}
            onClick={() => onAutoCrop(activeSide)}
            className="flex items-center justify-center gap-1.5 py-2 px-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl font-semibold transition-all disabled:opacity-40 cursor-pointer"
            title="Detect corners and crop automatically with AI"
          >
            <Sparkles className={`w-3.5 h-3.5 text-indigo-600 ${isAutoCropping ? 'animate-spin' : ''}`} />
            <span>{isAutoCropping ? 'Cropping...' : 'Auto crop'}</span>
          </button>

          <button
            type="button"
            disabled={!currentSideData}
            onClick={onResetTone}
            className="py-2 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-700 transition-all disabled:opacity-40 cursor-pointer"
          >
            Reset tone
          </button>
        </div>

        {/* Row 2: Rotate Left | Rotate Right | Reset sheet */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!currentSideData}
            onClick={() => handleRotate(-1)}
            className="flex items-center justify-center gap-1 py-2 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-700 transition-all disabled:opacity-40 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>Rotate</span>
          </button>

          <button
            type="button"
            disabled={!currentSideData}
            onClick={() => handleRotate(1)}
            className="flex items-center justify-center gap-1 py-2 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-700 transition-all disabled:opacity-40 cursor-pointer"
          >
            <span>Rotate</span>
            <RotateCw className="w-3 h-3 text-slate-500" />
          </button>

          <button
            type="button"
            onClick={onResetSheetOffsets}
            className="py-2 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-700 transition-all cursor-pointer"
          >
            Reset sheet
          </button>
        </div>
      </div>

      {/* Print size */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700">Print size</span>
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg px-1 py-0.5">
            <button
              type="button"
              disabled={!currentSideData}
              onClick={() => handleScaleChange(-2)}
              className="px-1 text-slate-600 hover:text-slate-900 font-bold"
            >
              -
            </button>
            <span className="font-mono px-2 text-slate-800 font-semibold min-w-[42px] text-center">
              {currentSideData?.printScale || 100}%
            </span>
            <button
              type="button"
              disabled={!currentSideData}
              onClick={() => handleScaleChange(2)}
              className="px-1 text-slate-600 hover:text-slate-900 font-bold"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Drag to position</span>
          <button
            type="button"
            onClick={onResetCopySize}
            className="hover:text-indigo-600 font-medium cursor-pointer"
          >
            Reset copy
          </button>
        </div>
      </div>

      {/* Image adjustments */}
      <div className="flex flex-col gap-2.5 pt-1 border-t border-slate-100">
        <span className="font-semibold text-slate-700">Image adjustments</span>

        {/* Checkboxes: Detail & Black & white */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={currentSideData?.isDetail ?? true}
              onChange={(e) => onUpdateActiveSideData({ isDetail: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 accent-indigo-600"
            />
            <span>Detail</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={currentSideData?.isBW ?? false}
              onChange={(e) => onUpdateActiveSideData({ isBW: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 accent-indigo-600"
            />
            <span>Black & white</span>
          </label>
        </div>

        {/* Brightness slider */}
        <div className="flex items-center gap-2">
          <span className="w-16 text-slate-600">Brightness</span>
          <input
            type="range"
            min="50"
            max="150"
            value={currentSideData?.brightness ?? 100}
            onChange={(e) => onUpdateActiveSideData({ brightness: parseInt(e.target.value, 10) })}
            className="flex-1 accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <span className="w-10 text-right font-mono text-slate-500">
            {currentSideData?.brightness ?? 100}%
          </span>
        </div>

        {/* Contrast slider */}
        <div className="flex items-center gap-2">
          <span className="w-16 text-slate-600">Contrast</span>
          <input
            type="range"
            min="50"
            max="150"
            value={currentSideData?.contrast ?? 100}
            onChange={(e) => onUpdateActiveSideData({ contrast: parseInt(e.target.value, 10) })}
            className="flex-1 accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <span className="w-10 text-right font-mono text-slate-500">
            {currentSideData?.contrast ?? 100}%
          </span>
        </div>
      </div>

      {/* Copies & paper */}
      <div className="flex flex-col gap-2.5 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700">Copies & paper</span>
          <span className="text-[10px] text-slate-400 font-mono">85.6 × 54 mm</span>
        </div>

        {/* Layout dropdown */}
        <div className="flex items-center gap-2">
          <span className="w-12 text-slate-600">Layout</span>
          <select
            value={settings.layout}
            onChange={(e) => onChangeSettings({ layout: e.target.value as LayoutMode })}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 text-xs focus:ring-1 focus:ring-indigo-500"
          >
            <option value="front_above_back">Front above back</option>
            <option value="side_by_side">Side by side</option>
            <option value="front_only">Front only</option>
            <option value="back_only">Back only</option>
            <option value="grid_copies">Multiple copies (5x / 8x Grid)</option>
          </select>
        </div>

        {/* Copies & Paper Row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600">Copies</span>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.copies}
              onChange={(e) => onChangeSettings({ copies: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              className="w-16 bg-white border border-slate-200 rounded-xl px-2 py-1 font-mono text-center"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-600">Paper</span>
            <select
              value={settings.paperOrientation}
              onChange={(e) => onChangeSettings({ paperOrientation: e.target.value as PaperOrientation })}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-2 py-1 font-medium"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
        </div>

        {/* Margin & Gap Row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 whitespace-nowrap">Margin (mm)</span>
            <input
              type="number"
              min="0"
              max="50"
              value={settings.marginMm}
              onChange={(e) => onChangeSettings({ marginMm: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className="w-14 bg-white border border-slate-200 rounded-xl px-2 py-1 font-mono text-center"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 whitespace-nowrap">Gap (mm)</span>
            <input
              type="number"
              min="0"
              max="50"
              value={settings.gapMm}
              onChange={(e) => onChangeSettings({ gapMm: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className="w-14 bg-white border border-slate-200 rounded-xl px-2 py-1 font-mono text-center"
            />
          </div>
        </div>

        {/* Checkboxes: Cut border & Rounded */}
        <div className="flex items-center gap-4 mt-1">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={settings.cutBorder}
              onChange={(e) => onChangeSettings({ cutBorder: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 accent-indigo-600"
            />
            <span>Cut border</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={settings.rounded}
              onChange={(e) => onChangeSettings({ rounded: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 accent-indigo-600"
            />
            <span>Rounded</span>
          </label>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
        <button
          type="button"
          onClick={onRemoveDocument}
          className="text-red-500 hover:text-red-700 font-medium cursor-pointer"
        >
          Remove document
        </button>

        <button
          type="button"
          onClick={onClearTab}
          className="text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
        >
          Clear tab
        </button>
      </div>
    </div>
  );
};
