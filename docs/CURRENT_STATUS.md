# Current Status

## Completed Features

- Working Electron + React + TypeScript + Vite foundation.
- Electron main process, preload, and renderer are separated.
- Secure Electron defaults are enabled.
- Stage 1 floating overlay is complete.
- Overlay is frameless, always on top, resizable, compact, and initially positioned near the top-right of the primary display.
- Overlay has a custom draggable title area, minimize control, hide control, `Ctrl+Shift+I` global visibility toggle, and `Esc` hide behavior.
- Manual question input and Generate flow are present with a hardcoded Stage 1 answer.
- Stage 2 overlay UX is implemented with `AUTO` / `MANUAL` modes.
- Stage 2 controls are present: Start Listening, Stop Listening, Clear, Settings, Expand Answer, Short Answer, Previous, and Next.
- Stage 2 statuses are represented: Ready, Listening, Transcribing, Thinking, Answer Ready, and Error.
- Answers use compact structured hardcoded formats for general and coding-style questions.
- Previous / Next navigate generated answers during the current app session.
- Stage 3 AI provider abstraction is implemented in the main process with shared TypeScript request/result types.
- Default provider is Ollama.
- OpenAI, Gemini, and Claude provider slots exist as optional future placeholders.
- Renderer accesses AI status/generation only through preload IPC.
- If local AI is unavailable, the UI shows "Local AI not configured" guidance instead of crashing.
- Stage 4 Ollama localhost integration is implemented.
- Ollama detection uses the local `/api/tags` endpoint.
- Manual Generate uses Ollama `/api/generate` with streamed tokens when an installed local model is available.
- Settings include provider status, model selection, temperature, answer length, response style, and Test AI Connection.
- Fixed a blank renderer issue caused by importing a Node module from sandboxed preload.
- Browser preview at `localhost` now shows fallback guidance instead of crashing when Electron preload is unavailable.
- Stage 4 real manual typed question -> Ollama -> streamed answer flow was verified by the user with `llama3.2:3b`.
- Stage 5 Interview Response Engine is implemented.
- Question classification now lives in a dedicated main-process service.
- Prompt formatting adapts to technical, coding, behavioral, resume, and project-style questions.
- Providers no longer contain interview prompt strings directly.
- Stage 6 Speech-to-Text Architecture is implemented.
- Selected STT architecture is a local Python sidecar using `faster-whisper` on CPU with int8 compute.
- Main process can detect speech sidecar readiness and report setup guidance through preload IPC.
- Overlay Settings includes speech service status and Check Speech Service.
- `services/speech` contains sidecar docs, future requirements, and a Python healthcheck.
- Stage 7 microphone transcription implementation is added.
- `.venv-speech` Python 3.12 environment is created and ignored by Git.
- `faster-whisper`, `sounddevice`, and `numpy` are installed in `.venv-speech`.
- `Systran/faster-whisper-tiny.en` is downloaded explicitly for local microphone testing.
- Electron can start and stop the speech sidecar through IPC.
- Speech transcript events stream from sidecar -> main process -> preload -> renderer.
- Final transcript fills the question field; Generate remains manual.
- Speech service readiness checks now resolve `.venv-speech` dynamically and show explicit Settings feedback when Check Speech Service is clicked.
- Stage 7 microphone transcription was verified by the user from the overlay.
- Stage 8 automatic question detection is implemented.
- Final transcripts are classified locally as question-like or not question-like.
- In AUTO mode, a confidently detected final question automatically starts answer generation.
- In MANUAL mode, a detected final question waits for the Generate button.
- RAG prompt context now explicitly means Retrieval-Augmented Generation to reduce irrelevant fabric/common-word answers.
- Stage 9 Windows system-audio transcription is implemented through the existing speech sidecar boundary.
- Settings includes an explicit Audio Source selector: Microphone or System Audio.
- System Audio starts the sidecar with `--source system-audio` and captures from the active Windows output loopback when available.
- `soundcard` was added to `.venv-speech` for WASAPI loopback capture.
- Stereo Mix remains a fallback if loopback capture is unavailable.
- System-audio smoke test opened `Loopback Headset (EarPods)` at 48000 Hz and stopped cleanly.
- Stage 9 Windows system-audio transcription was verified by the user.
- Stage 10 Conversation Memory is implemented as current-session memory only.
- Recent generated Q&A turns are sent with answer requests when Session Memory is enabled.
- Main-process IPC validates and caps conversation memory to four recent turns.
- The response engine includes session memory as follow-up context without treating it as saved profile, resume, database, or long-term history.
- Settings includes Session Memory On/Off and Clear Session controls.
- Stage 10 Conversation Memory was verified by the user.
- Stage 11 Local Database is implemented as a versioned local JSON document database under Electron `userData`.
- The main process owns all local history database reads and writes.
- Preload exposes narrow history methods: get info, list answers, save answer, and clear answers.
- The renderer loads saved answer history on startup and saves generated answers after successful generation.
- Settings shows Local History status and saved record count.
- Clear Session clears current-session memory only.
- Delete History clears saved local answer history.
- Verified local database file creation at `C:\Users\joshmitha\AppData\Roaming\interview_app\interview-coach-history.json`.
- Prompt style now targets a practical Generative AI engineer with about 3-4 years of hands-on experience, without inventing specific employers or fake project claims.
- Stage 12 Personal Knowledge / RAG is implemented as a local keyword-retrieval system.
- Personal knowledge is stored in a separate local JSON document database under Electron `userData`.
- The main process owns personal knowledge reads, writes, clears, and search.
- Preload exposes narrow knowledge methods: get info, list snippets, search snippets, save snippet, and clear snippets.
- Settings is organized into Session, Answer, Speech, Memory & History, and Personal Knowledge groups.
- Settings includes Personal Knowledge On/Off, snippet count, Knowledge Title, Knowledge Note, Save Knowledge, and Clear Knowledge.
- Answer generation retrieves up to four relevant local knowledge snippets and passes them to the main-process response engine.
- The response engine uses retrieved snippets only as grounding and avoids inventing facts beyond them.
- Verified personal knowledge database file creation at `C:\Users\joshmitha\AppData\Roaming\interview_app\interview-coach-knowledge.json`.
- Stage 12 personal knowledge saving was verified by the user.
- Settings layout was polished to group related controls and separate Clear Session from Delete History.
- Settings now opens as a dedicated scrollable view so Memory & History and Personal Knowledge are reachable without overlapping the landing view.
- The main question/answer view has a fixed-height composer so Generate no longer stretches with the question input.
- Stage 13 Resume-Aware Answers is implemented with a local resume/profile JSON database under Electron `userData`.
- The main process owns resume profile reads, writes, and clears.
- Preload exposes narrow resume methods: get info, get profile, save profile, and clear profile.
- Settings includes Resume Context On/Off, Profile Store status, Resume/Profile Notes, Save Resume, and Clear Resume.
- Answer generation passes saved resume profile context to the response engine when Resume Context is enabled.
- The response engine uses resume profile context as grounding and forbids inventing employers, dates, metrics, tools, responsibilities, or achievements beyond it.
- Stage 13 Resume-Aware Answers was verified by the user.
- Stage 14 Follow-Up Prediction is implemented in the local response engine.
- Generated answers now return up to three category-aware follow-up questions.
- Follow-up suggestions are shown below the answer and can be clicked to load the next question.
- Saved local answer history preserves follow-up suggestions for Previous / Next navigation.
- Stage 14 Follow-Up Prediction was verified by the user.
- Stage 15 Answer Length Controls is implemented.
- Main composer includes Short, Normal, and Detailed length controls before generation.
- Answer retry actions now support Short, Normal, and Detailed regeneration.
- Local generation budgets were reduced to improve response time.
- Ollama model info is cached briefly to avoid checking installed models on every answer.
- Resume profile context is now sent only for resume/background/project/experience-style questions.
- Empty personal knowledge stores are skipped during generation.
- Prompt context caps were reduced for session memory, personal knowledge, and resume profile content.
- Stage 15 Answer Length Controls and speed improvements were verified by the user.
- Stage 16 Mock Interview Mode is implemented with local deterministic question sets.
- Settings includes Mock Interview domain and question-count controls.
- The top control strip includes Start Mock / End Mock.
- Mock sessions show progress and Previous Question / Next Question navigation.
- Mock questions load into the question box for manual answer generation.
- Stage 16 Mock Interview Mode was accepted for moving forward.
- Stage 17 Answer Evaluation is implemented as a local deterministic main-process evaluator.
- Preload exposes a narrow evaluation IPC method; the renderer does not run evaluation logic directly.
- The main view includes a Your Answer practice box and Evaluate button.
- Evaluation returns a score, readiness band, category, strengths, and targeted improvement notes without making another AI call.
- Stage 17 Answer Evaluation was accepted for moving forward.
- Stage 18 Session Analytics is implemented as current-session analytics.
- The top control strip includes an Analytics view.
- Session analytics summarize evaluated answer count, average score, best score, readiness bands, category coverage, latest feedback, and recent evaluations.
- Analytics can be reset without deleting saved local answer history.
- Stage 18 Session Analytics was accepted for moving forward.
- Stage 19 Keyboard-First Experience is implemented.
- Keyboard shortcuts now cover generate, evaluate, focus question, focus answer, settings, analytics, clear, answer length, history navigation, and mock question navigation.
- `Esc` closes Settings/Analytics first, then hides the overlay when the main view is active.
- Keyboard focus rings are visible for buttons, inputs, selects, and textareas.
- Stage 19 Keyboard-First Experience was accepted for moving forward.
- Stage 20 Performance Optimization is implemented.
- The AI service now keeps a small in-memory LRU cache for exact repeated successful generation requests.
- Cached generated answers expire after 10 minutes and are not persisted to disk.
- The renderer prevents overlapping answer generation and answer evaluation requests.
- Generate, Evaluate, answer retry, history navigation, and length buttons now reflect busy states.
- The in-app keyboard listener now registers once and reads current handlers through a ref instead of re-registering after every render.
- Stage 20 Performance Optimization was accepted for moving forward.
- Stage 21 Error Handling is implemented.
- The renderer now shows a compact recoverable error notice with title, message, optional recovery hint, and Dismiss action.
- AI provider, speech service, history, personal knowledge, resume profile, generation, evaluation, and speech start/stop failures now route through clearer recoverable error messaging.
- Successful retry/start actions clear stale error notices.
- The Electron main process logs uncaught exceptions, unhandled promise rejections, renderer load failures, renderer process exits, and global shortcut registration failures.
- Stage 21 Error Handling was accepted for moving forward.
- Stage 22 Settings is implemented.
- App preferences are stored in a versioned local JSON document under Electron `userData`.
- The main process owns settings reads, saves, and reset through narrow preload IPC.
- Settings now persist across restarts for mode, audio source, memory toggles, AI model, temperature, answer length, response style, mock domain, and mock question count.
- Settings changes auto-save with a short debounce after the saved settings have loaded.
- Settings includes a Preferences section showing store status and a Reset Preferences action.
- Reset Preferences restores app preferences only; saved history, personal knowledge, and resume profile are not deleted.
- If a saved model is no longer installed, the app falls back to the first available local model.
- Stage 22 Settings was accepted for moving forward.
- Stage 23 Privacy is implemented.
- Privacy status is exposed through a main-process service and narrow preload IPC.
- Settings now includes a Privacy section with local data folder, local store summaries, privacy refresh, and Clear Private Data.
- Clear Private Data deletes saved answer history, personal knowledge, and resume profile, and resets app preferences after explicit confirmation.
- Privacy info states that there is no backend account, cloud database, telemetry, or crash upload configured.
- Privacy clear does not directly delete from the renderer; it goes through main-process storage services.
- Stage 23 Privacy was accepted for moving forward.
- Stage 24 Screen-Sharing Safety / Scope is implemented.
- Settings now includes a Screen-Sharing Safety section with Safety Mode, practice-only scope, and Hide Overlay.
- Screen-Sharing Safety persists locally with the rest of the app preferences.
- When Screen-Sharing Safety is on, the main view shows a visible safety notice and Settings masks the local data folder and local store summaries.
- Screen-Sharing Safety is manual and visible. It does not detect screen sharing, bypass proctoring, hide automatically, or change capture behavior.
- Stage 24 Screen-Sharing Safety / Scope was accepted for moving forward.
- Stage 25 Packaging is implemented.
- `electron-builder` is configured as the packaging dev tool.
- `npm run package` builds an unpacked Windows app in `dist/win-unpacked`.
- `npm run package:win` is available for a future portable Windows `.exe` artifact.
- Speech sidecar source files are copied into packaged app resources at `resources/services/speech`.
- Packaged speech resource paths resolve from the packaged resources folder when running from `dist`.
- `npm run start:packaged` launches the unpacked app after clearing `ELECTRON_RUN_AS_NODE` for shells that inherit it.
- Post-Stage-25 answer UX refinement is implemented.
- Generated answers now request first-person, directly speakable interview wording from the candidate perspective.
- Normal answer length now targets about 55-70 seconds spoken, Short targets about 25-35 seconds, and Detailed targets about 90 seconds.
- Saved resume/profile context is sent for all generated questions when Resume Context is enabled, so technical answers can be grounded in the user's context instead of staying generic.
- Pressing Enter in the question box now triggers Generate; Shift+Enter keeps multiline input available.
- After Generate starts, the submitted question moves to the question preview, the input box clears, and focus returns to the input for the next question.
- Stage 26 Google Gemini provider is implemented.
- `@google/genai` is installed as the official Gemini SDK dependency.
- Gemini can be selected as an optional AI provider without removing Ollama.
- Gemini API keys are saved only through the Electron overlay Settings UI and encrypted by the main process with Electron `safeStorage`.
- The renderer can check whether a Gemini key is saved, save a new key, or delete the saved key, but it cannot read the saved key.
- Gemini generation uses the existing response engine, so session memory, personal knowledge, and resume/profile context still flow through the same prompt path.
- Gemini streamed tokens use the existing AI streaming IPC channel.
- `npm run test:gemini` verifies the saved Gemini key through Electron `safeStorage` and a tiny Gemini request without printing the key.
- Gemini smoke testing passed with `gemini-3.5-flash-lite`.
- `npm run typecheck`, `npm run build`, and `npm run package` pass after the Gemini integration.
- The freshly packaged app launches from `dist/win-unpacked/Interview Coach.exe`.
- Source/build scans and packaged `app.asar` scans found no Gemini API-key-shaped value.
- Electron app naming is pinned to `interview_app` so dev and packaged builds use the same local `userData` folder.
- `npm run package:win` creates an updated Windows portable app at `dist/Interview-Coach-1.0.0-x64.exe`.
- `npm run package:mac` is configured for macOS `.dmg` and `.zip` builds, but Electron Builder requires that command to run on a macOS machine.

## Current Stage

Stage 26: Google Gemini provider implemented, pending only user visual verification of Gemini generation in the overlay UI.

## Known Issues

- Direct microphone endpoints failed through PortAudio on this machine, so the sidecar probes devices and currently opens `Microsoft Sound Mapper - Input`.
- Electron may print GPU/cache permission warnings during development; the app still launches and these are not blocking the speech service.
- Local model answer quality can still vary, but category-specific prompt context now handles ambiguous technical acronyms such as RAG more explicitly.
- System audio depends on active, unmuted playback being routed to the selected Windows output device.
- Local answer history is persisted on this Windows user profile. It is not synced and does not use any external API.
- Personal knowledge retrieval currently uses local keyword matching, not embeddings or vector search.
- Resume profile storage is a plain local note for now. File upload and automatic resume parsing are not implemented yet.
- Follow-up prediction is deterministic and local. It does not call the model a second time.
- Local Ollama speed still depends on CPU/GPU resources and selected model size, but prompts and token budgets are now leaner.
- Answer evaluation is deterministic and local. It is useful for quick practice feedback but is not a full human interviewer review.
- Session analytics are in-memory only and reset when the app restarts unless the user evaluates answers again.
- Keyboard shortcuts intentionally avoid most actions while typing, except generate/evaluate shortcuts.
- Generation caching is exact-request only, so changed question text, model, length, style, memory, knowledge, or resume context will still generate fresh answers.
- Main-process error logs are written to the development terminal for now. There is no user-facing log export yet.
- Settings persistence is local to this Windows user profile and does not sync across devices.
- Clear Private Data is destructive for saved local interview content and requires user confirmation.
- Screen-Sharing Safety masks sensitive Settings text only inside the overlay. It is not secure redaction, screen-share detection, or anti-capture technology.
- The packaged app currently uses Electron's default icon because no custom app icon has been provided yet.
- The speech sidecar Python environment and Whisper model are not bundled into the package; Python dependencies still need to be installed locally.
- If `Ctrl+Shift+I` is already registered by another app/session, Electron may warn that the overlay shortcut could not be registered.
- Gemini requires internet access and a valid user-provided API key. It is optional and not required for local Ollama usage.
- Gemini API key encryption depends on Electron `safeStorage` availability in the active Windows session.
- macOS app artifacts cannot be produced from this Windows machine; build them on macOS with `npm run package:mac`.

## Next Task

Verify Stage 26 Gemini provider in the overlay UI:

- in Settings -> Answer, select AI Provider: Google Gemini
- confirm the key status shows saved locally
- click Test Gemini Connection
- generate at least one manual answer using Gemini
- verify saved resume/profile and personal knowledge context still influence the Gemini answer

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run package
npm run start:packaged
```
