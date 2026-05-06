// api/transcribe.js
// Vercel serverless function — proxies audio to Groq Whisper (free)

import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

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
    const form = formidable({ keepExtensions: true });
    const [fields, files] = await form.parse(req);

    const audioFile = files.file?.[0];
    const language = fields.language?.[0] || 'en';

    if (!audioFile) return res.status(400).json({ error: 'No audio file received' });

    const fd = new FormData();
    fd.append('file', fs.createReadStream(audioFile.filepath), {
      filename: 'audio.webm',
      contentType: 'audio/webm',
    });
    fd.append('model', 'whisper-large-v3');
    fd.append('language', language);
    fd.append('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        ...fd.getHeaders(),
      },
      body: fd,
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Groq API error', detail: err });
    }

    const data = await response.json();
    return res.status(200).json({ text: data.text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
