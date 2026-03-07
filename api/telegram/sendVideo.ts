import { IncomingMessage, ServerResponse } from 'http';
import busboy from 'busboy';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const bb = busboy({ headers: req.headers });
  const fields: Record<string, string> = {};
  let videoFile: { path: string; name: string; mimetype: string } | null = null;

  return new Promise((resolve, reject) => {
    bb.on('file', (name, file, info) => {
      const { filename, mimeType } = info;
      const saveTo = path.join(os.tmpdir(), `upload-${Date.now()}-${filename}`);
      const writeStream = fs.createWriteStream(saveTo);
      file.pipe(writeStream);
      
      videoFile = {
        path: saveTo,
        name: filename,
        mimetype: mimeType
      };
    });

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('finish', async () => {
      const { chat_id, caption } = fields;
      const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;

      if (!botToken || !chat_id || !videoFile) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing required fields or bot token" }));
        resolve(null);
        return;
      }

      try {
        const formData = new FormData();
        formData.append("chat_id", chat_id);
        formData.append("caption", caption);
        
        const fileBuffer = fs.readFileSync(videoFile.path);
        const blob = new Blob([fileBuffer], { type: videoFile.mimetype });
        formData.append("video", blob, videoFile.name);

        const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
          method: "POST",
          body: formData,
        });

        const result = await telegramResponse.json();
        
        // Clean up
        if (fs.existsSync(videoFile.path)) {
          fs.unlinkSync(videoFile.path);
        }

        res.statusCode = telegramResponse.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
        resolve(null);
      } catch (error: any) {
        console.error("Telegram proxy error:", error);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: error.message }));
        resolve(null);
      }
    });

    bb.on('error', (err) => {
      console.error('Busboy error:', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal server error during upload' }));
      resolve(null);
    });

    req.pipe(bb);
  });
}
