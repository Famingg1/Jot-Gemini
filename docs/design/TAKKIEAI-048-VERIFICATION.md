# TakkieAI 0.4.8 verification

Date: 2026-09-18. Windows x64 packaged Electron application.

## Delivered behavior

- Hover HUD contains dictation and Notetaker buttons, with no globe. Existing small resting bar and side docking are retained.
- Notetaker has a separate default F9 binding, editable by recording a combination under Settings > General > Shortcuts > Notetaker. Conflicts with dictation are rejected. During an active meeting it opens the compact panel; otherwise it opens the new-meeting dialog.
- Only Notetaker sends live audio to Gemini Live. Ordinary dictation retains its existing transcription path. Durable local capture is independent of the live connection; reconnect queues are bounded and sessions rotate before the provider limit.
- Final transcript displays Spreker 1, Spreker 2, etc., instead of internal batch IDs. Names from a linked calendar event are offered for manual speaker assignment in the compact panel and persist in exports.

## Evidence

- `npm run build`: passed lint, unit tests, native compilation and NSIS packaging.
- `.capture-profile-native/verify.cjs`: all 44 packaged source files match disk; both native executables present; encoding clean.
- `screenshots/hud-pack048/hud-note.json`: packaged HUD button opens a meeting; recorded Right Alt + N persists independently of dictation; conflicting binding rejected. Screenshot visually inspected.
- `screenshots/live048b/live-verification.json`: real Gemini Live API transcribed synthetic speech successfully. No private meeting was uploaded in this test. This provider check predates two unrelated UI fixes; streaming source bytes are unchanged.
- `screenshots/desktop-filter-packaged/audio-verification.json`: actual packaged recording, pause/resume, notes persistence, close-without-stop, 375px panel, no renderer console errors. Selected Edge and newly started Opera test tones present; music-process tones absent above permitted background thresholds. Speaker-name selection persisted. Results/empty/error/paused states exercised by panel smoke; screenshots inspected.
- Audio verifier uses median short-window spectral amplitudes: summing across pause/resume caused phase cancellation. Neighbor-frequency noise checks accommodate permitted background speech. This is a test correction, not a change to capture behavior.
- New unit tests cover live interim/final messages, queue bounds, flush, rotation, readable labels and shortcut conflicts.
- Security: live key remains main-process only; generic transport errors omit credentials; meeting IPC validates trusted renderer, meeting/speaker IDs and names. Dependency installation reported zero audit vulnerabilities.

## Limits / not verified

- Physical F9 keypress on the user's keyboard was not simulated: injected keys are deliberately ignored by the native hook. Native shortcut matcher and UI recorder were tested; installed helper launch arguments are checked separately.
- Live transcription has approximate timestamps and no speaker diarization. Final batch processing supplies speaker separation and precise timing after stop. See https://ai.google.dev/gemini-api/docs/live-api/live-transcribe and https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe.
- Participant names are suggestions from linked Google Calendar events, including invitations with a Teams meeting link. This does not implement Microsoft Graph participant access or automatic voice-to-person identification. Real Google OAuth/Teams meeting integration was not end-to-end tested.
- Native desktop application: web hosting/port checks do not apply. 375px compact window was tested, not a mobile phone deployment.
- A redundant provider rerun command was rejected by automatic tool policy without a specific reason; it included copying Chromium Local State for isolated credential decryption. That operation was not retried. Prior successful real-provider evidence and final packaged tests are recorded above.
