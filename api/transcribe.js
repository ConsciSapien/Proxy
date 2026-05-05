// api/transcribe.js
// Vercel serverless function — proxies audio to OpenAI Whisper
// Your API key stays here, never exposed to the browser

import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

export const config = {
  api: { bodyParser: false }, // required for file uploads
};

export default async function handler(req, res) {
  // Allow CORS from your GitHub Pages site
  res.setHeader('Access-Control-Allow-Origin', 'https://conscisapien.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Parse the incoming audio file
    const form = formidable({ keepExtensions: true });
    const [fields, files] = await form.parse(req);

    const audioFile = files.file?.[0];
    const language = fields.language?.[0] || 'en';

    if (!audioFile) return res.status(400).json({ error: 'No audio file received' });

    // Forward to OpenAI Whisper
    const fd = new FormData();
    fd.append('file', fs.createReadStream(audioFile.filepath), {
      filename: 'audio.webm',
      contentType: 'audio/webm',
    });
    fd.append('model', 'whisper-1');
    fd.append('language', language);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, // ← stored securely in Vercel env
        ...fd.getHeaders(),
      },
      body: fd,
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Whisper API error', detail: err });
    }

    const data = await response.json();
    return res.status(200).json({ text: data.text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
