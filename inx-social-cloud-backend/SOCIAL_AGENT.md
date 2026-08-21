# INX Social Agent

## Phase 11.1 scope

Phase 11.1 turns the original planning foundation into an Ollama-first mission runtime with visible execution, reusable working memory and administrator-controlled provider priority.

Included now:

- an animated mission-control workspace with a live event feed;
- **Autopilot** for approved organic-content workflows and **Hybrid** for an owner checkpoint;
- Ollama-first planning, copy, adaptation and scheduling work;
- persistent, attributable working memory created from completed tasks;
- administrator-selected Ollama models for each work type;
- an optional OpenAI-compatible paid fallback, disabled by default and eligible only when Ollama is unavailable;
- administrator-selected video provider/model priorities and a mandatory per-asset cost ceiling before paid generation can be allowed;
- persistent plans, tasks, outputs and runtime events;
- repaired Facebook analytics capability detection without the obsolete Page `tasks` field.

Deliberately not claimed as complete in Phase 11.1:

- provider-specific video generation adapters and credentials;
- Instagram, YouTube and TikTok publishing adapters and their app reviews;
- automatic Facebook Page creation, ownership, deletion or security changes;
- paid advertising or advertising spend;
- uncontrolled self-training from customer conversations.

The runtime pauses visibly at an unavailable provider or platform adapter. It never reports media or publishing as complete when the corresponding external worker is not installed.

## Execution and fallback rules

1. Every language task uses the administrator's Priority 1 Ollama model.
2. A paid text model is considered only after a network failure, timeout, HTTP 408, HTTP 429 or HTTP 5xx from Ollama (or when Ollama is not configured).
3. Weak, short or imperfect Ollama output does **not** activate paid fallback.
4. Paid fallback must be enabled both in Railway configuration and on that task route in the admin panel.
5. Paid calls are capped per mission and recorded in the mission feed.
6. Video generation stays disabled or waiting until its selected provider adapter and server-side credentials exist.
7. Paid video generation additionally requires the admin switch and a non-zero maximum cost per asset.

Secrets, service-token credentials and private endpoints stay in Railway variables. The admin panel controls routing policy, models, priority and budgets but never returns a secret to the browser.

## Planned execution phases

1. **11.2 Brand Vault and retrieval** — customer files, logos, colours, approved claims and prohibited claims.
2. **11.3 Economy Content Engine** — FFmpeg template videos, image/carousel generation, captions, alt text and cost ledger.
3. **11.4 Provider adapters** — local worker, Runpod, fal, Replicate, BytePlus and selected commercial video APIs.
4. **11.5 Cross-platform workers** — Instagram, YouTube and TikTok OAuth, publishing and analytics after their reviews.
5. **11.6 Organic Autopilot** — recurring queues, retries, operator alerts and customer-defined safety limits.
6. **11.7 Evaluated learning** — analytics-backed, versioned playbooks promoted to memory only after validation.

## Deployment

See `OLLAMA_DEPLOYMENT.md` for self-hosting choices, Cloudflare Tunnel and Access setup, Railway variables, fallback controls and acceptance checks.

## Future provider variables

Do not configure these until their corresponding execution phase is installed:

```text
REPLICATE_API_TOKEN=
FAL_KEY=
BYTEPLUS_API_KEY=
OPENROUTER_API_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
```

All provider secrets must remain server-side. They must never be returned through the Studio API or stored in browser local storage.
