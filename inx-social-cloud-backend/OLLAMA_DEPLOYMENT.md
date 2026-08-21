# INX Social Ollama deployment and fallback guide

Updated: 21 August 2026. Prices change; confirm them on the provider page before purchase.

## What INX Social now does

The Social Agent always attempts Ollama first. A paid OpenAI-compatible endpoint can be configured as an emergency fallback, but it is disabled by default. It is eligible only when Ollama is not configured or returns a network failure, timeout, HTTP 408, HTTP 429, or HTTP 5xx. A normal Ollama answer, even a weak one, does not trigger paid usage. The default ceiling is one paid call per mission.

## Recommended starting architecture

```text
Browser -> social.inaxx.co.uk on Railway -> HTTPS + Cloudflare Access
       -> ai.social.inaxx.co.uk -> Cloudflare Tunnel -> Ollama :11434
```

Railway stays responsible for the web application and PostgreSQL. Ollama runs on a GPU computer elsewhere because Railway does not offer GPU instances. The Ollama port must never be opened directly to the public Internet.

## Hosting choices

### 1. Existing Windows or Linux GPU computer — cheapest trial

Use this first when you already own a suitable machine. Install Ollama and `cloudflared`, keep the machine awake, and connect it through Cloudflare Tunnel. Cost is electricity plus any Cloudflare plan features. This is ideal for development, but availability depends on your Internet connection and computer uptime.

Suggested local models:

- `qwen2.5:7b-instruct` for low-memory planning and captions;
- a current 7B–14B instruction model after testing its licence and output quality;
- do not use a 550B model for this product stage—the GPU cost is unnecessary.

### 2. Runpod Pod — recommended first hosted GPU

Runpod offers persistent Pods and serverless workers. Current listed Pod examples include RTX A5000 from about $0.27/hour, A40 about $0.44/hour and L4 about $0.49/hour; availability and regional pricing vary. A 24 GB GPU is enough for a quantized 7B–14B model. Shut the Pod down when unused, but preserve model storage separately if required.

### 3. Runpod Serverless — best for bursty production inference

Serverless scales to zero and is billed per second while a worker runs. Current listed entry GPU classes start around $0.58/hour-equivalent. It needs a container/handler adapter rather than relying on a continuously reachable Ollama daemon. Use this after the request volume is understood.

### 4. Vast.ai — potentially lowest marketplace price

Vast uses a supply-and-demand GPU marketplace with per-second billing. It can be inexpensive, but host reliability, networking, storage and availability vary. Use verified hosts, encrypted storage and health checks. It is better for controlled experiments than the first customer-facing production deployment.

### 5. Major clouds or dedicated GPU hosts

AWS, Google Cloud, Azure, Lambda GPU Cloud and similar providers provide stronger enterprise controls and predictable support, normally at higher cost. Choose these when compliance, private networking, reserved capacity or formal support matters more than lowest price.

### 6. Ollama cloud models

Ollama also offers cloud-offloaded models through the Ollama client. This is convenient but is a paid/hosted service rather than your own GPU. Treat it as another external provider and review its pricing and data terms before enabling it.

## Secure Cloudflare Tunnel setup

The following is performed on the machine that runs Ollama, not Railway.

1. Add `inaxx.co.uk` to Cloudflare DNS/Zero Trust if it is not already managed there.
2. In Cloudflare Zero Trust, create a tunnel named `inx-social-ollama`.
3. Install `cloudflared` using the command Cloudflare provides for that tunnel.
4. Add a published application route:
   - hostname: `ai.social.inaxx.co.uk`
   - service: `http://127.0.0.1:11434`
5. Create a self-hosted Cloudflare Access application for `ai.social.inaxx.co.uk`.
6. Create a Service Auth policy. Do not add a public bypass rule.
7. Create a service token and copy its Client ID and Client Secret once.
8. Restrict the host firewall so port 11434 is local-only. Do not port-forward it on the router.
9. Start Ollama, pull the selected model, then start the tunnel.
10. Add the settings below as Railway variables and redeploy.

For Windows development:

```bat
ollama pull qwen2.5:7b-instruct
ollama serve
cloudflared service install YOUR_TUNNEL_TOKEN
```

For a Docker GPU host, use the official Ollama container with GPU access and persistent `/root/.ollama` storage. Bind Ollama to a private Docker network or loopback-facing reverse proxy; expose only `cloudflared` outbound access.

## Railway variables

```text
OLLAMA_BASE_URL=https://ai.social.inaxx.co.uk
OLLAMA_MODEL=qwen2.5:7b-instruct
OLLAMA_TIMEOUT_MS=120000
OLLAMA_CF_ACCESS_CLIENT_ID=<Cloudflare service-token client ID>
OLLAMA_CF_ACCESS_CLIENT_SECRET=<Cloudflare service-token secret>
```

Leave paid fallback disabled while testing:

```text
AI_PAID_FALLBACK_ENABLED=false
AI_PAID_FALLBACK_BASE_URL=
AI_PAID_FALLBACK_API_KEY=
AI_PAID_FALLBACK_MODEL=
AI_PAID_FALLBACK_MAX_CALLS_PER_MISSION=1
```

When you later deliberately buy access to an OpenAI-compatible gateway, set its `/v1` base URL, key and model, then change `AI_PAID_FALLBACK_ENABLED=true`. Never put either Cloudflare or provider credentials in browser code.

## Acceptance checks

1. In Cloudflare Access logs, confirm unauthenticated requests are rejected.
2. From Railway, run a health request using the service-token headers.
3. Open Social Agent and confirm `Ollama online` and the chosen model appear.
4. Run a Hybrid mission and confirm task outputs enter Working Memory.
5. Stop Ollama. With paid fallback disabled, confirm the mission pauses and makes no paid call.
6. If paid fallback is later enabled, stop Ollama and confirm at most the configured number of fallback calls is recorded in the live feed.
7. Rotate the Cloudflare service token and tunnel token if either is exposed.

## Operational rules

- Do not fine-tune Ollama automatically on production conversations. Store reviewed, versioned working memory and retrieve it as context.
- Back up only approved brand memory, not raw access tokens or private customer uploads.
- Add uptime monitoring for Ollama and the tunnel before enabling Autopilot for customers.
- Autopilot covers organic content only. Paid ads, spending, Page deletion, ownership and security changes remain outside automatic execution.
