import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase body limit to handle high-resolution uploaded certificate images (base64)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini client lazily to avoid crashing if API key is not yet set up
let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to retry on 503 errors
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 1500): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const errorMessage = error?.message?.toLowerCase() || '';
      const isRetryable = errorMessage.includes('503') || errorMessage.includes('high demand') || errorMessage.includes('unavailable');
      
      if (isRetryable && attempt <= maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`Gemini API Error (High Demand). Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// ------------------ API ENDPOINTS ------------------

app.get("/api/config", (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || "" });
});

// 1. Generate certificate background using Gemini Lite Image model
app.post("/api/generate-background", async (req, res) => {
  try {
    const { prompt, style } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required." });
      return;
    }

    const ai = getAI();
    const finalPrompt = `An elegant, high-quality professional certificate template background. Theme: ${prompt}. Visual style: ${style}. Landscape format. MUST be entirely empty of text, placeholder lines, and signature lines in the center. Only borders, background colors, patterns, and decorative elements should be present, leaving ample empty space in the middle to place custom text.`;

    const response = await withRetry(() => ai.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt: finalPrompt,
      config: {
        aspectRatio: "4:3",
        numberOfImages: 1
      },
    }));

    const base64Image = response.generatedImages?.[0]?.image?.imageBytes;

    if (!base64Image) {
      res.status(500).json({ error: "Failed to retrieve generated image from Gemini." });
      return;
    }

    res.json({
      imageUrl: `data:image/jpeg;base64,${base64Image}`,
    });
  } catch (error: any) {
    console.error("Error generating background:", error);
    res.status(500).json({ error: error.message || "An error occurred during image generation." });
  }
});

// 1b. Generate badge/hologram using Gemini Lite Image model
app.post("/api/generate-badge", async (req, res) => {
  try {
    const { prompt, style } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required." });
      return;
    }

    const ai = getAI();
    const finalPrompt = `A high-quality, professional, transparent-looking seal, badge, or 3D hologram for a certificate. Theme: ${prompt}. Visual style: ${style}. The design should be centered, circular or emblem-shaped, and act as an official stamp. The background should be completely white or solid so it can be extracted, but ideally a clean emblem.`;

    const response = await withRetry(() => ai.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt: finalPrompt,
      config: {
        aspectRatio: "1:1",
        numberOfImages: 1
      },
    }));

    const base64Image = response.generatedImages?.[0]?.image?.imageBytes;

    if (!base64Image) {
      res.status(500).json({ error: "Failed to retrieve generated badge from Gemini." });
      return;
    }

    res.json({
      imageUrl: `data:image/jpeg;base64,${base64Image}`,
    });
  } catch (error: any) {
    console.error("Error generating badge:", error);
    res.status(500).json({ error: error.message || "An error occurred during badge generation." });
  }
});

// 2. Generate professional certificate copy using Gemini
app.post("/api/generate-text", async (req, res) => {
  try {
    const { topic, host, hours, date, tone } = req.body;
    if (!topic || !host) {
      res.status(400).json({ error: "Topic and Host are required." });
      return;
    }

    const ai = getAI();
    const prompt = `Generate formal, highly elegant text content for a workshop certificate.
    Workshop Details:
    - Topic: ${topic}
    - Host/Issuer: ${host}
    ${hours ? `- Duration/Hours: ${hours}` : ""}
    ${date ? `- Date: ${date}` : ""}
    - Desired Tone: ${tone || "Classic Formal"}
    
    Make the copywriting beautifully structured, inspiring, and polished. Return structured JSON matching the requested schema.`;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            header: {
              type: Type.STRING,
              description: "Elegant certificate title, e.g. 'CERTIFICATE OF COMPLETION' or 'CERTIFICATE OF ACHIEVEMENT'",
            },
            subHeader: {
              type: Type.STRING,
              description: "Presentation line, e.g. 'This is proudly presented to' or 'This certifies that'",
            },
            workshopName: {
              type: Type.STRING,
              description: "Polished workshop topic title",
            },
            achievementText: {
              type: Type.STRING,
              description: "A description of achievement, e.g., 'for active participation and successful completion of the intensive technical training workshop'",
            },
            hoursText: {
              type: Type.STRING,
              description: "Text describing the hours completed, or empty if none.",
            },
            issuerName: {
              type: Type.STRING,
              description: "Refined name of the host or organization issuing the certificate",
            },
            dateText: {
              type: Type.STRING,
              description: "Formatted date string",
            },
          },
          required: ["header", "subHeader", "workshopName", "achievementText", "issuerName", "dateText"],
        },
      },
    }));

    const text = response.text;
    if (!text) {
      res.status(500).json({ error: "Failed to generate certificate copy." });
      return;
    }

    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Error generating text:", error);
    res.status(500).json({ error: error.message || "An error occurred during text generation." });
  }
});

// 3. Analyze uploaded certificate image using Gemini vision to replicate layout
app.post("/api/analyze-certificate", async (req, res) => {
  try {
    const { imageBase64 } = req.body; // base64 string including header or raw
    if (!imageBase64) {
      res.status(400).json({ error: "Image base64 data is required." });
      return;
    }

    // Strip out standard base64 data url header if present
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const ai = getAI();
    const prompt = `You are a professional designer analyzing a certificate template image.
    Your job is to identify all the text fields, signatures, and placeholders, and determine their layout coordinates as percentages of the image dimensions.
    
    For each field you detect, determine:
    1. A unique ID (e.g. 'header', 'recipient_name', 'workshop_title', 'date', 'issuer_name', 'signature_1').
    2. A readable display label (e.g., 'Certificate Title', 'Recipient Name', 'Workshop Name', 'Date', 'Issuer / Signatures').
    3. The actual text string currently displayed at that location.
    4. Its horizontal center position 'x' (from 0 to 100, where 0 is left and 100 is right).
    5. Its vertical center position 'y' (from 0 to 100, where 0 is top and 100 is bottom).
    6. Suggested design attributes like: fontSize in pixels (relative to a 800px wide canvas), color (hex format, e.g., '#1e293b'), text alignment ('center', 'left', 'right').
    7. Whether this field is a dynamic placeholder that changes per recipient (e.g. 'recipient_name' is true; fixed labels or titles are false).
    8. A placeholderKey if dynamic (e.g. 'recipientName', 'workshopTitle', 'date').
    
    Make your coordinate estimates as accurate as possible so we can draw our text boxes exactly on top of the certificate!
    Return your analysis as structured JSON matching the provided schema.`;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "image/png",
            data: cleanBase64,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fields: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  text: { type: Type.STRING },
                  x: { type: Type.NUMBER, description: "Horizontal center position as a percentage from 0 to 100" },
                  y: { type: Type.NUMBER, description: "Vertical position as a percentage from 0 to 100" },
                  fontSize: { type: Type.NUMBER, description: "Suggested font size in pixels (e.g. 24 for names, 14 for descriptions)" },
                  color: { type: Type.STRING, description: "Estimated color hex code, e.g. '#2d3748'" },
                  alignment: { type: Type.STRING, description: "Alignment: 'center', 'left', or 'right'" },
                  isDynamic: { type: Type.BOOLEAN, description: "True if this field changes per recipient (like name)" },
                  placeholderKey: { type: Type.STRING, description: "Corresponding merge key, e.g. 'recipientName', 'workshopTitle', 'date' or null" },
                },
                required: ["id", "name", "text", "x", "y", "fontSize", "color", "alignment", "isDynamic"],
              },
            },
          },
          required: ["fields"],
        },
      },
    }));

    const text = response.text;
    if (!text) {
      res.status(500).json({ error: "Failed to analyze certificate image." });
      return;
    }

    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Error analyzing certificate:", error);
    res.status(500).json({ error: error.message || "An error occurred during certificate analysis." });
  }
});

// ------------------ FRONTEND SERVING ------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer();
