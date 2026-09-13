FROM public.ecr.aws/docker/library/node:24-bookworm-slim

ARG OPENMONTAGE_COMMIT=08e2151fa02de28a5d6a312b3d575692bf147ad7

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip python3-venv git ffmpeg chromium ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
RUN git clone --filter=blob:none https://github.com/calesthio/OpenMontage.git OpenMontage \
    && cd OpenMontage \
    && git checkout "$OPENMONTAGE_COMMIT" \
    && test "$(git rev-parse HEAD)" = "$OPENMONTAGE_COMMIT"

COPY requirements.txt /tmp/inx-requirements.txt
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -e /opt/OpenMontage -r /opt/OpenMontage/requirements.txt -r /tmp/inx-requirements.txt

# Caption and credit composition is deliberately Remotion-only. Installing the
# pinned upstream composer prevents remotion_caption_burn from silently taking
# its basic FFmpeg subtitle fallback path in production.
RUN cd /opt/OpenMontage/remotion-composer && npm ci
COPY overrides/remotion.config.ts /opt/OpenMontage/remotion-composer/remotion.config.ts

COPY pipeline_defs/inx-stock-montage.yaml /opt/OpenMontage/pipeline_defs/inx-stock-montage.yaml
COPY overrides/stock_sources_init.py /opt/OpenMontage/tools/video/stock_sources/__init__.py
RUN sed -i 's#https://api.pexels.com/videos/search#https://api.pexels.com/v1/videos/search#' /opt/OpenMontage/tools/video/stock_sources/pexels.py
COPY main.py /app/main.py
COPY app_entry.py /app/app_entry.py

ENV OPENMONTAGE_ROOT=/opt/OpenMontage \
    OPENMONTAGE_COMMIT=$OPENMONTAGE_COMMIT \
    REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/opt/OpenMontage

WORKDIR /app
CMD ["/bin/sh", "-c", "/opt/venv/bin/uvicorn app_entry:app --host 0.0.0.0 --port ${PORT:-8080}"]
