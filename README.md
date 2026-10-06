# Interview Coach

Private Windows desktop mock-interview training application built with Electron, React, TypeScript, and Vite.

The current app is a Stage 26 floating overlay shell with local Ollama integration, optional Google Gemini support, a dedicated interview response engine, microphone transcription, explicit Windows system-audio transcription, current-session conversation memory, local answer-history persistence, local personal knowledge retrieval, resume-aware answers, follow-up prediction, answer length controls, mock interview mode, local answer evaluation, current-session analytics, keyboard-first controls, local performance optimizations, recoverable error handling, persistent local settings, privacy controls, visible screen-sharing safety controls, and Windows packaging.

## Prerequisites

- Node.js 20 or newer
- npm
- Windows desktop environment

## Installation

```bash
npm install
```

## Development Commands

```bash
npm run dev
```

Launches the Electron desktop application in development mode.

```bash
npm run typecheck
```

Runs TypeScript checks for the Electron main process, preload, and React renderer.

```bash
npm run build
```

Builds the application into the `out` directory.

```bash
npm run test:gemini
```

Runs a small Electron-based Gemini smoke test against the saved encrypted key. It does not print the key.

```bash
npm run preview
```

Runs the built Electron application for local preview.

```bash
npm run package
```

Builds an unpacked Windows application at `dist/win-unpacked`.

```bash
npm run start:packaged
```

Launches the unpacked packaged app from `dist/win-unpacked`.

```bash
npm run package:win
```

Builds a portable Windows artifact when a single distributable file is needed.

```bash
npm run package:mac
```

Builds macOS `.dmg` and `.zip` artifacts when run on a macOS machine.

## Local Ollama

The app uses Ollama locally by default and never downloads models automatically.

Recommended starter model for CPU-first testing:

```bash
ollama pull llama3.2:3b
ollama list
```

## Optional Google Gemini

Google Gemini is available as an optional cloud AI provider. Ollama remains the default local provider.

To use Gemini, open Settings, choose `Google Gemini` as the AI Provider, enter your Gemini API key, click Save Key, then Test Gemini Connection. The key is encrypted by the Electron main process with `safeStorage` and stored under Electron `userData`; the renderer cannot read the saved key back.

## Speech Transcription

Speech uses a local Python sidecar in `.venv-speech` with `faster-whisper`, `soundcard`, `sounddevice`, and the small `Systran/faster-whisper-tiny.en` model.

Typical flow:

```text
Start Listening -> speak question -> Stop Listening -> transcript appears -> Generate
```

For system audio, open Settings, set Audio Source to System Audio, play unmuted audio from another app, then use Start System Audio and Stop Listening.

## Conversation Memory

Stage 10 keeps recent generated Q&A turns in memory for follow-up questions.

Use Settings to turn Session Memory on or off, or Clear Session for the current app session.

## Local History Database

Stage 11 saves generated answer history locally under Electron `userData`.

The renderer can list, save, and delete answer history only through the preload bridge. No cloud sync or external database is used.

## Personal Knowledge

Stage 12 saves local knowledge snippets and retrieves relevant snippets before answer generation.

Use Settings to save a Knowledge Title and Knowledge Note. Retrieval is local keyword matching for now; no embeddings, vector database, or external API is used.

## Resume Profile

Stage 13 saves a local resume/profile note under Electron `userData` and passes it to answer generation when Resume Context is on.

Use Settings to save concise resume, stack, project, role, and experience details. The app does not parse uploaded files yet and does not sync resume data.

## Follow-Up Prediction

Stage 14 shows likely interviewer follow-up questions after each generated answer.

Click a follow-up suggestion to load it into the question box, then Generate when ready. Follow-up suggestions are generated locally from the detected category and available local context.

## Answer Length Controls

Stage 15 exposes Short, Normal, and Detailed answer length controls on the main screen and in Settings.

Short targets about 25-35 seconds spoken. Normal targets about 55-70 seconds spoken. Detailed targets about 90 seconds. Answers are prompted as first-person candidate wording so they can be spoken directly in practice.

## Mock Interview Mode

Stage 16 adds a local mock interview mode with deterministic question sets.

Use Settings to choose a domain and question count, then Start Mock. The app loads one mock question at a time and lets you navigate questions.

## Answer Evaluation

Stage 17 adds local deterministic feedback for your own practice answer.

Type or load a question, write your answer in Your Answer, then click Evaluate. The app scores the answer locally and shows a readiness band, strengths, and improvement notes without making a second model call.

## Session Analytics

Stage 18 summarizes evaluated answers for the current app session.

Click Analytics to view evaluated count, average score, best score, readiness bands, category coverage, latest feedback, and recent evaluations. Reset clears only this session analytics view; it does not delete saved answer history.

## Keyboard Controls

Stage 19 adds in-app keyboard shortcuts.

```text
Ctrl+K              Focus question
Ctrl+J              Focus Your Answer
Ctrl+Enter          Generate
Ctrl+Shift+Enter    Evaluate
Ctrl+,              Toggle Settings
Ctrl+;              Toggle Analytics
Ctrl+Backspace      Clear
Ctrl+1/2/3          Short / Normal / Detailed
Ctrl+Left/Right     Previous / Next answer
Alt+Left/Right      Previous / Next mock question
Ctrl+M              Start / End mock interview
Esc                 Close panel or hide overlay
```

In the question box, Enter also triggers Generate. Use Shift+Enter only when you need a multiline draft.

## Performance

Stage 20 adds exact-request in-memory caching for successful generated answers and prevents overlapping Generate/Evaluate actions.

Repeat the same question with the same model, length, style, memory, knowledge, and resume context to reuse the cached answer. The cache is local memory only, expires after 10 minutes, and is cleared when the app exits.

## Error Handling

Stage 21 adds recoverable error notices for common app failures.

When generation, evaluation, speech, or local storage fails, the overlay shows a compact message with a recovery hint and Dismiss action. Development-only main-process errors are written to the terminal; no telemetry or external crash reporting is used.

## Settings

Stage 22 persists app preferences locally under Electron `userData`.

Settings restore on launch for mode, audio source, memory toggles, AI model, temperature, answer length, response style, mock interview domain, and mock question count. Reset Preferences returns these preferences to defaults without deleting saved answer history, personal knowledge, or resume profile.

## Privacy

Stage 23 shows local privacy status in Settings.

The Privacy section lists the Electron `userData` folder, saved local store summaries, and local/network behavior notes. Clear Private Data deletes saved answer history, personal knowledge, resume profile, and resets preferences after confirmation. No telemetry, cloud sync, backend account, or crash upload is configured.

## Screen-Sharing Safety

Stage 24 adds a visible manual safety mode in Settings.

When Screen-Sharing Safety is on, the main view shows a safety notice and Privacy masks local file paths and local store summaries. The mode is for permitted practice sessions only; it does not detect screen sharing, hide automatically, bypass proctoring, or provide anti-capture behavior.

## Packaging

Stage 25 uses Electron Builder for Windows packaging.

`npm run package` creates `dist/win-unpacked/Interview Coach.exe`. The speech sidecar scripts are copied into packaged resources, but `.venv-speech`, Whisper models, Ollama, and Ollama models are not bundled. The app currently uses Electron's default icon.

## Project Structure

```text
.
|-- electron.vite.config.ts
|-- docs
|   |-- ARCHITECTURE.md
|   |-- CURRENT_STATUS.md
|   |-- DECISIONS.md
|   |-- ROADMAP.md
|   `-- SETUP_WINDOWS.md
|-- scripts
|   |-- electron-vite.mjs
|   |-- run-gemini-smoke.mjs
|   `-- run-packaged.mjs
|-- services
|   `-- speech
|       |-- README.md
|       |-- download_model.py
|       |-- healthcheck.py
|       |-- microphone_transcriber.py
|       `-- requirements.stage7.txt
|-- src
|   |-- main
|   |   |-- index.ts
|   |   |-- ipc
|   |   |   |-- ai-ipc.ts
|   |   |   |-- evaluation-ipc.ts
|   |   |   |-- history-ipc.ts
|   |   |   |-- knowledge-ipc.ts
|   |   |   |-- privacy-ipc.ts
|   |   |   |-- resume-ipc.ts
|   |   |   |-- settings-ipc.ts
|   |   |   `-- speech-ipc.ts
|   |   `-- services
|   |       |-- ai
|   |       |-- history
|   |       |-- interview
|   |       |-- knowledge
|   |       |-- resume
|   |       `-- speech
|   |-- preload
|   |   `-- index.ts
|   |-- renderer
|   |   |-- index.html
|   |   `-- src
|   |       |-- interview.ts
|   |       |-- main.tsx
|   |       |-- styles.css
|   |       `-- vite-env.d.ts
|   `-- shared
|       |-- ai.ts
|       |-- evaluation.ts
|       |-- history.ts
|       |-- knowledge.ts
|       |-- privacy.ts
|       |-- resume.ts
|       |-- settings.ts
|       `-- speech.ts
|-- tsconfig.json
|-- tsconfig.node.json
`-- tsconfig.web.json
```

- `src/main`: Electron main process and desktop window lifecycle.
- `src/main/services/ai`: AI provider abstraction and provider registry.
- `src/main/services/secrets`: local encrypted secret storage for optional provider keys.
- `src/main/services/interview`: question classification, prompt/response formatting, follow-up prediction, and local answer evaluation.
- `src/main/services/speech`: speech sidecar readiness detection.
- `src/main/ipc`: typed IPC handlers owned by the main process.
- `src/preload`: secure bridge between Electron and the renderer.
- `src/renderer`: React UI rendered inside the Electron window.
- `src/shared`: types shared across main, preload, and renderer.
- `services/speech`: local speech sidecar planning and healthcheck files.
- `scripts/electron-vite.mjs`: local launcher for Electron Vite that keeps Electron from inheriting Node-only execution flags.
- `scripts/run-gemini-smoke.mjs`: local launcher for the Electron Gemini smoke test that clears `ELECTRON_RUN_AS_NODE`.
- `scripts/test-gemini-connection.cjs`: Electron smoke test for the saved encrypted Gemini key and a tiny Gemini request.
- `scripts/run-packaged.mjs`: local launcher for the unpacked packaged app that clears `ELECTRON_RUN_AS_NODE`.
- `docs`: persistent project memory for future development sessions.
- `electron.vite.config.ts`: Vite configuration for all three application layers.
