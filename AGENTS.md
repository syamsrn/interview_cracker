# AGENTS.md

## Project Purpose

Interview Coach is a private Windows desktop mock-interview training application. The app is local-first and should avoid backend dependencies unless a future step explicitly introduces them.

## Architecture

- `src/main`: Electron main process. Owns the desktop application lifecycle and `BrowserWindow` creation.
- `src/preload`: Electron preload scripts. Exposes a narrow, typed bridge to the renderer through `contextBridge`.
- `src/renderer`: React and TypeScript renderer application powered by Vite.
- `scripts/electron-vite.mjs`: Local wrapper used by npm scripts to launch Electron Vite with desktop-safe environment settings.
- `scripts/run-packaged.mjs`: Local wrapper used to launch the unpacked packaged app from development shells.
- `docs`: Persistent project memory for architecture, roadmap, decisions, current status, and Windows setup.
- Local history, personal knowledge, and resume/profile data are stored as versioned JSON documents under Electron `userData` and owned by main-process services.

The Electron window must use secure defaults:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`

## Coding Conventions

- Use TypeScript for all application code.
- Keep Electron main-process code, preload code, and renderer code separated.
- Keep AI provider integrations behind main-process services and preload IPC.
- Keep interview prompt construction and classification in the main-process response engine.
- Keep answer evaluation in main-process services behind narrow preload IPC.
- Keep session analytics current-session only until a future stage explicitly adds persistent analytics.
- Keep renderer keyboard shortcuts mapped to existing UI handlers and avoid triggering destructive actions while users are typing.
- Keep performance optimizations local and transparent; do not cache across app restarts unless a future stage explicitly adds persistent performance data.
- Keep error handling local and user-readable; do not add telemetry, crash uploads, or persistent logs unless a future stage explicitly asks for them.
- Keep app preferences separate from saved user content; preference reset must not delete history, knowledge, or resume/profile data.
- Keep privacy controls explicit and confirmation-based; the renderer must not directly manipulate local data files.
- Keep screen-sharing safety visible, manual, and practice-scoped; do not add screen-share detection, automatic hiding, proctoring-bypass, or anti-capture behavior.
- Keep resume/profile context behind main-process services and narrow preload IPC.
- Keep saved resume/profile facts as grounding only; do not invent employers, dates, metrics, tools, responsibilities, or achievements.
- Keep speech-to-text implementation isolated in the local speech sidecar; do not put audio capture or Whisper inference in the renderer.
- Keep microphone and future system-audio capture behind explicit sidecar/main-process IPC; never expose generic recording or shell APIs to React.
- Prefer small modules with explicit responsibilities.
- Keep renderer UI components free of Node.js and Electron direct access.
- Use explicit IPC channels through preload for desktop window operations.
- Keep sandboxed preload code limited to Electron IPC/contextBridge and browser-safe helpers; do not import Node modules there.
- Add dependencies only when they are clearly needed.
- Use local-first behavior by default.
- Do not automatically download Ollama models; ask the user to install/pull models explicitly.
- Do not bundle Python environments, Whisper models, Ollama, or local AI models unless a future stage explicitly asks for it.

## Important Constraints

- Do not add new AI providers, audio features, storage systems, or parsing workflows outside the active roadmap stage.
- Do not implement authentication yet.
- Do not expose generic APIs or hardcoded credentials.
- Do not build stealth, proctoring-bypass, or hidden-assistance functionality.
- Complete roadmap stages sequentially and update `docs/CURRENT_STATUS.md` after each major stage.
