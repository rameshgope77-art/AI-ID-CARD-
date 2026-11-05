import React, { useRef } from 'react';
import { DocSetupType, DocumentItem, CardSideData } from '../types/document';
import { CreditCard, FileText, Scissors, Upload, Check, Wand2 } from 'lucide-react';
import { generateSampleIDCard, detectDocumentWithAI } from '../utils/imageProcessing';

interface DocumentSetupProps {
  setupType: DocSetupType;
  onChangeSetupType: (type: DocSetupType) => void;
  isDoubleSided: boolean;
  onToggleDoubleSided: (val: boolean) => void;
  document: DocumentItem | null;
  onUpdateSide: (side: 'front' | 'back', sideData: CardSideData) => void;
  onLoadSample: () => void;
  onOpenCrop: (side: 'front' | 'back') => void;
}

export const DocumentSetup: React.FC<DocumentSetupProps> = ({
  setupType,
  onChangeSetupType,
  isDoubleSided,
  onToggleDoubleSided,
  document,
  onUpdateSide,
  onLoadSample,
  onOpenCrop,
}) => {
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File, side: 'front' | 'back') => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = async () => {
        // Trigger fast AI detection for initial auto crop box
        const detected = await detectDocumentWithAI(dataUrl, setupType);

        const newSideData: CardSideData = {
          id: `${side}_${Date.now()}`,
          name: file.name,
          originalUrl: dataUrl,
          croppedUrl: dataUrl,
          cropBox: detected.cropBox || { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
          rotation: 0,
          fineRotation: detected.rotationAngle || 0,
          brightness: 100,
          contrast: 100,
          isBW: false,
          isDetail: true,
          printScale: 100,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          detectedType: detected.detectedType,
        };

        onUpdateSide(side, newSideData);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent, side: 'front' | 'back') => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0], side);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col gap-6">
      {/* 01 Document Setup */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 tracking-tight mb-3">
          Document setup
        </h2>

        {/* 3 Preset Option Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* ID Card */}
          <button
            type="button"
            onClick={() => onChangeSetupType('id_card')}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
              setupType === 'id_card'
                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-xs ring-1 ring-indigo-500'
                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${
                setupType === 'id_card' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold leading-tight">ID Card</span>
            <span className="text-[10px] text-slate-400 mt-0.5">85.6 × 54 mm</span>
          </button>

          {/* A4 Document */}
          <button
            type="button"
            onClick={() => onChangeSetupType('a4_doc')}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
              setupType === 'a4_doc'
                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-xs ring-1 ring-indigo-500'
                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${
                setupType === 'a4_doc' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold leading-tight">A4 Document</span>
            <span className="text-[10px] text-slate-400 mt-0.5">210 × 297 mm</span>
          </button>

          {/* Custom Size */}
          <button
            type="button"
            onClick={() => onChangeSetupType('custom_size')}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
              setupType === 'custom_size'
                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-xs ring-1 ring-indigo-500'
                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${
                setupType === 'custom_size' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Scissors className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold leading-tight">Custom Size</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Slips & receipts</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-2.5">
          Manual crop & layout stay in your browser
        </p>
      </div>

      {/* Add Documents Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800">Add documents</h2>

          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-600 select-none">
            <input
              type="checkbox"
              checked={isDoubleSided}
              onChange={(e) => onToggleDoubleSided(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 accent-indigo-600"
            />
            <span>Double side</span>
          </label>
        </div>

        {/* Upload boxes */}
        <div className="grid grid-cols-2 gap-3">
          {/* Upload Front Box */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'front')}
            onClick={() => frontInputRef.current?.click()}
            className={`relative rounded-xl border-2 border-dashed transition-all p-4 flex flex-col items-center justify-center text-center cursor-pointer min-h-[148px] ${
              document?.front
                ? 'border-indigo-300 bg-indigo-50/30'
                : 'border-indigo-200/90 bg-indigo-50/20 hover:bg-indigo-50/40 hover:border-indigo-400'
            }`}
          >
            <input
              ref={frontInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) processFile(e.target.files[0], 'front');
              }}
            />

            {document?.front ? (
              <div className="w-full flex flex-col items-center">
                <img
                  src={document.front.croppedUrl || document.front.originalUrl}
                  alt="Front Preview"
                  className="w-24 h-16 object-cover rounded shadow-xs border border-indigo-200 mb-2"
                />
                <span className="text-xs font-semibold text-slate-800 truncate max-w-full">
                  Front Loaded
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCrop('front');
                  }}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium mt-1 flex items-center gap-1"
                >
                  <Scissors className="w-3 h-3" /> Edit Crop
                </button>
              </div>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-indigo-600">Upload front</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Browse or drop image</span>
              </>
            )}
          </div>

          {/* Upload Back Box */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              if (isDoubleSided) handleDrop(e, 'back');
            }}
            onClick={() => {
              if (isDoubleSided) backInputRef.current?.click();
            }}
            className={`relative rounded-xl border-2 border-dashed transition-all p-4 flex flex-col items-center justify-center text-center ${
              !isDoubleSided
                ? 'opacity-40 pointer-events-none border-slate-200 bg-slate-50'
                : document?.back
                ? 'border-indigo-300 bg-indigo-50/30 cursor-pointer'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 cursor-pointer'
            } min-h-[148px]`}
          >
            <input
              ref={backInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) processFile(e.target.files[0], 'back');
              }}
            />

            {document?.back ? (
              <div className="w-full flex flex-col items-center">
                <img
                  src={document.back.croppedUrl || document.back.originalUrl}
                  alt="Back Preview"
                  className="w-24 h-16 object-cover rounded shadow-xs border border-indigo-200 mb-2"
                />
                <span className="text-xs font-semibold text-slate-800 truncate max-w-full">
                  Back Loaded
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCrop('back');
                  }}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium mt-1 flex items-center gap-1"
                >
                  <Scissors className="w-3 h-3" /> Edit Crop
                </button>
              </div>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-slate-200/80 text-slate-600 flex items-center justify-center mb-2">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-700">Upload back</span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  {document?.front ? 'Browse or drop back' : 'Add front first'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Demo / One-Click sample button */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
          <button
            type="button"
            onClick={onLoadSample}
            className="w-full py-2 px-3 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
            Load Sample ID Card (Instant Demo)
          </button>
          <p className="text-[10px] text-slate-400 text-center">
            Pasting (Ctrl+V) from clipboard is also supported!
          </p>
        </div>
      </div>
    </div>
  );
};
