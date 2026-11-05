export type DocSetupType = 'id_card' | 'a4_doc' | 'custom_size';
export type DocumentSide = 'front' | 'back';
export type LayoutMode = 'front_above_back' | 'side_by_side' | 'front_only' | 'back_only' | 'grid_copies';
export type PaperOrientation = 'portrait' | 'landscape';

export interface CropBox {
  x: number; // 0 to 1
  y: number; // 0 to 1
  width: number; // 0 to 1
  height: number; // 0 to 1
}

export interface CardSideData {
  id: string;
  name: string;
  originalUrl: string;
  croppedUrl: string;
  cropBox: CropBox;
  rotation: number; // 0, 90, 180, 270 degrees
  fineRotation: number; // -45 to +45 deskew
  brightness: number; // 0 - 200, default 100
  contrast: number; // 0 - 200, default 100
  isBW: boolean;
  isDetail: boolean;
  printScale: number; // 50 to 150%, default 100
  naturalWidth: number;
  naturalHeight: number;
  detectedType?: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  setupType: DocSetupType;
  isDoubleSided: boolean;
  front: CardSideData | null;
  back: CardSideData | null;
}

export interface SheetPage {
  id: string;
  pageNumber: number;
  // Custom manual card offsets relative to calculated layout (in mm):
  cardPositions?: Record<string, { xMm: number; yMm: number }>;
}

export interface PrintSettings {
  layout: LayoutMode;
  copies: number;
  paperOrientation: PaperOrientation;
  marginMm: number;
  gapMm: number;
  cutBorder: boolean;
  rounded: boolean;
}
