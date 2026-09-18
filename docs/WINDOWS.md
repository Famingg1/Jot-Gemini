# TakkieAI for Windows

## Notetaker (0.4)

The Windows app now includes a Flow-style Notetaker, compact black recording HUD, Insights, snippets, writing styles, explicit text transforms and a local scratchpad. Start a recording with the microphone, system audio, or both. Each source and a mixed track are saved locally as bounded WAV segments. Pause/resume and final flush acknowledgements preserve the captured timeline. Interrupted recordings can be recovered and retried.

Meetings use the configured transcription model (default `gemini-3.5-transcribe`) for timestamped speaker segments, then a separate configurable text model for summaries, decisions and action items. Names remain editable; speaker labels across transcription batches are intentionally uncertain. Notes remain separate from generated content. Online transcription uploads audio to Google; local storage does not mean offline AI.

### Google Calendar setup

In your own Google Cloud project enable Calendar API and create a **Desktop app** OAuth client. Configure its client ID and optional client secret in Settings → Connectors, then connect in your browser. The app requests read-only event access for the primary calendar. OAuth credentials and tokens are encrypted for the current Windows user. A Gemini API key alone cannot authorize Calendar access. Cache remains available offline; disconnect removes the app's tokens and cached events.

### Local MCP and custom connections

Explicitly enable sharing on individual meeting notes. Settings → MCP copies a stdio configuration for a local client and can run a real connection test. The five tools list/search shared notes and read meeting details, transcripts and action items. Raw audio, unshared notes and provider credentials are excluded. Cloud-only clients cannot directly reach a local stdio server.

Custom stdio and HTTPS MCP connectors can be configured and inspected. Headers and environment secrets are encrypted, commands are executed as an executable plus arguments without a shell, and tool calls require an explicit confirmed action. Meeting content never automatically invokes tools.

### Data and verification

Meeting folders live under `userData/meetings/<uuid>`, containing metadata, capture manifest, source WAV segments, transcript, generated summary and own notes. Separate audio retention never removes incomplete processing jobs. API credentials are encrypted; audio and notes themselves are ordinary local files.

Development verification: `npm run lint`, `npm test`, `npm run build`. The isolated Electron smoke harness additionally exercises real renderer IPC, local MCP, synthetic media capture, pause/resume, playback and responsive screens. Its synthetic audio tests do not prove physical microphone quality or long hardware-clock drift. Real Google authorization and provider calls require your configured credentials.

If Windows cannot launch the native hotkey helper, TakkieAI reports the problem and manual controls remain available. Check the Windows security history and installation; do not silently disable security software. Full global push-to-talk requires the helper to be present and allowed to run.

TakkieAI for Windows is a full desktop port of the macOS app. It runs from the system tray, records while a global push-to-talk key is held, transcribes with the user's own Gemini API key, and inserts the result into the foreground application without opening a chat window.

## Supported workflow

- Hold right Ctrl to record; release to transcribe and insert.
- Press Space while recording to lock hands-free mode. Press right Ctrl again to finish or Esc to cancel.
- Change the trigger to Caps Lock or F8 in Settings.
- Use Gemini 3.5 Transcribe in Smart or Verbatim mode with automatic language detection or a fixed language.
- Bias recognition with up to 100 dictionary terms, then apply deterministic replacement rules locally.
- Keep searchable local history with raw audio, retry, copy, export, delete, word counts, and WPM statistics.
- Queue network failures and retry them automatically when the app is online again.
- Use a bottom-center, always-on-top HUD for listening, locked, processing, success, clipboard fallback, offline, secure-field, and error states.
- Start at login, choose a microphone, follow the Windows light/dark theme, and configure audio retention.

## Architecture

`windows/src/main/` is the trusted Electron main process. It owns settings, encrypted credentials, recording folders, Gemini requests, retention, tray behavior, and the dictation state machine. `windows/src/renderer/` is a sandboxed local UI with a strict Content Security Policy and no direct Node.js or network access.

`windows/native/JotNativeHelper.cs` compiles to a small .NET Framework executable. It installs a Windows low-level keyboard hook, watches only the configured dictation key plus Space/Esc gestures, records the foreground window identity, refuses to start in UI Automation password fields, and sends Unicode text with `SendInput`. TakkieAI copies the transcript to the clipboard if the foreground window changed or insertion cannot be confirmed.

Audio is captured as 16-bit mono PCM and finalized as WAV. PCM is flushed to the session folder while recording so a partial file can be recovered after an abnormal shutdown. Short files are sent inline; larger files use the Gemini Files API before transcription.

## Local data

Windows stores app data below Electron's per-user `userData` directory. The internal package identity remains `jot-windows` for compatibility; the exact data directory is included in Settings → MCP's generated configuration. Renaming the visible app does not intentionally migrate or delete existing data:

- `settings.json` — non-secret preferences.
- `gemini-key.bin` — the API key encrypted with Electron `safeStorage`, backed by Windows user-scoped protection.
- `recordings\<uuid>\meta.json` — session state and transcript.
- `recordings\<uuid>\audio.wav` — retained audio, removed according to the user's retention setting.

TakkieAI has no analytics and no TakkieAI account or middleman service. Audio and configured vocabulary terms are sent to Google's Gemini API for transcription. Review Google's Gemini API terms for the data treatment associated with your own API tier.

## Build from source

Prerequisites:

- Windows 10 or 11 x64
- Node.js 22 or newer
- npm
- .NET Framework 4.x Windows feature, including its C# compiler and UI Automation assemblies

```powershell
cd windows
npm ci
npm run lint
npm test
npm run dev
```

Create an unpacked test build or NSIS installer:

```powershell
npm run pack
npm run build
```

Artifacts appear under `windows\dist`. Public releases should be Authenticode-signed; a locally built installer is intentionally unsigned unless signing credentials are configured in the build environment.

## Windows permissions and troubleshooting

### The microphone does not start

Open Windows Settings → Privacy & security → Microphone. Enable microphone access and “Let desktop apps access your microphone,” then restart TakkieAI. Use Settings → Dictation → Microphone to select a different input.

### The shortcut does not fire

Another utility may consume Caps Lock or F8. Switch to right Ctrl in TakkieAI Settings. Security tools can also block global keyboard hooks; allow `JotNativeHelper.exe`, which is shipped next to TakkieAI and contains no network code.

### Text was copied instead of inserted

TakkieAI deliberately refuses to type if focus moved away from the window where dictation started. Return to the intended field and press Ctrl+V. Elevated applications can also reject input from a non-elevated TakkieAI process; run both applications at the same integrity level instead of running TakkieAI as administrator.

### Password fields

TakkieAI uses Windows UI Automation and the standard password-control flag to pause before recording in recognized secure fields. Custom-drawn password controls may not expose this metadata correctly; do not use dictation for passwords or other secrets.

## Current platform boundary

Windows includes the core Wispr Flow-style workflow: system-wide push-to-talk, hands-free locking, smart formatting, direct insertion, local searchable history, vocabulary, retry/offline behavior, tray/HUD, settings, onboarding, retention, and encrypted bring-your-own-key storage. It does not yet include real-time partial words while the user is still speaking, team administration, cloud history sync, mobile clients, or automatic application-specific tone profiles.
