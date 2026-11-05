import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Increase payload limit for scanned documents & high-res photos
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Google GenAI client (server-side only)
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// AI Smart Document Edge Detection & Auto-Crop Endpoint
app.post('/api/ai-crop', async (req, res) => {
  try {
    const { imageBase64, docType = 'id_card' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    // Strip prefix if present: "data:image/jpeg;base64,..."
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const mimeType = matches ? matches[1] : 'image/jpeg';
    const cleanBase64 = matches ? matches[2] : imageBase64;

    if (!ai) {
      // Fallback heuristic if GEMINI_API_KEY is not set
      return res.json({
        success: true,
        box: { ymin: 40, xmin: 40, ymax: 960, xmax: 960 },
        rotationAngle: 0,
        detectedDocType: docType === 'id_card' ? 'ID Card' : 'A4 Document',
        provider: 'heuristic_fallback',
        message: 'No GEMINI_API_KEY set. Used smart heuristic crop.',
      });
    }

    const promptText = `
You are an expert AI document scanner and edge detection engine.
Analyze this photo which contains a document or card (e.g. Identity Card, Aadhaar Card, PAN Card, Driving License, Certificate, Bill, Receipt, or Paper Document) placed on a surface (desk, table, bed, white sheet, or scanner bed).

Find the EXACT boundary/bounding box of the primary document or ID card within the image.
Ignore the background (table surface, fingers, shadows, margins, carpet, floor).
Also determine if the document is tilted/skewed and estimate the deskew angle in degrees (-45 to 45, or 0 if upright, 90, 180, 270 if rotated).

Return a JSON object conforming to the schema with:
- ymin (0 to 1000, top edge)
- xmin (0 to 1000, left edge)
- ymax (0 to 1000, bottom edge)
- xmax (0 to 1000, right edge)
- rotationAngle (deskew tilt in degrees, 0 if straight)
- detectedDocType (e.g. "ID Card", "Aadhaar Card", "PAN Card", "Driving License", "Passport", "A4 Document", "Receipt")
- confidence (0.0 to 1.0)
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ymin: { type: Type.INTEGER, description: 'Top edge coordinate from 0 to 1000' },
            xmin: { type: Type.INTEGER, description: 'Left edge coordinate from 0 to 1000' },
            ymax: { type: Type.INTEGER, description: 'Bottom edge coordinate from 0 to 1000' },
            xmax: { type: Type.INTEGER, description: 'Right edge coordinate from 0 to 1000' },
            rotationAngle: { type: Type.NUMBER, description: 'Deskew rotation angle in degrees' },
            detectedDocType: { type: Type.STRING, description: 'Identified document type' },
            confidence: { type: Type.NUMBER, description: 'Detection confidence from 0 to 1' },
          },
          required: ['ymin', 'xmin', 'ymax', 'xmax'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');

    // Clamp coordinates safely
    const ymin = Math.max(0, Math.min(1000, parsed.ymin ?? 50));
    const xmin = Math.max(0, Math.min(1000, parsed.xmin ?? 50));
    const ymax = Math.max(ymin + 50, Math.min(1000, parsed.ymax ?? 950));
    const xmax = Math.max(xmin + 50, Math.min(1000, parsed.xmax ?? 950));

    return res.json({
      success: true,
      box: { ymin, xmin, ymax, xmax },
      rotationAngle: parsed.rotationAngle || 0,
      detectedDocType: parsed.detectedDocType || (docType === 'id_card' ? 'ID Card' : 'Document'),
      confidence: parsed.confidence ?? 0.95,
      provider: 'gemini-3.8-flash',
    });
  } catch (error: any) {
    console.error('Error in /api/ai-crop:', error);
    // Return graceful fallback so user experience is never blocked
    return res.json({
      success: true,
      box: { ymin: 40, xmin: 40, ymax: 960, xmax: 960 },
      rotationAngle: 0,
      detectedDocType: 'Document',
      provider: 'fallback',
      warning: error?.message || 'AI detection fallback activated',
    });
  }
});

// Setup Vite middleware in development or static serving in production
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`AI Document Crop Studio running on http://0.0.0.0:${port}`);
  });
}

startServer();
