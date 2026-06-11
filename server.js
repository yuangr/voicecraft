import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { synthesizeSpeech, fetchVoices } from './server/edge-tts.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Gemini API configuration (supports custom proxy like NewAPI)
const GEMINI_BASE_URL = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const GEMINI_STT_MODEL = process.env.GEMINI_STT_MODEL || 'gemini-2.5-flash';

// Configure Multer for in-memory file uploads (max 25MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Wraps raw PCM audio data in a WAV container (RIFF header).
 * Gemini TTS returns raw Linear16 PCM which browsers cannot play directly.
 * @param {Buffer} pcmData - Raw PCM audio bytes
 * @param {number} sampleRate - Sample rate in Hz (e.g. 24000)
 * @param {number} numChannels - Number of channels (1 = mono, 2 = stereo)
 * @param {number} bitsPerSample - Bits per sample (typically 16)
 * @returns {Buffer} Complete WAV file buffer
 */
function wrapPcmInWav(pcmData, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF chunk descriptor
  buffer.write('RIFF', 0);                          // ChunkID
  buffer.writeUInt32LE(36 + dataSize, 4);            // ChunkSize
  buffer.write('WAVE', 8);                           // Format

  // "fmt " sub-chunk
  buffer.write('fmt ', 12);                          // Subchunk1ID
  buffer.writeUInt32LE(16, 16);                      // Subchunk1Size (PCM = 16)
  buffer.writeUInt16LE(1, 20);                       // AudioFormat (PCM = 1)
  buffer.writeUInt16LE(numChannels, 22);             // NumChannels
  buffer.writeUInt32LE(sampleRate, 24);              // SampleRate
  buffer.writeUInt32LE(byteRate, 28);                // ByteRate
  buffer.writeUInt16LE(blockAlign, 32);              // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);           // BitsPerSample

  // "data" sub-chunk
  buffer.write('data', 36);                          // Subchunk2ID
  buffer.writeUInt32LE(dataSize, 40);                // Subchunk2Size

  // Copy PCM data
  pcmData.copy(buffer, headerSize);
  return buffer;
}

// Cache voices in-memory to prevent multiple remote API calls
let cachedVoices = null;

// Route: Get voices list
app.get('/api/voices', async (req, res) => {
  try {
    const voices = await fetchVoices();
    res.json(voices);
  } catch (error) {
    console.error('Error fetching voices:', error);
    res.status(500).json({ error: 'Failed to fetch voices list from Edge TTS.' });
  }
});

// Route: Text to Speech (TTS)
app.post('/api/tts', async (req, res) => {
  const { text, voice, speed, pitch, provider } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text content is required' });
  }

  const selectedProvider = provider || 'edge';

  try {
    if (selectedProvider === 'edge') {
      const audioBuffer = await synthesizeSpeech(text, voice, speed, pitch);
      res.set('Content-Type', 'audio/mpeg');
      res.send(audioBuffer);
    } else if (selectedProvider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'Gemini API Key is not configured on the server. Please configure GEMINI_API_KEY in your .env file.' });
      }

      // Call Gemini TTS dedicated model for Audio generation
      const url = `${GEMINI_BASE_URL}/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{
          parts: [{
            text: text
          }]
        }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice || 'Puck'
              }
            }
          }
        }
      };

      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!geminiRes.ok) {
        const errorData = await geminiRes.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Gemini API returned status ${geminiRes.status}`);
      }

      const data = await geminiRes.json();
      const part = data.candidates?.[0]?.content?.parts?.[0];
      if (part && part.inlineData) {
        const rawBuffer = Buffer.from(part.inlineData.data, 'base64');
        const mimeType = part.inlineData.mimeType || 'audio/L16';
        console.log(`Gemini TTS returned mimeType: ${mimeType}, raw size: ${rawBuffer.length} bytes`);

        // Gemini TTS returns raw PCM Linear16 at 24kHz mono.
        // Browsers cannot play raw PCM, so we wrap it in a WAV container.
        const wavBuffer = wrapPcmInWav(rawBuffer, 24000, 1, 16);
        res.set('Content-Type', 'audio/wav');
        res.send(wavBuffer);
      } else {
        throw new Error('Gemini API did not return audio data in the expected format.');
      }
    } else {
      res.status(400).json({ error: 'Unsupported TTS provider' });
    }
  } catch (error) {
    console.error('TTS synthesis error:', error);
    res.status(500).json({ error: error.message || 'Error occurred during TTS synthesis.' });
  }
});

// Route: Speech to Text (STT) & Translation/Summarization
app.post('/api/stt', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API Key is not configured on the server. Please configure GEMINI_API_KEY in your .env file.' });
  }

  // mode can be: 'transcribe', 'translate', 'summarize'
  const mode = req.body.mode || 'transcribe';
  const targetLanguage = req.body.targetLanguage || 'English';

  try {
    const base64Data = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    let promptText = 'Please transcribe this audio file accurately. Output ONLY the transcribed text. Do not add any introduction, explanations, or meta-comments.';
    
    if (mode === 'translate') {
      promptText = `Please translate the spoken content in this audio file directly into ${targetLanguage}. Output ONLY the translated text. Do not add any introduction or explanations.`;
    } else if (mode === 'summarize') {
      promptText = 'Please provide a clear and concise summary of the spoken content in this audio file. List the key points as bullet points.';
    }

    const url = `${GEMINI_BASE_URL}/v1beta/models/${GEMINI_STT_MODEL}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }]
    };

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!geminiRes.ok) {
      const errorData = await geminiRes.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Gemini API returned status ${geminiRes.status}`);
    }

    const data = await geminiRes.json();
    const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text: transcript.trim() });
  } catch (error) {
    console.error('STT transcribing error:', error);
    res.status(500).json({ error: error.message || 'Error occurred during STT transcription.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
