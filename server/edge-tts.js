import { EdgeTTS, VoicesManager } from 'edge-tts-universal';

// Convert speed factor (e.g. 1.0, 1.5, 0.8) to Edge TTS rate string (e.g. "+0%", "+50%", "-20%")
function formatRate(speed) {
  const s = parseFloat(speed) || 1.0;
  const ratePercent = Math.round((s - 1.0) * 100);
  return (ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`);
}

// Convert pitch offset (e.g. 0, 10, -5) to Edge TTS pitch string (e.g. "+0Hz", "+10Hz", "-5Hz")
function formatPitch(pitch) {
  const p = parseInt(pitch, 10) || 0;
  return (p >= 0 ? `+${p}Hz` : `${p}Hz`);
}

/**
 * Synthesize text to speech using Edge TTS via edge-tts-universal
 * @param {string} text The text to synthesize
 * @param {string} voice The Edge voice name (e.g. "zh-CN-XiaoxiaoNeural")
 * @param {number|string} speed The speed factor (e.g. 1.0)
 * @param {number|string} pitch The pitch offset in Hz (e.g. 0)
 * @returns {Promise<Buffer>} The synthesized audio buffer (MP3 format)
 */
export async function synthesizeSpeech(text, voice = 'zh-CN-XiaoxiaoNeural', speed = 1.0, pitch = 0) {
  const formattedRate = formatRate(speed);
  const formattedPitch = formatPitch(pitch);

  const tts = new EdgeTTS(text, voice, {
    rate: formattedRate,
    pitch: formattedPitch,
    volume: '+0%'
  });

  const result = await tts.synthesize();
  const audioBuffer = Buffer.from(await result.audio.arrayBuffer());
  return audioBuffer;
}

/**
 * Fetch list of available Edge TTS voices
 * @returns {Promise<Array>} List of voices
 */
let cachedVoices = null;
let cacheTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function fetchVoices() {
  const now = Date.now();
  if (cachedVoices && (now - cacheTime < CACHE_DURATION)) {
    return cachedVoices;
  }

  const voicesManager = await VoicesManager.create();
  // Return all voices - the frontend will group them
  cachedVoices = voicesManager.voices;
  cacheTime = now;
  return cachedVoices;
}
