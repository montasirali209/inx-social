# INX Ollama Gateway

This small local service is the only endpoint that ngrok should expose. It binds to `127.0.0.1:5051`, authenticates every request, allows only configured models, accepts chat, embedding and image-generation routes, caps the queue and never logs prompts.

Do not expose Ollama port `11434` directly. See `../OLLAMA_DEPLOYMENT.md` for the complete Mac and Railway procedure.

Image generation accepts the authenticated OpenAI-compatible `/v1/images/generations` request used by INX Social, validates the requested model and dimensions, translates it to Ollama's experimental `/api/generate` image request, and converts the returned `image` field to `b64_json`. Image models remain isolated in `OLLAMA_ALLOWED_IMAGE_MODELS`.

Important: recent Ollama builds may not contain the experimental macOS image runner. A model appearing in `/health` proves only that it is allow-listed. Verify the Ollama version can actually generate before resuming a mission.
