# Social Agent media foundation

Phase 11.4 adds a deliberately bounded media workflow for administrator testing.

## Brand inputs

- PNG, JPEG and WebP only.
- Maximum 1 MB per uploaded image.
- Maximum 20 unattached uploaded brand images per account.
- Logo, profile-picture and general visual-reference classifications.
- Maximum 10 selected reference images per mission.
- Identical uploads are deduplicated by SHA-256 checksum.
- Files are served only through an authenticated owner-scoped API route.
- Uploaded brand references remain reusable and receive a 90-day expiry date. Generated assets are retained with their mission.

These limits keep the first implementation workable on the existing PostgreSQL deployment. Before broad customer launch, move binary media to private object storage and retain only ownership, checksum and lifecycle metadata in PostgreSQL.

## Generated images

- The administrator controls whether local image generation is enabled, the Ollama image model, output size and maximum images per mission.
- `x/z-image-turbo` is the initial local route for the 24 GB Apple-silicon development Mac. Ollama currently documents this as experimental text-to-image generation; Phase 11.4 does not claim reference-image editing.
- Generation travels only through the authenticated INX Ollama gateway.
- Image tasks never fall through silently to a paid provider.
- Returned files are signature-checked as PNG, JPEG or WebP and capped at 8 MB.
- Generated assets are attached to the mission and shown in authenticated task output.

## Video

Video generation remains a separate governed route. Phase 11.4 does not pretend that Ollama text or image models generate production video. Paid or GPU-hosted video workers stay disabled until an administrator configures a provider, price ceiling and explicit policy.

## Production hardening before customer launch

1. Replace PostgreSQL binary storage with private S3-compatible object storage.
2. Add malware/content scanning and image dimension validation.
3. Add automatic expiry deletion for abandoned uploads.
4. Add tenant storage quotas and operational metrics.
5. Add moderation and brand-policy review before automated publication.
6. Run the image worker on an always-on GPU service when the development Mac is no longer sufficient.
