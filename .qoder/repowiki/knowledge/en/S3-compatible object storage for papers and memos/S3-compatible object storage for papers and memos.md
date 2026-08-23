---
kind: external_dependency
name: S3-compatible object storage for papers and memos
slug: cloudflare-r2-aws-s3
category: external_dependency
scope:
    - '**'
---

### Paper/memo file storage
- Paper PDFs and memo files are not stored in Postgres; the Paper model stores only `fileUrl` and `memoUrl` pointing to an S3-compatible bucket.
- The tech-stack doc states the choice is Cloudflare R2 or AWS S3 (to be confirmed at deploy time). The current route code uploads via multer and persists URLs — the actual SDK call is expected to be swapped to the chosen provider's S3-compatible client.
- When implementing, use the provider's S3-compatible SDK (R2 or AWS SDK) with region/bucket credentials from environment variables; do not embed credentials in source. Confirm exact upload endpoint and bucket policy against the chosen vendor's docs.