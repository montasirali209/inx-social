FROM node:24-bookworm-slim

ARG OPENMONTAGE_COMMIT=08e2151fa02de28a5d6a312b3d575692bf147ad7

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip python3-venv git ffmpeg ca-certificates \
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

COPY pipeline_defs/inx-stock-montage.yaml /opt/OpenMontage/pipeline_defs/inx-stock-montage.yaml
COPY main.py /app/main.py

ENV OPENMONTAGE_ROOT=/opt/OpenMontage \
    OPENMONTAGE_COMMIT=$OPENMONTAGE_COMMIT \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/opt/OpenMontage

WORKDIR /app
CMD ["/bin/sh", "-c", "/opt/venv/bin/uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
