# VoiceCraft

VoiceCraft 是一个现代化、基于 AI 驱动的语音合成与识别双向处理平台。集成了高品质文字转语音 (TTS) 与高精度语音转文字 (STT) 转录翻译服务，具有极致优美的毛玻璃（Glassmorphism）暗色主题界面。

## 🌟 核心功能

*   **🗣️ 文字转语音 (TTS)**
    *   **Microsoft Edge TTS（默认且免费）**：支持 20+ 种神经网络自然语音，可自由调节语速（0.5x 到 2.0x）和音调，无需任何 API Key 即可即时合成。
    *   **Gemini 语音生成**：支持 Gemini 最新语音生成模型，提供更加生动拟真的音色选择。
    *   **批量/长文本输入**：支持长文本分段合成，并支持直接拖拽/上传 `.txt` 文件读取内容。
    *   **音频播放与下载**：生成成功后支持网页端直接在线试听，或一键下载 MP3/WAV 格式到本地。

*   **🎧 语音转文字 (STT)**
    *   **多种输入方式**：支持拖拽上传本地音频文件（MP3、WAV、M4A 等，最大 25MB），或使用麦克风在网页端进行实时高保真录音。
    *   **智能转录引擎**：利用 Gemini API 强大的多模态处理能力，支持三种处理模式：
        1.  **语音转写 (Transcribe)**：精准识别并转录为文字，支持二次编辑。
        2.  **语音翻译 (Translate)**：将音频中的说话内容直接翻译并转录为目标语言（支持英、中、日、韩、法、德、西等）。
        3.  **内容总结 (Summarize)**：自动提炼音频的核心内容，以条理清晰的列表形式呈现。
    *   **双向联动**：转录生成的文本支持一键“发送到文字转语音”面板，轻松实现闭环再加工。

## 🛠️ 架构与技术栈

*   **前端**：Vanilla HTML5, CSS3 (现代化 HSL 调色板、毛玻璃背景微光动画), Vanilla JavaScript (实现录音、音频可视化、拖拽文件、异步流接口)。
*   **后端**：Node.js + Express (ES Modules)。
*   **容器化**：基于 `docker-compose`，支持全环境变量配置，并自动兼容国内网络与代理服务（内置公共 DNS 配置）。

---

## 🚀 快速开始

### 方式一：使用 Docker 运行（推荐）

1.  复制 `.env.example` 并重命名为 `.env`：
    ```bash
    cp .env.example .env
    ```
2.  编辑 `.env` 配置文件，填入您的 API Key（若只使用 Edge TTS，可留空）：
    ```env
    # 填入您的 Gemini API Key 或中转服务 Key
    GEMINI_API_KEY="your_api_key_here"

    # 可选：配置您的 NewAPI 中转网关地址及自定义模型
    # GEMINI_BASE_URL="https://generativelanguage.googleapis.com"
    # GEMINI_TTS_MODEL="gemini-2.5-flash-preview-tts"
    # GEMINI_STT_MODEL="gemini-2.5-flash"
    ```
3.  通过 Docker Compose 启动容器：
    ```bash
    docker compose up -d
    ```
4.  在浏览器中打开：[http://localhost:3000](http://localhost:3000)

### 方式二：本地 Node.js 运行

1.  安装依赖项：
    ```bash
    npm install
    ```
2.  配置 `.env` 环境变量文件。
3.  启动开发服务：
    ```bash
    npm run dev
    ```
    或生产环境运行：
    ```bash
    npm start
    ```

---

## 🔒 隐私与存储说明

VoiceCraft 采用**端到端内存级流式处理**。所有生成的音频均在内存中缓冲并直接以流形式传输给您的浏览器，**服务器和 Docker 容器中不会留存任何音频文件**，在极大提升处理效率的同时保证您的个人隐私。下载时，文件将被直接保存至您访问设备的默认“下载”目录中。

## 📄 开源协议

本项目基于 MIT 协议开源。
