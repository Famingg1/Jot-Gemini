# Jot for Windows

Jot for Windows is a full desktop port of the macOS app. It runs from the system tray, records while a global push-to-talk key is held, transcribes with the user's own Gemini API key, and inserts the result into the foreground application without opening a chat window.

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

`windows/native/JotNativeHelper.cs` compiles to a small .NET Framework executable. It installs a Windows low-level keyboard hook, watches only the configured dictation key plus Space/Esc gestures, records the foreground window identity, refuses to start in UI Automation password fields, and sends Unicode text with `SendInput`. Jot copies the transcript to the clipboard if the foreground window changed or insertion cannot be confirmed.

Audio is captured as 16-bit mono PCM and finalized as WAV. PCM is flushed to the session folder while recording so a partial file can be recovered after an abnormal shutdown. Short files are sent inline; larger files use the Gemini Files API before transcription.

## Local data

Windows stores app data below Electron's per-user `userData` directory, normally `%APPDATA%\Jot`:

- `settings.json` — non-secret preferences.
- `gemini-key.bin` — the API key encrypted with Electron `safeStorage`, backed by Windows user-scoped protection.
- `recordings\<uuid>\meta.json` — session state and transcript.
- `recordings\<uuid>\audio.wav` — retained audio, removed according to the user's retention setting.

Jot has no analytics and no Jot account or middleman service. Audio and configured vocabulary terms are sent to Google's Gemini API for transcription. Review Google's Gemini API terms for the data treatment associated with your own API tier.

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

Open Windows Settings → Privacy & security → Microphone. Enable microphone access and “Let desktop apps access your microphone,” then restart Jot. Use Settings → Dictation → Microphone to select a different input.

### The shortcut does not fire

Another utility may consume Caps Lock or F8. Switch to right Ctrl in Jot Settings. Security tools can also block global keyboard hooks; allow `JotNativeHelper.exe`, which is shipped next to Jot and contains no network code.

### Text was copied instead of inserted

Jot deliberately refuses to type if focus moved away from the window where dictation started. Return to the intended field and press Ctrl+V. Elevated applications can also reject input from a non-elevated Jot process; run both applications at the same integrity level instead of running Jot as administrator.

### Password fields

Jot uses Windows UI Automation and the standard password-control flag to pause before recording in recognized secure fields. Custom-drawn password controls may not expose this metadata correctly; do not use dictation for passwords or other secrets.

## Current platform boundary

Windows includes the core Wispr Flow-style workflow: system-wide push-to-talk, hands-free locking, smart formatting, direct insertion, local searchable history, vocabulary, retry/offline behavior, tray/HUD, settings, onboarding, retention, and encrypted bring-your-own-key storage. It does not yet include real-time partial words while the user is still speaking, team administration, cloud history sync, mobile clients, or automatic application-specific tone profiles.
