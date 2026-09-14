FROM public.ecr.aws/docker/library/node:24-bookworm-slim

ARG OPENMONTAGE_COMMIT=08e2151fa02de28a5d6a312b3d575692bf147ad7

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 python3-pip python3-venv git ffmpeg chromium ca-certificates \
       build-essential fonts-dejavu-core libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Keep the upstream OpenMontage checkout pristine. INXSocial integration lives
# only in /app and never overwrites upstream tools, skills, pipeline manifests,
# provider registries, schemas or renderers.
WORKDIR /opt
RUN git clone https://github.com/calesthio/OpenMontage.git OpenMontage \
    && cd OpenMontage \
    && git checkout "$OPENMONTAGE_COMMIT" \
    && test "$(git rev-parse HEAD)" = "$OPENMONTAGE_COMMIT" \
    && test -z "$(git status --porcelain)"

COPY requirements.txt /tmp/inx-requirements.txt
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel \
    && /opt/venv/bin/pip install --no-cache-dir -e /opt/OpenMontage -r /opt/OpenMontage/requirements.txt -r /tmp/inx-requirements.txt \
    && /opt/venv/bin/pip install --no-cache-dir piper-tts

# Install the native upstream composition runtimes exactly as OpenMontage's
# documented setup requires. No INXSocial renderer override is copied in.
RUN cd /opt/OpenMontage/remotion-composer && npm ci \
    && cd /opt/OpenMontage \
    && npx --yes hyperframes --version >/dev/null 2>&1 || true

COPY full_bridge.py compat_bridge.py /app/

ENV OPENMONTAGE_ROOT=/opt/OpenMontage \
    OPENMONTAGE_COMMIT=$OPENMONTAGE_COMMIT \
    REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/opt/OpenMontage

WORKDIR /app
CMD ["/bin/sh", "-c", "/opt/venv/bin/uvicorn compat_bridge:app --host 0.0.0.0 --port ${PORT:-8080}"]
