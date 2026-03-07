import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ dest: "uploads/" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for Telegram proxy
  app.post("/api/telegram/sendVideo", upload.single("video"), async (req, res) => {
    const { chat_id, caption } = req.body;
    const videoFile = req.file;
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;

    if (!botToken || !chat_id || !videoFile) {
      return res.status(400).json({ error: "Missing required fields or bot token" });
    }

    try {
      const formData = new FormData();
      formData.append("chat_id", chat_id);
      formData.append("caption", caption);
      
      const fileBuffer = fs.readFileSync(videoFile.path);
      const blob = new Blob([fileBuffer], { type: videoFile.mimetype });
      formData.append("video", blob, videoFile.originalname);

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      
      // Clean up uploaded file
      fs.unlinkSync(videoFile.path);

      if (!response.ok) {
        return res.status(response.status).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error("Telegram proxy error:", error);
      res.status(500).json({ error: error.message });
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
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
