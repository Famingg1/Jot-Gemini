# Speech-to-text models and APIs for a dictation product and meeting notetaker (state as of 19 September 2026)

Scope: dictation-relevant features beyond raw WER (smart formatting, punctuation, filler removal, self-correction handling, custom vocabulary, prompting, Dutch/English code-switching, streaming latency, diarization, privacy), plus whether local/on-device inference on a typical Windows laptop is good enough to replace the cloud. Where a claim comes from vendor marketing rather than API documentation, or from an anecdotal third-party report, that is flagged inline.

Quick orientation (details and sources under each key question below):

- Only one vendor documents native self-correction resolution in the ASR API itself: Gemini 3.5 Transcribe's `mode: "smart"` (August 2026). Everyone else either removes a few fillers (Deepgram strips "uh"/"um" in English only, ElevenLabs "no verbatim mode") or leaves cleanup to a separate LLM pass.
- Azure's "LLM Speech" API and OpenAI's `gpt-transcribe` accept free-text prompts, but Azure documents prompts as style guidance only (lexical vs display) and AssemblyAI explicitly says its prompt is for vocabulary, not formatting behaviour.
- Dutch is a first-class language at Gemini 3.5 Transcribe, ElevenLabs Scribe v2 ("Excellent" tier), AssemblyAI Universal-3.5 Pro (18 languages incl. Dutch), Deepgram Nova-3 (incl. in the 10-language `multi` code-switching mode), Mistral Voxtral (13 languages incl. Dutch), Soniox, Speechmatics, Azure, and locally at Parakeet TDT 0.6B v3, Canary 1B v2, Voxtral Mini 4B Realtime, Qwen3-ASR and Nemotron 3.5 ASR Streaming. Moonshine and Kyutai STT are English-first with no Dutch.
- Locally, the practical 2026 choices for a Windows laptop are NVIDIA Parakeet TDT 0.6B v3 (CC-BY-4.0, ~630 to 680 MB INT8, CPU-viable via sherpa-onnx/ONNX or the GGUF port used by Handy) and Whisper large-v3-turbo (int8, needs a GPU to feel instant). NPU acceleration on Windows is still immature outside AMD (VitisAI in whisper.cpp) and Intel OpenVINO; Qualcomm Snapdragon NPUs sit idle in current dictation apps.

---

## KQ1. Dictation-relevant features per cloud model/API

### Takeaway
Feature coverage now differs more than accuracy does. Gemini 3.5 Transcribe (Aug 2026) is the only API whose documentation promises inline self-correction resolution, filler removal and structured formatting natively, but its custom vocabulary cannot be combined with diarization or timestamps. OpenAI `gpt-transcribe` (Aug 2026) adds `keywords` and `languages` hints; AssemblyAI Universal-3.5 Pro, Deepgram Nova-3, ElevenLabs Scribe v2, Voxtral, Soniox, Speechmatics and Azure all offer some form of vocabulary biasing, with limits ranging from 100 terms (AssemblyAI, Voxtral) to 1,000 (Gemini, ElevenLabs, Speechmatics recommended) to 8,000 tokens of free text (Soniox).

### Cited Findings

**Google Gemini 3.5 Transcribe (released August 2026)**
- Model IDs `gemini-3.5-transcribe` (file/batch, "Interactions API") and `gemini-3.5-transcribe-live` (Live API WebSockets, max 10 minutes per session); files up to 1 hour per request, 30 minutes when diarization or word timestamps are enabled; Dutch listed as `nl-NL` among 85+ languages — [Gemini 3.5 Transcribe model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe)
- Smart transcription is enabled with `"mode": "smart"` in `generation_config.transcription_config`. Documented behaviour: "Disfluency removal: Strips conversational filler words, stuttering, and false starts", "Inline self-corrections: Resolves spoken corrections directly" with the documented example "Let's meet on Tuesday, actually no, Wednesday at two" becoming "Let's meet on Wednesday at 2:00 PM", plus "Automatic structured formatting" into paragraphs, numbered lists and bullet points, and "Grammatical cleanup" — [Gemini audio transcription docs](https://ai.google.dev/gemini-api/docs/transcribe)
- Custom vocabulary: up to 1,000 terms in `custom_vocabulary`; "Customers typically see best results with up to 100 terms"; "You cannot combine custom_vocabulary with speaker diarization or word-level timestamps"; word timestamps "Degrades transcription accuracy" — [model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe); [transcribe docs](https://ai.google.dev/gemini-api/docs/transcribe)
- Code-switching: "Handles intra-sentence and inter-sentential code-switching without manual configuration", auto-detects 85+ locales, "mid-session code-mixing" supported in live — [transcribe docs](https://ai.google.dev/gemini-api/docs/transcribe); [model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe)
- Diarization: file mode only, up to 8 speakers, "Attribution for 3+ speakers is experimental"; not supported in live streaming — [model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe)
- The transcription docs describe no free-text instruction/prompt parameter for the transcribe model (only `custom_vocabulary` and `mode`) — [transcribe docs](https://ai.google.dev/gemini-api/docs/transcribe)
- Marketing claims (Google blog, 26 Aug 2026): average WER 4.0% streaming and 2.6% non-streaming "as measured by Artificial Analysis", FLEURS top-languages 5.50% streaming / 5.04% non-streaming, "time to final transcription improves by 70%" vs Chirp 3, powers Gboard "Rambler" and the Gemini macOS app, Chrome "coming soon"; public preview — [Google blog](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5-transcribe/); [9to5Google, 26 Aug 2026](https://9to5google.com/2026/08/26/gemini-3-5-transcribe/)
- Pricing: `gemini-3.5-transcribe` $0.003/min audio in + $0.002/min text out ($2.00 / $12.00 per 1M tokens); `gemini-3.5-transcribe-live` $0.005/min in + $0.004/min out ($3.50 / $21.00 per 1M tokens) — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)

**Gemini 3.5 Flash / 2.5 Flash with audio + prompt (generic multimodal route)**
- Audio is tokenized at 32 tokens per second (about 1,920 tokens per minute), up to 9.5 hours per prompt; audio is downsampled to 16 kbps and mixed to mono; transcription is requested by prompting ("Generate a transcript of the speech"), and timestamps/speaker labels can be requested via prompt with structured output — [Gemini audio understanding docs](https://ai.google.dev/gemini-api/docs/audio)
- Audio input price: Gemini 3.5 Flash $1.00 per 1M audio tokens; Gemini 2.5 Flash $1.00 per 1M audio tokens in, $2.50 per 1M out — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Independent streaming benchmark (June 2026) shows ElevenLabs claiming Scribe v2 Realtime outperforms "Gemini Flash 2.5, GPT-4o Mini Transcribe, and Deepgram Nova 3 on the FLEURS benchmark" (vendor claim) — [ElevenLabs realtime page](https://elevenlabs.io/realtime-speech-to-text)

**OpenAI (gpt-transcribe, gpt-live-transcribe, gpt-4o-transcribe family, Realtime API)**
- Current file-transcription models: `gpt-transcribe` (recommended), `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `gpt-4o-transcribe-diarize` (speaker labels, up to four known-speaker references, `diarized_json`), `whisper-1` (legacy, only model with `timestamp_granularities`); all except whisper-1 support streaming; files max 25 MB — [OpenAI speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text)
- `gpt-transcribe` supports "unstructured context, keyword hints, and multiple language hints to improve transcription of domain terms, multilingual audio, and code-switching" via `prompt`, `keywords`, `languages`; docs recommend keywords over prompt-only for reliable spelling; price $0.0045/min — [gpt-transcribe model page](https://developers.openai.com/api/docs/models/gpt-transcribe); [speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text)
- `gpt-transcribe` release date 5 August 2026 (third-party pricing tracker, not OpenAI docs) — [costgoat](https://costgoat.com/pricing/openai-transcription)
- Realtime transcription sessions (`type: "transcription"`, PCM 24 kHz, WebSocket or WebRTC): `gpt-live-transcribe` "returns transcript deltas as speech arrives and a final transcript when your application commits each audio turn"; `delay` parameter with five settings (minimal, low, medium, high, xhigh); turn detection off by default (explicit `input_audio_buffer.commit`) or server VAD; `prompt`, `keywords` (no `<`, `>`, CR, LF) and `languages`; `gpt-live-transcribe` "doesn't provide word-level timestamps, speaker labels, or confidence scores" — [OpenAI realtime transcription guide](https://developers.openai.com/api/docs/guides/realtime-transcription)
- Realtime API prompt limit 1024 tokens (Microsoft community post on the Azure-hosted variant) — [Microsoft Tech Community](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/real-time-speech-transcription-with-gpt-4o-transcribe-and-gpt-4o-mini-transcribe/4410353)
- Pricing per minute: gpt-transcribe $0.0045, gpt-live-transcribe $0.017, gpt-4o-transcribe $0.006, gpt-4o-mini-transcribe $0.003, gpt-4o-transcribe-diarize $0.006, whisper $0.006 — [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- No documented filler-word removal, self-correction handling or "smart format" parameter for any OpenAI transcription model in the guides fetched — [speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text)

**Deepgram Nova-3 and Flux**
- Models: Flux ("first conversational speech recognition model built specifically for voice agents"), Nova-3 (general), Nova-2 (fallback languages), Nova-3 Medical/Pharma. Nova-3 monolingual covers 50+ languages including Dutch; multilingual code-switching via language code `multi` covers "English, Spanish, French, German, Hindi, Russian, Portuguese, Japanese, Italian, and Dutch" — [Deepgram models and languages overview](https://developers.deepgram.com/docs/models-languages-overview)
- Keyterm prompting (Nova-3 and Flux only; Nova-2 uses legacy `keywords`): repeated `keyterm=` query params, plain terms only (no weights), "limited to 500 tokens per request", guidance to focus on 20 to 50 terms; works for "both monolingual and multilingual transcription" but the page does not list per-language support — [Deepgram keyterm docs](https://developers.deepgram.com/docs/keyterm)
- `smart_format=true` applies punctuation, paragraphs and entity formatting (dates, times, numbers) — [Vapi summary of Deepgram docs](https://docs.vapi.ai/customization/custom-keywords); [OSTT provider reference](https://ostt.ai/reference/providers/deepgram)
- `filler_words` defaults to false: "When filler_words=false or the parameter is not set, the two most common fillers, 'uh' and 'um', are stripped out"; the feature (and the stripping list uh, um, mhmm, mm-mm, uh-uh, uh-huh, nuh-uh) is documented for English only, Nova/Nova-2/Nova-3 — [Deepgram filler words docs](https://developers.deepgram.com/docs/filler-words)
- Flux: `flux-general-en` and `flux-general-multi` (10 languages, `language_hint`), configurable end-of-turn via `eager_eot_threshold`; Dutch not explicitly listed on the Flux page — [Deepgram Flux docs](https://developers.deepgram.com/docs/flux)
- Pricing (third-party trackers, not Deepgram docs): Nova-3 batch about $0.0043/min, streaming $0.0077/min list with a $0.0048/min promotional rate; self-hosted available for enterprise contracts — [ConvertAudioToText](https://convertaudiototext.com/blog/deepgram-nova-3-explained); [diyai](https://diyai.io/ai-tools/speech-to-text/deepgram-pricing-2026/)

**AssemblyAI Universal-3.5 Pro / Universal-2 / Universal-Streaming**
- Universal-3.5 Pro: "highest accuracy, fastest model with 18-language support, native code switching, and contextual prompting"; Universal-2 remains the 99-language fallback — [AssemblyAI Universal-3 Pro docs](https://www.assemblyai.com/docs/pre-recorded-audio/universal-3-pro)
- Dutch (`nl`) is one of the 18 Universal-3.5 Pro languages (with English variants, Spanish, French, German, Italian, Portuguese, Arabic, Danish, Finnish, Hebrew, Hindi, Japanese, Mandarin, Norwegian, Swedish, Turkish, Vietnamese); if a feature is unsupported for a language, a manually set language code returns an error while auto-detect silently drops the feature — [AssemblyAI supported languages](https://www.assemblyai.com/docs/speech-to-text/pre-recorded-audio/supported-languages)
- Prompting is for vocabulary only: "Transcription behavior — punctuation, formatting, verbatim style — is already optimized out of the box"; keyterms up to 100 terms / 8,000 characters, with a warning that many or common terms "could lead to overcorrections and hallucinations" — [AssemblyAI prompting and keyterms](https://www.assemblyai.com/docs/sync-stt/prompting-and-keyterms)
- Older docs: `keyterms_prompt` up to 1,000 terms for pre-recorded, 100 per streaming session, 200 for Universal; `custom_spelling` maps words/phrases to a desired spelling — [AssemblyAI keyterms docs](https://www.assemblyai.com/docs/pre-recorded-audio/keyterms-prompting); [custom spelling](https://www.assemblyai.com/docs/speech-to-text/pre-recorded-audio/custom-spelling)
- Pricing: Universal-3.5 Pro async $0.21/hr, Universal-2 $0.15/hr; Universal-3.5 Pro Realtime (`u3-rt-pro`) $0.45/hr; Universal-Streaming $0.15/hr; keyterms +$0.05/hr async (included in U3.5 Pro Realtime); diarization +$0.02/hr async, +$0.12/hr streaming — [AssemblyAI pricing](https://www.assemblyai.com/pricing)

**ElevenLabs Scribe v2 and Scribe v2 Realtime**
- Scribe v2 (batch): keyterm prompting up to 1,000 terms, diarization up to 32 speakers, entity detection (65 types), word timestamps, audio tagging, files up to 3 GB / 10 hours; "No verbatim mode" removes filler words and disfluencies for "cleaner output"; Dutch (`nld`) is in the "Excellent" (≤5% WER) tier — [ElevenLabs STT docs](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)
- Scribe v2 Realtime released 11 Nov 2025: "transcribes speech in under 150 ms", 90+ languages, "Negative latency: Next word and punctuation prediction", auto language detection with mid-conversation switching, VAD or manual commit, PCM 48 kHz / mu-law — [ElevenLabs blog](https://elevenlabs.io/blog/introducing-scribe-v2-realtime)
- Pricing: Scribe v2 $0.22/hr (+$0.05/hr keyterms, +$0.07/hr entity detection); Scribe v2 Realtime $0.39/hr — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
- Marketing claim: "93.5% accuracy across 30 languages", outperforming Gemini Flash 2.5, GPT-4o Mini Transcribe, Deepgram Nova 3 on FLEURS — [ElevenLabs realtime page](https://elevenlabs.io/realtime-speech-to-text)

**Mistral Voxtral Transcribe 2 (released 4 Feb 2026)**
- Two models: Voxtral Mini Transcribe V2 (batch, $0.003/min) and Voxtral Realtime (streaming, $0.006/min, "latency configurable down to sub-200ms"); 13 languages including Dutch; diarization with timestamps; context biasing "up to 100 words or phrases"; audio up to 3 hours; Voxtral Realtime open-weights Apache 2.0; vendor WER claim "approximately 4% on FLEURS" and "outperforms GPT-4o mini Transcribe, Gemini 2.5 Flash, Assembly Universal, and Deepgram Nova" (marketing) — [Mistral news](https://mistral.ai/news/voxtral-transcribe-2/)

**Soniox**
- Context object with four sections (general key-value, free text, terms, translation terms), max 8,000 tokens (~10,000 characters) — [Soniox context docs](https://soniox.com/docs/stt/concepts/context)
- Dutch page: current real-time model `stt-rt-v5` at $0.12/hr (updated June 2026), "sub-200ms streaming latency", automatic language detection that "follows changes between Dutch and other languages as they happen, even within the same sentence", EU data residency; no Dutch WER published (marketing page) — [Soniox Dutch page](https://soniox.com/speech-to-text/dutch)

**Speechmatics (Ursa 2)**
- Custom dictionary via `additional_vocab` with optional `sounds_like`; available in Batch, Realtime and Agent STT; recommended max 1,000 entries, hard limit 20,000, max 6 words per entry; realtime caches dictionaries for 24 hours — [Speechmatics custom dictionary docs](https://docs.speechmatics.com/speech-to-text/features/custom-dictionary)
- Ursa 2: vendor claims 18% WER reduction across 50+ languages vs Ursa 1 and real-time latency "<1 second"; Dutch supported; no Dutch-specific WER published — [Speechmatics Ursa 2 article](https://www.speechmatics.com/company/articles-and-news/ursa-2-elevating-speech-recognition-across-52-languages); [Speechmatics Dutch page](https://www.speechmatics.com/speech-to-text/dutch)

**Azure Speech (Fast transcription, LLM Speech API, phrase lists)**
- Phrase lists work in real-time and fast transcription with a `biasing_weight` between 0.0 and 2.0; fast transcription supports Dutch — [Azure phrase list docs](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/improve-accuracy-phrase-list); [Azure fast transcription](https://docs.azure.cn/en-us/ai-services/speech-service/fast-transcription-create)
- LLM Speech API (Foundry, doc updated 5 June 2026): "A large language model (LLM) enhances a speech model, delivering improved quality, deep contextual understanding, multilingual support, and prompt-tuning capabilities"; 25 input languages including Dutch; multilingual by default; prompts up to 4,096 characters (REST: 20,000), "preferably written in English", "can guide output formatting" (display vs lexical), and "Prompts that aren't related to speech tasks (for example, Tell me a story.) are typically disregarded"; custom prompting is only supported in the LLM Speech column of the feature table — [Azure LLM Speech docs](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/llm-speech)

### Inferences
- For a push-to-talk dictation product, Gemini 3.5 Transcribe smart mode is the only single-call route that yields formatted, self-corrected text; every other API needs a second (LLM) stage for self-corrections (see KQ2).
- Gemini's constraint that `custom_vocabulary` excludes diarization/timestamps means a meeting notetaker that needs speakers cannot also use the user dictionary in the same call; two calls or a different vendor would be needed for meetings.
- AssemblyAI's explicit statement that prompts do not change formatting, and Azure's note that off-task prompts are ignored, indicate that "prompt injection" of style rules is not a reliable formatting mechanism at most ASR vendors; only the generic LLM audio route (Gemini Flash with a prompt) truly follows instructions.

### Gaps
- Gemini live transcription page (`/docs/live-transcription`) returned 404; whether `mode: "smart"` and `custom_vocabulary` apply to `gemini-3.5-transcribe-live` could not be confirmed from docs.
- Deepgram's docs do not state which languages support `keyterm`; `filler_words` is documented as English-only, so Dutch filler handling at Deepgram is unknown.
- Speechmatics custom dictionary page only names English and Japanese explicitly; Dutch support for `sounds_like` is unconfirmed.
- No vendor other than Google publishes a documented example of self-correction resolution.

---

## KQ2. Do ASR models handle self-correction and filler removal natively, or is an LLM pass needed? Which cheap models and what cost per dictation?

### Takeaway
Natively: Gemini 3.5 Transcribe smart mode (documented self-corrections plus fillers), ElevenLabs "no verbatim mode" (fillers/disfluencies, no self-correction claim), Deepgram (strips "uh"/"um" in English by default) and Windows Fluid Dictation (English-only, on-device SLM). Everything else, including OpenAI, AssemblyAI, Speechmatics, Soniox, Voxtral and all local models, needs a post-processing pass. A cheap LLM pass with gpt-5-nano or Gemini Flash-Lite costs on the order of $0.00005 to $0.0002 per 10-second dictation (calculated below), so cost is negligible; latency and reliability are the real trade-offs, which is why some open-source projects are moving cleanup back to rules/classifiers.

### Cited Findings
- Gemini 3.5 Transcribe smart mode documents "Inline self-corrections: Resolves spoken corrections directly" and "Disfluency removal: Strips conversational filler words, stuttering, and false starts" — [Gemini transcribe docs](https://ai.google.dev/gemini-api/docs/transcribe)
- ElevenLabs Scribe v2 "No verbatim mode" removes filler words and disfluencies; nothing documented about self-corrections — [ElevenLabs STT docs](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)
- Deepgram strips "uh" and "um" by default (English only) — [Deepgram filler words](https://developers.deepgram.com/docs/filler-words)
- AssemblyAI: prompting cannot change verbatim style; the page "does not address filler words or self-correction behavior" — [AssemblyAI prompting docs](https://www.assemblyai.com/docs/sync-stt/prompting-and-keyterms)
- Azure LLM Speech prompts can switch between display and lexical formatting, but off-task prompts "are typically disregarded" — [Azure LLM Speech docs](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/llm-speech)
- Windows Fluid Dictation (Copilot+ PCs, all English locales only) "automatically corrects grammar, punctuation, and filler words as you speak", "powered by on-device small language models (SLMs)"; normal Win+H voice typing uses online Azure speech — [Microsoft Support voice typing](https://support.microsoft.com/en-us/accessibility/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc)
- Academic framing: "Readable transcription requires disfluency removal and self-correction resolution"; users "often change their mind about what to say and ASR itself commonly introduces transcription errors" — [Toward Interactive Dictation, arXiv 2307.04008](https://arxiv.org/pdf/2307.04008)
- 2026 research finds "Contemporary instruction-tuned LLMs are not inherently robust to natural ASR disfluencies", motivating dedicated disfluency-aware fine-tuning — [Mind the Pause, arXiv 2605.12242](https://arxiv.org/pdf/2605.12242); [ACL 2026 long paper](https://aclanthology.org/2026.acl-long.2137.pdf)
- Open-source dictation project voxtype (issue #696, 1 Sept 2026) proposes a staged pipeline "vocabulary → disfluency → punctuation/casing → ITN → user rules" using labelers and rules instead of LLM rewriting, citing LLM failure modes (empty responses, `<think>` artefacts, reasoning models unsuitable); disfluency detection targets reparandum/interregnum/repair patterns (LARD dataset, CC-BY), with an eventual single encoder "~10ms" per pass, and LLMs constrained to an edit-list contract for tone/restructuring only — [voxtype issue #696](https://github.com/peteonrails/voxtype/issues/696)
- Commercial practice (third-party reviews, anecdotal): Wispr Flow is cloud-only, uploads audio to AWS us-east-1 via Baseten, OpenAI, Anthropic and Cerebras subprocessors and "clean[s] up by default, with filler words removed, grammar corrected"; Superwhisper runs Whisper locally and "gives you a faithful transcript—every 'um', every false start" unless the user configures custom cleanup prompts — [Spokenly review](https://spokenly.app/blog/wispr-flow-review); [Superwhisper vs Wispr Flow](https://www.getvoibe.com/resources/wispr-flow-vs-superwhisper/)
- OpenWhispr (open source) advertises "AI cleanup" alongside local Whisper/Parakeet transcription — [OpenWhispr Windows page](https://openwhispr.com/blog/best-dictation-tools-windows-2026)
- Cheap LLM prices per 1M tokens: gpt-5-nano $0.05 in / $0.40 out; gpt-4.1-nano $0.10 / $0.40; gpt-5-mini $0.25 / $2.00; gpt-5.4-nano $0.20 / $1.25 — [OpenAI pricing](https://developers.openai.com/api/docs/pricing). Gemini 3.1 Flash-Lite $0.25 in / $1.50 out (batch $0.125 / $0.75) — [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing). Gemini 2.5 Flash-Lite $0.10 in / $0.40 out (third-party comparison) — [Medium comparison](https://medium.com/@sidmehtamit/gpt-5-nano-vs-gemini-2-5-flash-lite-an-evaluation-of-cost-effective-ai-9e007b964a58)
- Third-party evaluation: Gemini 2.5 Flash-Lite is "the speed leader when cognitive load is low, but its accuracy drops sharply as instructions increase", while GPT-5 nano keeps accuracy under heavier instructions (anecdotal single-author test) — [Medium comparison](https://medium.com/@sidmehtamit/gpt-5-nano-vs-gemini-2-5-flash-lite-an-evaluation-of-cost-effective-ai-9e007b964a58)

### Inferences
- Cost per dictation (own calculation from the prices above, assuming a ~300-token system prompt with user dictionary, ~40 tokens of transcript in, ~50 tokens out): gpt-5-nano ≈ $0.00004; gpt-4.1-nano ≈ $0.00006; Gemini 3.1 Flash-Lite ≈ $0.00016; gpt-5-mini ≈ $0.00019. At 200 dictations per user per day this is well under $0.05 per user per day, so the ASR minute price dominates total cost.
- Given the research finding that generic LLMs are not robust to disfluencies and the voxtype experience, a dictation product should treat the LLM pass as a constrained edit step (tight prompt, low temperature, guard against empty/over-rewritten output) or use a native option (Gemini smart mode) when available.
- The self-correction example in the prompt ("let's meet at 1pm, actually no, 2pm") matches almost exactly Google's documented example, which suggests Google built smart mode for this dictation use case (Gboard Rambler).

### Gaps
- No published, independent accuracy benchmark for self-correction resolution (Gemini smart mode or any LLM) was found; quality is only asserted by the vendor.
- No source gives measured added latency of an LLM cleanup pass for short dictations; only Wispr Flow's overall ~700 ms pipeline figure exists (third-party, anecdotal).
- Whether Dutch self-corrections ("nee wacht", "eh, ik bedoel") are handled by Gemini smart mode as well as English is not documented.

---

## KQ3. End-to-end latency for a 10-second clip, batch vs streaming; which APIs accept audio while the user is still speaking

### Takeaway
All major vendors now support streaming input while the user speaks (Gemini Live, OpenAI Realtime, Deepgram, AssemblyAI, ElevenLabs, Voxtral Realtime, Soniox, Speechmatics, Azure). Independent measurements from Artificial Analysis (June 2026) put time-to-final after end of speech at 20 ms (Deepgram Flux), 60 ms (Nova-3, Soniox), 140 ms (ElevenLabs Scribe v2 Realtime) and ~470 ms to first partial for AssemblyAI U3 Realtime Pro. No independent per-vendor number for batch transcription of a 10-second clip exists; AA's batch "speed factor" is measured on 10-minute files and explicitly warned not to hold for clips under a minute.

### Cited Findings
- AA-WER Streaming benchmark (published 1 June 2026, ~8 hours of audio, latency measured after Silero VAD end-of-speech): Deepgram Flux 7.36% WER, 20 ms to final; Deepgram Nova-3 Realtime 6.69% partial WER, 60 ms to final; ElevenLabs Scribe v2 Realtime 3.64% WER, 140 ms to final; Cartesia Ink-2 3.66%, 90 ms; AssemblyAI U3 Realtime Pro 4.46% partial WER at 470 ms; Soniox Realtime 60 ms to final; OpenAI Whisper Realtime 5.1% final WER; Voxtral Mini Transcribe 5.3% final WER — [Artificial Analysis AA-WER Streaming](https://artificialanalysis.ai/articles/new-streaming-speech-to-text-benchmark-aa-wer-streaming)
- AA non-streaming speed factor: Nova-3 fastest at 542.9x real time; measurements "based on an audio duration of 10 minutes, and Speed Factor may vary for other durations, particularly very short durations under 1 minute" — [AA non-streaming leaderboard](https://artificialanalysis.ai/speech-to-text/non-streaming); [AA methodology](https://artificialanalysis.ai/speech-to-text/methodology)
- Gemini 3.5 Transcribe: "Real-time streaming which delivers continuous, bidirectional streaming with sub-second latency" via the Live API; 70% faster time-to-final than Chirp 3 (vendor claims) — [Google blog](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5-transcribe/); [DeepMind page](https://deepmind.google/models/gemini-audio/ai-transcription/)
- OpenAI `gpt-live-transcribe` emits `conversation.item.input_audio_transcription.delta` while speaking and `.completed` on commit; `delay` setting from minimal to xhigh, "exact delay in milliseconds can vary by model configuration" — [OpenAI realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription)
- ElevenLabs: "transcribes speech in under 150 ms", partials while speaking, committed segments on finalisation — [ElevenLabs blog](https://elevenlabs.io/blog/introducing-scribe-v2-realtime)
- Voxtral Realtime: "latency configurable down to sub-200ms"; open model card shows FLEURS WER vs delay: 160 ms 12.60%, 240 ms 10.80%, 480 ms 8.72%, 960 ms 7.70%, 2400 ms 6.73% (recommended 480 ms) — [Mistral news](https://mistral.ai/news/voxtral-transcribe-2/); [Voxtral Mini 4B Realtime model card](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602)
- Soniox: "sub-200ms streaming latency" (marketing) — [Soniox Dutch page](https://soniox.com/speech-to-text/dutch)
- Speechmatics: real-time latency "<1 second" (vendor) — [Speechmatics article](https://www.speechmatics.com/company/articles-and-news/best-in-class-real-time-asr-system)
- Deepgram marketing: "Sub-300ms" streaming for Nova-3 — [Substack review](https://neurlcreators.substack.com/p/nova-3-deepgram-review)
- Commercial dictation pipelines (third-party, anecdotal): Wispr Flow cloud pipeline "approximately 700ms"; Superwhisper local "roughly 1 to 2 seconds depending on the model" — [Superwhisper vs Wispr Flow](https://www.getvoibe.com/resources/wispr-flow-vs-superwhisper/)
- Local CPU counter-example: on a Snapdragon X Plus Surface, OpenWhispr's whisper.cpp build ran CPU-only at 73% CPU with "5-7 seconds for short dictation", GPU and NPU at 0% (user report, 29 May 2026) — [OpenWhispr issue #867](https://github.com/OpenWhispr/openwhispr/issues/867)

### Inferences
- For push-to-talk with a 10 s clip, streaming the audio during the hold and committing on release gives ~20 to 500 ms to final text at most vendors; a batch upload after release adds upload time plus model time, which for these models is a fraction of a second but is not independently measured for short clips.
- Streaming models trade accuracy for latency (Voxtral's own curve shows WER roughly doubling from 2.4 s to 160 ms delay), so for dictation a 480 ms to 1 s delay setting, or a batch call on the full clip, is the better quality choice; the streaming benefit is mostly perceived responsiveness.
- Adding an LLM cleanup call after ASR roughly doubles the number of network round trips; Wispr Flow's ~700 ms total suggests an optimised cloud ASR + LLM pipeline can stay under one second.

### Gaps
- No independent batch latency figures for 10-second clips per vendor (AA measures 10-minute files).
- Gemini 3.5 Transcribe Live and OpenAI gpt-live-transcribe do not appear in the AA streaming table fetched; their measured latencies are unknown.
- Dutch-specific streaming latency/WER is not reported by AA (English datasets only).

---

## KQ4. Local/on-device options on a typical Windows laptop: quality, speed, size, licensing

### Takeaway
By September 2026 a Windows laptop can run Dutch-capable ASR with cloud-class accuracy in the open models (Parakeet TDT 0.6B v3: FLEURS-nl 6.5 to 7.5% WER, CC-BY-4.0, ~650 MB INT8; Canary 1B v2: FLEURS-nl 5.3%, CC-BY-4.0; Voxtral Mini 4B Realtime: FLEURS-nl 7.07% at 480 ms, Apache 2.0 but needs a 16 GB GPU in BF16; Qwen3-ASR 1.7B, Apache 2.0). Whisper large-v3-turbo remains the most widely packaged option but is slow on CPU. None of the local models do smart formatting or self-corrections; NPU acceleration on Windows is only partially wired up (AMD VitisAI, Intel OpenVINO in whisper.cpp; Qualcomm QNN not used by current dictation apps).

### Cited Findings

**Whisper (large-v3, large-v3-turbo) via whisper.cpp / faster-whisper**
- whisper-large-v3 license Apache-2.0; trained on 1M hours weakly labeled + 4M hours pseudo-labeled audio; "10% to 20% reduction of errors compared to Whisper large-v2"; documented hallucination ("may include texts that are not actually spoken") and repetition tendencies — [openai/whisper-large-v3 model card](https://huggingface.co/openai/whisper-large-v3)
- whisper.cpp backends: CPU (AVX, NEON), CUDA, ROCm/HIP, Vulkan, Intel OpenVINO, Core ML, AMD Ryzen AI NPU (VitisAI), Ascend NPU (CANN), Moore Threads; Windows via MSVC/MinGW; integer quantization (e.g. Q5_0); large-v3 is 2.9 GiB on disk / ~3.9 GB RAM — [whisper.cpp README](https://github.com/ggml-org/whisper.cpp)
- faster-whisper benchmark on an (unspecified) NVIDIA GPU, 13 min audio, beam 5: large-v3 fp16 52.0 s / 4,521 MB VRAM; large-v3-turbo fp16 19.2 s / 2,537 MB; turbo int8 19.6 s / 1,545 MB VRAM (about 2.7x faster than large-v3) — [faster-whisper issue #1030](https://github.com/SYSTRAN/faster-whisper/issues/1030)
- whisper.cpp on a 2010 Intel i5-460M (2c/4t, DDR3), 11 s clip, q4_0: tiny 6.97 s (RTF 1.58x), base 12.86 s, small 39.65 s, medium 113.85 s, large-v3-turbo 142.16 s; author concludes only tiny is interactive on that hardware class — [whisper.cpp discussion #3752](https://github.com/ggml-org/whisper.cpp/discussions/3752)
- Third-party summaries: turbo is "4× faster than Large-v3 at 1-2 WER points cost" and Dutch is a "Tier 1" language with 0.5 to 2 WER points degradation on turbo; "CPU-only on a recent Intel laptop is fast enough for occasional use but not fast enough to feel instant" (blog claims, not primary benchmarks) — [VexaScribe](https://vexascribe.com/whisper-large-v3-vs-turbo); [Tessera AI](https://tesseraai.cloud/en/blog/whisper-large-v3-turbo-vs-large-v3-cpu-eu/)
- Turbo "delivers roughly 4× speed on GPU, 6× speed on CPU (via faster-whisper), and 5× speed on Apple Silicon (via whisper.cpp)" (blog claim) — [Whisper Notes](https://whispernotes.app/blog/introducing-whisper-large-v3-turbo)

**NVIDIA Parakeet TDT 0.6B v3 (released 14 Aug 2025)**
- CC-BY-4.0; 25 European languages including Dutch, automatic language detection; punctuation and capitalization; word/segment timestamps; RTFx 3,332.74 (GPU); FLEURS Dutch WER 7.48% (model card); minimum 2 GB RAM; "words outside the trained vocabulary are unlikely to be recognized" — [nvidia/parakeet-tdt-0.6b-v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)
- Open ASR Leaderboard Dutch seed results (PR merged 4 Sept 2026): Parakeet-TDT-0.6b-v3 FLEURS 6.50%, Common Voice 5.47%, MLS 11.27% — [open_asr_leaderboard PR #208](https://github.com/huggingface/open_asr_leaderboard/pull/208)
- sherpa-onnx int8 build: needs ONNX Runtime ≥1.22 and sherpa-onnx ≥1.12; INT8 ONNX models are "roughly 630–680MB on disk", ~2 GB RAM; wrapper README claims "up to 30x faster than real-time on modern CPUs" while another wrapper reports RTF 0.325 on an i7-12700K (3.845 s audio in 1.249 s) — conflicting anecdotal numbers — [csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8](https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8); [achetronic/parakeet](https://github.com/achetronic/parakeet); [groxaxo wrapper](https://github.com/groxaxo/parakeet-tdt-0.6b-v3-fastapi-openai)
- OpenWhispr comparison (18 July 2026): Parakeet TDT v3 6.34% avg WER on Open ASR Leaderboard vs Whisper large-v3 ~7.4%; Parakeet/Nemotron 631 to 680 MB INT8 vs Whisper large-v3 3 GB; recommends "Parakeet Unified EN 0.6B" for English dictation and Nemotron for live streaming — [OpenWhispr blog](https://openwhispr.com/blog/parakeet-vs-whisper-vs-nemotron)

**NVIDIA Canary 1B v2 (released 14 Aug 2025)**
- CC-BY-4.0; 978M params; 25 European languages incl. Dutch; punctuation/capitalization; timestamps; RTFx 749; FLEURS average WER 8.4% across 25 languages — [nvidia/canary-1b-v2](https://huggingface.co/nvidia/canary-1b-v2)
- Open ASR Leaderboard Dutch seed results: Canary-1b-v2 FLEURS 5.27%, Common Voice 5.78%, MLS 9.64% — [PR #208](https://github.com/huggingface/open_asr_leaderboard/pull/208)
- A community GGUF conversion exists (handy-computer/canary-1b-v2-gguf) — [Hugging Face](https://huggingface.co/handy-computer/canary-1b-v2-gguf)

**NVIDIA Nemotron 3.5 ASR Streaming 0.6B (released 4 June 2026)**
- License OpenMDW-1.1; 40 locales, 19 "transcription-ready" including Dutch (nl-NL); Dutch WER 11.46% at 1.12 s chunk with LangID; latency chunks 80 ms to 1.12 s; punctuation/capitalization; runtimes NeMo, Transformers ≥5.13, "NeMo-Speech.cpp" C++; GPU-optimized, CPU not explicitly supported; no word boosting mentioned on the card — [nvidia/nemotron-3.5-asr-streaming-0.6b](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b)
- NVIDIA marketing describes "word boosting for domain-specific vocabulary" and 240 to 2400 concurrent streams per H100 — [NVIDIA Nemotron Speech](https://perspectives.nvidia.com/nemotron-speech/task/faq/which-streaming-asr-models-can-automatically-detect-the-speakers-language-across/)

**Mistral Voxtral Mini 4B Realtime 2602 (Feb 2026)**
- Apache 2.0; 13 languages incl. Dutch; delay 80 ms to 2.4 s; Dutch FLEURS WER 7.07% at 480 ms; BF16 needs ≥16 GB GPU; runtimes vLLM (recommended), Transformers ≥5.2, ExecuTorch (untested), community pure C, MLX, Rust; no context biasing or punctuation info on the card — [Voxtral-Mini-4B-Realtime-2602](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602)
- llama.cpp support was a feature request (issue #19696); community GGUFs exist; LocalAI and audio.cpp claim Voxtral support — [llama.cpp issue #19696](https://github.com/ggml-org/llama.cpp/issues/19696); [LocalAI docs](https://localai.io/docs/features/audio-to-text/)

**Qwen3-ASR (Alibaba, 2026)**
- Apache 2.0; 0.6B and 1.7B variants; 52 languages/dialects including Dutch; language detection, timestamps; vendor claims best average WER among open models on 20 major languages; toolkit supports vLLM, streaming inference — [Qwen blog](https://qwen.ai/blog?id=qwen3asr); [Qwen3-ASR GitHub](https://github.com/QwenLM/Qwen3-ASR); [MarkTechPost comparison, 23 July 2026](https://www.marktechpost.com/2026/07/23/best-open-speech-recognition-asr-models-in-2026-wer-languages-latency-and-license-compared/)

**Moonshine (v2, Feb 2026) and Kyutai STT**
- Moonshine v2 "current models focus exclusively on English"; language-specific Base models exist for Arabic, Japanese, Korean, Mandarin, Spanish, Ukrainian, Vietnamese; no Dutch; toolkit MIT, but "legacy non-streaming models for non-English languages remain under the non-commercial Moonshine Community License"; streaming line reaches 6.66% avg WER on Open ASR Leaderboard; runs on Windows/Linux/macOS/mobile/WASM — [Moonshine v2 paper](https://arxiv.org/abs/2602.12241); [moonshine GitHub](https://github.com/moonshine-ai/moonshine); [OnResonant overview](https://www.onresonant.com/resources/local-stt-models-2026)
- Kyutai STT: `stt-1b-en_fr` (0.5 s latency, semantic VAD) and `stt-2.6b-en` (2.5 s); CC-BY-4.0 weights; PyTorch, Rust/candle server, MLX; no Dutch and no 2026 multilingual STT release found (Kyutai's 2026 multilingual work was TTS) — [kyutai delayed-streams-modeling](https://github.com/kyutai-labs/delayed-streams-modeling/); [kyutai blog](https://kyutai.org/blog/)

**Apple/Windows built-in and NPU acceleration**
- Windows 11 voice typing (Win+H) supports Dutch (Netherlands) but "uses online speech recognition, which is powered by Azure Speech services"; Fluid Dictation is on-device (SLM) but Copilot+ PC and English-only; no developer API mentioned — [Microsoft Support](https://support.microsoft.com/en-us/accessibility/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc)
- On Snapdragon X Plus, OpenWhispr's whisper.cpp ran CPU-only (NPU 0%), 5 to 7 s per short dictation; issue suggests ONNX Runtime QNN / DirectML or "sherpa-onnx with QNN backend for Parakeet"; no maintainer response as of the fetched page — [OpenWhispr issue #867](https://github.com/OpenWhispr/openwhispr/issues/867)
- Qualcomm AI Hub publishes NPU-ready Whisper-Small; a Medium walkthrough runs Whisper on the Snapdragon X Elite NPU for an offline note taker — [Qualcomm AI Hub Whisper-Small](https://aihub.qualcomm.com/mobile/models/whisper_small); [Shivay Lamba, Medium](https://shivaylamba.medium.com/offline-note-taker-building-private-meeting-notes-on-snapdragon-x-elite-with-whisper-qwen-and-be1090adefff)
- whisper.cpp OpenVINO path runs the encoder on Intel CPUs/GPUs; Intel NPU 4/5 rated 48 to 50 TOPS vs Qualcomm Hexagon NPU6 80 to 85 TOPS (third-party comparison) — [whisper.cpp README](https://github.com/ggml-org/whisper.cpp); [localaimaster NPU comparison](https://localaimaster.com/blog/npu-comparison-2026)

**Aggregate picture**
- Open ASR Leaderboard covers 86 systems, English short/long-form and a multilingual track; Dutch (FLEURS, MCV, MLS) was wired into the multilingual track on 4 Sept 2026 — [HF blog](https://huggingface.co/blog/open-asr-leaderboard); [arXiv 2510.06961](https://arxiv.org/abs/2510.06961); [PR #208](https://github.com/huggingface/open_asr_leaderboard/pull/208)
- MarkTechPost's July 2026 table: Parakeet TDT 0.6B v3 6.32% English WER, RTFx 3,332, CC-BY-4.0, no streaming; Voxtral Mini Realtime 3.4B ~5.33%, Apache 2.0, streaming 80 to 2400 ms; Qwen3-ASR-1.7B 5.76%, Apache 2.0; Kyutai STT 6.40%, CC-BY-4.0, streaming; Whisper large-v3 1.55B, 99 languages; "The top of that leaderboard is now separated by less than one WER point" — [MarkTechPost](https://www.marktechpost.com/2026/07/23/best-open-speech-recognition-asr-models-in-2026-wer-languages-latency-and-license-compared/)
- OnResonant (2026): small open models "now match or beat the accuracy of cloud transcription services and run on your laptop"; remaining frontiers are multilingual coverage, specialized vocabularies and diarization — [OnResonant](https://www.onresonant.com/resources/local-stt-models-2026)

### Inferences
- For Dutch + English on a Windows laptop without a discrete GPU, Parakeet TDT 0.6B v3 via sherpa-onnx INT8 (or Handy's GGUF port) is the only option that is simultaneously commercially licensed (CC-BY-4.0), Dutch-capable at ~6 to 7% FLEURS WER, small (~650 MB) and CPU-viable. Canary 1B v2 is more accurate in Dutch (5.3% FLEURS) but ~4x slower (RTFx 749 vs 3,332 on GPU) and has no mainstream CPU dictation packaging yet.
- Whisper large-v3-turbo on CPU is not "instant" for 10 s clips on typical laptops (anecdotal reports of 5 to 7 s on ARM, blog consensus that CPU-only is not instant); with a consumer NVIDIA GPU and faster-whisper int8 (1.5 GB VRAM) it transcribes well over 30x real time, so a 10 s clip finishes in well under a second.
- Local models give no smart formatting, no self-corrections, no user-dictionary biasing (except Nemotron word boosting on GPU and Whisper's weak `initial_prompt`), so a local dictation product still needs a cleanup stage; a local small LLM adds seconds on CPU, so most open-source apps ship a raw-transcript default.
- Voxtral Realtime and Nemotron 3.5 are GPU-first; they are realistic locally only on laptops with ≥16 GB VRAM (Voxtral BF16) or via community quantized ports whose quality is not benchmarked.
- Privacy: local models are the only route with zero audio egress; among cloud vendors, EU data residency is explicitly offered by ElevenLabs and Soniox, and Voxtral/Speechmatics offer on-prem/enterprise self-hosting; Deepgram self-hosting is enterprise-only.

### Gaps
- No primary benchmark of Parakeet TDT v3 or Canary on a modern laptop CPU with published RTF was found; the available CPU numbers are anecdotal and conflict (RTF 0.325 vs "30x real time").
- No per-language Dutch WER for Whisper large-v3/turbo from a primary source (the HF model card fetched did not include the Common Voice 15 table).
- Whisper large-v3-turbo size on disk is not listed in the whisper.cpp README fetch (third parties cite ~1.6 GB GGML, e.g. Handy's "Turbo (1600 MB)").
- No confirmed 2026 NPU-accelerated Dutch ASR runtime for Qualcomm Snapdragon on Windows; only Whisper-Small via Qualcomm AI Hub and a CPU-only failure report.
- Nemotron 3.5 ASR word boosting is in NVIDIA marketing but not on the Hugging Face model card fetched.

---

## KQ5. Which models are clearly strong in Dutch and which are English-first

### Takeaway
Dutch-strong (documented as a supported language with either published Dutch WER or a top accuracy tier): Gemini 3.5 Transcribe (nl-NL), ElevenLabs Scribe v2 (Dutch in ≤5% WER tier), AssemblyAI Universal-3.5 Pro (one of 18 languages), Deepgram Nova-3 (incl. multilingual code-switching), Voxtral (13 languages, FLEURS-nl 7.07% at 480 ms), Soniox stt-rt-v5, Speechmatics, Azure LLM Speech, Parakeet TDT v3 (FLEURS-nl 6.5 to 7.5%), Canary 1B v2 (FLEURS-nl 5.3%), Qwen3-ASR, Nemotron 3.5 (nl-NL transcription-ready, 11.46% WER). English-first with no Dutch: Moonshine (v2 English-only, other languages as separate non-commercial models), Kyutai STT (EN/FR), Deepgram Flux page (Dutch not listed), Deepgram `filler_words` (English only), Windows Fluid Dictation (English only), Parakeet Unified EN.

### Cited Findings
- Gemini 3.5 Transcribe lists Dutch `nl-NL` — [model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe)
- ElevenLabs: Dutch (`nld`) "Excellent", ≤5% WER tier — [ElevenLabs STT docs](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)
- AssemblyAI Universal-3.5 Pro includes Dutch (`nl`) — [supported languages](https://www.assemblyai.com/docs/speech-to-text/pre-recorded-audio/supported-languages)
- Deepgram Nova-3 Dutch monolingual and in the 10-language `multi` mode — [Deepgram models overview](https://developers.deepgram.com/docs/models-languages-overview)
- Voxtral: Dutch among 13 languages, Dutch FLEURS 7.07% at 480 ms — [Mistral news](https://mistral.ai/news/voxtral-transcribe-2/); [model card](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602)
- Soniox Dutch page with in-sentence Dutch/other language switching — [Soniox](https://soniox.com/speech-to-text/dutch)
- Azure LLM Speech and fast transcription list Dutch — [Azure LLM Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/llm-speech); [Azure fast transcription](https://docs.azure.cn/en-us/ai-services/speech-service/fast-transcription-create)
- Parakeet TDT v3 Dutch FLEURS 7.48% (card) / 6.50% (leaderboard seed); Canary 1B v2 Dutch FLEURS 5.27% — [Parakeet card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3); [PR #208](https://github.com/huggingface/open_asr_leaderboard/pull/208)
- Nemotron 3.5 ASR: Dutch transcription-ready, 11.46% WER at 1.12 s — [Nemotron card](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b)
- Qwen3-ASR language list includes Dutch — [Qwen blog](https://qwen.ai/blog?id=qwen3asr)
- Moonshine v2 English-only; Kyutai EN/FR — [Moonshine v2 paper](https://arxiv.org/abs/2602.12241); [Kyutai repo](https://github.com/kyutai-labs/delayed-streams-modeling/)
- Whisper: Dutch described as a "Tier 1" language by a third-party blog; Whisper covers 99 languages — [VexaScribe](https://vexascribe.com/whisper-large-v3-vs-turbo)

### Inferences
- Dutch/English code-switching within a sentence is documented at Gemini 3.5 Transcribe, Deepgram `multi`, AssemblyAI U3.5 Pro ("native code switching"), Soniox and OpenAI gpt-transcribe (`languages` hints); local models with auto language ID (Parakeet v3, Nemotron) detect per utterance rather than mid-sentence, which matters for Dutch developers mixing English product terms.
- Among local models, Canary 1B v2 is currently the most accurate open Dutch model with a commercial license, Parakeet v3 the best accuracy/speed trade-off.

### Gaps
- No vendor publishes an independent Dutch WER for Gemini, OpenAI, AssemblyAI, ElevenLabs or Deepgram; the Open ASR multilingual Dutch track went live only in early September 2026 and its API-provider rows were not visible in the sources fetched.
- Mid-sentence code-switching quality for Dutch/English is not benchmarked anywhere found.

---

## KQ6. What dictation-app developers recommend in 2026 (open-source READMEs, issues, blogs)

### Takeaway
Open-source dictation apps in 2026 converge on the same stack: push-to-talk hotkey, Silero VAD, whisper.cpp (GGML) plus NVIDIA Parakeet v3 as the CPU-friendly multilingual default, GPU via Vulkan/CUDA when available, optional cloud BYOK providers (Deepgram, OpenAI, Groq), and an optional LLM "transformation" step. Practitioners report LLM cleanup is brittle and are moving to staged rule/classifier pipelines; Parakeet is recommended over Whisper for speed and (English) accuracy, with Nemotron for live streaming.

### Cited Findings
- Handy (MIT code, brand assets excluded): Tauri (Rust + React); Whisper Small 487 MB, Medium 492 MB, Turbo 1,600 MB, Large 1,100 MB via ggml with GPU acceleration; Parakeet V3 as "CPU-optimized model with automatic language detection" in GGUF; Silero VAD; hold/toggle/tap push-to-talk; Vulkan on Windows; no LLM post-processing in README; also lists Parakeet V2, Moonshine and custom GGML models per a third-party review — [Handy README](https://github.com/cjpais/Handy); [Spokenly Handy review](https://spokenly.app/blog/handy-review)
- OpenWhispr: Electron + whisper.cpp, "local (Nvidia Parakeet/Whisper) and cloud models (BYOK)", AI cleanup, free tier 2,000 cloud words/week with unlimited local — [OpenWhispr GitHub](https://github.com/OpenWhispr/openwhispr); [OpenWhispr Windows page](https://openwhispr.com/use-cases/windows)
- OpenWhispr blog (18 July 2026) recommends Parakeet Unified EN 0.6B for English dictation and Nemotron for live streaming; Parakeet/Nemotron 631 to 680 MB vs Whisper large-v3 3 GB — [OpenWhispr blog](https://openwhispr.com/blog/parakeet-vs-whisper-vs-nemotron)
- Whispering (now under EpicenterHQ/epicenter): shortcut → transcribe → transform → paste; local-first, audio can go to local whisper.cpp; providers include Deepgram, OpenAI, Groq Whisper, and a custom Whisper-compatible endpoint — [Whispering releases](https://github.com/braden-w/whispering/releases); [OpenWhispr provider notes](https://openwhispr.com/blog/best-dictation-tools-windows-2026)
- Dictly Whisper: Windows-only offline push-to-talk built on faster-whisper, packaged as an EXE — [faster-whisper discussion #1432](https://github.com/SYSTRAN/faster-whisper/discussions/1432)
- voxtype (issue #696, Sept 2026): advocates staged labelers/rules for vocabulary, disfluency, punctuation/casing (XLM-RoBERTa), ITN and user rules, with user rules last "because hand-written replacements beat model outputs"; LLMs only for tone/restructuring via an edit-list contract — [voxtype issue #696](https://github.com/peteonrails/voxtype/issues/696)
- OpenWhispr issue #867 (May 2026): local Whisper on Windows-on-ARM "currently unusable as a Wispr Flow alternative because of CPU-only inference latency" — [issue #867](https://github.com/OpenWhispr/openwhispr/issues/867)
- Commercial comparisons (third-party): Wispr Flow cloud pipeline ~700 ms with default cleanup; Superwhisper local Whisper, 1 to 2 s, raw transcript unless custom prompt; Superwhisper offers model tiers "Nano to Ultra" — [Superwhisper vs Wispr Flow](https://www.getvoibe.com/resources/wispr-flow-vs-superwhisper/); [Spokenly](https://spokenly.app/blog/wispr-flow-review)
- Gladia and Northflank 2026 round-ups list Parakeet, Voxtral, Qwen3-ASR, Canary, Whisper and Moonshine as the leading open models — [Gladia](https://www.gladia.io/blog/best-open-source-speech-to-text-models); [Northflank](https://northflank.com/blog/best-open-source-speech-to-text-stt-model-in-2026-benchmarks)

### Inferences
- For a Windows dictation product with Dutch users, the practitioner-consensus local default is Parakeet TDT v3 (auto language ID, ~650 MB) with Whisper large-v3-turbo as the GPU option; Moonshine and Kyutai are not viable for Dutch.
- Products aiming at Wispr-Flow-like output (clean, formatted) either rely on cloud ASR + LLM or on Gemini 3.5 Transcribe smart mode; fully local products currently ship raw transcripts or heavier local LLM steps.
- The direction of travel in open-source (voxtype) is towards deterministic cleanup stages plus a user dictionary applied last, which also solves the "user dictionary of names and product terms" requirement without depending on ASR keyterm limits.

### Gaps
- VoiceInk (macOS) and Buzz READMEs were not fetched; their 2026 model recommendations are not covered here.
- Handy's README does not state a preferred model or whether Parakeet GGUF runs on GPU/NPU on Windows.
- No open-source dictation app README found that documents a Dutch-specific configuration or benchmark.
