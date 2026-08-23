# INX Ollama Gateway

This small local service is the only endpoint that ngrok should expose. It binds to `127.0.0.1:5051`, authenticates every request, allows only configured models, accepts chat, embedding and image-generation routes, caps the queue and never logs prompts.

Do not expose Ollama port `11434` directly. See `../OLLAMA_DEPLOYMENT.md` for the complete Mac and Railway procedure.

Image generation uses `/v1/images/generations` and a separate `OLLAMA_ALLOWED_IMAGE_MODELS` allow-list. INX Social defaults to the commercially permissive `x/z-image-turbo` route.
