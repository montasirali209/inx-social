# Secure Mac Ollama deployment (ngrok-first)

Social Agent ships in **Admins only** mode. Configure the Mac gateway, verify missions with an administrator account, then use **Admin → AI Model Routing → Social Agent availability** to enable eligible subscribers. Customer workspaces show subscription mission usage only; model routes, provider pricing and paid-call records remain private to administrators.

This is the initial low-cost topology for INX Social. Railway never connects directly to Ollama. It calls an authenticated local gateway through an ngrok HTTPS URL.

`Railway -> ngrok HTTPS -> 127.0.0.1:5051 INX Gateway -> 11434 text/vision + 11435 image`

## 1. Requirements on the Mac

- Keep the Mac awake, online and connected to power while missions run.
- The verified 24 GB M4 MacBook Air uses standard Ollama `0.32.15` on `127.0.0.1:11434` for `qwen3.5:9b` text/vision and the existing image-compatible Ollama `0.22.1` on `127.0.0.1:11435` for local image generation.
- Phase 11.4 local image generation uses `x/z-image-turbo`. Image generation is sequential and may temporarily use most available unified memory.
- ngrok must be installed and authenticated.
- Node.js 20 or newer must be installed.

Verify:

```bash
ollama --version
ollama list
OLLAMA_HOST=http://127.0.0.1:11434 ollama pull qwen3.5:9b
ollama pull x/z-image-turbo
curl -s http://127.0.0.1:11434/api/version
curl -s http://127.0.0.1:11435/api/version
node --version
ngrok version
```

## 2. Create a gateway token

```bash
openssl rand -hex 32
```

Save the result in a password manager. Do not paste it into Git or screenshots.

## 3. Start the protected gateway

```bash
cd /path/to/inx-social-cloud-backend/ollama-gateway
export INX_OLLAMA_GATEWAY_TOKEN='paste-the-64-character-token'
export OLLAMA_TEXT_URL='http://127.0.0.1:11434'
export OLLAMA_IMAGE_URL='http://127.0.0.1:11435'
export OLLAMA_ALLOWED_MODELS='qwen3:8b,qwen3:14b,qwen3.5:9b,qwen3-embedding:0.6b'
export OLLAMA_ALLOWED_IMAGE_MODELS='x/z-image-turbo'
npm start
```

The gateway binds to localhost only and exposes no model-management route. It accepts one active generation across both local engines, keeps a bounded queue, clamps context size, and removes Ollama's internal `thinking` field before a response leaves the Mac.

The production Mac uses the existing LaunchAgents `uk.co.inaxx.ollama-image`, `uk.co.inaxx.ollama-gateway`, and `uk.co.inaxx.ngrok`; the Terminal exports above are an explanatory/manual fallback only. The gateway LaunchAgent script must define the two local URLs and updated model allowlist.

In a second Terminal window:

```bash
ngrok http 5051
```

Copy the forwarding HTTPS URL shown by ngrok, for example `https://example.ngrok-free.app`. A free URL may change after restart; update Railway whenever it changes. A reserved ngrok domain can be added later without changing INX Social DNS.

Test the tunnel:

```bash
curl -s -H 'Authorization: Bearer paste-the-64-character-token' https://example.ngrok-free.app/health
```

## 4. Railway variables

Add these to the INX Social backend service:

```text
OLLAMA_BASE_URL=https://example.ngrok-free.app
OLLAMA_API_KEY=paste-the-64-character-token
OLLAMA_MODEL=qwen3.5:9b
OLLAMA_SIMPLE_CONTEXT=8192
OLLAMA_COMPLEX_CONTEXT=32768
OLLAMA_VISION_ENABLED=true
OLLAMA_TIMEOUT_MS=180000
OLLAMA_IMAGE_MODEL=x/z-image-turbo
OLLAMA_IMAGE_TIMEOUT_MS=300000
OLLAMA_IMAGE_REVIEW_ENABLED=true
OLLAMA_IMAGE_REVIEW_MIN_SCORE=75
AI_PAID_FALLBACK_ENABLED=false
OPENAI_API_KEY=store-the-secret-in-Railway-only
OPENAI_MODEL=gpt-5.6
OPENAI_WEB_SEARCH_MODEL=gpt-5.6
WEB_RESEARCH_ENABLED=true
WEB_RESEARCH_PROVIDER=openai
WEB_RESEARCH_BASE_URL=https://api.openai.com/v1
```

Leave the Cloudflare access variables empty when using ngrok. Redeploy only after saving the variables.

## 5. Admin routing

Open Admin -> AI Model Routing. Keep Ollama as priority 1 for each task type. Paid fallback requires all of the following, so accidental spending is blocked:

1. `AI_PAID_FALLBACK_ENABLED=true` in Railway;
2. provider URL, key and model configured in Railway;
3. the individual Admin route fallback switch enabled;
4. a genuine Ollama availability failure;
5. remaining per-mission fallback allowance.

Keep paid fallback disabled during initial local testing.

Live research is independent from emergency fallback. For a complex research mission, Ollama produces the first draft and search questions, then one OpenAI Responses API call is required to search current public sources and refine that draft. The refined response produces a concise reusable learning candidate for administrator review. `AI_PAID_FALLBACK_ENABLED=false` does not disable this governed research call.

In Admin -> AI Model Routing, enable **Local image generation**, keep the provider set to `OLLAMA_IMAGE`, choose `x/z-image-turbo`, and initially limit output to one image per mission. Selected logo/reference uploads are sent privately to `qwen3.5:9b` for brand review. Every generated image is then inspected for generic phone mockups, fabricated logos, gibberish, unreadable text and misleading UI; one automatic local regeneration is allowed before customer review. The customer sees only their generated assets and subscription usage—not the private route or model name.

## 6. Verify local image generation

The gateway health response must list `x/z-image-turbo` under `imageModels`. Then run one administrator-only Social Agent mission that explicitly requests a single image. Confirm that the mission image task completes and the authenticated thumbnail opens in Studio. No video provider or paid fallback is needed for this test.

## 7. Learning policy

Completed reasoning is converted into a concise reusable summary or playbook. Hidden chain-of-thought is removed at the Mac gateway and is never transmitted, displayed or saved. Current market facts are not stored as permanent learning. New durable playbooks appear in Admin -> Agent Learning as `PENDING_REVIEW`. Only `APPROVED` memories can be supplied to a future matching Ollama task. Declined items are retained for audit but never reused.

## 8. Operations and security

- Never run `ngrok http 11434`.
- Never expose Ollama with `OLLAMA_HOST=0.0.0.0` for this setup.
- Rotate the gateway token after any accidental disclosure.
- Stop ngrok or the gateway to immediately remove cloud access.
- The free tunnel is suitable for owner testing, not guaranteed production uptime.
- When customer load requires always-on capacity, move the same authenticated gateway contract to a GPU provider and keep the Railway routing unchanged.
