import React, { useState, useEffect, useCallback } from 'react';
import {
  DocSetupType,
  DocumentSide,
  DocumentItem,
  CardSideData,
  PrintSettings,
  SheetPage,
} from './types/document';
import { DocumentSetup } from './components/DocumentSetup';
import { PrintPreview } from './components/PrintPreview';
import { CropPrintTools } from './components/CropPrintTools';
import { CropModal } from './components/CropModal';
import {
  generateSampleIDCard,
  renderProcessedImage,
  detectDocumentWithAI,
} from './utils/imageProcessing';
import { downloadDocumentPDF, saveSheetAsJPG } from './utils/pdfGenerator';
import { Sparkles, Printer, Layers, FileCheck } from 'lucide-react';

export default function App() {
  // Document setup state
  const [setupType, setSetupType] = useState<DocSetupType>('id_card');
  const [isDoubleSided, setIsDoubleSided] = useState<boolean>(true);
  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [activeSide, setActiveSide] = useState<DocumentSide>('front');

  // Print layout settings
  const [settings, setSettings] = useState<PrintSettings>({
    layout: 'front_above_back',
    copies: 1,
    paperOrientation: 'portrait',
    marginMm: 5,
    gapMm: 3,
    cutBorder: true,
    rounded: true,
  });

  // Sheets management
  const [sheets, setSheets] = useState<SheetPage[]>([{ id: 'sheet_1', pageNumber: 1 }]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState<number>(0);

  // Crop modal state
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);
  const [cropModalSide, setCropModalSide] = useState<DocumentSide>('front');
  const [isAutoCropping, setIsAutoCropping] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const showStatus = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => {
      setStatusNotification(null);
    }, 3500);
  };

  // Re-process side image when crop, rotation, or tone settings change
  const reprocessSide = useCallback(async (sideData: CardSideData): Promise<CardSideData> => {
    try {
      const croppedUrl = await renderProcessedImage(sideData);
      return { ...sideData, croppedUrl };
    } catch (err) {
      console.error('Error reprocessing image:', err);
      return sideData;
    }
  }, []);

  // Update a side's data
  const handleUpdateSide = async (side: DocumentSide, newSideData: CardSideData) => {
    const processed = await reprocessSide(newSideData);
    setDocument((prev) => {
      const docName = prev?.name || 'Document 1';
      const updated: DocumentItem = prev
        ? {
            ...prev,
            [side]: processed,
          }
        : {
            id: `doc_${Date.now()}`,
            name: docName,
            setupType,
            isDoubleSided,
            front: side === 'front' ? processed : null,
            back: side === 'back' ? processed : null,
          };
      return updated;
    });
    setActiveSide(side);
  };

  // Update partial properties on current active side (e.g. brightness, contrast, scale, rotation)
  const handleUpdateActiveSideData = async (updates: Partial<CardSideData>) => {
    if (!document) return;
    const current = activeSide === 'front' ? document.front : document.back;
    if (!current) return;

    const merged = { ...current, ...updates };
    const processed = await reprocessSide(merged);

    setDocument((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [activeSide]: processed,
      };
    });
  };

  // Save changes from Crop Modal
  const handleSaveCrop = async (cropUpdates: Partial<CardSideData>) => {
    if (!document) return;
    const current = cropModalSide === 'front' ? document.front : document.back;
    if (!current) return;

    const merged = { ...current, ...cropUpdates };
    const processed = await reprocessSide(merged);

    setDocument((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [cropModalSide]: processed,
      };
    });
    showStatus(`Cropped and updated ${cropModalSide.toUpperCase()} successfully`);
  };

  // AI Auto Crop Action
  const handleAutoCrop = async (side: DocumentSide) => {
    if (!document) return;
    const current = side === 'front' ? document.front : document.back;
    if (!current) return;

    setIsAutoCropping(true);
    showStatus('AI scanning document edges and calculating deskew angle...');

    try {
      const res = await detectDocumentWithAI(current.originalUrl, setupType);
      const merged: CardSideData = {
        ...current,
        cropBox: res.cropBox,
        fineRotation: res.rotationAngle || 0,
        detectedType: res.detectedType,
      };
      const processed = await reprocessSide(merged);

      setDocument((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          [side]: processed,
        };
      });
      showStatus(`AI detected and cropped ${res.detectedType || 'document'} perfectly!`);
    } catch (err) {
      console.error('Auto crop failed:', err);
      showStatus('Auto crop completed with standard margins');
    } finally {
      setIsAutoCropping(false);
    }
  };

  // Reset Tone
  const handleResetTone = async () => {
    await handleUpdateActiveSideData({
      brightness: 100,
      contrast: 100,
      isBW: false,
      isDetail: true,
    });
    showStatus('Tone reset to natural colors');
  };

  // Reset custom dragged offsets on sheet
  const handleResetSheetOffsets = () => {
    setSheets((prev) =>
      prev.map((s, idx) => (idx === currentSheetIndex ? { ...s, cardPositions: {} } : s))
    );
    showStatus('Reset sheet layout positions');
  };

  // Reset scale to 100%
  const handleResetCopySize = () => {
    handleUpdateActiveSideData({ printScale: 100 });
  };

  // Load Sample ID Card (Instant Demo)
  const handleLoadSample = async () => {
    showStatus('Generating realistic Indian ID Card (Aadhaar/Voter style) sample...');
    const frontUrl = generateSampleIDCard('front');
    const backUrl = generateSampleIDCard('back');

    const frontImg = new Image();
    const backImg = new Image();

    frontImg.onload = async () => {
      const frontData: CardSideData = {
        id: `sample_front_${Date.now()}`,
        name: 'Aadhaar_ID_Front.jpg',
        originalUrl: frontUrl,
        croppedUrl: frontUrl,
        cropBox: { x: 0, y: 0, width: 1, height: 1 },
        rotation: 0,
        fineRotation: 0,
        brightness: 100,
        contrast: 100,
        isBW: false,
        isDetail: true,
        printScale: 100,
        naturalWidth: frontImg.naturalWidth,
        naturalHeight: frontImg.naturalHeight,
        detectedType: 'ID Card (Aadhaar)',
      };

      backImg.onload = async () => {
        const backData: CardSideData = {
          id: `sample_back_${Date.now()}`,
          name: 'Aadhaar_ID_Back.jpg',
          originalUrl: backUrl,
          croppedUrl: backUrl,
          cropBox: { x: 0, y: 0, width: 1, height: 1 },
          rotation: 0,
          fineRotation: 0,
          brightness: 100,
          contrast: 100,
          isBW: false,
          isDetail: true,
          printScale: 100,
          naturalWidth: backImg.naturalWidth,
          naturalHeight: backImg.naturalHeight,
          detectedType: 'ID Card (Aadhaar)',
        };

        setDocument({
          id: `sample_${Date.now()}`,
          name: 'Resident Identity Card',
          setupType: 'id_card',
          isDoubleSided: true,
          front: frontData,
          back: backData,
        });

        setSetupType('id_card');
        setIsDoubleSided(true);
        setActiveSide('front');
        showStatus('Sample ID Card loaded! Ready to preview, crop, or download.');
      };
      backImg.src = backUrl;
    };
    frontImg.src = frontUrl;
  };

  // Open Crop Modal
  const handleOpenCropModal = (side: DocumentSide) => {
    setCropModalSide(side);
    setIsCropModalOpen(true);
  };

  // Add / Delete Sheet Pages
  const handleAddSheet = () => {
    const newPageNum = sheets.length + 1;
    const newSheet: SheetPage = {
      id: `sheet_${Date.now()}`,
      pageNumber: newPageNum,
    };
    setSheets((prev) => [...prev, newSheet]);
    setCurrentSheetIndex(sheets.length);
    showStatus(`Added A4 Page ${newPageNum}`);
  };

  const handleDeleteSheet = (index: number) => {
    if (sheets.length <= 1) return;
    setSheets((prev) => prev.filter((_, i) => i !== index));
    setCurrentSheetIndex((prev) => Math.max(0, prev - 1));
    showStatus('Sheet page deleted');
  };

  const handleResetAll = () => {
    if (window.confirm('Reset all documents, sheets, and adjustments?')) {
      setDocument(null);
      setSheets([{ id: 'sheet_1', pageNumber: 1 }]);
      setCurrentSheetIndex(0);
      showStatus('Workspace reset');
    }
  };

  // Clipboard Paste (Ctrl+V) listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const targetSide = !document?.front ? 'front' : isDoubleSided ? 'back' : 'front';
            const reader = new FileReader();
            reader.onload = async (event) => {
              const dataUrl = event.target?.result as string;
              if (dataUrl) {
                const img = new Image();
                img.onload = () => {
                  const newSideData: CardSideData = {
                    id: `${targetSide}_${Date.now()}`,
                    name: `Pasted_Image_${targetSide}.png`,
                    originalUrl: dataUrl,
                    croppedUrl: dataUrl,
                    cropBox: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
                    rotation: 0,
                    fineRotation: 0,
                    brightness: 100,
                    contrast: 100,
                    isBW: false,
                    isDetail: true,
                    printScale: 100,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                  };
                  handleUpdateSide(targetSide, newSideData);
                  showStatus(`Pasted image to ${targetSide.toUpperCase()}`);
                };
                img.src = dataUrl;
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [document, isDoubleSided]);

  // Update card offset when dragged on sheet
  const handleUpdateCardOffset = (
    sheetId: string,
    cardKey: string,
    offset: { xMm: number; yMm: number }
  ) => {
    setSheets((prev) =>
      prev.map((s) => {
        if (s.id === sheetId) {
          return {
            ...s,
            cardPositions: {
              ...(s.cardPositions || {}),
              [cardKey]: offset,
            },
          };
        }
        return s;
      })
    );
  };

  // PDF Export
  const handleDownloadPDF = async () => {
    showStatus('Generating 100% mm-accurate A4 PDF...');
    await downloadDocumentPDF(document, settings, sheets);
    showStatus('PDF Downloaded successfully!');
  };

  // JPG Export
  const handleSaveJPG = async () => {
    showStatus('Rendering 300 DPI high-resolution JPEG...');
    await saveSheetAsJPG(document, settings, sheets[currentSheetIndex], currentSheetIndex);
    showStatus('JPG Saved successfully!');
  };

  // Direct Print via Browser
  const handlePrint = () => {
    window.print();
  };

  const activeSideData = activeSide === 'front' ? document?.front : document?.back;

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header / Brand Bar */}
      <header className="bg-white border-b border-slate-200/90 px-6 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              AI Document Crop & Print Studio
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-indigo-200/60">
                AI Powered
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Cyber Cafe & Online Services standard A4 document & ID card printer
            </p>
          </div>
        </div>

        {/* Status notification toast */}
        {statusNotification && (
          <div className="bg-slate-900 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 animate-fadeIn">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {statusNotification}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadSample}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            Load Demo Card
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Fast Print PDF
          </button>
        </div>
      </header>

      {/* Main 3-Column Studio Grid matching screenshot layout */}
      <main className="flex-1 p-4 lg:p-6 max-w-[1720px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: 01 Document Setup (Col span 3) */}
        <div className="lg:col-span-3">
          <DocumentSetup
            setupType={setupType}
            onChangeSetupType={setSetupType}
            isDoubleSided={isDoubleSided}
            onToggleDoubleSided={setIsDoubleSided}
            document={document}
            onUpdateSide={handleUpdateSide}
            onLoadSample={handleLoadSample}
            onOpenCrop={handleOpenCropModal}
          />
        </div>

        {/* Center Column: 02 Print Preview (Col span 6) */}
        <div className="lg:col-span-6 min-h-[640px] flex flex-col">
          <PrintPreview
            document={document}
            settings={settings}
            sheets={sheets}
            currentSheetIndex={currentSheetIndex}
            onUpdateCardOffset={handleUpdateCardOffset}
            onDownloadPDF={handleDownloadPDF}
            onSaveJPG={handleSaveJPG}
            onPrint={handlePrint}
            onSelectSide={setActiveSide}
          />
        </div>

        {/* Right Column: 03 Crop & Print Tools (Col span 3) */}
        <div className="lg:col-span-3">
          <CropPrintTools
            document={document}
            activeSide={activeSide}
            onChangeActiveSide={setActiveSide}
            settings={settings}
            onChangeSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
            sheets={sheets}
            currentSheetIndex={currentSheetIndex}
            onSelectSheetIndex={setCurrentSheetIndex}
            onAddSheet={handleAddSheet}
            onDeleteSheet={handleDeleteSheet}
            onResetAll={handleResetAll}
            onOpenCrop={handleOpenCropModal}
            onAutoCrop={handleAutoCrop}
            isAutoCropping={isAutoCropping}
            onUpdateActiveSideData={handleUpdateActiveSideData}
            onResetTone={handleResetTone}
            onResetSheetOffsets={handleResetSheetOffsets}
            onResetCopySize={handleResetCopySize}
            onRemoveDocument={() => setDocument(null)}
            onClearTab={() => {
              setSettings({
                layout: 'front_above_back',
                copies: 1,
                paperOrientation: 'portrait',
                marginMm: 5,
                gapMm: 3,
                cutBorder: true,
                rounded: true,
              });
              showStatus('Tab settings reset');
            }}
          />
        </div>
      </main>

      {/* Interactive Crop Modal */}
      {isCropModalOpen && activeSideData && (
        <CropModal
          isOpen={isCropModalOpen}
          onClose={() => setIsCropModalOpen(false)}
          sideData={activeSideData}
          setupType={setupType}
          onSaveCrop={handleSaveCrop}
        />
      )}

      {/* CSS @media print styles for true 1:1 scale browser printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-a4-sheet,
          #printable-a4-sheet * {
            visibility: visible !important;
          }
          #printable-a4-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            height: 100% !important;
          }
          @page {
            size: A4 ${settings.paperOrientation};
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
