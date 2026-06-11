// UI Elements
const tabTts = document.getElementById('tab-tts');
const tabStt = document.getElementById('tab-stt');
const panelTts = document.getElementById('panel-tts');
const panelStt = document.getElementById('panel-stt');

const ttsText = document.getElementById('tts-text');
const ttsCharCount = document.getElementById('tts-char-count');
const ttsClear = document.getElementById('tts-clear');
const ttsFileDrop = document.getElementById('tts-file-drop');
const ttsFileInput = document.getElementById('tts-file-input');
const ttsFileInfo = document.getElementById('tts-file-info');
const ttsRemoveFile = document.getElementById('tts-remove-file');

const ttsProvider = document.getElementById('tts-provider');
const ttsVoice = document.getElementById('tts-voice');
const ttsSpeed = document.getElementById('tts-speed');
const ttsSpeedVal = document.getElementById('tts-speed-val');
const ttsPitch = document.getElementById('tts-pitch');
const ttsPitchVal = document.getElementById('tts-pitch-val');
const pitchControlGroup = document.getElementById('pitch-control-group');
const btnGenerateTts = document.getElementById('btn-generate-tts');
const ttsOutputBox = document.getElementById('tts-output-box');
const ttsAudioPlayer = document.getElementById('tts-audio-player');
const ttsDownloadLink = document.getElementById('tts-download-link');

const sttModeUpload = document.getElementById('stt-mode-upload');
const sttModeRecord = document.getElementById('stt-mode-record');
const sttUploadSec = document.getElementById('stt-upload-sec');
const sttRecordSec = document.getElementById('stt-record-sec');
const sttFileDrop = document.getElementById('stt-file-drop');
const sttFileInput = document.getElementById('stt-file-input');
const sttFileInfo = document.getElementById('stt-file-info');
const sttRemoveFile = document.getElementById('stt-remove-file');

const btnRecordMic = document.getElementById('btn-record-mic');
const recordStatusTxt = document.getElementById('record-status-txt');
const recordDuration = document.getElementById('record-duration');
const sttRecordPreview = document.getElementById('stt-record-preview');
const sttRecordPlayer = document.getElementById('stt-record-player');

const sttEngineMode = document.getElementById('stt-engine-mode');
const sttLangGroup = document.getElementById('stt-lang-group');
const sttTargetLang = document.getElementById('stt-target-lang');
const btnTranscribe = document.getElementById('btn-transcribe');
const sttOutputBox = document.getElementById('stt-output-box');
const sttResultText = document.getElementById('stt-result-text');
const sttCopy = document.getElementById('stt-copy');
const sttSendToTts = document.getElementById('stt-send-to-tts');

const globalLoader = document.getElementById('global-loader');
const loaderText = document.getElementById('loader-text');

// State Variables
let edgeVoices = [];
let voiceConfigLoaded = false;
let mediaRecorder = null;
let audioChunks = [];
let recordInterval = null;
let recordStartTime = null;
let recordedAudioBlob = null;
let selectedAudioFile = null;

// Gemini Prebuilt Voices
const GEMINI_VOICES = [
  { Name: 'Puck', FriendlyName: 'Puck (男声 - 活力)' },
  { Name: 'Charon', FriendlyName: 'Charon (男声 - 深沉)' },
  { Name: 'Kore', FriendlyName: 'Kore (女声 - 清晰)' },
  { Name: 'Fenrir', FriendlyName: 'Fenrir (男声 - 专业)' },
  { Name: 'Aoede', FriendlyName: 'Aoede (女声 - 亲切对话)' }
];

// --- 1. Tab & Mode Switching ---
tabTts.addEventListener('click', () => switchTab('tts'));
tabStt.addEventListener('click', () => switchTab('stt'));

function switchTab(mode) {
  if (mode === 'tts') {
    tabTts.classList.add('active');
    tabTts.setAttribute('aria-selected', 'true');
    tabStt.classList.remove('active');
    tabStt.setAttribute('aria-selected', 'false');
    panelTts.classList.add('active');
    panelStt.classList.remove('active');
  } else {
    tabTts.classList.remove('active');
    tabTts.setAttribute('aria-selected', 'false');
    tabStt.classList.add('active');
    tabStt.setAttribute('aria-selected', 'true');
    panelTts.classList.remove('active');
    panelStt.classList.add('active');
  }
}

sttModeUpload.addEventListener('click', () => switchSttInputMode('upload'));
sttModeRecord.addEventListener('click', () => switchSttInputMode('record'));

function switchSttInputMode(mode) {
  if (mode === 'upload') {
    sttModeUpload.classList.add('active');
    sttModeRecord.classList.remove('active');
    sttUploadSec.classList.add('active');
    sttRecordSec.classList.remove('active');
  } else {
    sttModeUpload.classList.remove('active');
    sttModeRecord.classList.add('active');
    sttUploadSec.classList.remove('active');
    sttRecordSec.classList.add('active');
  }
}

// --- 2. Voice Loading & Setup ---
document.addEventListener('DOMContentLoaded', () => {
  loadEdgeVoices();
  setupSliders();
  setupFileInputs();
  setupRecording();
});

// Setup slider value labels
function setupSliders() {
  ttsSpeed.addEventListener('input', (e) => {
    ttsSpeedVal.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
  });
  ttsPitch.addEventListener('input', (e) => {
    ttsPitchVal.textContent = (e.target.value >= 0 ? '+' : '') + e.target.value + 'Hz';
  });
}

// Fetch Edge voices and populate selector
async function loadEdgeVoices() {
  try {
    const response = await fetch('/api/voices');
    if (!response.ok) throw new Error('Cannot fetch voice list');
    edgeVoices = await response.json();
    voiceConfigLoaded = true;
    updateVoiceOptions();
  } catch (error) {
    console.error('Failed to load voice configurations:', error);
    showToast('加载音色列表失败，将使用默认声音。', 'error');
    // Fallback static options
    ttsVoice.innerHTML = '<option value="zh-CN-XiaoxiaoNeural">晓晓 (女声 - 推荐)</option><option value="zh-CN-YunxiNeural">云希 (男声 - 推荐)</option>';
  }
}

// Update voice selector options based on selected provider
ttsProvider.addEventListener('change', () => {
  updateVoiceOptions();
  if (ttsProvider.value === 'gemini') {
    pitchControlGroup.classList.add('hidden'); // Gemini TTS does not support pitch offset parameter in prebuiltVoiceConfig
  } else {
    pitchControlGroup.classList.remove('hidden');
  }
});

function updateVoiceOptions() {
  ttsVoice.innerHTML = '';
  const provider = ttsProvider.value;

  if (provider === 'gemini') {
    // Populate Gemini voices
    GEMINI_VOICES.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.Name;
      opt.textContent = v.FriendlyName;
      ttsVoice.appendChild(opt);
    });
  } else {
    if (!voiceConfigLoaded) {
      ttsVoice.innerHTML = '<option value="">正在加载音色...</option>';
      return;
    }

    // Group Edge voices by region/language
    const groups = {
      '中文 (Mainland)': [],
      '中文 (Hong Kong)': [],
      '中文 (Taiwan)': [],
      '英语 (US & UK)': [],
      '其他语言': []
    };

    edgeVoices.forEach(voice => {
      const locale = voice.Locale;
      if (locale === 'zh-CN') {
        groups['中文 (Mainland)'].push(voice);
      } else if (locale === 'zh-HK') {
        groups['中文 (Hong Kong)'].push(voice);
      } else if (locale === 'zh-TW') {
        groups['中文 (Taiwan)'].push(voice);
      } else if (locale.startsWith('en-')) {
        groups['英语 (US & UK)'].push(voice);
      } else {
        groups['其他语言'].push(voice);
      }
    });

    // Render grouped voices
    for (const groupName in groups) {
      if (groups[groupName].length === 0) continue;
      
      // Limit "Other Languages" list to prevent overflow
      if (groupName === '其他语言' && groups[groupName].length > 15) {
        groups[groupName] = groups[groupName].slice(0, 15);
      }

      const optGroup = document.createElement('optgroup');
      optGroup.label = groupName;

      groups[groupName].forEach(voice => {
        const opt = document.createElement('option');
        opt.value = voice.ShortName || voice.Name;
        // Clean friendly name a bit
        let name = voice.FriendlyName || voice.ShortName || voice.Name;
        name = name.replace('Microsoft ', '').replace(' Online (Natural)', '');
        opt.textContent = name;
        
        // Select Xiaoxiao as default
        if ((voice.ShortName || voice.Name) === 'zh-CN-XiaoxiaoNeural') {
          opt.selected = true;
        }
        optGroup.appendChild(opt);
      });

      ttsVoice.appendChild(optGroup);
    }
  }
}

// --- 3. Text Box Input Logic ---
ttsText.addEventListener('input', () => {
  const len = ttsText.value.length;
  ttsCharCount.textContent = len;
});

ttsClear.addEventListener('click', () => {
  ttsText.value = '';
  ttsCharCount.textContent = '0';
  ttsText.focus();
});

// --- 4. File Drag and Drop / Input Configuration ---
function setupFileInputs() {
  // TTS file upload
  setupDragAndDrop(ttsFileDrop, ttsFileInput, (file) => {
    if (file.type !== 'text/plain') {
      showToast('仅支持读取 .txt 纯文本文件', 'error');
      return;
    }
    selectedAudioFile = null; // Clear any STT selection
    readTxtFile(file);
  });

  ttsRemoveFile.addEventListener('click', (e) => {
    e.stopPropagation();
    ttsFileInput.value = '';
    ttsFileInfo.classList.add('hidden');
    ttsFileDrop.classList.remove('hidden');
  });

  // STT file upload
  setupDragAndDrop(sttFileDrop, sttFileInput, (file) => {
    if (!file.type.startsWith('audio/')) {
      showToast('仅支持上传音频文件', 'error');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      showToast('文件大小不能超过 25MB', 'error');
      return;
    }
    selectedAudioFile = file;
    recordedAudioBlob = null; // Clear recording
    
    sttFileInfo.querySelector('.file-name-txt').textContent = `${file.name} (${formatBytes(file.size)})`;
    sttFileInfo.classList.remove('hidden');
    sttFileDrop.classList.add('hidden');
  });

  sttRemoveFile.addEventListener('click', (e) => {
    e.stopPropagation();
    sttFileInput.value = '';
    selectedAudioFile = null;
    sttFileInfo.classList.add('hidden');
    sttFileDrop.classList.remove('hidden');
  });
}

function setupDragAndDrop(dropArea, fileInput, onFileSelected) {
  dropArea.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.remove('dragover');
    }, false);
  });

  dropArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      onFileSelected(files[0]);
    }
  });
}

function readTxtFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    if (text.length > 5000) {
      showToast('文本超过 5000 字限制，将截取前 5000 字', 'warning');
      ttsText.value = text.slice(0, 5000);
    } else {
      ttsText.value = text;
    }
    ttsCharCount.textContent = ttsText.value.length;
    
    // Show File banner
    ttsFileInfo.querySelector('.file-name-txt').textContent = file.name;
    ttsFileInfo.classList.remove('hidden');
    ttsFileDrop.classList.add('hidden');
  };
  reader.onerror = () => {
    showToast('读取文本文件失败', 'error');
  };
  reader.readAsText(file, 'utf-8');
}

// --- 5. Speech-to-Text Microphone Recording ---
function setupRecording() {
  btnRecordMic.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  });
}

async function startRecording() {
  audioChunks = [];
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Identify supported mime types
    let options = { mimeType: 'audio/webm' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/ogg' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/mp4' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = {}; // browser default
        }
      }
    }

    mediaRecorder = new MediaRecorder(stream, options);
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      recordedAudioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      selectedAudioFile = null; // Clear uploaded file
      
      const audioURL = URL.createObjectURL(recordedAudioBlob);
      sttRecordPlayer.src = audioURL;
      sttRecordPreview.classList.remove('hidden');
      recordStatusTxt.textContent = '录音已完成，可进行播放预览或点击重新录音';
      
      // Stop all tracks to release mic
      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start(250); // collect 250ms chunks
    
    btnRecordMic.classList.add('recording');
    recordStatusTxt.textContent = '正在录音...';
    
    // Start recording timer
    recordStartTime = Date.now();
    recordDuration.textContent = '00:00';
    recordInterval = setInterval(updateRecordTimer, 1000);
    
  } catch (error) {
    console.error('Mic record error:', error);
    showToast('无法启动麦克风。请检查麦克风权限配置。', 'error');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  btnRecordMic.classList.remove('recording');
  clearInterval(recordInterval);
}

function updateRecordTimer() {
  const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const seconds = String(elapsed % 60).padStart(2, '0');
  recordDuration.textContent = `${minutes}:${seconds}`;
}

// --- 6. Send TTS Request ---
btnGenerateTts.addEventListener('click', async () => {
  const text = ttsText.value.trim();
  if (!text) {
    showToast('请输入合成文本！', 'warning');
    return;
  }

  showLoader('正在为您合成语音，请稍候...');
  ttsOutputBox.classList.add('hidden');

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        voice: ttsVoice.value,
        speed: parseFloat(ttsSpeed.value),
        pitch: parseInt(ttsPitch.value, 10),
        provider: ttsProvider.value
      })
    });

    if (!response.ok) {
      const errRes = await response.json().catch(() => ({}));
      throw new Error(errRes.error || `服务器返回 status: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    ttsAudioPlayer.src = audioUrl;
    ttsDownloadLink.href = audioUrl;
    
    // Auto name matching provider format
    const extension = ttsProvider.value === 'gemini' ? 'wav' : 'mp3';
    ttsDownloadLink.download = `voicecraft_${Date.now()}.${extension}`;
    
    ttsOutputBox.classList.remove('hidden');
    showToast('语音合成成功！', 'success');
  } catch (error) {
    console.error('TTS synthesis error:', error);
    showToast(`语音合成失败: ${error.message}`, 'error');
  } finally {
    hideLoader();
  }
});

// --- 7. Send STT Request ---
sttEngineMode.addEventListener('change', () => {
  if (sttEngineMode.value === 'translate') {
    sttLangGroup.classList.remove('hidden');
  } else {
    sttLangGroup.classList.add('hidden');
  }
});

btnTranscribe.addEventListener('click', async () => {
  let audioFile = null;

  if (recordedAudioBlob) {
    // Convert recorded blob to file
    const extension = recordedAudioBlob.type.includes('ogg') ? 'ogg' : recordedAudioBlob.type.includes('mp4') ? 'mp4' : 'webm';
    audioFile = new File([recordedAudioBlob], `recorded_audio.${extension}`, { type: recordedAudioBlob.type });
  } else if (selectedAudioFile) {
    audioFile = selectedAudioFile;
  }

  if (!audioFile) {
    showToast('请上传音频文件或使用麦克风进行录音！', 'warning');
    return;
  }

  showLoader('正在为您解析转录，请稍候...');
  sttOutputBox.classList.add('hidden');

  try {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('mode', sttEngineMode.value);
    formData.append('targetLanguage', sttTargetLang.value);

    const response = await fetch('/api/stt', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errRes = await response.json().catch(() => ({}));
      throw new Error(errRes.error || `服务器返回 status: ${response.status}`);
    }

    const data = await response.json();
    sttResultText.value = data.text;
    sttOutputBox.classList.remove('hidden');
    showToast('转录处理完成！', 'success');
  } catch (error) {
    console.error('STT transcribing error:', error);
    showToast(`转录失败: ${error.message}`, 'error');
  } finally {
    hideLoader();
  }
});

// --- 8. Copy and Send back to TTS ---
sttCopy.addEventListener('click', () => {
  const text = sttResultText.value;
  if (!text) return;
  navigator.clipboard.writeText(text)
    .then(() => showToast('文本已成功复制到剪贴板！', 'success'))
    .catch(() => showToast('复制失败，请手动选择复制。', 'error'));
});

sttSendToTts.addEventListener('click', () => {
  const text = sttResultText.value;
  if (!text) return;
  
  ttsText.value = text;
  ttsCharCount.textContent = text.length;
  switchTab('tts');
  showToast('已复制文本并切换到语音合成模式。', 'success');
});

// --- 9. Toast Notification Helper ---
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  // Animate out and remove
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease-in reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// --- 10. Loader Helpers ---
function showLoader(text) {
  loaderText.textContent = text;
  globalLoader.classList.remove('hidden');
}

function hideLoader() {
  globalLoader.classList.add('hidden');
}

// Helper: Format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
