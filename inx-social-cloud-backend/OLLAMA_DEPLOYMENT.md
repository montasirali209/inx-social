# Secure Mac Ollama deployment (ngrok-first)

Social Agent ships in **Admins only** mode. Configure the Mac gateway, verify missions with an administrator account, then use **Admin → AI Model Routing → Social Agent availability** to enable eligible subscribers. Customer workspaces show subscription mission usage only; model routes, provider pricing and paid-call records remain private to administrators.

This is the initial low-cost topology for INX Social. Railway never connects directly to Ollama. It calls an authenticated local gateway through an ngrok HTTPS URL.

`Railway -> ngrok HTTPS -> 127.0.0.1:5051 INX Gateway -> 127.0.0.1:11434 Ollama`

## 1. Requirements on the Mac

- Keep the Mac awake, online and connected to power while missions run.
- Ollama must be running. Recommended text default for the 24 GB M4 MacBook Air: `qwen3:8b`. Use `qwen3:14b` only for complex tasks and expect lower throughput.
- Phase 11.4 local image generation uses `x/z-image-turbo`. Image generation is sequential and may temporarily use most available unified memory.
- ngrok must be installed and authenticated.
- Node.js 20 or newer must be installed.

Verify:

```bash
ollama --version
ollama list
ollama pull x/z-image-turbo
curl -s http://127.0.0.1:11434/api/version
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
export OLLAMA_ALLOWED_MODELS='qwen3:8b,qwen3:14b,qwen3-embedding:0.6b'
export OLLAMA_ALLOWED_IMAGE_MODELS='x/z-image-turbo'
npm start
```

The gateway binds to localhost only and exposes no model-management route. It accepts one active generation and keeps a bounded queue for the Mac.

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
OLLAMA_MODEL=qwen3:8b
OLLAMA_TIMEOUT_MS=180000
OLLAMA_IMAGE_MODEL=x/z-image-turbo
OLLAMA_IMAGE_TIMEOUT_MS=300000
AI_PAID_FALLBACK_ENABLED=false
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

In Admin -> AI Model Routing, enable **Local image generation**, keep the provider set to `OLLAMA_IMAGE`, choose `x/z-image-turbo`, and initially limit output to one image per mission. The customer sees only their generated assets and subscription usage—not the private route or model name.

## 6. Verify local image generation

The gateway health response must list `x/z-image-turbo` under `imageModels`. Then run one administrator-only Social Agent mission that explicitly requests a single image. Confirm that the mission image task completes and the authenticated thumbnail opens in Studio. No video provider or paid fallback is needed for this test.

## 7. Learning policy

Completed reasoning is converted into a concise reusable summary or playbook. Hidden chain-of-thought is never saved. New playbooks appear in Admin -> Agent Learning as `PENDING_REVIEW`. Only `APPROVED` memories can be supplied to a future matching Ollama task. Declined items are retained for audit but never reused.

## 8. Operations and security

- Never run `ngrok http 11434`.
- Never expose Ollama with `OLLAMA_HOST=0.0.0.0` for this setup.
- Rotate the gateway token after any accidental disclosure.
- Stop ngrok or the gateway to immediately remove cloud access.
- The free tunnel is suitable for owner testing, not guaranteed production uptime.
- When customer load requires always-on capacity, move the same authenticated gateway contract to a GPU provider and keep the Railway routing unchanged.
