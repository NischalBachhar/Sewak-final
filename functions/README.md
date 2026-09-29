# Preserved Firebase rollback reference

This directory is the historical Firebase backend. It is **not part of the active Sewak runtime or Cloudflare build/deploy**. Its Firebase Admin dependencies are only for retained migration, backup and offline reference tools. Do not deploy it, enable its APIs or use its provisioning/signing scripts for the Cloudflare-only cutover.

The current backend is `worker/src`, configured by `wrangler.toml` (isolated staging) and `wrangler.production.toml` (production). Authentication, users and sessions live in D1. Future mobile work should use `docs/MOBILE_API.md` and `docs/openapi.json`.

Keep this source for rollback provenance; a Firebase rollback or project deletion requires separate authorization.
