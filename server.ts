import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini Setup
  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Routes
  app.post("/api/ai/outreach-plan", async (req, res) => {
    try {
      const { eventTitle, category, description } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create a detailed outreach and logistics plan for a church event titled "${eventTitle}" under the category "${category}". Description: ${description}. Include volunteer roles, target audience, and key preparation steps.`,
      });
      res.json({ plan: response.text });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate plan" });
    }
  });

  app.post("/api/ai/event-description", async (req, res) => {
    try {
      const { title, details } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Write a compelling and professional church event description for "${title}" based on these details: ${details}. Keep it inspiring and clear.`,
      });
      res.json({ description: response.text });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate description" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
