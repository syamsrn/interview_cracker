# Windows Setup

## Prerequisites

- Windows 10 or Windows 11, 64-bit
- Node.js 20 or newer
- npm

## Install Dependencies

```bash
npm install
```

If PowerShell blocks `npm.ps1`, use:

```bash
npm.cmd install
```

## Run in Development

```bash
npm run dev
```

This launches the Electron overlay and starts the Vite renderer dev server.

## Verify the Project

```bash
npm run typecheck
npm run build
```

## Package the App

Create an unpacked Windows build:

```bash
npm run package
```

Launch the unpacked build from PowerShell or VS Code:

```bash
npm run start:packaged
```

The packaged executable is created at:

```text
dist\win-unpacked\Interview Coach.exe
```

The app can also be opened directly from File Explorer. If launching from a shell that sets `ELECTRON_RUN_AS_NODE`, use `npm run start:packaged` so the variable is cleared before Electron starts.

## Current Runtime Notes

This development environment may set `ELECTRON_RUN_AS_NODE=1`. Project npm scripts call `scripts/electron-vite.mjs`, which removes that variable before launching Electron Vite so Electron starts as a desktop app.

## Ollama Setup

Stage 4 uses Ollama locally. The app does not download models automatically.

Install Ollama for Windows from the official Ollama website, then download a small model:

```bash
ollama pull llama3.2:3b
```

Other CPU-friendly options for this machine:

```bash
ollama pull gemma3:4b
ollama pull qwen2.5:3b
```

Verify installed models:

```bash
ollama list
```

The app detects installed models through the local Ollama API at:

```text
http://localhost:11434/api/tags
```

## Speech Sidecar Setup

Stage 6 selects a local Python sidecar for speech-to-text. Do not install microphone or Whisper packages until Stage 7 begins.

Use Python 3.11 or 3.12 for the sidecar environment. The currently detected Python in this environment is 3.14.5, which should not be used for the speech sidecar.

Stage 7 and later use `.venv-speech` in the project folder.

Create the environment:

```bash
py -3.12 -m venv .venv-speech
```

Install dependencies:

```bash
.venv-speech\Scripts\python.exe -m pip install -r services\speech\requirements.stage7.txt
```

Download the small starter model explicitly:

```bash
.venv-speech\Scripts\python.exe services\speech\download_model.py --model Systran/faster-whisper-tiny.en
```

Current healthcheck:

```bash
.venv-speech\Scripts\python.exe services\speech\healthcheck.py
```

## System Audio Notes

Stage 9 uses Windows loopback capture through the `soundcard` Python package. If system audio records silence, confirm that the source audio is actively playing, unmuted, and routed to the Windows output device you are listening through.

Packaged builds include the speech sidecar scripts, but they do not bundle `.venv-speech` or the Whisper model. Keep the speech Python dependencies installed locally before testing microphone or system-audio transcription from a packaged build.
