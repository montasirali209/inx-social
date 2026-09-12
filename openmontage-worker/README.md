# INXSocial OpenMontage Worker

This independently deployed HTTP service integrates the unmodified
[OpenMontage](https://github.com/calesthio/OpenMontage) runtime at pinned commit
`08e2151fa02de28a5d6a312b3d575692bf147ad7`.

It is deliberately isolated from the INXSocial application. The two services
communicate only through the authenticated HTTP endpoints in `main.py`; they do
not share application code, runtime memory, or database models.

## License and source availability

OpenMontage is licensed under AGPL-3.0. This worker wrapper is distributed under
the same license. The corresponding source is this directory plus the exact
upstream source identified by the pinned commit above. INXSocial's separate
application is not part of this worker process or combined runtime.

## API

- `GET /health` — runtime health and pinned commit
- `GET /capabilities` — live OpenMontage pipeline and provider discovery
- `POST /jobs` — start the `inx-stock-montage` pipeline
- `GET /jobs/{id}` — stage and progress
- `GET /jobs/{id}/output` — completed MP4

All endpoints except health require `Authorization: Bearer
$OPENMONTAGE_INTERNAL_TOKEN`.

