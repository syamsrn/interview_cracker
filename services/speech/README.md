# Speech Sidecar

Stage 6 selects a local Python sidecar for speech-to-text architecture.

## Selected Engine

- Engine: `faster-whisper`
- Device target: CPU
- Compute target: int8
- Default model class for first implementation: small Whisper model, likely `base.en` or `small.en`

This keeps Electron free of native ML and audio dependencies while leaving microphone and Windows audio capture isolated in a separate local process.

## Why Python Sidecar

- Easier to isolate ML dependencies from Electron.
- Easier to restart or report failure without crashing the desktop app.
- Better path for Stage 7 microphone capture and Stage 9 Windows system-audio capture.
- Keeps the renderer free of Node, native audio, and ML access.

## Stage 7 Setup

Use a dedicated Python 3.11 or 3.12 environment before installing speech packages.

Install dependencies:

```bash
.venv-speech\Scripts\python.exe -m pip install -r services\speech\requirements.stage7.txt
```

Download the small starter model explicitly:

```bash
.venv-speech\Scripts\python.exe services\speech\download_model.py --model Systran/faster-whisper-tiny.en
```

Stage 7 uses microphone transcription. Stage 9 adds explicit System Audio transcription through Windows loopback capture with `soundcard`, falling back to Stereo Mix when needed.

## Healthcheck

The current healthcheck only validates Python version suitability:

```bash
python services/speech/healthcheck.py
```
