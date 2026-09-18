# Privacy

## The promise

Your voice goes from your Mac or Windows PC directly to Google's Gemini API, using your own API
key. There is no middleman server, no account, no analytics, no telemetry.
Local files remain on your computer unless you explicitly use an integration or export them. The code is open — verify this behavior.

## Windows Notetaker and integrations (0.4)

Windows meeting capture can record the selected microphone, system output, or both. System output includes other apps and notifications. The capture API can require a display track to obtain loopback audio; TakkieAI never renders, persists or uploads that video track. Recording starts only through a user action.

Meeting audio batches go to Google for transcription. Transcript text then goes to Google for summaries, decisions and action items. Concise/formal writing styles and explicit transforms also send the source text and editing instruction to Google. Automatic meeting transcription can be disabled while retaining local capture. Speaker identity is not inferred from calendar invitations.

Optional Google Calendar OAuth contacts Google's authorization/token endpoints and Calendar API to read upcoming primary-calendar events. Client credentials and refresh tokens are encrypted with Windows user protection; event metadata is cached locally. Disconnect removes tokens and cache, and attempts token revocation.

The local MCP server serves only notes individually marked as shared. A connected client can receive their transcript, own notes, summary and action items. Audio, unshared notes and credentials are excluded. Custom MCP connections contact user-configured servers or run configured local executables. Their tool results may contain external content; tool calls require an explicit user action. The destination's handling of received data is separate from TakkieAI's local storage.

Audio and text files are not application-encrypted. API keys, OAuth credentials/tokens and custom-connector secrets are encrypted. Retention settings apply to completed audio; incomplete jobs remain recoverable. No telemetry or automatic cloud history sync is added.

The original dictation-only description below applies to macOS and the Windows dictation core except where these explicitly enabled Windows features extend it.

## What leaves your machine (the complete list)

1. **The audio of each dictation** (FLAC on macOS, WAV on Windows), sent to
   `generativelanguage.googleapis.com` for transcription.
2. **Your dictionary terms**, alongside that audio. The transcription model uses
   them to bias what it hears, which is why names and jargon come out spelled
   right as you speak rather than being corrected afterwards. Only the correct
   spellings are sent — never the misspellings you record. They ride on every
   dictation, including with Smart transcription off.
3. **The formatting prompt**, *only if* "Match tone to the app you're in" is on
   in Settings → Dictation — off by default. It contains the transcript being
   formatted, the formatting rules, a coarse tone category derived from the
   frontmost app's *category* (e.g. "chat message"), and your dictionary terms.
   The Windows writing-style, meeting-summary and explicit transform features described above can also send transcript text.
   Never window contents, never screenshots, never surrounding text.
4. **Your API key**, in the request header to Google only. It is stored in the
   macOS Keychain or a Windows user-scoped encrypted secret, never in plain-text preferences.

## What never leaves

- Your history database and stored recordings — audio and transcript text leave
  only as part of the requests above, never in bulk and never anywhere else
- Your dictionary as a file. Individual terms ride with the audio as described
  above, and your misspelling rules are included in the formatting prompt *only*
  when tone matching is on — with it off (the default) they never leave. The
  store itself, and everything you have not dictated against, stays on your computer
- Which apps you use, when you dictate, or anything you type
- Keystrokes: the event tap watches your dictation key, plus — only while a
  dictation is active — Esc (cancel), Space (the hands-free gesture), and the
  *fact that* another key was pressed (the accidental-chord guard; which key it
  was is never examined beyond its keycode, never logged, never stored, never
  transmitted). When you're not dictating, other keys pass through untouched.
- Screenshots: never taken during normal operation. The Windows build's opt-in
  smoke-test mode can capture only TakkieAI's own windows for UI verification.
- Telemetry: there is none. No analytics SDK, no crash uploader, no phone-home.

## What's stored locally, and your controls

- One folder per dictation (`~/Library/Application Support/TakkieAI/recordings/` on macOS,
  Electron's `%APPDATA%` user-data directory on Windows):
  crash-safe audio, transcript, metadata — this is what makes Retry and recovery work.
- Settings → Privacy & Storage: audio retention (24h / 7d / 30d / forever / never —
  "never" disables Retry), plus one-click **Delete all history**.
- Local recording files are protected by FileVault or BitLocker if enabled; they
  are not separately encrypted (stated honestly). The API key is separately
  protected by macOS Keychain or Windows user-scoped encryption.

## Google's side of the wire

Your audio is governed by your own Gemini API terms with Google. As of writing,
paid-tier API usage is not used for model training; free-tier usage may be. That
relationship is yours — this app doesn't broker it. Review the
[Gemini API terms](https://ai.google.dev/gemini-api/terms).

## Secure input

When a recognized password field is focused (secure input), dictation refuses to start, and
a transcript in flight is held in History only — never inserted, never placed on
the clipboard.

## Verify it

- Build from source (`./scripts/build.sh` on macOS or `npm run build` in `windows/`).
- Watch traffic with Little Snitch or `nettop` — you'll see exactly one host.
- Read the prompt: it's a source file — note it governs only the optional tone pass; with that off, formatting happens inside Google's transcription model and there is no local prompt to read
  ([PromptV1.swift](../JotCore/Sources/FormattingPipeline/PromptV1.swift)).
