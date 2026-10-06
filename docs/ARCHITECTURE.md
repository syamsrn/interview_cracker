# Architecture

Interview Coach is a private Windows-first desktop application built with Electron, React, TypeScript, and Vite.

## Application Layers

- `src/main`: Electron main process. Creates and manages the desktop overlay window, owns global shortcuts, and handles IPC requests from the renderer.
- `src/preload`: Secure preload bridge. Exposes a narrow `window.interviewApp` API through `contextBridge`.
- `src/renderer`: React UI. Renders the overlay and calls preload APIs for window operations.
- `scripts/electron-vite.mjs`: Local npm-script launcher that removes `ELECTRON_RUN_AS_NODE` before running Electron Vite.

## Security Model

The renderer must not access Node.js or Electron directly. Window operations go through typed preload methods and specific IPC channels.

Current `BrowserWindow` security defaults:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`

## Stage 1 Overlay

The app starts as a compact floating overlay:

- frameless window
- always on top
- resizable
- initially positioned near the top-right of the primary display
- custom draggable title area
- minimize and hide controls
- global `Ctrl+Shift+I` visibility toggle
- `Esc` hides the overlay from the renderer

Answer generation is currently hardcoded. AI, audio, speech recognition, databases, authentication, and APIs are intentionally not implemented yet.

## Stage 2 Renderer UX

The renderer now owns local UI-only interview state:

- mode: `AUTO` or `MANUAL`
- status: `Ready`, `Listening`, `Transcribing`, `Thinking`, `Answer Ready`, or `Error`
- answer detail: `short`, `normal`, or `expanded`
- in-memory answer history for Previous / Next navigation

Stage 2 listening and answer generation are simulated UI flows only. No microphone access, speech recognition, AI provider, storage, or API calls are implemented.

Hardcoded response formatting lives in `src/renderer/src/interview.ts` so future prompt and provider work can replace it without burying response logic inside JSX.

## Stage 3 AI Provider Boundary

AI provider architecture is now split across shared types, main-process services, preload IPC, and renderer UI:

- `src/shared/ai.ts`: provider ids, provider status, generation request, and generation result types.
- `src/main/services/ai`: provider interface, provider registry, default Ollama provider, and future provider placeholders.
- `src/main/ipc/ai-ipc.ts`: validated IPC handlers for provider status and answer generation.
- `src/preload/index.ts`: narrow `window.interviewApp.ai` API exposed to React.
- `src/renderer/src/main.tsx`: calls the preload AI API and displays provider setup guidance.

Ollama is the default provider, but Stage 3 intentionally does not call Ollama, download models, or perform inference. Until Stage 4, generation returns a user-facing "Local AI not configured" message.

## Stage 4 Ollama Integration

The Ollama provider now uses the local Ollama HTTP API:

- `GET http://localhost:11434/api/tags` detects Ollama and lists installed models.
- `POST http://localhost:11434/api/generate` generates answers with streaming enabled.
- Streamed tokens are forwarded from the main process to preload and then into the renderer.

The renderer settings panel supports:

- AI provider status
- installed model selection
- temperature
- maximum answer length
- response style
- Test AI Connection

The app never downloads models automatically. If Ollama is not running or no models are installed, the app shows local setup guidance and continues running.

## Stage 5 Interview Response Engine

Prompt construction and question classification now live in `src/main/services/interview/response-engine.ts`.

The response engine:

- classifies questions into broad interview categories such as Python, SQL, ML, RAG, LLMs, Agents, System Design, DSA / Coding, Project, Resume, Behavioral / HR, and General Technical
- builds category-specific answer format instructions
- adds short category context for ambiguous technical acronyms such as RAG
- keeps prompt policy in one main-process service instead of scattering prompt strings through UI or provider code
- instructs the model not to fabricate personal experience, resume facts, project claims, employers, metrics, or production usage

Ollama remains responsible for local model detection, transport, and streaming. The renderer receives the final category in the generation result for current-session history display.

## Stage 6 Speech-to-Text Architecture

Speech-to-text is architected as a local Python sidecar, not as renderer code and not as Electron main-process ML code.

Selected approach:

- Engine: `faster-whisper`
- Runtime: dedicated Python 3.11 or 3.12 environment
- Device target: CPU
- Compute target: int8
- First model target: small Whisper model such as `base.en` or `small.en`

Rationale:

- isolates ML and audio dependencies outside Electron
- keeps renderer code free of Node, native audio, and ML access
- allows the Electron app to detect missing speech setup and show useful guidance
- prepares for Stage 7 microphone transcription and Stage 9 Windows system-audio capture without destabilizing the overlay

Current files:

- `src/shared/speech.ts`: shared speech service status types
- `src/main/services/speech/speech-service.ts`: main-process speech readiness detector
- `src/main/ipc/speech-ipc.ts`: speech IPC registration
- `services/speech`: sidecar documentation, future requirements, and a stdlib Python healthcheck

Stage 6 does not capture microphone audio, record audio, run Whisper inference, or install Python packages.

## Stage 7 Microphone Transcription

Stage 7 adds microphone-only transcription through the local Python sidecar.

Runtime flow:

1. Renderer calls `window.interviewApp.speech.startMicrophone(...)`.
2. Preload forwards the request through IPC.
3. Electron main process starts `services/speech/microphone_transcriber.py` using `.venv-speech`.
4. The sidecar records microphone audio with `sounddevice`.
5. The sidecar transcribes audio with `faster-whisper` using CPU int8 compute.
6. Transcript events stream back to the renderer through a narrow `speech:event` IPC channel.
7. Final transcript populates the question field.
8. User manually clicks Generate to call Ollama.

The initial model is `Systran/faster-whisper-tiny.en`, downloaded explicitly with `services/speech/download_model.py`.

Stage 7 does not trigger AI automatically and does not capture Windows system audio. System audio remains deferred to Stage 9.

## Stage 8 Automatic Question Detection

Stage 8 adds local deterministic question detection in the renderer.

Runtime behavior:

1. A final transcript arrives from the speech sidecar.
2. The renderer checks for question cues such as question words, interview phrases, and trailing question punctuation.
3. If the transcript is not clearly question-like, the app stays Ready.
4. If MANUAL mode is selected, the app shows a detected-question state and waits for Generate.
5. If AUTO mode is selected, the app automatically starts answer generation for the detected question.

Stage 8 does not capture Windows system audio and does not add persistence, databases, or personal knowledge retrieval.

## Stage 9 Windows System Audio

Stage 9 adds an explicit System Audio source option while keeping capture inside the Python speech sidecar.

Runtime behavior:

1. The user opens Settings and chooses Audio Source: System Audio.
2. Renderer calls `window.interviewApp.speech.startSystemAudio(...)`.
3. Preload forwards the request through `speech:start-system-audio`.
4. Electron main process starts `services/speech/microphone_transcriber.py` with `--source system-audio`.
5. The sidecar captures the active Windows output loopback with `soundcard`, falling back to Stereo Mix if needed.
6. The sidecar transcribes captured audio with `faster-whisper`.
7. Transcript events use the same `speech:event` channel as microphone transcription.

Current Windows constraint:

- System Audio depends on active, unmuted playback being routed to the selected Windows output device.
- If Windows loopback capture and Stereo Mix fallback are unavailable, the sidecar reports a visible error and the user can switch back to Microphone.

Stage 9 does not add persistence, databases, personal knowledge retrieval, or hidden capture behavior.

## Stage 10 Conversation Memory

Stage 10 adds current-session conversation memory without persistence.

Runtime behavior:

1. The renderer keeps generated answers in the existing in-memory history array.
2. When Session Memory is enabled, the renderer sends up to four recent Q&A turns with `ai:generate-answer`.
3. The main-process IPC handler validates and caps memory before passing it to the AI service.
4. The response engine inserts the memory as follow-up context in the prompt.
5. The model is told not to treat this context as a saved profile, resume, database, or long-term history.

Controls:

- Settings includes Session Memory On/Off.
- Settings includes Clear Session, which clears current-session answer history.

Stage 10 does not write memory to disk and does not add a database. Persistence starts in Stage 11.

## Stage 11 Local Database

Stage 11 adds local answer-history persistence.

Storage approach:

- A versioned JSON document database is stored under Electron `userData`.
- Current file name: `interview-coach-history.json`.
- The main process owns all filesystem reads and writes.
- Writes use a temporary file followed by rename to reduce partial-write risk.
- The renderer does not receive generic filesystem access.

Runtime behavior:

1. On app startup, Electron creates `HistoryDatabase` with the local `userData` path.
2. Main process registers narrow history IPC handlers.
3. Preload exposes `window.interviewApp.history`.
4. Renderer loads saved answers on startup.
5. Successful generated answers are saved locally.
6. Clear Session clears current-session memory only.
7. Delete History clears saved local answer history.

Stage 11 does not add cloud sync, authentication, personal knowledge retrieval, or external APIs.

## Stage 12 Personal Knowledge / RAG

Stage 12 adds local personal knowledge retrieval for grounded interview answers.

Storage approach:

- A versioned JSON document database is stored under Electron `userData`.
- Current file name: `interview-coach-knowledge.json`.
- The main process owns all reads, writes, clears, and searches.
- The renderer never receives generic filesystem access.

Retrieval approach:

- Snippets have a title and content.
- Search uses deterministic keyword matching over title and content.
- Up to four matching snippets are sent to the response engine.
- No embeddings, vector database, cloud APIs, or external retrieval services are used yet.

Runtime behavior:

1. User saves personal knowledge in Settings.
2. Renderer calls `window.interviewApp.knowledge.saveSnippet(...)`.
3. On answer generation, renderer searches snippets with the current question.
4. Retrieved snippets are sent with `ai:generate-answer`.
5. AI IPC validates and caps snippets.
6. Response engine inserts snippets as grounding context.
7. Prompt instructions forbid inventing facts beyond retrieved snippets.

Stage 12 does not parse resumes automatically and does not add vector search. Resume-aware answers start in Stage 13.

## Stage 13 Resume-Aware Answers

Stage 13 adds a local resume/profile context store for grounded background, resume, and project answers.

Storage approach:

- A versioned JSON document database is stored under Electron `userData`.
- Current file name: `interview-coach-resume.json`.
- The main process owns all reads, writes, and clears.
- The renderer never receives generic filesystem access.

Runtime behavior:

1. User saves concise resume/profile notes in Settings.
2. Renderer calls `window.interviewApp.resume.saveProfile(...)`.
3. Renderer loads the saved profile on startup.
4. When Resume Context is enabled, renderer sends the profile with `ai:generate-answer`.
5. AI IPC validates and caps the profile content.
6. Response engine inserts the profile as grounding context.
7. Prompt instructions forbid inventing employers, dates, metrics, tools, responsibilities, or achievements beyond the saved profile.

Stage 13 does not parse resume files, upload documents, use embeddings, or add cloud sync.

## Stage 14 Follow-Up Prediction

Stage 14 adds explicit follow-up suggestions after generated answers.

Prediction approach:

- Follow-ups are generated locally inside the response engine.
- Suggestions use the detected interview category, generated answer text, current-session memory, resume profile presence, and retrieved personal knowledge presence.
- No additional AI call, cloud API, database, or external service is used.

Runtime behavior:

1. Provider builds the interview prompt and generates the answer.
2. Provider asks the response engine for three follow-up predictions.
3. `GenerateAnswerResult` returns `followUpQuestions` with the answer and category.
4. Renderer displays follow-up suggestions below the answer.
5. Clicking a suggestion loads it into the question input without auto-generating.
6. Saved answer history keeps follow-up suggestions so Previous / Next can restore them.

Stage 14 does not add interview scheduling, evaluation, analytics, or autonomous mock interview loops.

## Stage 15 Answer Length Controls

Stage 15 makes answer length a first-class control before generation.

Length modes:

- Short: fastest spoken answer for quick practice.
- Normal: default interview-ready answer.
- Detailed: deeper answer for follow-up or project discussion.

Runtime behavior:

1. Renderer keeps the selected length in `answerDetail` and `aiSettings.maxAnswerLength`.
2. The main composer exposes Short, Normal, and Detailed controls.
3. Settings keeps the same length control for configuration consistency.
4. Retry actions can regenerate Short, Normal, or Detailed answers.
5. Ollama generation uses smaller token budgets for faster local responses.

Performance notes:

- Ollama model info is cached briefly instead of re-checking `/api/tags` on every answer.
- Resume profile context is sent only for resume, background, project, stack, role, achievement, or experience-style questions.
- Empty personal knowledge stores are not searched during generation.
- Prompt context caps were reduced to keep local CPU inference responsive.

Stage 15 does not add new AI providers or change the local-first architecture.

## Stage 16 Mock Interview Mode

Stage 16 adds a local mock interview flow for structured practice.

Session approach:

- Mock sessions live in renderer state only.
- Question sets are deterministic local lists in `src/renderer/src/mock-interview.ts`.
- Settings controls choose the domain and question count.
- The app loads one mock question at a time into the existing question input.

Runtime behavior:

1. User chooses a domain and question count.
2. User starts a mock session from Settings or the top control strip.
3. Renderer creates a local mock session with ordered questions.
4. Current mock question is loaded into the question input.
5. Previous Question / Next Question navigates the mock question set.
6. Generate still manually creates a sample answer for the current question.

Stage 16 does not record answers, evaluate answers, score sessions, or add analytics. Those begin in later stages.

## Stage 17 Answer Evaluation

Stage 17 adds local deterministic evaluation for a user's practice answer.

Responsibilities:

- `src/main/services/interview/answer-evaluator.ts` owns scoring and feedback logic.
- `src/main/ipc/evaluation-ipc.ts` validates evaluation payloads and exposes a narrow IPC handler.
- `src/shared/evaluation.ts` defines typed request, result, score, band, and feedback contracts.
- `src/preload/index.ts` exposes `evaluation.evaluateAnswer()` through `contextBridge`.
- `src/renderer/src/main.tsx` renders the practice-answer input and result display.

Flow:

1. The renderer sends the current question, user's practice answer, and optional generated reference answer.
2. The main process classifies the question through the existing interview response engine.
3. The evaluator scores answer length, structure, category signal coverage, production tradeoffs, specificity, and optional reference overlap.
4. The renderer displays score, readiness band, strengths, and improvements.

Stage 17 does not persist evaluation results, compute session analytics, record candidate audio, or call the AI model again for scoring.

## Stage 18 Session Analytics

Stage 18 adds current-session analytics derived from evaluated practice answers.

Responsibilities:

- `src/renderer/src/main.tsx` stores evaluated answer summaries in React state for the current app session.
- The analytics view calculates evaluated count, average score, best score, readiness band counts, category coverage, latest feedback, and recent evaluations.
- Evaluation logic remains owned by the main-process evaluator from Stage 17.

Flow:

1. The user evaluates a practice answer.
2. The renderer receives the main-process evaluation result.
3. The renderer appends a compact session evaluation record to in-memory state.
4. The Analytics view derives summaries from those records.
5. Reset clears only session analytics and does not delete saved answer history.

Stage 18 does not persist analytics, export reports, or add long-term trend tracking. Those can be revisited after keyboard and settings polish.

## Stage 19 Keyboard-First Experience

Stage 19 adds renderer-level keyboard shortcuts and focus behavior for the compact overlay.

Responsibilities:

- `src/renderer/src/main.tsx` owns keyboard shortcuts because they operate on renderer state and existing button handlers.
- Shortcuts call the same functions used by visible controls so behavior stays consistent.
- `src/renderer/src/styles.css` provides visible focus rings for keyboard navigation.

Shortcuts:

- `Ctrl+K`: focus the question composer.
- `Ctrl+J`: focus the user's practice-answer box.
- `Ctrl+Enter`: generate an answer.
- `Ctrl+Shift+Enter`: evaluate the user's practice answer.
- `Ctrl+,`: toggle Settings.
- `Ctrl+;`: toggle Analytics.
- `Ctrl+Backspace`: clear the current question/answer view.
- `Ctrl+1`, `Ctrl+2`, `Ctrl+3`: choose Short, Normal, or Detailed answer length.
- `Ctrl+Left`, `Ctrl+Right`: navigate saved/current answer history.
- `Alt+Left`, `Alt+Right`: navigate active mock-interview questions.
- `Ctrl+M`: start or end mock interview mode.
- `Esc`: close Settings/Analytics first; otherwise hide the overlay.

Most shortcuts are ignored while the user is typing in an input, textarea, or select. Generate and Evaluate still work from text areas so the main practice flow is keyboard-first.

## Stage 20 Performance Optimization

Stage 20 adds low-risk local performance improvements without changing providers or persistence.

Responsibilities:

- `src/main/services/ai/ai-service.ts` owns a small in-memory LRU cache for exact repeated successful answer-generation requests.
- `src/renderer/src/main.tsx` prevents overlapping generate/evaluate requests and keeps busy state visible in the UI.
- The renderer keyboard listener is registered once and delegates to the latest handler through a ref.

Generation cache:

- Stores only successful results.
- Uses question, provider, model, temperature, answer length, response style, session memory, personal knowledge, and resume/profile context in the cache key.
- Keeps up to 25 entries.
- Expires entries after 10 minutes.
- Does not write cached answers to disk.

Stage 20 does not change Ollama model selection, add background workers, alter speech transcription, or introduce persistent analytics.

## Stage 21 Error Handling

Stage 21 improves recoverable error visibility and main-process diagnostics.

Responsibilities:

- `src/renderer/src/main.tsx` owns recoverable user-facing error notices.
- `src/renderer/src/styles.css` styles the compact error notice so it can appear above any view without changing layout.
- `src/main/index.ts` logs main-process and renderer lifecycle failures to the development terminal.

Renderer behavior:

- Recoverable failures show a title, message, optional recovery hint, and Dismiss action.
- AI provider, speech, local history, personal knowledge, resume profile, generation, evaluation, and speech start/stop failures use the same notice pattern.
- Successful retry/start actions clear stale error notices.

Main-process behavior:

- Logs uncaught exceptions and unhandled promise rejections.
- Logs renderer load failures and renderer process exits.
- Warns if the global overlay shortcut cannot be registered.

Stage 21 does not add persistent log files, telemetry, crash uploads, or external monitoring.

## Stage 22 Settings

Stage 22 turns the existing Settings panel into persistent local preferences.

Responsibilities:

- `src/shared/settings.ts` defines the settings document contract.
- `src/main/services/settings/settings-store.ts` owns the versioned local JSON settings file under Electron `userData`.
- `src/main/ipc/settings-ipc.ts` exposes narrow get, save, and reset IPC handlers.
- `src/preload/index.ts` exposes settings methods through `contextBridge`.
- `src/renderer/src/main.tsx` loads settings on startup, applies them to React state, auto-saves preference changes after a short debounce, and exposes Reset Preferences.

Persisted preferences:

- response mode
- speech input source
- session memory enabled
- personal knowledge enabled
- resume profile enabled
- AI provider id
- AI model
- temperature
- answer length
- response style
- mock interview domain
- mock interview question count

Reset Preferences restores only app preferences. It does not delete saved answer history, personal knowledge snippets, resume profile, session analytics, or generated answer cache.

Stage 22 does not add cloud sync, accounts, settings import/export, or persistent logs.

## Stage 23 Privacy

Stage 23 adds explicit local privacy visibility and deletion controls.

Responsibilities:

- `src/shared/privacy.ts` defines privacy info and clear-result contracts.
- `src/main/services/privacy/privacy-service.ts` owns privacy summaries and private-data clearing through existing storage services.
- `src/main/ipc/privacy-ipc.ts` exposes narrow privacy IPC.
- `src/preload/index.ts` exposes privacy methods through `contextBridge`.
- `src/renderer/src/main.tsx` renders privacy status and asks for confirmation before clearing private data.

Privacy view includes:

- Electron `userData` folder path.
- saved answer history summary.
- personal knowledge summary.
- resume profile summary.
- preferences summary.
- local/network behavior summary.

Clear Private Data:

- clears saved answer history.
- clears personal knowledge snippets.
- clears resume profile notes.
- resets preferences to defaults.
- clears current session history, analytics, and visible resume/knowledge state in the renderer.

Stage 23 does not add cloud sync, telemetry, crash upload, encrypted storage, OS credential vault integration, or secure deletion guarantees.

## Stage 24 Screen-Sharing Safety / Scope

Stage 24 adds a visible, manual safety mode for permitted practice sessions.

Responsibilities:

- `src/shared/settings.ts` includes the persisted `screenShareSafetyEnabled` preference.
- `src/main/services/settings/settings-store.ts` validates and stores the safety preference with other local settings.
- `src/renderer/src/main.tsx` renders the safety controls, masks privacy details while safety mode is enabled, and shows a main-view safety notice.
- `src/renderer/src/styles.css` keeps the safety notice compact inside the overlay layout.

Behavior:

1. The user opens Settings and turns Screen-Sharing Safety on.
2. The preference auto-saves locally through the existing settings IPC.
3. The main practice view shows a visible safety notice.
4. Privacy details in Settings hide local folder paths and local store summaries while the mode is enabled.
5. The user can explicitly click Hide Overlay.

Stage 24 does not detect screen sharing, hide automatically, bypass proctoring, alter audio capture, add background monitoring, or provide anti-capture guarantees.

## Stage 25 Packaging

Stage 25 adds Windows packaging with Electron Builder.

Responsibilities:

- `package.json` defines packaging scripts and Electron Builder configuration.
- `scripts/run-packaged.mjs` launches the unpacked app while clearing `ELECTRON_RUN_AS_NODE` for development shells.
- `src/main/services/speech/speech-service.ts` resolves speech sidecar resources from either the project folder or packaged Electron resources.

Build outputs:

- `npm run package` creates an unpacked Windows app in `dist/win-unpacked`.
- `npm run package:win` can create a portable Windows artifact when a single distributable file is needed.
- `services/speech` is copied to `dist/win-unpacked/resources/services/speech`.

Runtime notes:

- The app loads the production renderer from `out/renderer/index.html` inside `resources/app.asar`.
- Local user data remains under Electron `userData`.
- Ollama remains an external local service.
- Python speech dependencies and the Whisper model are not bundled into the packaged app.

Stage 25 does not add installer signing, auto-update, a custom icon, bundled Python, bundled Ollama, bundled AI models, or cloud distribution.

## Stage 26 Optional Google Gemini Provider

Stage 26 adds Google Gemini as an optional cloud AI provider while preserving Ollama as the default local provider.

Runtime behavior:

1. The user selects Google Gemini in Settings.
2. The user enters a Gemini API key in the Electron overlay only.
3. Renderer sends the key once through a narrow `gemini:save-api-key` IPC command.
4. The main process encrypts the key with Electron `safeStorage` and stores it under Electron `userData` as `interview-coach-gemini-key.json`.
5. Renderer can query only whether a key is saved; it cannot read the saved key.
6. `GeminiProvider` uses `@google/genai`, lists available text-generation models when possible, and streams generated answer tokens through the existing AI IPC path.
7. The existing interview response engine still owns classification, prompt construction, memory, resume/profile grounding, and personal knowledge context.

Gemini is not required for the app to run. If the key is missing, invalid, rate limited, or offline, the app shows a user-readable error and the user can switch back to Ollama.

Stage 26 does not add authentication, backend services, cloud storage, telemetry, generic secret-reading IPC, or additional AI providers.

## Post-Stage-25 Answer UX Refinement

The renderer now separates the editable question draft from the active submitted question:

- `question` remains the composer draft.
- `activeQuestion` stores the question currently attached to the visible answer.
- Generate moves the draft into `activeQuestion`, clears the composer, and refocuses the composer.
- Enter in the question composer triggers Generate, while Shift+Enter preserves multiline input.

The response engine now asks the local model for first-person, speakable answer text from the candidate perspective. Resume/profile context is sent whenever Resume Context is enabled and a profile exists, while the prompt still forbids invented employers, dates, metrics, tools, responsibilities, achievements, or project facts.
