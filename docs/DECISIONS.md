# Decisions

## 2026-08-24: Use Electron Vite for the Desktop Shell

Electron Vite remains the build and dev orchestration tool for the main process, preload, and renderer. This avoids adding extra process runners.

## 2026-08-24: Keep Renderer Isolated from Electron and Node

Renderer code must call window operations through preload-exposed methods. The main process handles IPC and native Electron APIs.

## 2026-08-24: Stage 1 Close Button Hides the Overlay

The overlay close button hides the window instead of quitting the application. This keeps the global `Ctrl+Shift+I` toggle useful for bringing the overlay back during a mock session.

## 2026-08-24: Generate Uses a Hardcoded Answer for Stage 1

Stage 1 intentionally does not include AI. The Generate button returns a fixed structured practice response so the overlay flow can be tested before provider architecture is introduced.

## 2026-08-24: Stage 2 Keeps UX State In-Memory

Overlay mode, status, answer detail, and history are kept in renderer state only. Persistence is deferred until the planned local database stage.

## 2026-08-24: Stage 2 Simulates Listening

Start Listening and Stop Listening update visible UI states but do not access a microphone or speech service. Real speech-to-text is deferred to the speech architecture and transcription stages.

## 2026-08-24: Hardcoded Answer Formatting Moved Out of JSX

Stage 2 response templates live in `src/renderer/src/interview.ts`. This keeps the React component focused on UI state and leaves a simple replacement point for the future response engine.

## 2026-08-24: AI Providers Live Behind Main-Process IPC

AI provider calls are routed through the Electron main process and exposed to the renderer through preload IPC. This preserves `contextIsolation`, keeps Node/Electron APIs out of React, and creates a safe boundary for future local and optional cloud providers.

## 2026-08-24: Ollama Is the Default Provider

The default provider id is `ollama`. Stage 3 does not detect or call Ollama yet; the provider reports `not-configured` and returns setup guidance until Stage 4 implements local Ollama detection and generation.

## 2026-08-24: Cloud Providers Are Placeholders Only

OpenAI, Gemini, and Claude provider slots exist as not-configured placeholders. They must remain optional future integrations and must not use hardcoded API keys.

## 2026-08-24: Ollama Uses Local HTTP API Without Extra Packages

Stage 4 integrates Ollama through the local HTTP API at `http://localhost:11434/api`. No npm package was added because `fetch` is sufficient in the Electron main process.

## 2026-08-24: Do Not Auto-Download Ollama Models

The application detects installed models but does not pull models automatically. Model downloads are explicit user actions because even small local models consume disk space, bandwidth, memory, and CPU.

## 2026-08-24: Prefer Small CPU-Friendly Ollama Models

For the target hardware, recommend small 3B-7B class models before larger ones. Initial recommendations are `llama3.2:3b`, `gemma3:4b`, and `qwen2.5:3b`.

## 2026-08-24: Keep Sandboxed Preload Free of Node Module Imports

The Electron window uses `sandbox: true`, so preload code must avoid imports such as `node:crypto`. Request ids and similar helpers should use browser-safe code or be generated outside preload.

## 2026-08-24: Centralize Interview Prompt Logic

Stage 5 moves prompt construction and question classification into `src/main/services/interview/response-engine.ts`. AI providers should call this service rather than building interview prompts directly.

## 2026-08-24: Use Lightweight Deterministic Classification First

Question classification uses simple keyword rules for now. This is transparent, fast, local, and easy to adjust before adding model-assisted classification later.

## 2026-08-24: Use a Python Sidecar for Speech-to-Text

Stage 6 selects a local Python sidecar using `faster-whisper` for speech-to-text. This keeps Electron free of ML/audio dependencies and gives the app a process boundary for startup checks, errors, and later restarts.

## 2026-08-24: Prefer Python 3.11 or 3.12 for Speech

The current shell sees Python 3.14.5, but the speech sidecar should use Python 3.11 or 3.12 because ML/audio packages are more likely to provide compatible wheels there.

## 2026-08-24: Do Not Implement Microphone Capture in Stage 6

Stage 6 is architecture and readiness detection only. Microphone capture and live transcription begin in Stage 7 after setup requirements are confirmed.

## 2026-08-24: Use Tiny Faster-Whisper Model for First Microphone Test

Stage 7 uses `Systran/faster-whisper-tiny.en` first. It is small enough for quick CPU-first testing and can be replaced with larger models after the microphone path is stable.

## 2026-08-24: Pick an Openable Windows Input Device

Direct microphone endpoints may fail through PortAudio on Windows. The sidecar probes candidate input devices and chooses the first openable non-Stereo-Mix input, which currently resolves to `Microsoft Sound Mapper - Input` on this machine.

## 2026-08-24: Manual Generate Remains Separate from Transcription

Stage 7 fills the question field with the final transcript but does not automatically call Ollama. The user still clicks Generate manually.

## 2026-08-24: Automatic Detection Uses Local Rules First

Stage 8 detects question-like final transcripts with deterministic renderer-side rules. AUTO mode only generates after a final transcript has clear question cues, while MANUAL mode still waits for the Generate button.

## 2026-08-24: Disambiguate Technical Acronyms in Prompts

RAG answers were irrelevant when the local model interpreted "rag" as fabric. The response engine now adds category context so RAG means Retrieval-Augmented Generation in technical interview prompts.

## 2026-08-24: Use Windows Loopback for System-Audio Capture

Stage 9 keeps Windows system-audio capture inside the existing Python speech sidecar. `sounddevice` Stereo Mix capture was not enough because it can miss audio routed to headset outputs, so system audio now prefers `soundcard` WASAPI loopback from the active Windows speaker output.

Stereo Mix remains a fallback. The app does not hide this behavior: System Audio is a visible source selection and uses the same Start/Stop Listening controls as microphone transcription.

## 2026-08-25: Keep Conversation Memory In-Memory Before Database Stage

Stage 10 adds current-session conversation memory only. The renderer sends recent generated Q&A turns with each answer request, IPC validates and caps them, and the response engine uses them only as follow-up context.

Nothing is persisted to disk yet. Local storage, databases, and long-term session history remain deferred to Stage 11.

## 2026-08-25: Use a File-Backed Local Database First

Stage 11 persists answer history in a versioned JSON document under Electron `userData`. The main process owns all reads and writes, preload exposes narrow history methods, and the renderer never receives filesystem access.

This avoids adding a native SQLite dependency while the data model is still small. The `HistoryDatabase` service boundary keeps a later SQLite migration straightforward.

## 2026-08-25: Answer Voice Targets a 3-4 Year GenAI Engineer

Interview answers should sound like a practical Generative AI engineer with about 3-4 years of hands-on experience. The prompt should favor grounded, experience-shaped phrasing such as real debugging, evaluation, retrieval, latency, prompt quality, and deployment tradeoffs.

The app must still avoid inventing specific employers, resume facts, metrics, or project claims.

## 2026-08-25: Start Personal Knowledge with Local Keyword Retrieval

Stage 12 implements Personal Knowledge / RAG with a local JSON-backed snippet database and deterministic keyword retrieval. This keeps the feature local-first, simple to inspect, and free of embedding/vector dependencies while the knowledge shape is still evolving.

The response engine receives only the top matching snippets and treats them as grounding context. Embeddings, vector databases, richer chunking, and resume-specific parsing remain future work.

## 2026-08-25: Separate Session Memory From Saved History Deletion

Clear Session now clears only the current in-memory answer context. Delete History is the explicit control for deleting saved local answer history from the file-backed database.

Settings controls are grouped by task area so operational controls, diagnostics, persistence, and personal knowledge inputs are easier to scan in the compact overlay.

## 2026-08-25: Treat Settings as Its Own Overlay Mode

The overlay is too compact to show all settings plus the answer workspace at the same time. Settings now takes the available content area and scrolls internally, while the question/answer workspace is hidden until Settings is closed.

## 2026-08-30: Start Resume-Aware Answers With a Local Profile Note

Stage 13 stores one local resume/profile note in a versioned JSON file under Electron `userData`. This gives grounded resume-aware answers without adding document upload, parsing, embeddings, cloud sync, or a heavier database.

The response engine may use the profile for resume, project, background, behavioral, and experience questions, but it must not invent facts beyond the saved profile.

## 2026-08-30: Keep Follow-Up Prediction Deterministic

Stage 14 generates follow-up suggestions locally from category rules, answer text cues, and available local context presence. It does not make a second model request.

This keeps the feature fast and predictable while the app is still a compact overlay. More advanced follow-up generation can be revisited during Mock Interview Mode.

## 2026-08-30: Prioritize Local Response Latency After Resume Context

Stage 13 added resume profile grounding, but always carrying that context can slow local Ollama responses. The renderer now sends resume profile context only for resume, project, background, stack, role, achievement, or experience-style questions.

Stage 15 also lowers local token budgets, caches Ollama model info briefly, skips empty knowledge searches, and exposes Short / Normal / Detailed length controls before generation.

## 2026-08-30: Keep Mock Interview Mode Renderer-Local

Stage 16 uses deterministic local question sets and renderer state for mock interview sessions. This avoids adding new persistence or evaluation behavior before the planned stages.

## 2026-08-31: Keep Answer Evaluation Local and Fast

Stage 17 uses a deterministic main-process evaluator instead of an extra Ollama call. This keeps feedback quick, private, and predictable while still checking for practical 3-4 year GenAI engineer signals such as examples, tradeoffs, evaluation, latency, debugging, and production quality.

## 2026-08-31: Keep Session Analytics In Memory

Stage 18 keeps analytics in renderer memory and derives them from evaluated answers in the current app session. This avoids adding another persistent data model before the app has keyboard polish, error handling, and privacy settings for saved analytics.

## 2026-08-31: Keep Shortcuts Renderer-Local

Stage 19 implements keyboard shortcuts in the renderer because they operate on visible UI state and existing action handlers. The main-process global shortcut remains limited to overlay visibility, while in-app shortcuts avoid most actions during text entry.

## 2026-08-31: Use Exact In-Memory Generation Cache

Stage 20 caches only exact repeated successful generation requests in memory. The cache key includes local context that can affect the answer, which avoids reusing stale responses when the user changes model, length, style, memory, knowledge, or resume/profile context.

## 2026-08-31: Keep Error Handling Local and Visible

Stage 21 uses recoverable in-app notices for user-facing failures and terminal logging for main-process failures. The app does not create persistent logs or send telemetry because privacy and local-first behavior remain the default.

## 2026-08-31: Store Preferences Separately From User Content

Stage 22 stores app preferences in a separate local JSON document from answer history, personal knowledge, and resume profile. Reset Preferences only affects preferences so the user cannot accidentally delete interview content while adjusting app behavior.

## 2026-08-31: Route Privacy Clearing Through Main Services

Stage 23 exposes privacy status and deletion through main-process services instead of allowing the renderer to manipulate files. This keeps storage ownership consistent and ensures Clear Private Data uses the same validated clear/reset paths as history, knowledge, resume, and settings.

The user remains in control of generation. Mock questions load into the existing question box, and the user can manually generate a sample answer when useful.

## 2026-08-31: Keep Screen-Sharing Safety Visible and Manual

Stage 24 adds a persisted screen-sharing safety preference that visibly marks the overlay as practice-scoped and masks local paths/store summaries in Settings.

The feature is intentionally not screen-share detection, automatic hiding, proctoring bypass, or anti-capture behavior. The only window action is an explicit Hide Overlay button controlled by the user.

## 2026-08-31: Package an Unpacked Windows App First

Stage 25 uses `electron-builder` for packaging and starts with an unpacked Windows directory at `dist/win-unpacked`. This keeps verification simple before adding installer signing, custom icons, auto-update, or a one-file distribution workflow.

Speech sidecar scripts are copied as extra resources, but the Python environment and Whisper model are not bundled because they are large, machine-specific dependencies that the user installs explicitly.

## 2026-08-31: Optimize Answers for Speakable Candidate Perspective

After Stage 25, generated answers were adjusted to be directly speakable by the user. Normal answers now target about a minute, use first-person candidate wording, and prioritize saved resume/profile and personal knowledge context whenever enabled.

The question composer now treats Enter as Generate and keeps Shift+Enter for multiline drafts. Submitted questions are moved into the read-only question preview while the input clears and keeps focus for the next question.

## 2026-08-31: Add Gemini as an Optional Provider

Stage 26 adds Google Gemini through the official `@google/genai` SDK while keeping Ollama as the default local provider. Gemini uses the existing `AIProvider` interface and the existing interview response engine, so classification, memory, resume/profile grounding, and personal knowledge retrieval stay provider-independent.

Gemini API keys are entered only in the Electron Settings UI. The main process encrypts the key with Electron `safeStorage` and stores it under Electron `userData`; the renderer can only save, delete, or check key presence through narrow preload IPC.
