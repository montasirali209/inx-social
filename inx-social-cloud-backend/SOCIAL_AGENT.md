# INX Social Agent

## Phase 11.0 scope

Phase 11.0 establishes the approval-first control plane for the future cross-platform Social Agent.

Included now:

- authenticated Social Agent workspace in Cloud Studio;
- deterministic campaign planning for Facebook, Instagram, YouTube and TikTok;
- economical INX Template, Wan 2.2 Fast and LTX 2.3 Fast routing choices;
- transparent media cost estimates;
- persistent plans and task-level audit data;
- explicit approval and cancellation records;
- high-risk labelling for publishing and Page changes.

Not enabled in Phase 11.0:

- paid media-generation API calls;
- autonomous publishing;
- autonomous Page creation or profile changes;
- provider API keys;
- background execution workers.

This separation is intentional. It lets the data model, user experience, permissions and approval boundary be reviewed before INX Social can spend money or change an external account.

## Planned execution phases

1. **11.1 Brand Memory and Asset Vault** — business brief, logo files, colours, approved claims, prohibited claims and structured retrieval.
2. **11.2 Economy Content Engine** — FFmpeg template videos, still-image posts, captions, accessibility text and cost ledger.
3. **11.3 Provider Gateway** — Replicate/fal/BytePlus adapters, encrypted server-side keys, retries, budgets and generation result storage.
4. **11.4 Instagram Publishing** — account connection, media container workflow, disclosures and analytics.
5. **11.5 YouTube Publishing** — OAuth, resumable uploads, Shorts metadata, quota handling and analytics.
6. **11.6 TikTok Publishing** — Content Posting API, privacy controls, commercial-content disclosures and TikTok review requirements.
7. **11.7 Campaign Autopilot** — approved recurring campaigns, queue workers, failure recovery and operator alerts.
8. **11.8 Structured Learning** — analytics summaries and reusable playbooks stored as versioned memory. This is retrieval and workflow memory, not uncontrolled model self-training.

## Future environment variables

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
