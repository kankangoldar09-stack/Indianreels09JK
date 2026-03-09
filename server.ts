import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ dest: "uploads/" });

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", botTokenSet: !!botToken, chatIdSet: !!chatId });
  });

  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.VITE_TELEGRAM_CHAT_ID;

  // API route for Telegram proxy - Send Video
  app.post("/api/telegram/sendVideo", upload.single("video"), async (req, res) => {
    const { chat_id, caption } = req.body;
    const videoFile = req.file;

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

  // API route for Telegram proxy - Upload Image (Profile/Media)
  app.post("/api/telegram/upload", upload.single("file"), async (req, res) => {
    const file = req.file;
    const targetChatId = req.body.chat_id || chatId;

    if (!botToken || !targetChatId || !file) {
      return res.status(400).json({ error: "Missing required fields or bot token" });
    }

    try {
      const formData = new FormData();
      formData.append("chat_id", targetChatId);
      
      const fileBuffer = fs.readFileSync(file.path);
      const blob = new Blob([fileBuffer], { type: file.mimetype });
      
      const isVideo = file.mimetype.startsWith("video/");
      const endpoint = isVideo ? "sendVideo" : "sendPhoto";
      const fieldName = isVideo ? "video" : "photo";
      
      formData.append(fieldName, blob, file.originalname);

      const response = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      fs.unlinkSync(file.path);

      if (!response.ok) {
        return res.status(response.status).json(result);
      }

      // Get file path for the uploaded file to construct a proxy URL
      const fileId = isVideo ? result.result.video.file_id : result.result.photo[result.result.photo.length - 1].file_id;
      
      const getFileResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      const getFileData = await getFileResponse.json();

      if (!getFileResponse.ok) {
        return res.status(getFileResponse.status).json(getFileData);
      }

      const filePath = getFileData.result.file_path;
      // Return a URL that points to our local proxy
      const publicUrl = `/api/telegram/file/${filePath}`;

      res.json({ 
        success: true, 
        url: publicUrl,
        file_id: fileId,
        telegram_result: result 
      });
    } catch (error: any) {
      console.error("Telegram upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy route to serve Telegram files without exposing bot token
  app.get("/api/telegram/file/*", async (req, res) => {
    const filePath = req.params[0];
    if (!botToken || !filePath) {
      return res.status(400).send("Missing file path or bot token");
    }

    try {
      const telegramUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
      const response = await fetch(telegramUrl);

      if (!response.ok) {
        return res.status(response.status).send("Failed to fetch file from Telegram");
      }

      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error("Telegram file proxy error:", error);
      res.status(500).send(error.message);
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
