# Speech-to-text (ASR) API pricing, September 2026, and a cost model for a Windows dictation app

All prices read on 2026-09-19 unless stated otherwise. USD is the base; EUR only where a vendor publishes it (only Gladia does, for its free credit). "min" = one minute of audio. Per-hour figures are converted with 60 min/hr and rounded to 4 decimals. Where an official page did not render figures (OpenAI marketing page, Azure, Fireworks, Google Cloud STT), the fallback source is marked as such.

## Key question 1: current list price per minute / per hour, and per-request minimums, per provider

### Takeaway
As of September 2026 the market has collapsed toward $0.002 to $0.005 per minute for high-quality batch transcription with diarization included (Soniox $0.0017, Speechmatics Melia $0.0022, Meta Muse / Mistral Voxtral $0.003, AssemblyAI $0.0035 to $0.0038, ElevenLabs $0.0037, Deepgram $0.0043, Gemini 3.5 Transcribe ~$0.005). Gemini 3.5 Transcribe, the app's current model, is mid-pack on price, not the cheapest; Whisper hosts (Groq, Cloudflare, Together, Fireworks) are 3 to 10x cheaper still but ship no diarization.

### Cited Findings

**Google Gemini API (ai.google.dev/gemini-api/docs/pricing, page states "Last updated 2026-09-16 UTC", read 2026-09-19)**
- Gemini 3.5 Transcribe (file model): input "$2.00 [per 1M audio tokens] or $0.003/min (audio)", output "$12.00 [per 1M text tokens] or $0.002/min (text)". Footnote: "Estimated pricing is based on 25 audio tokens per second for input and 175 text tokens per minute". Free tier: yes. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini 3.5 Transcribe Live (streaming): input "$3.50 or $0.005/min (audio)", output "$21.00 or $0.004/min (text)"; same 25 tokens/sec and 175 text tokens/min assumption. Free tier: yes. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Conversion check: 25 tokens/sec x 60 = 1,500 audio tokens/min; 1,500 x $2.00/1M = $0.0030/min input (matches Google's figure). 175 text tokens/min x $12/1M = $0.0021/min output. Blended = ~$0.005/min for the file model, ~$0.009/min for Live. — arithmetic on [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini 3.5 Flash-Lite: input "$0.30 (text/image/video/audio)" per 1M tokens standard, $0.15 batch; output $2.50 standard, $1.25 batch. Free tier: yes. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini 3.5 Flash: input "$1.50 per 1M tokens", output "$9.00 per 1M tokens" (standard). The fetch did not show a separate audio row; treat the $1.50 as covering all modalities unless the page shows otherwise. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini 3.8 Flash (standard, promotional "through December 31, 2026"): input $0.75/1M, output $3.75/1M. Gemini 3.8 Live: audio input "$3.00 or $0.005/min", audio output "$12.00 or $0.018/min". — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini 2.5 Flash audio input: $1.00/1M standard, $0.50 batch; output $2.50 / $1.25. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Audio tokenization for the general (non-Transcribe) Gemini models: "32 tokens per second of audio (1 minute = 1,920 tokens)"; max "9.5 hours of audio per prompt"; audio is "Downsampled to 16 Kbps" and multichannel "combined to single channel". — [Gemini audio understanding docs](https://ai.google.dev/gemini-api/docs/audio)
- Note the discrepancy: the pricing page uses 25 audio tokens/sec for the Transcribe models' per-minute estimate, while the audio docs state 32 tokens/sec for general models. Both are Google's own figures; use 25/sec for Transcribe and 32/sec for Flash/Flash-Lite/Pro.
- Gemini 3.5 Transcribe launched August 27, 2026. Diarization "supported for up to 8 speakers (attribution for 3+ speakers is experimental); limited to 30-minute files when these features are enabled". Max audio length: "One hour for recorded model; 10 minutes for live model". — [MLQ News, 2026-08-27](https://mlq.ai/news/google-launches-gemini-35-transcribe-at-an-estimated-0005-per-minute/)
- No EUR pricing is published on the Gemini pricing page. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)

**OpenAI (developers.openai.com/api/docs/pricing, read 2026-09-19; openai.com/api/pricing returned HTTP 403)**
- gpt-transcribe: "$0.0045 / minute"; gpt-4o-transcribe: "$0.006 / minute" ($2.50 input / $10.00 output per 1M tokens); gpt-4o-mini-transcribe: "$0.003 / minute" ($1.25 / $5.00 per 1M); gpt-4o-transcribe-diarize: "$0.006 / minute"; Whisper (whisper-1): "$0.006 / minute". — [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- Realtime/live transcription: gpt-live-transcribe "$0.017 / minute"; gpt-realtime-whisper "$0.017 / minute"; gpt-realtime-translate "$0.034 / minute". — [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- gpt-realtime (speech-to-speech) audio tokens: "$32.00" input, "$0.40" cached input, "$64.00" output per 1M; mini variants "$10.00" input, "$0.30" cached, "$20.00" output. gpt-audio: $32.00 audio input, $64.00 output. — [OpenAI API pricing](https://developers.openai.com/api/pricing)
- Realtime audio token rate: "1 audio token per 100 ms of user speech and 1 per 50 ms of model speech", so listening costs "$0.0192/min" on gpt-realtime-2.1 ($32/1M x 600 tokens/min) and $0.006/min on the mini ($10/1M x 600). — [Synthorai, 2026-07-27](https://synthorai.io/blog/gpt-realtime-api-pricing/)
- No free tier is mentioned on the OpenAI pricing page. — [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)

**Deepgram (deepgram.com/pricing, read 2026-09-19)**
- Pre-recorded, Pay As You Go / Growth: Nova-3 Monolingual $0.0043/min / $0.0036/min; Nova-3 Multilingual $0.0052/min / $0.0043/min; Whisper Large $0.0048/min. — [Deepgram pricing](https://deepgram.com/pricing)
- Streaming, Pay As You Go / Growth: Nova-3 Monolingual "Current: $0.0048/min / $0.0042/min (regular $0.0077/$0.0065)"; Nova-3 Multilingual $0.0058 / $0.0050 (regular $0.0092 / $0.0078); Flux English $0.0065 / $0.0057 (regular $0.0077 / $0.0065); Flux Multilingual $0.0078 / $0.0068. The streaming Nova-3 rates are marked as a current promotion. — [Deepgram pricing](https://deepgram.com/pricing)
- Free: "$200 free credit". Growth: "Save up to 20%" with annual pre-paid credits. No stated minimum commitment. — [Deepgram pricing](https://deepgram.com/pricing)
- Cloudflare Workers AI resells Nova-3 at "$0.0052 per audio minute input" (472.73 neurons/min) and Nova-3 WebSocket at "$0.0092 per audio minute input". — [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

**AssemblyAI (assemblyai.com/pricing, read 2026-09-19)**
- Pre-recorded: Universal-3.5 Pro "$0.21/hr" ($0.0035/min); Universal-2 "$0.15/hr" ($0.0025/min). SLAM-1 deprecated; legacy `best` and `nano` identifiers deprecated. — [AssemblyAI pricing](https://www.assemblyai.com/pricing)
- Streaming: Universal-3.5 Pro Realtime (`u3-rt-pro`) "$0.45/hr base" ($0.0075/min); Universal-Streaming English and Multilingual "$0.15/hr" ($0.0025/min). Billing is by "session duration, not audio duration. A WebSocket open for 60 minutes with 30 minutes of audio sent is billed for 60 minutes." — [AssemblyAI pricing](https://www.assemblyai.com/pricing)
- Free: "$50 in free credits on signup, no credit card required"; free-tier streaming capped at "5 new streams per minute". — [AssemblyAI pricing](https://www.assemblyai.com/pricing)
- AssemblyAI's own blog (Sept 2026) restates: pre-recorded U-3.5 Pro $0.21/hr, Universal-2 $0.15/hr, streaming $0.45/hr, and claims a free tier of "185 hours pre-recorded + 333 hours streaming"; "no minimums, no upfront commitments". — [AssemblyAI blog](https://www.assemblyai.com/blog/speech-recognition-cost)
- Conflict: a third-party comparison lists Universal-3.5 Pro at $0.15/hr; the official page says $0.21/hr (Universal-2 is the $0.15/hr model). Use the official figure. — [tech-insider.org, 2026-09-14](https://tech-insider.org/speech-to-text-api-comparison-2026/) vs [AssemblyAI pricing](https://www.assemblyai.com/pricing)

**ElevenLabs Scribe (elevenlabs.io/pricing/api, read 2026-09-19)**
- Scribe v2 and v2 Medical batch: "$0.22" per hour ($0.0037/min). Scribe v2 Realtime: "$0.39" per hour ($0.0065/min). — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
- Included hours by plan: Starter $6/mo 4.5 hr Scribe v2 / 2.5 hr realtime; Creator $22/mo 27 / 15 hr; Pro $99/mo 100 / 56 hr; Scale $299/mo 450 / 254 hr; Business $990/mo 1,359 / 767 hr. "Overage rates match base tier pricing". USD only. — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)

**Mistral Voxtral**
- Voxtral Mini Transcribe 2 (batch): "$0.003 per minute"; Voxtral Realtime: "$0.006 per minute". Announced February 4, 2026. Mini Transcribe 2 supports "speaker diarization, context biasing (up to 100 custom terms), word-level timestamps" and "recordings up to 3 hours in a single request"; no extra diarization charge is mentioned. — [Mistral news: Voxtral Transcribe 2](https://mistral.ai/news/voxtral-transcribe-2/); [Mistral docs: audio](https://docs.mistral.ai/capabilities/audio/)
- "Realtime transcription is not compatible with the `diarize` parameter." — [Mistral docs: audio](https://docs.mistral.ai/capabilities/audio/)
- The general mistral.ai/pricing page only states "speech models are per minute" and does not list Voxtral figures; the news post is the source of the numbers. — [Mistral pricing](https://mistral.ai/pricing)

**Speechmatics (speechmatics.com/pricing, read 2026-09-19)**
- The pricing page shows a Pro reference price of "$0.129" (per hour) and "$100 free" credit, no card required; Pro allows "50 concurrent real-time sessions" and "10 file jobs per second"; Free allows "2 concurrent real-time sessions". Automatic 20% discount "above 500 hours for each type of Speech-To-Text in a given month"; further discounts from 24,000 hours/year via sales. — [Speechmatics pricing](https://www.speechmatics.com/pricing)
- Third-party reading of the same page: "Melia batch starts at $0.129 per hour compared to $0.24 for the older Standard model"; real-time Pro listed at "$0.0067/min" and batch Standard "$0.0050/min" (one source) or $0.24/hr (another). These conflict on the per-minute Standard batch figure ($0.0050 vs $0.0040); the official page's own rows did not render in the fetch. — [DEV Community, 2026](https://dev.to/moksh/speech-to-text-apis-in-2026-what-the-pricing-pages-dont-tell-you-12kb); [PulseSignal](https://getpulsesignal.com/pricing/speechmatics)
- A model-training opt-in gives "33% off Speech to Text rates". — [Speechmatics pricing](https://www.speechmatics.com/pricing)

**Microsoft Azure AI Speech (official page rendered "$-" placeholders; figures from third-party summaries of the page)**
- Real-time standard "$1 per audio hour" ($0.0167/min); fast transcription "$0.36 per hour" ($0.006/min); batch "$0.18 per hour" ($0.003/min). Diarization, continuous language ID and pronunciation assessment "add $0.30 per hour per feature for real-time use, but are included at no extra charge for batch". Prices vary by region. — [BrassTranscripts summary of Azure pricing](https://brasstranscripts.com/blog/azure-speech-services-pricing-2025-microsoft-ecosystem-costs); [Azure Speech pricing page](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/)
- Official page confirms: Free (F0) tier "Real-time Transcription: 5 audio hours free per month", shared between Standard and Custom, "batch processing is unsupported" on F0; "speech to text hours are measured as the hours of audio sent to the service, billed in second increments"; commitment tiers at 2,000 / 10,000 / 50,000 hours. — [Azure Speech pricing page](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/)

**Amazon Transcribe (aws.amazon.com/transcribe/pricing, read 2026-09-19)**
- US East (N. Virginia) T1: batch "$0.006 per minute", streaming "$0.01 per minute"; T2 is 38% off T1, T3 is 58% off T1. "Usage is billed in one-second increments, with no minimum applied" for standard transcription. Free tier "60 minutes per month for 12 months". Speaker identification is not listed as a separate charge. PII redaction from $0.0024/min; Call Analytics $0.03/min; Transcribe Medical $0.075/min. — [Amazon Transcribe pricing](https://aws.amazon.com/transcribe/pricing/)

**Rev.ai (rev.ai/pricing, read 2026-09-19)**
- Reverb ASR (English) "$0.20 per hour" ($0.0033/min); Reverb Foreign Language "$0.30 per hour"; Whisper Large "$0.005 per minute". Billing "Rounded up to the nearest second, 15 second minimum". Free credits "equivalent to 5 hours of Reverb ASR". Streaming and diarization prices are not itemized on the page. — [Rev.ai pricing](https://www.rev.ai/pricing)

**Soniox (soniox.com/pricing, read 2026-09-19)**
- "$0.10/hour for async (file uploads)" ($0.00167/min); "$0.12/hour for real-time (streaming)" ($0.0020/min). "Speaker diarization, language identification, and smart formatting are bundled into the hourly rate". Token view: "1 hour of audio is ~30,000 input audio tokens" at "$1.50 per 1M tokens". No free credit stated on the page. — [Soniox pricing](https://soniox.com/pricing)

**Gladia (gladia.io/pricing, read 2026-09-19)**
- Starter pay-as-you-go: async "$0.61/hr" ($0.0102/min), real-time "$0.75/hr" ($0.0125/min). Growth (committed): "as low as $0.20/hr" async, "$0.25/hr" real-time. Free: "50€ in free credits" ("80+ hours of pre-recorded transcription or 60+ hours of real-time"). Diarization, language detection included. This is the only vendor found publishing a EUR figure. — [Gladia pricing](https://www.gladia.io/pricing)

**Groq (console.groq.com/docs/speech-to-text, read 2026-09-19; groq.com/pricing did not render the audio table)**
- Whisper Large V3 Turbo "$0.04" per hour ($0.00067/min); Whisper Large V3 "$0.111" per hour ($0.00185/min). "Minimum 10-second billing requirement even for shorter clips". Word/segment timestamps via `verbose_json`; no diarization documented. File limits 25 MB (free) / 100 MB (dev). — [Groq speech-to-text docs](https://console.groq.com/docs/speech-to-text)

**Fireworks AI (official pricing page and docs URL returned no audio table / 404; third-party figure)**
- "Whisper models on Fireworks AI range from $0.0009–$0.0015 per audio minute, with streaming transcription priced at $0.0032 per minute." — [Walturn summary](https://www.walturn.com/insights/what-is-fireworks-ai-features-pricing-and-use-cases); Fireworks' own launch post confirms serverless whisper-v3-large and whisper-v3-large-turbo billed per audio minute without stating the number in the fetched excerpt — [Fireworks blog](https://fireworks.ai/blog/audio-transcription-launch)

**Together AI (together.ai/pricing, read 2026-09-19)**
- OpenAI Whisper Large v3: "$0.0015 per audio minute"; Whisper Large v3 (Streaming): "$0.0035 per audio minute"; NVIDIA Parakeet TDT 0.6B v3: $0.0015/min; NVIDIA Nemotron 3 ASR Streaming 0.6B: $0.0015/min; NVIDIA Nemotron 3.5 ASR: $0.0045/min. No free transcription credit stated. — [Together pricing](https://www.together.ai/pricing)

**Cloudflare Workers AI (developers.cloudflare.com/workers-ai/platform/pricing, read 2026-09-19)**
- Whisper: "$0.0005 per audio minute" (41.14 neurons/min); Whisper Large v3 Turbo: "$0.0005 per audio minute" (46.63 neurons/min); Deepgram Nova-3: "$0.0052 per audio minute input"; Nova-3 WebSocket: "$0.0092 per audio minute input". Free: "10,000 Neurons per day at no charge"; paid "$0.011 per 1,000 Neurons". — [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

**Meta Muse Voice Transcribe (new in September 2026)**
- "$0.18 per hour" of audio processed ($0.003/min, "$3 per 1,000 audio minutes"). "Streaming and non-streaming transcription are priced the same." "Audio time is billed as a separate line item from token usage (rounded down to whole seconds)." "ZDR is priced at parity with Standard, and platform free-tier credits apply." Limits: 128 concurrent streams, 16,000 streams/hour. — [Meta Model API pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits)
- Shipped September 1, 2026; diarization "for 20+ speakers" included, "supports long conversations of over an hour". — [VentureBeat](https://venturebeat.com/technology/meta-prices-muse-voice-transcribe-at-0-18-an-hour-with-real-time-diarization-for-20-speakers-a-steal-for-enterprises); [tech-insider.org, 2026-09-14](https://tech-insider.org/speech-to-text-api-comparison-2026/)

**Google Cloud Speech-to-Text v2 (official page did not render; third-party)**
- Standard real-time recognition "$0.016/min, dropping with volume to $0.004/min at 2M+ minutes per month"; Dynamic Batch "as low as ~$0.003 per minute"; 60 free minutes/month. — [ConvertAudioToText summary](https://convertaudiototext.com/blog/google-cloud-speech-to-text-pricing-2026); [Google Cloud STT pricing](https://cloud.google.com/speech-to-text/pricing)

**Anthropic Claude**
- "All current models support text and image input, text output, multilingual capabilities, vision, and tool use." No audio input modality and no audio pricing is listed. — [Claude models overview](https://platform.claude.com/docs/en/models/overview)

### Consolidated price table (USD per audio minute, batch/file endpoint unless noted; read 2026-09-19)

| Provider / model | Batch $/min | Batch $/hr | Streaming $/min | Diarization | Min per request | Source |
|---|---|---|---|---|---|---|
| Cloudflare Workers AI, whisper-large-v3-turbo | 0.0005 | 0.03 | n/a | no | none stated | [CF](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| Groq, Whisper Large V3 Turbo | 0.00067 | 0.04 | n/a | no | 10 s | [Groq](https://console.groq.com/docs/speech-to-text) |
| Fireworks, Whisper v3 (third-party) | 0.0009 to 0.0015 | 0.054 to 0.09 | 0.0032 | not documented | unknown | [Walturn](https://www.walturn.com/insights/what-is-fireworks-ai-features-pricing-and-use-cases) |
| Together, Whisper Large v3 / Parakeet | 0.0015 | 0.09 | 0.0035 | no | none stated | [Together](https://www.together.ai/pricing) |
| Soniox | 0.00167 | 0.10 | 0.0020 | included | none stated | [Soniox](https://soniox.com/pricing) |
| Groq, Whisper Large V3 | 0.00185 | 0.111 | n/a | no | 10 s | [Groq](https://console.groq.com/docs/speech-to-text) |
| Speechmatics, Melia (Pro) | 0.00215 | 0.129 | ~0.0067 (third-party) | included | none stated | [Speechmatics](https://www.speechmatics.com/pricing) |
| AssemblyAI, Universal-2 | 0.0025 | 0.15 | 0.0025 (Universal-Streaming) | +$0.02/hr async, +$0.12/hr streaming | none | [AssemblyAI](https://www.assemblyai.com/pricing) |
| Meta Muse Voice Transcribe | 0.003 | 0.18 | 0.003 | included | rounds down to seconds | [Meta](https://dev.meta.ai/docs/pricing-rate-limits) |
| Mistral Voxtral Mini Transcribe 2 | 0.003 | 0.18 | 0.006 (Realtime, no diarization) | included | none stated | [Mistral](https://mistral.ai/news/voxtral-transcribe-2/) |
| Azure, batch | 0.003 | 0.18 | 0.0167 real-time (+0.005 diarization) | included batch | per second | [Azure](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/) |
| OpenAI gpt-4o-mini-transcribe | 0.003 | 0.18 | n/a | no | none stated | [OpenAI](https://developers.openai.com/api/docs/pricing) |
| Gemini 3.5 Transcribe (file) | 0.003 in + 0.002 out = ~0.005 | 0.30 | Transcribe Live ~0.009 | included (<=8 speakers, 30-min file cap) | none stated | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| Rev.ai, Reverb ASR | 0.0033 | 0.20 | not listed | not itemized | 15 s | [Rev](https://www.rev.ai/pricing) |
| AssemblyAI, Universal-3.5 Pro | 0.0035 | 0.21 | 0.0075 (U3.5 Pro RT) | +$0.02/hr async | none | [AssemblyAI](https://www.assemblyai.com/pricing) |
| ElevenLabs Scribe v2 | 0.0037 | 0.22 | 0.0065 | not itemized (assumed included) | none stated | [ElevenLabs](https://elevenlabs.io/pricing/api) |
| Speechmatics, Standard (Pro) | 0.004 to 0.005 (sources conflict) | 0.24 | ~0.0067 | included | none stated | [Speechmatics](https://www.speechmatics.com/pricing) |
| Deepgram Nova-3 monolingual (PAYG) | 0.0043 | 0.258 | 0.0048 promo (0.0077 regular) | included pre-recorded; +0.0020 streaming | none stated | [Deepgram](https://deepgram.com/pricing) |
| OpenAI gpt-transcribe | 0.0045 | 0.27 | n/a | no | none stated | [OpenAI](https://developers.openai.com/api/docs/pricing) |
| Together, Nemotron 3.5 ASR | 0.0045 | 0.27 | n/a | not documented | none stated | [Together](https://www.together.ai/pricing) |
| Deepgram Whisper Large | 0.0048 | 0.288 | n/a | included | none stated | [Deepgram](https://deepgram.com/pricing) |
| Rev.ai, Whisper Large | 0.005 | 0.30 | n/a | not itemized | 15 s | [Rev](https://www.rev.ai/pricing) |
| Deepgram Nova-3 multilingual (PAYG) | 0.0052 | 0.312 | 0.0058 promo | included pre-recorded | none stated | [Deepgram](https://deepgram.com/pricing) |
| OpenAI gpt-4o-transcribe / -diarize / whisper-1 | 0.006 | 0.36 | n/a | diarize variant only | none stated | [OpenAI](https://developers.openai.com/api/docs/pricing) |
| Azure, fast transcription | 0.006 | 0.36 | n/a | included | per second | [BrassTranscripts](https://brasstranscripts.com/blog/azure-speech-services-pricing-2025-microsoft-ecosystem-costs) |
| Amazon Transcribe (T1, us-east-1) | 0.006 | 0.36 | 0.010 | included | none, per second | [AWS](https://aws.amazon.com/transcribe/pricing/) |
| Gladia (Starter) | 0.0102 | 0.61 | 0.0125 | included | none stated | [Gladia](https://www.gladia.io/pricing) |
| Google Cloud STT v2 standard | 0.016 (dynamic batch ~0.003) | 0.96 | 0.016 | not verified | not verified | [Google Cloud](https://cloud.google.com/speech-to-text/pricing) |
| OpenAI gpt-live-transcribe / gpt-realtime-whisper | n/a | n/a | 0.017 | no | none stated | [OpenAI](https://developers.openai.com/api/docs/pricing) |

### Inferences
- The dedicated Gemini 3.5 Transcribe model (~$0.005/min blended) sits at the median of the market. Switching to Soniox, Speechmatics Melia, Meta Muse, Voxtral or AssemblyAI Universal-2 would cut the per-minute list price by 30 to 65 percent while keeping diarization included.
- The 30-minute file cap on Gemini 3.5 Transcribe when diarization is enabled forces chunking for 30 to 120 minute meetings, which adds engineering cost and risks speaker-label inconsistency across chunks. Voxtral (3 hr/request), Muse (>1 hr), AssemblyAI and Deepgram do not have that constraint.
- Per-request minimums matter for push-to-talk dictation: Groq (10 s) and Rev.ai (15 s) will bill a 4-second clip as 10 or 15 seconds. For an average clip of 8 seconds, Groq's effective rate is 1.25x list, Rev.ai's is ~1.9x list. Everyone else quoted bills per second with no floor (AWS, Azure, Meta explicit; others silent).

### Gaps
- Azure, Google Cloud STT, Fireworks and Speechmatics official pages did not render their price tables in the fetch; the figures above for those four come from third-party summaries dated 2025 to 2026 and should be re-verified in a browser before publishing.
- Gemini 3.5 Pro was not listed on the pricing page fetch; no audio rate could be confirmed for it.
- Rev.ai streaming price and diarization surcharge are not on the pricing page.
- ElevenLabs' page does not itemize diarization; it is assumed included in Scribe v2.
- No vendor except Gladia (EUR free credit) publishes EUR prices; all EUR conversion would be at the user's card rate.

## Key question 2: free tiers and monthly free minutes

### Takeaway
Only Azure (5 real-time hours every month), Google Cloud STT (60 min/month), Cloudflare Workers AI (10,000 neurons/day, about 214 min/day of Whisper) and Gemini (free tier with data-use caveat) offer recurring monthly free usage; most others give a one-time signup credit.

### Cited Findings
- Gemini 3.5 Transcribe and Transcribe Live: "Free tier: Yes"; free-tier content "used to improve our products", paid tier content "not used". — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Azure F0: "Real-time Transcription: 5 audio hours free per month" (batch not included). — [Azure Speech pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/)
- Cloudflare Workers AI: "10,000 Neurons per day at no charge"; whisper-large-v3-turbo uses 46.63 neurons/min, so 10,000 / 46.63 = ~214 free minutes per day (~107 hours/month) for Whisper; Nova-3 uses 472.73 neurons/min, so ~21 free minutes per day. — [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- Amazon Transcribe: "60 minutes per month for 12 months". — [Amazon Transcribe pricing](https://aws.amazon.com/transcribe/pricing/)
- Google Cloud STT: "60 minutes for transcribing and analyzing audio free per month" plus $300 new-customer credit. — [ConvertAudioToText](https://convertaudiototext.com/blog/google-cloud-speech-to-text-pricing-2026)
- Deepgram: "$200 free credit" (one-time). — [Deepgram pricing](https://deepgram.com/pricing)
- AssemblyAI: "$50 in free credits on signup". — [AssemblyAI pricing](https://www.assemblyai.com/pricing)
- Speechmatics: "$100 in credit to get started, no card required". Third-party sources additionally claim "8 hours which reset every month"; not confirmed on the official page fetch. — [Speechmatics pricing](https://www.speechmatics.com/pricing); [SpotSaaS](https://www.spotsaas.com/product/speechmatics/pricing)
- Gladia: "50€ in free credits". — [Gladia pricing](https://www.gladia.io/pricing)
- Rev.ai: "Free credits equivalent to 5 hours of Reverb ASR". — [Rev.ai pricing](https://www.rev.ai/pricing)
- Meta: "platform free-tier credits apply" (amount not stated on the fetched page). — [Meta pricing](https://dev.meta.ai/docs/pricing-rate-limits)
- OpenAI, Together, Soniox, Mistral, ElevenLabs API: no free transcription minutes stated on their pricing pages. — [OpenAI](https://developers.openai.com/api/docs/pricing); [Together](https://www.together.ai/pricing); [Soniox](https://soniox.com/pricing); [ElevenLabs](https://elevenlabs.io/pricing/api)

### Inferences
- For a BYO-key dictation user, Azure's 5 free real-time hours/month cover the "light dictation" and "heavy dictation" scenarios entirely at $0, but only via the real-time endpoint (batch is excluded from F0), and diarization costs $0.30/hr extra on real-time.
- Cloudflare's daily neuron allowance would make all dictation scenarios free with Whisper, but Whisper has no diarization, so meetings would need Nova-3 on Workers AI at $0.0052/min beyond ~21 free minutes/day.
- One-time credits (Deepgram $200 = ~775 hr of Nova-3 pre-recorded; Speechmatics $100 = ~775 hr of Melia; AssemblyAI $50 = ~238 hr of U-3.5 Pro) would cover a single user's first 1 to 3 years, but do not scale to a product where each user brings their own key only if each user signs up.

### Gaps
- Gemini free-tier rate limits (requests/day) for the Transcribe models were not shown in the fetch.
- Meta's free-tier credit amount was not on the fetched pricing page.

## Key question 3: extra charges for diarization, timestamps, keyterm boosting, streaming

### Takeaway
Diarization is included in batch pricing at Deepgram, Soniox, Mistral, Meta, Gladia, Azure batch, AWS and Gemini, is a small add-on at AssemblyAI (+$0.02/hr async, +$0.12/hr streaming) and Azure real-time (+$0.30/hr), and is unavailable on Whisper hosts. Streaming costs 1.1x to 3x the batch rate almost everywhere; keyterm boosting is a paid add-on only at Deepgram, AssemblyAI and ElevenLabs.

### Cited Findings
- Deepgram add-ons (streaming / pre-recorded): Speaker Diarization "$0.0020/min (streaming) / Included (pre-recorded)"; Keyterm Prompting $0.0013/min / $0.0012/min; Smart Formatting "Included"; Redaction $0.0020 / $0.0017; Entity Detection $0.0017/min. — [Deepgram pricing](https://deepgram.com/pricing)
- AssemblyAI add-ons: Speaker Diarization async standard "+$0.02/hr", async experimental "+$0.065/hr", streaming "+$0.12/hr"; Keyterms Prompting (U3 Pro async) "+$0.05/hr" (free on Universal-2 and streaming); Sentiment +$0.02/hr; Entity Detection +$0.08/hr; Medical Mode +$0.15/hr. — [AssemblyAI pricing](https://www.assemblyai.com/pricing); [AssemblyAI blog](https://www.assemblyai.com/blog/speech-recognition-cost)
- ElevenLabs Scribe add-ons: entity detection "$0.070" per hour, keyterm prompting "$0.050" per hour; realtime $0.39/hr vs batch $0.22/hr (1.77x). — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
- Azure: diarization "+$0.30 per hour" on real-time, "included at no extra charge for batch". — [BrassTranscripts summary](https://brasstranscripts.com/blog/azure-speech-services-pricing-2025-microsoft-ecosystem-costs)
- AWS: streaming $0.01/min vs batch $0.006/min (1.67x); speaker identification not listed as a surcharge; PII redaction $0.0024/min extra. — [Amazon Transcribe pricing](https://aws.amazon.com/transcribe/pricing/)
- Soniox: diarization, language ID, smart formatting "bundled into the hourly rate"; real-time $0.12/hr vs async $0.10/hr (1.2x). — [Soniox pricing](https://soniox.com/pricing)
- Mistral: diarization, context biasing (100 terms) and word timestamps in Mini Transcribe 2 with no separate price; Realtime is 2x batch and does not support diarize. — [Mistral news](https://mistral.ai/news/voxtral-transcribe-2/); [Mistral docs](https://docs.mistral.ai/capabilities/audio/)
- Meta: streaming and batch same price; diarization for 20+ speakers included. — [Meta pricing](https://dev.meta.ai/docs/pricing-rate-limits); [VentureBeat](https://venturebeat.com/technology/meta-prices-muse-voice-transcribe-at-0-18-an-hour-with-real-time-diarization-for-20-speakers-a-steal-for-enterprises)
- Gemini 3.5 Transcribe: diarization and timestamps supported at no separate price but "limited to 30-minute files when these features are enabled"; Live is 1.8x the file model. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing); [MLQ News](https://mlq.ai/news/google-launches-gemini-35-transcribe-at-an-estimated-0005-per-minute/)
- OpenAI: diarization only via gpt-4o-transcribe-diarize at the same $0.006/min as gpt-4o-transcribe; live transcription (gpt-live-transcribe) is $0.017/min, 2.8x the batch model. — [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- Groq: timestamps via `verbose_json` at no extra cost; no diarization. — [Groq docs](https://console.groq.com/docs/speech-to-text)
- Rev.ai: forced alignment $0.003/min, language ID $0.003/min as add-ons; diarization not itemized. — [Rev.ai pricing](https://www.rev.ai/pricing)
- Gladia: diarization and language detection included in all plans. — [Gladia pricing](https://www.gladia.io/pricing)

### Inferences
- For a dictation app, streaming endpoints are the wrong economic choice: batch of a finished push-to-talk clip costs 40 to 65 percent less and the latency penalty is a single round-trip. Only Meta charges the same for both.
- Keyterm boosting (custom vocabulary) is free at Mistral, Soniox, Speechmatics and Universal-2; paid at Deepgram ($0.0012/min, +28% on Nova-3 mono) and AssemblyAI U-3.5 Pro (+$0.05/hr, +24%).

### Gaps
- Whether Gemini 3.5 Transcribe charges more output tokens (and so more money) when diarization or timestamps are requested is not documented; the 175 text tokens/min estimate presumably covers plain transcripts only.

## Key question 4: monthly cost per scenario

### Takeaway
At the app's realistic volumes every option is cheap in absolute terms: Gemini 3.5 Transcribe costs $0.15 / $1.50 / $6.00 / $13.50 per month across the four scenarios, the cheapest diarization-capable API (Soniox) costs $0.05 / $0.50 / $2.00 / $4.50, and Whisper hosts make pure dictation nearly free but cannot do meetings.

### Cited Findings (rates used, all from Key question 1 sources)
Scenario definitions: (1) light dictation 30 min/month; (2) heavy dictation 300 min/month; (3) meetings 1,200 min/month with diarization; (4) 300 min dictation + 2,400 min meetings with diarization. Dictation uses the batch/file endpoint without diarization; meetings use the batch endpoint with diarization (add-on included where charged). Free credits are ignored in the table (see notes below). Costs in USD.

| Option (batch endpoint) | Rate dictation $/min | Rate meetings $/min (incl. diarization) | (1) 30 min | (2) 300 min | (3) 20 hr meetings | (4) 5 hr + 40 hr |
|---|---|---|---|---|---|---|
| Gemini 3.5 Transcribe (current) | 0.005 | 0.005 | $0.15 | $1.50 | $6.00 | $13.50 |
| Soniox async | 0.00167 | 0.00167 | $0.05 | $0.50 | $2.00 | $4.50 |
| Speechmatics Melia (Pro) | 0.00215 | 0.00215 | $0.06 | $0.65 | $2.58 | $5.81 |
| AssemblyAI Universal-2 (+$0.02/hr diarization) | 0.0025 | 0.00283 | $0.08 | $0.75 | $3.40 | $7.55 |
| Meta Muse Voice Transcribe | 0.003 | 0.003 | $0.09 | $0.90 | $3.60 | $8.10 |
| Mistral Voxtral Mini Transcribe 2 | 0.003 | 0.003 | $0.09 | $0.90 | $3.60 | $8.10 |
| Azure batch (dictation via batch too) | 0.003 | 0.003 | $0.09 | $0.90 | $3.60 | $8.10 |
| ElevenLabs Scribe v2 | 0.00367 | 0.00367 | $0.11 | $1.10 | $4.40 | $9.90 |
| AssemblyAI Universal-3.5 Pro (+$0.02/hr) | 0.0035 | 0.00383 | $0.11 | $1.05 | $4.60 | $10.25 |
| Deepgram Nova-3 mono (PAYG) | 0.0043 | 0.0043 | $0.13 | $1.29 | $5.16 | $11.61 |
| OpenAI gpt-4o-mini-transcribe / gpt-4o-transcribe-diarize | 0.003 | 0.006 | $0.09 | $0.90 | $7.20 | $15.30 |
| Amazon Transcribe batch (T1) | 0.006 | 0.006 | $0.18 | $1.80 | $7.20 | $16.20 |
| Gladia Starter | 0.0102 | 0.0102 | $0.31 | $3.05 | $12.20 | $27.45 |
| Google Cloud STT v2 standard | 0.016 | 0.016 | $0.48 | $4.80 | $19.20 | $43.20 |

Dictation-only options (no diarization, so meetings column not applicable):

| Option | Rate $/min | (1) 30 min | (2) 300 min | Note |
|---|---|---|---|---|
| Cloudflare whisper-large-v3-turbo | 0.0005 | $0.00 (within 10k neurons/day) | $0.00 (within free tier) | list price would be $0.015 / $0.15 |
| Groq Whisper Large V3 Turbo | 0.00067 | $0.02 | $0.20 | 10-second minimum per clip inflates short clips |
| Together Whisper Large v3 | 0.0015 | $0.05 | $0.45 | |
| Groq Whisper Large V3 | 0.00185 | $0.06 | $0.56 | 10-second minimum |
| OpenAI gpt-transcribe | 0.0045 | $0.14 | $1.35 | |
| Azure real-time (F0 free tier) | 0.0167 list | $0.00 (5 free hr/month) | $0.00 (exactly 5 hr) | free tier is real-time only |

Free-credit effect on scenario 4 (45 hr/month): Deepgram's $200 credit lasts ~17 months at $11.61/month; Speechmatics' $100 lasts ~17 months at $5.81/month; AssemblyAI's $50 lasts ~5 months at $10.25/month; Gladia's €50 lasts ~2 months. Sources as in Key question 2.

### Inferences
- The price gap between the cheapest diarizing option (Soniox, $4.50) and the current Gemini 3.5 Transcribe ($13.50) in the heaviest scenario is $9/month per user. For a BYO-key app the absolute amounts are so small that accuracy, diarization quality on 30 to 120 minute Dutch/English meetings, file-length limits and latency should outweigh price in the model choice.
- Gemini 3.5 Transcribe's 30-minute cap with diarization means a 120-minute meeting needs 4 requests; the cost is unchanged but the implementation must stitch speaker labels across chunks, which none of the sub-$0.004/min competitors require.
- If the app keeps Gemini for dictation and only meetings move to a cheaper diarizing provider, scenario 4 drops from $13.50 to $1.50 + $4.00 (Soniox) = $5.50.

### Gaps
- Real spend depends on how much of the 175 text tokens/min Google assumes is exceeded when diarization and timestamps are requested; the Gemini figures above use Google's own blended estimate and may understate diarized meeting output by an unknown amount.
- Scenario costs for Speechmatics and Azure rely on third-party readings of official pages (see Key question 1 gaps).

## Key question 5: audio-token pricing of general multimodal LLMs versus dedicated ASR endpoints

### Takeaway
Cheap multimodal LLMs (Gemini 3.5 Flash-Lite, Gemini 3.8 Flash) work out to roughly $0.001 to $0.002 per audio minute including a short text output, which is cheaper than every dedicated ASR endpoint except Whisper hosts; the premium audio-native models (gpt-realtime at $0.019/min listening, Gemini 3.8 Live at $0.005/min input) are 2 to 6x more expensive than dedicated ASR. Claude has no audio input.

### Cited Findings
- Gemini 3.5 Flash-Lite: audio input $0.30/1M tokens; at the documented 32 tokens/sec (1,920 tokens/min), input = 1,920 x $0.30/1M = $0.000576/min; output at 175 text tokens/min x $2.50/1M = $0.00044/min; total ~$0.0010/min ($0.06/hr). Batch tier halves the input to $0.000288/min. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing); token rate from [Gemini audio docs](https://ai.google.dev/gemini-api/docs/audio)
- Gemini 3.8 Flash (promotional to 2026-12-31): input $0.75/1M x 1,920 = $0.00144/min; output 175 x $3.75/1M = $0.00066/min; total ~$0.0021/min. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini 3.5 Flash: input $1.50/1M x 1,920 = $0.00288/min; output 175 x $9.00/1M = $0.0016/min; total ~$0.0045/min, roughly equal to Gemini 3.5 Transcribe. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini 2.5 Flash: audio input $1.00/1M x 1,920 = $0.00192/min; output 175 x $2.50/1M = $0.00044; total ~$0.0024/min. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini 3.8 Live: audio input "$3.00 or $0.005/min" (Google's own per-minute figure, implying 1,667 tokens/min, i.e. ~28 tokens/sec); audio output $0.018/min. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- OpenAI gpt-realtime audio input $32/1M at 1 token per 100 ms (600 tokens/min) = "$0.0192/min" listening; gpt-realtime-mini $10/1M = $0.006/min; gpt-audio $32/1M input. — [OpenAI API pricing](https://developers.openai.com/api/docs/pricing); [Synthorai](https://synthorai.io/blog/gpt-realtime-api-pricing/)
- OpenAI gpt-4o-transcribe is itself token-priced at $2.50/1M input and OpenAI's own per-minute estimate is $0.006/min. — [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- Soniox exposes the same token framing: "~30,000 input audio tokens" per hour (500 tokens/min) at "$1.50 per 1M tokens" = $0.00075/min input, $0.10/hr all-in. — [Soniox pricing](https://soniox.com/pricing)
- Claude: current models "support text and image input"; no audio modality listed. — [Claude models overview](https://platform.claude.com/docs/en/models/overview)

### Comparison (USD per minute of audio, input plus ~175 output tokens)

| Model | Tokens/min assumed | $/min | vs Gemini 3.5 Transcribe ($0.005) |
|---|---|---|---|
| Gemini 3.5 Flash-Lite | 1,920 in (32/s) | ~0.0010 | 5x cheaper |
| Gemini 3.8 Flash (promo) | 1,920 in | ~0.0021 | 2.4x cheaper |
| Gemini 2.5 Flash | 1,920 in | ~0.0024 | 2x cheaper |
| Gemini 3.5 Flash | 1,920 in | ~0.0045 | about equal |
| Gemini 3.5 Transcribe | 1,500 in (25/s) | ~0.005 | baseline |
| gpt-realtime-mini (listening only) | 600 in (10/s) | 0.006 | 1.2x more |
| Gemini 3.8 Live (input only) | ~1,667 in | 0.005 (+0.018 if it speaks back) | equal on input |
| gpt-realtime (listening only) | 600 in | 0.0192 | 3.8x more |

### Inferences
- The cheapest way to transcribe with Google is not the Transcribe model but Gemini 3.5 Flash-Lite as a general model (~$0.001/min), at the cost of less predictable transcript formatting and no purpose-built diarization guarantees. Google's own docs point users needing "dedicated transcription" to Cloud Speech-to-Text rather than the general models.
- Audio-native conversational models (gpt-realtime, Gemini Live) are priced for two-way voice agents, not transcription; using them as ASR costs 1x to 4x a dedicated endpoint and, in OpenAI's case, 3x its own gpt-live-transcribe.
- Token-priced ASR hides output cost: a diarized, timestamped transcript emits far more than 175 tokens/min (speaker tags, timestamps, JSON), so Gemini's real per-minute cost for meetings will exceed $0.005 by an amount proportional to output verbosity, while flat per-minute vendors are unaffected.

### Gaps
- The exact audio token rate for Gemini 3.5 Flash and 3.5 Pro was not shown separately on the pricing page; the 32 tokens/sec figure comes from the general audio docs and may differ per model.
- Gemini 3.5 Pro pricing was not found.

## Key question 6: the price of silence

### Takeaway
Every file/batch API bills the full uploaded duration, silence included, at the rates above; on streaming, AssemblyAI bills wall-clock session time, OpenAI Realtime with server VAD bills zero for silence, Deepgram and Meta bill only audio actually sent or processed, and no vendor offers server-side silence trimming for uploads, so a client-side VAD before upload is the only lever.

### Cited Findings
- AssemblyAI streaming: billing is by "session duration, not audio duration. A WebSocket open for 60 minutes with 30 minutes of audio sent is billed for 60 minutes." Unclosed sessions "can remain open for up to three hours and bill for that full period." — [AssemblyAI pricing](https://www.assemblyai.com/pricing); [AssemblyAI blog](https://www.assemblyai.com/blog/speech-recognition-cost)
- OpenAI Realtime with server VAD: streaming 60 seconds of silence produced usage "byte-identical to a control session that never sent audio"; "idle periods accumulate no charges". — [Synthorai test, 2026-07](https://synthorai.io/blog/gpt-realtime-api-pricing/)
- Deepgram streaming: KeepAlive JSON messages hold an idle socket open without sending audio; "If you send KeepAlive messages without any audio payloads for a period of time, then resume sending audio, the timestamps will continue from where the audio left off", i.e. only streamed audio advances the billed clock. Deepgram's Voice Agent API by contrast "is calculated based on websocket connection time". The pricing FAQ contains the question "Does Deepgram charge for silence or round up audio time?" but the answer did not render. — [Deepgram audio keep-alive docs](https://developers.deepgram.com/docs/audio-keep-alive); [Deepgram pricing](https://deepgram.com/pricing)
- Meta Muse: billed on "audio processed", "rounded down to whole seconds". — [Meta pricing](https://dev.meta.ai/docs/pricing-rate-limits)
- AWS: "billed in one-second increments, with no minimum applied" on the audio duration submitted. — [Amazon Transcribe pricing](https://aws.amazon.com/transcribe/pricing/)
- Azure: hours "measured as the hours of audio sent to the service, billed in second increments". — [Azure Speech pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/)
- Gemini: audio is tokenized at a fixed rate per second (25/s for Transcribe, 32/s for general models) regardless of content, so silence costs the same as speech on upload; Gemini "understands non-speech sounds". — [Gemini audio docs](https://ai.google.dev/gemini-api/docs/audio); [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Per-request floors: Groq "Minimum 10-second billing"; Rev.ai "15 second minimum". — [Groq docs](https://console.groq.com/docs/speech-to-text); [Rev.ai pricing](https://www.rev.ai/pricing)
- Sarvam AI (example of a vendor exposing the billed figure): the session end message "includes audio_duration_s (the billed audio)". — [Sarvam docs](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/realtime-streaming)

### Worked example: 4 hours of "recording left on" with 30 minutes of real speech
- File upload without client trimming: 240 min billed everywhere. Gemini 3.5 Transcribe 240 x $0.003 = $0.72 input (output tokens roughly track speech, ~$0.06); Soniox $0.40; AssemblyAI U-3.5 Pro $0.84; Deepgram Nova-3 $1.03; Voxtral / Muse $0.72. — arithmetic on Key question 1 sources
- AssemblyAI streaming session left open for 4 hours: 240 x $0.0075 = $1.80 (U-3.5 Pro RT) even with 30 min of speech. — [AssemblyAI pricing](https://www.assemblyai.com/pricing)
- OpenAI gpt-realtime with server VAD: ~30 x $0.0192 = $0.58 (silence unbilled) — [Synthorai](https://synthorai.io/blog/gpt-realtime-api-pricing/)
- With client-side VAD trimming to the 30 speech minutes before upload: Gemini $0.15, Soniox $0.05, Deepgram $0.13, i.e. an 8x reduction, identical across vendors.

### Inferences
- For this app, which already runs an audio worklet on the client, a local VAD that drops silent segments before upload (or before streaming) is worth more than any vendor switch: it removes the "silence tax" on the 30 to 120 minute meeting recordings and on abandoned push-to-talk sessions.
- If a streaming path is ever added, avoid session-duration billers (AssemblyAI) for long idle meetings; prefer audio-duration billers (Deepgram, Meta) or VAD-gated ones (OpenAI Realtime).
- No vendor found offers "only bill speech" on uploaded files; VAD trimming must happen client-side. Removing silence can also shorten Gemini's per-file duration, which matters given its 30-minute diarization cap and 1-hour file cap.

### Gaps
- Deepgram's explicit FAQ answer on silence billing was not retrievable; the KeepAlive behaviour is the best available evidence that idle time is not billed.
- Azure's Q&A thread on whether silence in a stream is billed (learn.microsoft.com/answers/questions/1299865) was found but its answer was not read.
- Whether the Gemini Live API's automatic activity detection stops audio tokens from being counted during silence is not documented on the fetched pages.
