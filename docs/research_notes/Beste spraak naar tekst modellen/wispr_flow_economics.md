# Wispr Flow economics, tech stack and competitor landscape (state as of 2026-09-19)

Scope note: all prices and claims are dated. "Official" = wisprflow.ai, docs.wisprflow.ai or a vendor's own pricing page. Several third-party blogs cited below (spokenly, getvoibe, tryvoiceink, weesperneonflow, usevoicy) are competitor-run content sites; they are used only for facts that were consistent across multiple of them and, where possible, cross-checked against official pages.

## Key question 1: Wispr Flow pricing (September 2026): free tier, Pro, teams, caps, fair use, heavy users

### Takeaway
As of 2026-09-19 Wispr Flow Pro costs USD 15 per user per month or USD 12 per month billed annually, with "unlimited dictations" and no published per-word cap, throttle or fair-use clause; the free "Basic" tier is capped at 2,000 words per week on desktop and 1,000 per week on iPhone. The published policy for heavy users is simply "upgrade to Pro"; no overage fees exist.

### Cited Findings
- Official pricing page (fetched 2026-09-19): Free USD 0; Pro USD 15/user/month monthly or USD 12/user/month annual (20% discount) with "unlimited dictations" and extended notetaker history; Growth USD 23/user/month monthly or USD 18 annual (adds SSO/SAML, org-wide HIPAA with BAA, admin model-training controls, per-user usage reporting); Enterprise custom, annual only (SCIM, audit logs, MDM, domain capture, PO billing). Page says "no commitments", "cancel anytime". — [Wispr Flow pricing](https://wisprflow.ai/pricing)
- Official help center article "Flow plans and what's included" (last updated about 4 days before 2026-09-19): Pro is USD 15/user/month or USD 12/month billed yearly; Pro adds "unlimited dictations in 100+ languages, opt out of model training, centralized billing and user management". Key quote: "Transcription accuracy is identical across tiers; your plan sets how much you can dictate, which features you get, and whether you can manage a team." No fair-use or abuse language in the article. Trials: 2 weeks default, 1 month for referred users, 3 months for students, 2 weeks for teams; up to 7 bonus days via a "100 Words a Day Challenge". — [Wispr Flow Help Center](https://docs.wisprflow.ai/articles/9559327591-flow-plans-and-what-s-included)
- Free tier caps: 2,000 words/week on Mac and Windows, 1,000 words/week on iPhone, Android unlimited "for a limited time" (secondary sources, consistent across several, dated June to August 2026). — [Zack Proser pricing guide](https://zackproser.com/blog/wisprflow-pricing-guide-2026); [Weesper Neon Flow](https://weesperneonflow.ai/en/blog/2026-06-06-wispr-flow-free-plan-limits-2026/); [Spokenly](https://spokenly.app/blog/wispr-flow-pricing)
- The official pricing page's own wording on the free plan is "2,000/week on desktop" and "1,000/week on mobile" (the fetch tool attributed this to dictionary words; the help center and all secondary sources say it is the dictation word cap). — [Wispr Flow pricing](https://wisprflow.ai/pricing)
- One-time bonus for free users: the first time an eligible free user hits the weekly cap, Wispr may grant a one-time 8,000 bonus words (cap temporarily 10,000 that week); not every account gets it. No per-word charges and no overages exist; the intended path for heavy users is Pro. (Secondary sources.) — [eesel AI](https://www.eesel.ai/blog/wispr-flow-pricing); [Use Apify blog](https://use-apify.com/blog/wispr-flow-free-plan)
- New accounts get a 14-day Pro trial without a credit card; students/educators with an edu email get 50% off Pro (and 3 months free per the pricing page); discounts also mentioned for nonprofits, military, seniors and accessibility needs. — [Zack Proser pricing guide](https://zackproser.com/blog/wisprflow-pricing-guide-2026)
- Price history claim: a secondary guide states that "as of August 1, 2026" Pro is USD 15/USD 12 and that "the old USD 19/month pricing you may still see in search results is stale". I could not verify a USD 19 price point from any primary source. — [Zack Proser pricing guide](https://zackproser.com/blog/wisprflow-pricing-guide-2026)
- Free "Basic" versus Pro feature delta (secondary): Pro adds unlimited words on all platforms, command mode editing, team collaboration, shared dictionaries/snippets, priority support. Some secondary sources also claim Pro adds "advanced models"; this is contradicted by the official help center statement that accuracy is identical across tiers. — [Zack Proser](https://zackproser.com/blog/wisprflow-pricing-guide-2026) versus [Wispr Flow Help Center](https://docs.wisprflow.ai/articles/9559327591-flow-plans-and-what-s-included)
- Usage tab: Wispr Flow shows per-user dictation stats (words, WPM, streaks, percentile rank). — [Wispr Flow Help Center, Usage tab](https://docs.wisprflow.ai/articles/8760230576-your-usage-tab-track-your-dictation-stats-in-wispr-flow)

### Inferences
- With no published fair-use clause, Wispr appears to accept that a small tail of heavy users is loss-making and is cross-subsidised by the majority, plus by annual prepayment (USD 144/year) and the 80% or so of users who never pay (see key question 4: ~19% payment rate).
- The word-based (not minute-based) free cap is a strong hint that Wispr's internal cost model is per word of output rather than per minute of audio, which matches a push-to-talk product where audio is only captured while the hotkey is held (see key question 3).
- The Growth tier's "admin model training controls" and the Pro "opt out of model training" feature imply training data from free/standard users is part of the value Wispr extracts from non-paying users.

### Gaps
- No primary source publishes a fair-use, throttling or abuse clause for Pro. I found no reports (Reddit/HN) of Pro users being throttled or banned for volume, but I also did not find an explicit "no limits ever" statement beyond the word "unlimited".
- The reported earlier USD 19/month price could not be confirmed from Wispr's own pages or archived pages.

## Key question 2: Which speech-to-text models does Wispr Flow use?

### Takeaway
Until at least late 2025 Wispr licensed third-party speech recognition and used third-party LLMs (Llama 3.1 and OpenAI models) for post-editing; in August 2026 it announced its first proprietary ASR model "Canto" (3.4% WER on real Flow dictations), built by a new lab led by an ex-Amazon Alexa scientist, with a successor already training at more than 10x scale. The exact vendor(s) behind the earlier licensed ASR are not publicly confirmed.

### Cited Findings
- Computerworld interview with CEO Tanay Kothari (2025-12-31): Wispr uses the open-source Llama 3.1 model and proprietary OpenAI models for text editing/editing assistance; Kothari says Wispr built "voice-first models" trained on how people naturally speak that learn "transcription, formatting, and intent together, rather than bolting speech recognition onto a general-purpose language model". The same article (per search snippet) states that until recently Wispr had not built its own speech recognition software and had licensed it instead, and that accents caused "3 words in 10" to come out wrong. — [Computerworld](https://www.computerworld.com/article/4107331/wispr-ceo-interview-post-keyboard-office.html)
- Canto (official page, undated, announced around 2026-08-17): Wispr's "Advanced Interfaces Lab" introduced Canto as "the first in a rapid series of speech models". Evaluation: 10 hours of English Flow dictations from more than 2,300 unique speakers; Canto scored 3.4% WER, lowest of the tested models from Google, OpenAI, AssemblyAI and Deepgram. On a harder 3-hour dataset it ranked second behind Gemini 3.1 Pro but had "the lowest WER" among real-time transcription options. Training: supervised fine-tuning followed by reinforcement learning with GRPO. Wispr is "already training its successor at more than ten times Canto's scale". No model size, latency, hosting or cost details are given. — [Wispr Flow: Canto](https://wisprflow.ai/canto)
- Series B post (2026-08-17): Canto reduces word error rates in noisy conditions from "30%+" to 5 to 10% and is expected to reduce editing by 30 to 35%. — [Wispr Flow Series B post](https://wisprflow.ai/post/series-b)
- TechCrunch (2026-08-17): new speech model Canto; "Wispr Interface Labs" announced, led by Ariya Rastrow, formerly an Amazon Alexa developer. — [TechCrunch](https://techcrunch.com/2026/08/17/wispr-raises-280m-at-2b-valuation-as-it-looks-beyond-dictation/)
- The fact that Canto is benchmarked against Google, OpenAI, AssemblyAI and Deepgram (and that the earlier ASR was licensed) is the closest public hint at the vendors Wispr previously relied on; none is named as the actual prior supplier. — [Wispr Flow: Canto](https://wisprflow.ai/canto)
- Subprocessors (secondary sources citing Wispr's trust centre, 2026): named vendors include AWS, OpenAI, Anthropic, Google, Cerebras, Baseten, Supabase, Stripe and Cloudflare, all US-located. Baseten and Cerebras are inference-hosting providers, which is consistent with Wispr running its own or open models on rented inference rather than only calling ASR APIs. — [WAIMAKERS security guide](https://www.waimakers.com/en/resources/ai-data-security/wispr-flow); [Spokenly review](https://spokenly.app/blog/wispr-flow-review)
- Wispr publishes only "a partial list of five vendors on its trust centre" and keeps the authoritative subprocessor list in Annex 2 of the DPA "available under NDA" (blog post dated 2026-08-31, content checked 2026-08-29). — [Careless Whisper blog](https://carelesswhisper.app/blog/wispr-flow-documents-side-by-side)
- Older founder claim (secondary/podcast summaries, undated, likely 2025): Wispr claims about 10% error rate versus 27% for OpenAI Whisper and 47% for Apple native dictation, and "the fastest inference on the planet today" with half-second response times. — [Postbeam](https://www.postbeam.ai/blog/how-wisprflow-grows); [Dealroom note](https://app.dealroom.co/news/note/building-jarvis-tanay-kothari-on-wispr-flow-s-hardware-to-software-pivot-and-zero-edit-rate)
- Privacy/training: 25 to 30% of users opt in to model training, the remaining 70 to 75% use privacy mode with zero data retention (Kothari, Computerworld 2025-12-31). Standard mode (default for trial/standard accounts) allows audio and transcripts to be used "to evaluate, train, and improve Wispr's models". — [Computerworld](https://www.computerworld.com/article/4107331/wispr-ceo-interview-post-keyboard-office.html); [Careless Whisper blog](https://carelesswhisper.app/blog/wispr-flow-documents-side-by-side)
- Wikipedia describes the technology generically as ASR with ML language models, adaptive learning of user vocabulary/style, and "Flow Sessions" (configurable microphone access windows); it supports 104 languages with about 40% of dictations in English. — [Wikipedia: Wispr Flow](https://en.wikipedia.org/wiki/Wispr_Flow)

### Inferences
- Timeline: 2024 to mid-2026 = licensed third-party ASR (vendor unnamed) + Llama 3.1 / OpenAI LLM post-processing; from August 2026 = proprietary Canto ASR (likely still with LLM post-processing via OpenAI/Anthropic/Cerebras-hosted models, given the subprocessor list).
- Presence of Cerebras and Baseten as subprocessors suggests Wispr serves open-weight or in-house models on specialised inference providers for latency and cost, rather than paying list-price ASR API rates. This is inference, not confirmed.
- Canto being described as compact ("successor at more than ten times Canto's scale") plus SFT+GRPO on real dictation data suggests a fine-tuned mid-sized model optimised for the dictation domain, which is a cost lever (smaller model, cheaper per minute).

### Gaps
- No public statement names the ASR vendor Wispr licensed before Canto. Reverse-engineering write-ups (levels.io, 2026-07-29) only confirm that Wispr Flow's client API was reverse engineered into a Python SDK; the post gives no backend details. — [levels.io](https://levels.io/wispr-flow-granola-whoop-reverse-engineered)
- No parameter count, hosting location or per-minute cost for Canto is published.
- Hacker News threads found (2025-10, 2026-02) discuss UX, not Wispr's models or costs. — [HN thread 45650410](https://news.ycombinator.com/item?id=45650410); [HN Show HN 47040375](https://news.ycombinator.com/item?id=47040375)

## Key question 3: How they keep inference cost low (push-to-talk, VAD, batching, per-word economics, usage stats)

### Takeaway
Wispr Flow only captures audio while the hotkey is held (or in an explicit hands-free toggle), sends the whole utterance after release, and bills/caps in words, not minutes; real usage data shows even top-2% users dictate roughly 6,000 words per day (about 40 minutes of speech), far below the "2 hours per day" heavy-user scenario. No official numbers on average words per user, GPU fleet or cost per user exist.

### Cited Findings
- Interaction model: "Flow captures audio while you hold the hotkey, then transcribes and pastes the finished text on release. That full-context approach lets Flow clean up filler words, punctuation, and self-corrections." Users can double-tap to toggle hands-free mode. (Help center and third-party guide, 2026.) — [Wispr Flow Help Center: What is Flow?](https://docs.wisprflow.ai/articles/2772472373-what-is-flow); [Sid Saladi guide](https://sidsaladi.substack.com/p/wispr-flow-101-the-complete-guide)
- Word-based caps rather than minute-based (2,000 words/week free) and unlimited for Pro. — [Wispr Flow Help Center](https://docs.wisprflow.ai/articles/9559327591-flow-plans-and-what-s-included)
- Aggregate volume: "60+ billion words dictated" cumulatively (2026-08-17). — [Wispr Flow Series B post](https://wisprflow.ai/post/series-b)
- Aggregate volume: "100M weekly dictated words" (undated, Postbeam growth analysis, probably late 2025). — [Postbeam](https://www.postbeam.ai/blog/how-wisprflow-grows)
- Founder tweet (2026): "millions of words flow through it daily". — [Tanay Kothari on X](https://x.com/tankots/status/2085453214195831163)
- Anecdotal power-user volumes (all self-reported by bloggers, 2026): 243,554 words in 39 days at 129 WPM, shown by the app as top 2% of all Flow users (about 6,250 words/day); 462,017 words in five months (about 3,000 words/day); 107,125 words in 90 days (about 1,190 words/day), top 11% by speed at 154 WPM. — [modulovalue](https://modulovalue.com/blog/voxtral-transcribe-and-wispr-flow/); [Medium, A. Jadeja](https://medium.com/@aadityasinhjadeja96/ive-spoken-460-000-words-into-wispr-flow-here-s-what-it-did-to-my-brain-0bca692d36ee); [mrktcorrect](https://mrktcorrect.com/blog/wispr-flow-review)
- Behavioural stat from Kothari (2025-12-31): after five months of use, 72% of users' computer activity happens with Flow versus under 25% by keyboard; users report cutting daily typing from five to three hours. — [Computerworld](https://www.computerworld.com/article/4107331/wispr-ceo-interview-post-keyboard-office.html)
- Average speaking rate for context: about 150 words per minute. — [technovice review](https://www.technovice.net/post/wispr-flow-review)
- Latency claim: half-second responses, "fastest inference on the planet" (founder claim, secondary). — [Dealroom note](https://app.dealroom.co/news/note/building-jarvis-tanay-kothari-on-wispr-flow-s-hardware-to-software-pivot-and-zero-edit-rate)

### Inferences
- Push-to-talk plus release-triggered batch transcription means Wispr pays only for spoken seconds and can use cheaper non-streaming (batch) inference, which at public API rates is roughly 40 to 45% cheaper than streaming (Deepgram USD 0.0043 vs 0.0077/min; Gemini 3.5 Transcribe USD 0.005 vs 0.009/min, see key question 6). No streaming partial results are shown, so no continuous websocket cost.
- Converting the "top 2%" anecdote: 6,250 words/day at about 150 WPM is roughly 42 minutes of speech per day; at 22 working days that is about 15 hours/month. Even at a relatively expensive USD 0.30/hour (Gemini 3.5 Transcribe batch) that is about USD 4.60/month for a top-2% user, well under USD 12 to 15. A median user is very likely well under 10 minutes/day.
- The "2 hours per day" scenario in the assignment corresponds to about 18,000 words/day, roughly 3x the top-2% anecdote, so it is an extreme tail; a subscription business needs only that the average cost across all subscribers (including the majority who use little) stays well below ARPU.
- Owning the model (Canto) and serving via inference platforms (Baseten, Cerebras) removes the API vendor margin; Groq's public Whisper-large-v3-turbo price of USD 0.04/hour shows how low self-served small-model ASR can go (see key question 6), suggesting Wispr's true marginal cost per dictated hour is likely in the low cents rather than USD 0.30.

### Gaps
- No official figures on average words per user per month, distribution of usage, GPU fleet, batching strategy, VAD, or cost per user. I found no founder statement on gross margin or infrastructure cost.
- I did not find confirmation of whether Wispr does any on-device VAD/trimming before upload, or what audio codec/bitrate is used.

## Key question 4: Funding, revenue, users, margins

### Takeaway
Wispr has raised USD 361M in total, including a USD 280M Series B at a USD 2B valuation on 2026-08-17 (Menlo Ventures); revenue was about USD 3.8M for July 2024 to July 2025 and roughly USD 10M ARR by October 2025 (estimates), with founder claims of 150x revenue and 200x user growth in the year to May 2026, about 19% paid conversion and about 80% six-month retention. No gross margin or cost-per-user figures have been disclosed.

### Cited Findings
- Series B: USD 280M led by Menlo Ventures at USD 2B valuation, total raised USD 361M; existing investors Notable Capital, NEA, Neo Ventures, 8VC, MVP Ventures; new investors Acrew, Forerunner, Goodwater, Peak XV, Together Fund, PLUS Capital; previous round about 10 months earlier (USD 25M from Notable Capital, November 2025). — [TechCrunch, 2026-08-17](https://techcrunch.com/2026/08/17/wispr-raises-280m-at-2b-valuation-as-it-looks-beyond-dictation/); [Wispr Flow Series B post](https://wisprflow.ai/post/series-b)
- Series B post user metrics (2026-08-17): 60+ billion words dictated, used at nearly all Fortune 500 companies, 10,000+ enterprises. Revenue and retention not disclosed. — [Wispr Flow Series B post](https://wisprflow.ai/post/series-b)
- Funding history: USD 4.5M seed (August 2021); USD 30M Series A led by Menlo (June 2025); USD 25M Series A extension led by Notable Capital at USD 700M post-money (November 2025); revenue reportedly grew 10x between June and November 2025. — [Postbeam](https://www.postbeam.ai/blog/how-wisprflow-grows); [Wikipedia: Wispr Flow](https://en.wikipedia.org/wiki/Wispr_Flow)
- Revenue: "approximately US$3.8 million between July 2024 and July 2025"; monthly user growth above 50%; six-month active-user retention about 80%; payment rate about 19%. — [Wikipedia: Wispr Flow](https://en.wikipedia.org/wiki/Wispr_Flow)
- ARR about USD 10M (October 2025, estimate); 40% month-over-month growth; year-1 retention 70 to 80%; 19% paid conversion; founder claims 150x revenue and 200x users in the year to May 2026; team 7 to 60 people by May 2026; 270+ Fortune 500 customers at Series A extension (Nov 2025); 125 enterprise signups per week at peak (Oct 2025); India is the number 2 market by users and revenue (April 2026) with 75% annual-commitment rate there. — [Postbeam](https://www.postbeam.ai/blog/how-wisprflow-grows); [Latka estimate](https://getlatka.com/companies/wisprflow.ai)
- Kothari (2025-12-31): about 125 new customers weekly; "about 50% month over month, both in revenue and user base". — [Computerworld](https://www.computerworld.com/article/4107331/wispr-ceo-interview-post-keyboard-office.html)
- User geography (Wikipedia): 40% US, 30% Europe, 30% other; 30%+ non-technical users; 104 languages, about 40% of dictations in English. — [Wikipedia: Wispr Flow](https://en.wikipedia.org/wiki/Wispr_Flow)
- Company background: founded 2021 by Tanay Kothari and Sahaj Garg as a non-invasive neural wearable, pivoted to Flow software dictation in 2024; Android app launched February 2026; hardware partnerships (Oasis ring); go-to-market expansion in India and UK. — [Wikipedia: Wispr Flow](https://en.wikipedia.org/wiki/Wispr_Flow); [TechCrunch](https://techcrunch.com/2026/08/17/wispr-raises-280m-at-2b-valuation-as-it-looks-beyond-dictation/)

### Inferences
- A 19% payment rate with an unlimited Pro tier means the paying 19% fund inference for 100% of users (free users are capped at 2,000 words/week, so their cost is bounded at roughly 13 minutes of audio per week each).
- USD 361M of venture capital at a USD 2B valuation means Wispr can run at thin or negative gross margins on heavy users while it builds its own models; its unit economics are not a reliable template for a bootstrapped app paying list-price API rates.

### Gaps
- No disclosed gross margin, cost per user, or infrastructure spend. ARR figures after October 2025 are estimates or founder growth multiples without absolute numbers.
- Total user count is not published (only words dictated and enterprise counts).

## Key question 5: How competitors are built and priced (local vs cloud, models, prices)

### Takeaway
The market splits into (a) cloud-only subscription products at USD 8 to 15/month with word-capped free tiers (Wispr Flow, Willow, Aqua Voice, Typeless) that run proprietary or partner cloud models plus LLM cleanup, and (b) local-first Mac apps sold one-time or cheaply (Superwhisper, MacWhisper, VoiceInk, Spokenly, Amical, plus open-source Handy/Hex/FreeFlow) that run Whisper or NVIDIA Parakeet on-device at zero marginal cost, with optional cloud or BYOK. OS-native dictation (Apple, Windows Voice Access) is free and on-device; Windows voice typing (Win+H) is cloud Azure ASR with an on-device Phi Silica LLM for cleanup.

### Cited Findings
- Comparison table (VoiceInk blog, updated 2026-08-10; note this is a competitor's site): 
  - Wispr Flow: free 2,000 words/week; Pro USD 15/month or USD 12/month annual; cloud only; Wispr's cloud speech model; automatic LLM formatting.
  - Willow Voice: free; Pro USD 15/month or USD 12/month annual; cloud ("offline claim needs verification"); own cloud model; LLM style matching and "smart memory".
  - Typeless: free 8,000 words/week; Pro USD 30/month or USD 12/month annual; cloud only; proprietary cloud model; LLM rewriting and "Ask Anything".
  - Aqua Voice: Starter free (1,000 words); Pro USD 8/month annual; Max USD 24/month annual; cloud only (Avalon model); LLM custom instructions/formatting.
  - Superwhisper: free tier; Pro USD 8.49/month, USD 84.99/year, USD 249.99 lifetime; local or cloud with user-selectable models; optional LLM cleanup modes.
  - MacWhisper: free; Pro EUR 64 one-time; local Whisper; Pro AI cleanup requires user's own API key.
  - VoiceInk: USD 25 one-time (1 Mac), USD 39 (2), USD 49 (3); local by default (Whisper, Parakeet, Apple native); optional cloud AI enhancement.
  - Spokenly: free (local/BYOK); Pro USD 9.99/month or USD 99.99/year; local Whisper/Parakeet or BYOK cloud.
  - Amical: free unlimited local; Premium USD 10/month or USD 84/year; Whisper local or cloud; optional Ollama-based formatting.
  - Raycast Dictation: free during beta; cloud via partner STT; styles via LLM.
  - Apple Dictation: included with macOS; on-device or cloud depending on language; no LLM post-processing. — [VoiceInk: best dictation apps](https://tryvoiceink.com/best-dictation-apps)
- Aqua Voice official pricing (2026, via secondary sources quoting aquavoice.com/pricing): Starter free with 1,000 words and Avalon model; Pro USD 8/month annual or USD 10 monthly (unlimited words, Avalon tuned for technical vocabulary, 800-term dictionary, real-time text with sub-second latency); Max USD 24/month annual or USD 30 monthly; Team USD 12/user/month annual or USD 15 monthly; Avalon supports 49 languages; students 70% off. — [Aqua Voice pricing](https://aquavoice.com/pricing); [usevoicy](https://usevoicy.com/blog/aqua-voice-pricing); [Spokenly](https://spokenly.app/blog/aqua-voice-pricing)
- Typeless (2026): Pro USD 12/member/month billed yearly (USD 144/year) or USD 30 month-to-month; free plan 8,000 words/week; 30-day Pro trial; subscription only, no lifetime. — [usevoicy](https://usevoicy.com/blog/typeless-pricing); [Voibe](https://www.getvoibe.com/resources/typeless-pricing/)
- Willow Voice (own blog, 2026-09-18): "unlimited free dictation plan"; Pro USD 12/month billed annually (faster/more accurate dictation, unlimited Willow Scribe); enterprise custom; cloud-based "hybrid approach for sub-200ms latency"; proprietary context-aware engine; LLM formatting/tone adaptation; zero data retention. Superwhisper as described by Willow: USD 8.49/month, USD 84.99/year, USD 249.99 lifetime; free tier 15 minutes recording; local-first with Nano/Fast/Ultra models; optional cloud. Note: Willow's free tier is described as "unlimited" by Willow itself and as "Free" (unspecified) by VoiceInk; Willow's monthly price of USD 15 comes from VoiceInk and a Voibe comparison, not from Willow's own post. — [Willow Voice blog](https://willowvoice.com/blog/willow-vs-super-whisper-mac-dictation); [Voibe comparison](https://www.getvoibe.com/resources/superwhisper-vs-willow-voice/)
- Superwhisper architecture (2026): "Mac-first hybrid app with five on-device Whisper modes plus optional cloud Ultra and Super Mode"; Aqua Voice "cloud-only architecture by default". — [Voibe: Aqua Voice vs Superwhisper](https://www.getvoibe.com/resources/aqua-voice-vs-superwhisper/)
- Open source / free alternatives (Show HN "FreeFlow", about February 2026, anecdotal): FreeFlow uses Groq API with Whisper for transcription and sends a screenshot of the active window to Llama on Groq for "deep context" spelling fixes; pipeline under 1 second with cloud, 5 to 10 seconds local-only (Parakeet + local LLM), which the author found too slow. Commenters recommended Handy (free, local Parakeet/Whisper), Hex (native macOS, CoreML, "incredibly fast"), Talkie and VoiceInk; commenter dan_wood: "SuperWhisper is free with Parakeet as a local model." — [HN Show HN 47040375](https://news.ycombinator.com/item?id=47040375)
- Other clones: "groq_flow" (Groq whisper-large-v3 / v3-turbo) and a Tauri + Deepgram desktop clone exist on GitHub. — [groq_flow](https://github.com/ParthJain18/groq_flow); [Tauri Deepgram clone](https://github.com/shmbhvi101/wispr-flow)
- Windows 11 voice typing (Win+H) uses cloud-based Azure speech recognition (needs internet) and, on supported PCs, "Fluid dictation" running the on-device Phi Silica small language model to fix grammar/punctuation and remove filler words. Windows Voice Access uses on-device speech recognition and works offline after downloading language files. — [Blabby: voice typing on Windows 11](https://www.blabby.ai/blog/voice-typing-windows); [Microsoft Support: set up voice access](https://support.microsoft.com/en-us/accessibility/windows/voice-access/set-up-voice-access); [Weesper: voice typing vs voice access](https://weesperneonflow.ai/en/blog/2026-06-30-voice-typing-vs-voice-access-windows-11-guide/)
- Apple Dictation is free, system-wide and runs on-device on the Neural Engine on Apple Silicon Macs. — [Voibe: Apple Dictation review](https://www.getvoibe.com/resources/apple-dictation-review/); [ModelPiper](https://modelpiper.com/blog/free-dictation-app-mac)
- TechCrunch lists Wispr's competitors as Willow, Monologue, Aqua, Superwhisper, Granola, Fireflies and Read AI (2026-08-17). — [TechCrunch](https://techcrunch.com/2026/08/17/wispr-raises-280m-at-2b-valuation-as-it-looks-beyond-dictation/)

### Inferences
- Every cloud-only competitor converges on USD 12/month annual (Wispr, Willow, Typeless, Aqua Team) with a lower monthly-billed price only at Aqua (USD 10) and a higher one at Typeless (USD 30); this price band is a market norm rather than a cost-derived number.
- Cloud products universally cap the free tier by words per week (1,000 to 8,000) or, for Willow, use a slower/less accurate free model; that is the standard lever to bound free-tier inference cost.
- Local-first apps can charge one-time fees because Whisper/Parakeet on Apple Silicon costs nothing per minute; on Windows the equivalent local path (whisper.cpp, Parakeet via ONNX/NVIDIA) exists but the HN anecdote shows local latency can be 5 to 10 s without GPU acceleration.

### Gaps
- I did not fetch Superwhisper's, Typeless's or Willow's official pricing pages directly; prices come from their own blog (Willow) or multiple consistent secondary sources. Willow's monthly (non-annual) price and free-tier limits are inconsistently reported.
- Which third-party ASR Raycast, Willow and Typeless use is not published.

## Key question 6: Cost estimate for a heavy user (2 hours per day) at cloud ASR prices versus a USD 15 subscription

### Takeaway
At September 2026 list prices, 2 hours of actual speech per day costs between about USD 2 (Groq Whisper-large-v3-turbo) and USD 32 (Gemini 3.5 Transcribe Live) per month; with Gemini 3.5 Transcribe batch (USD 0.005/min) it is about USD 13 to 18 per month, i.e. roughly equal to the entire subscription. Such a user is therefore only viable if the subscriber base's average usage is far lower (which the Wispr anecdotes suggest) or if a cheaper model/self-hosting is used.

### Cited Findings (prices, all 2026)
- Gemini 3.5 Transcribe (official): input USD 2.00 per 1M audio tokens "or USD 0.003/min", output USD 12.00 per 1M text tokens "or USD 0.002/min"; Google's estimate assumes 25 audio tokens per second in and 175 text tokens per minute out, "for an effective blended rate of ~$0.005 per min". Gemini 3.5 Transcribe Live: USD 3.50 per 1M audio tokens (USD 0.005/min) plus USD 21.00 per 1M text tokens (USD 0.004/min), about USD 0.009/min blended. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing); [WaveSpeed summary](https://wavespeed.ai/blog/cost-and-billing/gemini-3-5-transcribe-pricing/)
- Deepgram Nova-3: USD 0.0043/min batch, USD 0.0077/min streaming (some sources quote real-time from USD 0.0092/min with add-ons). — [Deepgram pricing 2026 (diyai)](https://diyai.io/ai-tools/speech-to-text/deepgram-pricing-2026/); [smallest.ai pricing explainer](https://smallest.ai/blog/speech-to-text-api-pricing-models-explained-(2026))
- OpenAI: gpt-4o-mini-transcribe about USD 0.003/min, gpt-4o-transcribe about USD 0.006/min. — [buildmvpfast API costs, July 2026](https://www.buildmvpfast.com/api-costs/transcription)
- AssemblyAI: Universal-2 USD 0.15/hour (USD 0.0025/min), Universal-3.5 Pro USD 0.21/hour (July 2026). — [buildmvpfast](https://www.buildmvpfast.com/api-costs/transcription); [AssemblyAI pricing blog](https://www.assemblyai.com/blog/speech-to-text-api-pricing)
- Mistral Voxtral Mini Transcribe 2: USD 0.003/min batch (4% WER on FLEURS), with a realtime variant also offered. — [Mistral on X](https://x.com/MistralAI/status/2019068832405443046); [Mistral docs](https://docs.mistral.ai/models/voxtral-mini-transcribe-26-02)
- Groq: Whisper-large-v3-turbo USD 0.04/hour, Whisper-large-v3 USD 0.111/hour. — [Groq docs](https://console.groq.com/docs/model/whisper-large-v3-turbo); [CloudZero Groq pricing](https://www.cloudzero.com/blog/groq-pricing/)
- ElevenLabs Scribe: USD 0.22/hour batch, USD 0.39/hour realtime. — [ElevenLabs STT API](https://elevenlabs.io/speech-to-text-api); [Flexprice breakdown](https://flexprice.io/blog/elevenlabs-pricing-breakdown)
- Effective cost with add-ons can be 2 to 4x the advertised base rate (diarization, keyterms, etc.). — [smallest.ai](https://smallest.ai/blog/speech-to-text-api-pricing-models-explained-(2026))

### Inferences (arithmetic on the cited prices; "2 hours/day of speech" = 44 h/month at 22 working days or 60 h/month at 30 days)
- Groq Whisper-large-v3-turbo (USD 0.04/h): USD 1.76 to 2.40/month. Groq Whisper-large-v3 (USD 0.111/h): USD 4.88 to 6.66.
- AssemblyAI Universal-2 (USD 0.15/h): USD 6.60 to 9.00. Universal-3.5 Pro (USD 0.21/h): USD 9.24 to 12.60.
- OpenAI gpt-4o-mini-transcribe / Voxtral Mini Transcribe 2 (USD 0.18/h): USD 7.92 to 10.80.
- ElevenLabs Scribe batch (USD 0.22/h): USD 9.68 to 13.20; realtime (USD 0.39/h): USD 17.16 to 23.40.
- Deepgram Nova-3 batch (USD 0.258/h): USD 11.35 to 15.48; streaming (USD 0.462/h): USD 20.33 to 27.72.
- Gemini 3.5 Transcribe batch (USD 0.30/h): USD 13.20 to 18.00; Live (USD 0.54/h): USD 23.76 to 32.40.
- OpenAI gpt-4o-transcribe (USD 0.36/h): USD 15.84 to 21.60.
- Conclusion: against a EUR 15 (about USD 16 to 17) subscription, a true 2-hour-per-day user is roughly break-even or loss-making on Gemini 3.5 Transcribe batch, clearly loss-making on any streaming/live endpoint, and comfortably profitable (under USD 3 to 11) on Groq Whisper, Voxtral, gpt-4o-mini-transcribe or AssemblyAI batch, before payment fees and LLM post-processing.
- Reality check on volume: 2 hours/day equals about 18,000 words/day at 150 WPM, about 3x the self-reported top-2% Wispr user (about 6,250 words/day, about 42 min/day). At 42 min/day (15 h/month) the Gemini 3.5 Transcribe batch cost is about USD 4.60/month, and a median user (likely under 10 min/day) costs under USD 1/month. A subscription at EUR 15 therefore covers a typical user many times over and can absorb a small heavy tail; the risk is only if the average subscriber is a multi-hour dictator.
- Levers that reduce cost independent of vendor: push-to-talk (pay only for speech), client-side VAD/silence trimming, batch rather than live endpoints (about 40 to 45% cheaper at both Google and Deepgram), a cheaper model tier for free users, and a soft fair-use cap (for example a monthly word or audio-hour ceiling after which a cheaper model is used) which Wispr does not publish but which several competitors implement via free-tier word caps.

### Gaps
- No official data on the distribution of dictation minutes per subscriber at Wispr or any competitor; the "top 2%" figure comes from one blogger's screenshot of the Usage tab.
- Volume/enterprise discounts from Google, Deepgram or others are not public; the arithmetic above uses list prices.

## Key question 7: LLM post-processing (filler removal, self-correction, formatting): which models and costs

### Takeaway
All major cloud dictation products (Wispr Flow, Willow, Aqua, Typeless) and most local apps (Superwhisper, VoiceInk, MacWhisper Pro, Spokenly, Amical) run an LLM cleanup pass after ASR; Wispr has confirmed using Llama 3.1 and OpenAI models for editing and lists OpenAI, Anthropic, Google, Cerebras and Baseten as subprocessors. Per-dictation LLM cost is small relative to ASR because dictations are short text, but no product publishes its LLM spend.

### Cited Findings
- Wispr Flow: uses open-source Llama 3.1 and proprietary OpenAI models for text editing; Kothari frames Wispr's own models as learning "transcription, formatting, and intent together". — [Computerworld, 2025-12-31](https://www.computerworld.com/article/4107331/wispr-ceo-interview-post-keyboard-office.html)
- Wispr Flow behaviour: on hotkey release Flow "interprets" the whole utterance, adds punctuation and paragraphs, capitalises, strips filler words and applies self-corrections; "Context Awareness" lets Flow read which app is active to format appropriately (Settings, Data and Privacy). — [Wispr Flow Help Center: What is Flow?](https://docs.wisprflow.ai/articles/2772472373-what-is-flow); [Sid Saladi guide](https://sidsaladi.substack.com/p/wispr-flow-101-the-complete-guide)
- Wispr subprocessors named by secondary sources include OpenAI, Anthropic, Google, Cerebras, Baseten, AWS (plus Supabase, Stripe, Cloudflare). — [WAIMAKERS](https://www.waimakers.com/en/resources/ai-data-security/wispr-flow); [Spokenly review](https://spokenly.app/blog/wispr-flow-review)
- Competitor post-processing (VoiceInk comparison, 2026-08-10): Willow (style matching, smart memory), Typeless (rewriting, "Ask Anything"), Aqua (custom instructions, formatting), Superwhisper (optional cleanup modes), MacWhisper Pro (AI cleanup with user's own API key), VoiceInk (optional cloud enhancement), Spokenly (optional AI instructions), Amical (optional cloud or Ollama), Raycast (styles); Apple Dictation has none. — [VoiceInk: best dictation apps](https://tryvoiceink.com/best-dictation-apps)
- Windows 11 "Fluid dictation" runs the on-device Phi Silica small language model to improve grammar and punctuation and remove some filler words during voice typing. — [Blabby: voice typing on Windows 11](https://www.blabby.ai/blog/voice-typing-windows)
- FreeFlow (open source, HN Feb 2026): sends a screenshot of the active window plus the transcript to Llama on Groq to fix spelling and technical terms. — [HN Show HN 47040375](https://news.ycombinator.com/item?id=47040375)
- Canto's training explicitly used supervised fine-tuning plus GRPO reinforcement learning, and Wispr claims it reduces editing needs by 30 to 35%, i.e. part of the cleanup is being pushed into the ASR model itself. — [Wispr Flow: Canto](https://wisprflow.ai/canto); [Series B post](https://wisprflow.ai/post/series-b)

### Inferences
- Order-of-magnitude LLM cost (not sourced in this research; based on the token arithmetic of a 100-word dictation being about 130 tokens in and 130 out plus a few hundred tokens of system prompt and app context): even at 18,000 words/day (about 180 dictations of 100 words) this is on the order of 150k to 250k tokens/day; at small-model rates in the USD 0.10 to 0.60 per million-token range that is roughly USD 0.02 to 0.15 per day, i.e. about USD 1 to 4 per month for the extreme user and cents for a typical user. The report writer should treat these as unverified estimates; small-model token prices were not fetched in this research.
- Using Cerebras or Groq-hosted Llama for cleanup (as Wispr's subprocessor list and the FreeFlow clone suggest) is the cheap, low-latency default; frontier models (OpenAI, Anthropic) are likely reserved for command-mode edits or context-heavy rewriting.

### Gaps
- No product publishes which exact LLM handles the cleanup pass or its per-dictation cost.
- Whether Wispr still uses Llama 3.1 after Canto (August 2026) is not stated.
