// api/upload.js
// Vercel serverless function — uploads files to Google Drive

import formidable from 'formidable';
import fs from 'fs';
import { google } from 'googleapis';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://conscisapien.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Parse the incoming file
    const form = formidable({ keepExtensions: true });
    const [fields, files] = await form.parse(req);

    const uploadedFile = files.file?.[0];
    const fileName = fields.fileName?.[0] || 'upload';
    const mimeType = fields.mimeType?.[0] || 'application/octet-stream';

    if (!uploadedFile) return res.status(400).json({ error: 'No file received' });

    // Parse service account from env
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    // Authenticate with Google
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Upload file to Drive
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: mimeType,
        body: fs.createReadStream(uploadedFile.filepath),
      },
      fields: 'id, webViewLink',
    });

    const fileId = response.data.id;
    const fileLink = response.data.webViewLink;

    // Make file viewable by anyone with link
    await drive.permissions.create({
      fileId: fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    return res.status(200).json({ success: true, fileId, fileLink });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
