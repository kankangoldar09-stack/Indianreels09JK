import { Handler, HandlerResponse } from "@netlify/functions";
import Busboy from "busboy";

export const handler: Handler = async (event): Promise<HandlerResponse> => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { statusCode: 500, body: JSON.stringify({ error: "Telegram bot token not configured" }) };
  }

  return new Promise<HandlerResponse>((resolve) => {
    const busboy = Busboy({ headers: event.headers as any });
    const fields: any = {};
    let videoFile: { data: Buffer; filename: string; mimetype: string } | null = null;

    busboy.on("field", (fieldname, val) => {
      fields[fieldname] = val;
    });

    busboy.on("file", (fieldname, file, info) => {
      const { filename, mimeType } = info;
      const chunks: Buffer[] = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => {
        if (fieldname === "video") {
          videoFile = {
            data: Buffer.concat(chunks),
            filename,
            mimetype: mimeType,
          };
        }
      });
    });

    busboy.on("finish", async () => {
      if (!videoFile || !fields.chat_id) {
        resolve({
          statusCode: 400,
          body: JSON.stringify({ error: "Missing video file or chat_id" }),
        });
        return;
      }

      try {
        const formData = new FormData();
        formData.append("chat_id", fields.chat_id);
        if (fields.caption) formData.append("caption", fields.caption);
        
        const blob = new Blob([videoFile.data], { type: videoFile.mimetype });
        formData.append("video", blob, videoFile.filename);

        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();
        resolve({
          statusCode: response.status,
          body: JSON.stringify(result),
        });
      } catch (error: any) {
        console.error("Telegram function error:", error);
        resolve({
          statusCode: 500,
          body: JSON.stringify({ error: error.message }),
        });
      }
    });

    busboy.on("error", (err: any) => {
      resolve({
        statusCode: 500,
        body: JSON.stringify({ error: err.message || String(err) }),
      });
    });

    const body = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64")
      : Buffer.from(event.body || "");
    
    busboy.end(body);
  });
};
