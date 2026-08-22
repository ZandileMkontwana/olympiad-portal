---
kind: external_dependency
name: SendGrid email API
slug: sendgrid
category: external_dependency
category_hints:
    - vendor_identity
    - auth_protocol
scope:
    - '**'
---

### SendGrid outbound email
- Used to send submission receipts and round reminders from the backend via `@sendgrid/mail`.
- Authentication is via a SendGrid API key injected through environment variables (the test suite mocks this dependency); the real integration expects a standard SendGrid key format.
- The tech-stack doc lists it as the chosen external API for email; confirm the exact environment variable name and API version against the SendGrid docs when wiring production secrets.
- No inbound webhook or event subscription is used — only outbound transactional emails.