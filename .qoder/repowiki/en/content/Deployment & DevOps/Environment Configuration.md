# Environment Configuration

<cite>
**Referenced Files in This Document**
- [backend/src/index.js](file://backend/src/index.js)
- [backend/src/middleware/auth.js](file://backend/src/middleware/auth.js)
- [backend/src/lib/email.js](file://backend/src/lib/email.js)
- [backend/prisma/schema.prisma](file://backend/prisma/schema.prisma)
- [frontend/src/lib/api.js](file://frontend/src/lib/api.js)
- [frontend/src/app/educator/round_view/page.js](file://frontend/src/app/educator/round_view/page.js)
- [frontend/src/app/educator/submit/page.js](file://frontend/src/app/educator/submit/page.js)
- [backend/.gitignore](file://backend/.gitignore)
- [frontend/.gitignore](file://frontend/.gitignore)
- [backend/package.json](file://backend/package.json)
- [frontend/package.json](file://frontend/package.json)
</cite>

## Table of Contents
1. Introduction
2. Project Structure
3. Core Components
4. Architecture Overview
5. Detailed Component Analysis
6. Dependency Analysis
7. Performance Considerations
8. Troubleshooting Guide
9. Conclusion

## Introduction
This document provides environment configuration guidance for the Olympiad Portal, covering both backend and frontend applications. It explains required environment variables for database connections, authentication secrets, email service configuration, file storage settings, and runtime behavior across development, staging, and production environments. It also includes security best practices for managing sensitive configuration data, .gitignore patterns, secret rotation procedures, example .env setups, and common pitfalls to avoid.

## Project Structure
The project is a monorepo with separate backend (Express + Prisma) and frontend (Next.js) applications:
- Backend: Express server, JWT-based auth middleware, SendGrid email integration, Prisma client, and static file serving for uploads.
- Frontend: Next.js application that calls backend APIs using environment-driven base URLs.

```mermaid
graph TB
subgraph "Backend"
BIndex["Express Entry<br/>backend/src/index.js"]
BAuth["Auth Middleware<br/>backend/src/middleware/auth.js"]
BEmail["Email Service<br/>backend/src/lib/email.js"]
BPrisma["Database Schema<br/>backend/prisma/schema.prisma"]
end
subgraph "Frontend"
FAPI["API Client<br/>frontend/src/lib/api.js"]
FPage1["Round View Page<br/>frontend/src/app/educator/round_view/page.js"]
FPage2["Submit Page<br/>frontend/src/app/educator/submit/page.js"]
end
FAPI --> BIndex
FPage1 --> BIndex
FPage2 --> BIndex
BAuth --> BIndex
BEmail --> BIndex
BPrisma --> BIndex
```

**Diagram sources**
- [backend/src/index.js:1-43](file://backend/src/index.js#L1-L43)
- [backend/src/middleware/auth.js:1-35](file://backend/src/middleware/auth.js#L1-L35)
- [backend/src/lib/email.js:1-23](file://backend/src/lib/email.js#L1-L23)
- [backend/prisma/schema.prisma:1-109](file://backend/prisma/schema.prisma#L1-L109)
- [frontend/src/lib/api.js:1-146](file://frontend/src/lib/api.js#L1-L146)
- [frontend/src/app/educator/round_view/page.js:1-200](file://frontend/src/app/educator/round_view/page.js#L1-L200)
- [frontend/src/app/educator/submit/page.js:1-220](file://frontend/src/app/educator/submit/page.js#L1-L220)

**Section sources**
- [backend/src/index.js:1-43](file://backend/src/index.js#L1-L43)
- [frontend/src/lib/api.js:1-146](file://frontend/src/lib/api.js#L1-L146)

## Core Components
This section summarizes the environment variables used by each component and their roles.

- Backend runtime
  - PORT: Server listening port; defaults to 5000 when not set.
  - NODE_ENV: Used to differentiate environments (e.g., production).
  - DATABASE_URL: PostgreSQL connection string consumed by Prisma.
  - JWT_SECRET: Secret used to sign and verify JSON Web Tokens.
  - SENDGRID_API_KEY: API key for SendGrid email service.
  - SENDGRID_FROM_EMAIL: Sender address used in outgoing emails.

- Frontend runtime
  - NEXT_PUBLIC_API_BASE_URL: Base URL for backend API calls from the shared API client.
  - NEXT_PUBLIC_API_URL: Base URL used in some pages for direct fetch calls.

Notes:
- The backend loads environment variables via dotenv at startup.
- The frontend reads public environment variables prefixed with NEXT_PUBLIC_.
- Prisma reads DATABASE_URL from the environment to connect to PostgreSQL.

**Section sources**
- [backend/src/index.js:34-39](file://backend/src/index.js#L34-L39)
- [backend/src/middleware/auth.js:1-19](file://backend/src/middleware/auth.js#L1-L19)
- [backend/src/lib/email.js:1-23](file://backend/src/lib/email.js#L1-L23)
- [backend/prisma/schema.prisma:6-9](file://backend/prisma/schema.prisma#L6-L9)
- [frontend/src/lib/api.js:1-45](file://frontend/src/lib/api.js#L1-L45)
- [frontend/src/app/educator/round_view/page.js:30-90](file://frontend/src/app/educator/round_view/page.js#L30-L90)
- [frontend/src/app/educator/submit/page.js:40-65](file://frontend/src/app/educator/submit/page.js#L40-L65)

## Architecture Overview
Environment-driven configuration flows through the system as follows:
- Frontend uses NEXT_PUBLIC_* variables to determine where to call the backend.
- Backend uses environment variables to configure server port, database connectivity, JWT signing, and email sending.
- Prisma connects to PostgreSQL using DATABASE_URL.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant BE as "Backend (Express)"
participant DB as "PostgreSQL"
participant Mail as "SendGrid"
FE->>BE : HTTP request (uses NEXT_PUBLIC_API_BASE_URL/NEXT_PUBLIC_API_URL)
BE->>DB : Prisma query (DATABASE_URL)
DB-->>BE : Data
BE-->>FE : JSON response
Note over BE : If needed, send email
BE->>Mail : Send email (SENDGRID_API_KEY, SENDGRID_FROM_EMAIL)
Mail-->>BE : Delivery status
```

**Diagram sources**
- [frontend/src/lib/api.js:17-45](file://frontend/src/lib/api.js#L17-L45)
- [backend/src/index.js:14-40](file://backend/src/index.js#L14-L40)
- [backend/prisma/schema.prisma:6-9](file://backend/prisma/schema.prisma#L6-L9)
- [backend/src/lib/email.js:1-23](file://backend/src/lib/email.js#L1-L23)

## Detailed Component Analysis

### Backend Environment Variables
- PORT
  - Purpose: Controls which port the Express server listens on.
  - Default: 5000 if not provided.
  - Usage: Read at startup to bind the HTTP server.
- NODE_ENV
  - Purpose: Indicates current environment (development, staging, production).
  - Usage: Conditional logic in routes to adjust behavior (e.g., cookie security).
- DATABASE_URL
  - Purpose: PostgreSQL connection string for Prisma.
  - Usage: Consumed by Prisma datasource configuration.
- JWT_SECRET
  - Purpose: Secret used to sign and verify JWTs for authentication.
  - Usage: Read by auth middleware and routes to validate tokens.
- SENDGRID_API_KEY
  - Purpose: Authentication for SendGrid email API.
  - Usage: Set globally before sending emails.
- SENDGRID_FROM_EMAIL
  - Purpose: Sender address for outgoing emails.
  - Usage: Included in email message headers.

Security notes:
- Keep JWT_SECRET strong and unique per environment.
- Store DATABASE_URL securely in your deployment platform’s secret store.
- Rotate SENDGRID_API_KEY periodically and revoke compromised keys immediately.

**Section sources**
- [backend/src/index.js:34-39](file://backend/src/index.js#L34-L39)
- [backend/src/routes/auth.js:1-20](file://backend/src/routes/auth.js#L1-L20)
- [backend/src/middleware/auth.js:1-19](file://backend/src/middleware/auth.js#L1-L19)
- [backend/src/lib/email.js:1-23](file://backend/src/lib/email.js#L1-L23)
- [backend/prisma/schema.prisma:6-9](file://backend/prisma/schema.prisma#L6-L9)

### Frontend Environment Variables
- NEXT_PUBLIC_API_BASE_URL
  - Purpose: Base URL for the shared API client used across the app.
  - Default: http://localhost:5000 if not provided.
  - Usage: All API requests go to this base path.
- NEXT_PUBLIC_API_URL
  - Purpose: Base URL used in specific pages for direct fetch calls.
  - Usage: Pages construct full URLs for round and submission endpoints.

Operational notes:
- Ensure these values point to the correct backend instance per environment.
- For HTTPS deployments, use https:// URLs and ensure CORS is configured accordingly.

**Section sources**
- [frontend/src/lib/api.js:1-45](file://frontend/src/lib/api.js#L1-L45)
- [frontend/src/app/educator/round_view/page.js:30-90](file://frontend/src/app/educator/round_view/page.js#L30-L90)
- [frontend/src/app/educator/submit/page.js:40-65](file://frontend/src/app/educator/submit/page.js#L40-L65)

### Database Connection (Prisma)
- DATABASE_URL
  - Required by Prisma to connect to PostgreSQL.
  - Should include credentials, host, port, database name, and SSL options as needed.
- Best practices:
  - Use connection pooling parameters appropriate for your deployment.
  - Enable SSL for production databases.
  - Restrict database user permissions to least privilege.

**Section sources**
- [backend/prisma/schema.prisma:6-9](file://backend/prisma/schema.prisma#L6-L9)

### Authentication Secrets (JWT)
- JWT_SECRET
  - Used to sign and verify tokens.
  - Must be kept secret and rotated regularly.
  - Different values per environment are recommended.

Security considerations:
- Never commit secrets to version control.
- Use environment-specific secret stores (e.g., CI/CD vaults, platform secret managers).
- Enforce token expiration and secure cookie attributes in production.

**Section sources**
- [backend/src/middleware/auth.js:1-19](file://backend/src/middleware/auth.js#L1-L19)
- [backend/src/routes/auth.js:1-20](file://backend/src/routes/auth.js#L1-L20)

### Email Service Configuration (SendGrid)
- SENDGRID_API_KEY
  - Authenticates with SendGrid API.
- SENDGRID_FROM_EMAIL
  - Sets the sender address for receipts and notifications.

Operational tips:
- Test email delivery in staging before production.
- Monitor SendGrid usage and set up alerts for anomalies.
- Handle failures gracefully and log errors without exposing internals.

**Section sources**
- [backend/src/lib/email.js:1-23](file://backend/src/lib/email.js#L1-L23)

### File Storage Settings
- Static uploads directory
  - The backend serves files under /uploads statically.
  - Ensure the uploads directory exists and has appropriate permissions.
- Security recommendations:
  - Validate uploaded file types and sizes.
  - Consider moving uploads to object storage (e.g., S3) for scalability and security.
  - Restrict access to sensitive files behind authentication if necessary.

**Section sources**
- [backend/src/index.js:26-28](file://backend/src/index.js#L26-L28)

### Environment-Specific Behavior
- Development
  - Localhost URLs for frontend-to-backend communication.
  - Verbose logging helpful for debugging.
- Staging
  - Mirror production configuration with non-production credentials.
  - Enable stricter validation and monitoring.
- Production
  - Use HTTPS, strong secrets, and secure cookies.
  - Configure CORS to allow only trusted origins.
  - Use robust error handling and observability.

Note:
- The backend checks NODE_ENV to adjust behavior such as cookie security flags.

**Section sources**
- [backend/src/routes/auth.js:1-20](file://backend/src/routes/auth.js#L1-L20)

## Dependency Analysis
Environment variables influence multiple components and services:

```mermaid
graph LR
ENV["Environment Variables"]
FE["Frontend App"]
BE["Backend App"]
DB["PostgreSQL"]
SG["SendGrid"]
ENV --> FE
ENV --> BE
FE --> BE
BE --> DB
BE --> SG
```

**Diagram sources**
- [frontend/src/lib/api.js:17-45](file://frontend/src/lib/api.js#L17-L45)
- [backend/src/index.js:14-40](file://backend/src/index.js#L14-L40)
- [backend/prisma/schema.prisma:6-9](file://backend/prisma/schema.prisma#L6-L9)
- [backend/src/lib/email.js:1-23](file://backend/src/lib/email.js#L1-L23)

**Section sources**
- [backend/package.json:19-32](file://backend/package.json#L19-L32)
- [frontend/package.json:15-20](file://frontend/package.json#L15-L20)

## Performance Considerations
- Database
  - Tune connection pool size based on expected load.
  - Use connection strings with SSL enabled in production.
- Email
  - Batch or queue emails during high-volume events to avoid blocking requests.
- File Uploads
  - Validate and limit file sizes to prevent abuse.
  - Consider CDN-backed storage for large assets.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Cannot reach backend from frontend
  - Verify NEXT_PUBLIC_API_BASE_URL or NEXT_PUBLIC_API_URL points to the correct backend endpoint.
  - Check CORS configuration and ensure credentials are allowed if using cookies.
- Database connection failures
  - Confirm DATABASE_URL is correct and network-accessible.
  - Validate credentials and firewall rules.
- JWT verification errors
  - Ensure JWT_SECRET matches between login and subsequent requests.
  - Check token expiration and cookie settings.
- Email sending failures
  - Validate SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.
  - Review logs for SendGrid error responses.

**Section sources**
- [frontend/src/lib/api.js:17-45](file://frontend/src/lib/api.js#L17-L45)
- [backend/src/middleware/auth.js:1-19](file://backend/src/middleware/auth.js#L1-L19)
- [backend/src/lib/email.js:1-23](file://backend/src/lib/email.js#L1-L23)

## Conclusion
Proper environment configuration is critical for the reliability and security of the Olympiad Portal. Use environment-specific variables for database connections, authentication secrets, email services, and frontend API endpoints. Follow security best practices to protect sensitive data, implement secret rotation, and maintain consistent configurations across development, staging, and production.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Required Environment Variables Summary
- Backend
  - PORT
  - NODE_ENV
  - DATABASE_URL
  - JWT_SECRET
  - SENDGRID_API_KEY
  - SENDGRID_FROM_EMAIL
- Frontend
  - NEXT_PUBLIC_API_BASE_URL
  - NEXT_PUBLIC_API_URL

**Section sources**
- [backend/src/index.js:34-39](file://backend/src/index.js#L34-L39)
- [backend/src/middleware/auth.js:1-19](file://backend/src/middleware/auth.js#L1-L19)
- [backend/src/lib/email.js:1-23](file://backend/src/lib/email.js#L1-L23)
- [backend/prisma/schema.prisma:6-9](file://backend/prisma/schema.prisma#L6-L9)
- [frontend/src/lib/api.js:1-45](file://frontend/src/lib/api.js#L1-L45)
- [frontend/src/app/educator/round_view/page.js:30-90](file://frontend/src/app/educator/round_view/page.js#L30-L90)
- [frontend/src/app/educator/submit/page.js:40-65](file://frontend/src/app/educator/submit/page.js#L40-L65)

### Example .env Setup
- Backend (.env)
  - PORT=5000
  - NODE_ENV=development|staging|production
  - DATABASE_URL=postgresql://user:password@host:port/dbname
  - JWT_SECRET=<strong-random-secret>
  - SENDGRID_API_KEY=SG.<your-key>
  - SENDGRID_FROM_EMAIL=noreply@example.com
- Frontend (.env.local)
  - NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
  - NEXT_PUBLIC_API_URL=http://localhost:5000

Note:
- Replace placeholders with actual values per environment.
- Do not commit .env files to version control.

**Section sources**
- [backend/.gitignore:1-5](file://backend/.gitignore#L1-L5)
- [frontend/.gitignore:33-35](file://frontend/.gitignore#L33-L35)

### Security Best Practices
- Secret management
  - Store secrets in your platform’s secret manager (e.g., CI/CD vaults, cloud provider secret stores).
  - Avoid committing secrets to repositories.
- Rotation procedures
  - Rotate JWT_SECRET periodically and invalidate existing tokens upon rotation.
  - Regenerate SENDGRID_API_KEY if compromised; update all environments.
  - Rotate DATABASE_URL credentials according to your database policy.
- .gitignore patterns
  - Ensure .env* files are ignored in both backend and frontend directories.
  - Exclude generated artifacts and local uploads from version control.

**Section sources**
- [backend/.gitignore:1-5](file://backend/.gitignore#L1-L5)
- [frontend/.gitignore:33-35](file://frontend/.gitignore#L33-L35)

### Common Configuration Pitfalls
- Mismatched frontend and backend URLs causing CORS or network errors.
- Missing or incorrect DATABASE_URL leading to Prisma connection failures.
- Using weak or shared JWT_SECRET across environments.
- Not setting SENDGRID_FROM_EMAIL resulting in invalid email headers.
- Forgetting to enable HTTPS and secure cookies in production.

**Section sources**
- [frontend/src/lib/api.js:17-45](file://frontend/src/lib/api.js#L17-L45)
- [backend/prisma/schema.prisma:6-9](file://backend/prisma/schema.prisma#L6-L9)
- [backend/src/middleware/auth.js:1-19](file://backend/src/middleware/auth.js#L1-L19)
- [backend/src/lib/email.js:1-23](file://backend/src/lib/email.js#L1-L23)