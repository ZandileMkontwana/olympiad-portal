# API Reference

<cite>
**Referenced Files in This Document**
- [index.js](file://backend/src/index.js)
- [auth.js](file://backend/src/routes/auth.js)
- [rounds.js](file://backend/src/routes/rounds.js)
- [papers.js](file://backend/src/routes/papers.js)
- [submissions.js](file://backend/src/routes/submissions.js)
- [auth middleware](file://backend/src/middleware/auth.js)
- [schema.prisma](file://backend/prisma/schema.prisma)
- [email.js](file://backend/src/lib/email.js)
</cite>

## Update Summary
**Changes Made**
- Enhanced error handling patterns across all API endpoints
- Improved logging and debugging capabilities
- Updated response formats with consistent error structures
- Added comprehensive validation with descriptive error messages
- Enhanced security with better token validation and role-based access control

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document provides a comprehensive REST API reference for the Olympiad Portal backend. It covers authentication, rounds, papers, and submissions endpoints with HTTP methods, URL patterns, request/response schemas, authentication requirements, error codes, and validation rules. The API features enhanced error handling, improved logging, and robust security measures for reliable integration.

## Project Structure
The backend is an Express application that mounts routers under a common base path. The server sets up CORS, cookie parsing, JSON parsing, static file serving for uploads, and registers route modules with comprehensive error handling.

```mermaid
graph TB
Client["Client"] --> API["Express App<br/>Base: /api"]
API --> AuthRouter["Auth Router<br/>/api/auth/*"]
API --> RoundsRouter["Rounds Router<br/>/api/olympiads, /api/rounds/*"]
API --> PapersRouter["Papers Router<br/>/api/rounds/:id/papers"]
API --> SubmissionsRouter["Submissions Router<br/>/api/rounds/:id/submissions"]
API --> Static["Static Uploads<br/>/uploads/*"]
```

**Diagram sources**
- [index.js:14-30](file://backend/src/index.js#L14-L30)

**Section sources**
- [index.js:1-41](file://backend/src/index.js#L1-L41)

## Core Components
- **Authentication**: JWT-based session via cookies; role-based access control (educator, organiser) with enhanced validation
- **Rounds**: CRUD for Olympiads and Rounds; listing entrants and submissions per round with improved error handling
- **Papers**: Upload paper and memo files with optional memo answers; controlled download based on round state with comprehensive validation
- **Submissions**: Submit answers with idempotency key; automatic scoring when memo answers are present; email receipt with robust error handling

**Section sources**
- [auth.js:22-152](file://backend/src/routes/auth.js#L22-L152)
- [rounds.js:6-116](file://backend/src/routes/rounds.js#L6-L116)
- [papers.js:23-97](file://backend/src/routes/papers.js#L23-L97)
- [submissions.js:8-93](file://backend/src/routes/submissions.js#L8-L93)
- [auth middleware:5-35](file://backend/src/middleware/auth.js#L5-L35)

## Architecture Overview
The API uses cookie-based JWT authentication with enhanced security validation. Protected routes validate tokens from cookies and enforce roles with detailed error responses. Data persistence is handled by Prisma against PostgreSQL with comprehensive error handling. File uploads are stored locally under /uploads/papers and served statically.

```mermaid
sequenceDiagram
participant C as "Client"
participant E as "Express App"
participant A as "Auth Middleware"
participant R as "Route Handler"
participant DB as "Prisma/DB"
C->>E : POST /api/auth/login {email,password}
E->>R : auth.login handler
R->>DB : find user by email
DB-->>R : user or null
R->>R : verify password hash
R->>E : set Cookie : token=JWT
E-->>C : 200 {user}
C->>E : GET /api/rounds/ : id/papers (Cookie : token)
E->>A : requireRole('organiser')?
A->>A : verify JWT from cookie
A-->>E : next() or 401/403
E->>R : papers.get handler
R->>DB : get round + paper
DB-->>R : round,paper
R-->>C : 200 paper or 403/404
```

**Diagram sources**
- [auth.js:73-97](file://backend/src/routes/auth.js#L73-L97)
- [auth middleware:5-35](file://backend/src/middleware/auth.js#L5-L35)
- [papers.js:68-97](file://backend/src/routes/papers.js#L68-L97)
- [index.js:14-30](file://backend/src/index.js#L14-L30)

## Detailed Component Analysis

### Authentication
- Base path: /api
- Endpoints:
  - POST /api/auth/register
    - Purpose: Create a new educator account and log in.
    - Request body:
      - email: string, required
      - password: string, required  
      - name: string, required
      - schoolName: string, required
    - Success response: 201 with user object including id, email, role, name, school.
    - Errors:
      - 400: Missing fields with descriptive error message
      - 409: Email already exists
    - Notes: Creates or reuses a School by name; sets HttpOnly cookie with JWT valid for 7 days.

  - POST /api/auth/login
    - Purpose: Authenticate and set session cookie.
    - Request body:
      - email: string, required
      - password: string, required
    - Success response: 200 with user object (id, email, role).
    - Errors:
      - 400: Missing fields with descriptive error message
      - 401: Invalid credentials

  - POST /api/auth/reset-password
    - Purpose: Change current password.
    - Auth: Required (cookie JWT).
    - Request body:
      - currentPassword: string, required
      - newPassword: string, required
    - Success response: 200 message.
    - Errors:
      - 401: Not authenticated or invalid current password
      - 400: Missing fields
      - 404: User not found

  - POST /api/auth/logout
    - Purpose: Clear session cookie.
    - Response: 200 message.

  - GET /api/auth/me
    - Purpose: Get current user info.
    - Auth: Required.
    - Success response: 200 with user object (id, email, role).
    - Errors:
      - 401: Not authenticated
      - 404: User not found

  - DELETE /api/auth/account
    - Purpose: Delete current user account.
    - Auth: Required.
    - Success response: 200 message.
    - Errors:
      - 401: Not authenticated
      - 404: User not found

- Security:
  - Token stored in HttpOnly cookie; secure flag enabled in production; SameSite lax.
  - Role-based middleware enforces educator/organiser permissions where applicable with enhanced validation.

**Updated** Enhanced error handling with descriptive error messages and improved token validation.

**Section sources**
- [auth.js:22-152](file://backend/src/routes/auth.js#L22-L152)
- [auth middleware:5-35](file://backend/src/middleware/auth.js#L5-L35)

### Rounds and Olympiads
- Base path: /api
- Endpoints:
  - POST /api/olympiads
    - Purpose: Create an Olympiad.
    - Request body:
      - name: string, required
      - timezone: string, required
    - Success response: 201 with created Olympiad.
    - Errors:
      - 400: Missing fields with descriptive error message
      - 500: Server error with logging

  - GET /api/olympiads
    - Purpose: List all Olympiads sorted by name ascending.
    - Success response: 200 array of Olympiads.
    - Errors:
      - 500: Server error with logging

  - POST /api/rounds
    - Purpose: Create a Round within an Olympiad.
    - Request body:
      - olympiadId: string, required
      - name: string, required
      - openTime: ISO datetime string, required
      - closeTime: ISO datetime string, required
    - Validation: closeTime must be after openTime.
    - Success response: 201 with created Round.
    - Errors:
      - 400: Missing fields or invalid time range with descriptive error message
      - 500: Server error with logging

  - GET /api/rounds
    - Purpose: List all Rounds sorted by openTime ascending.
    - Success response: 200 array of Rounds.
    - Errors:
      - 500: Server error with logging

  - GET /api/rounds/:id
    - Purpose: Retrieve a specific Round.
    - Path param: id: string, required
    - Success response: 200 Round object.
    - Errors:
      - 404: Round not found
      - 500: Server error with logging

  - GET /api/olympiads/:id/rounds
    - Purpose: List Rounds for a specific Olympiad.
    - Path param: id: string, required
    - Success response: 200 array of Rounds.
    - Errors:
      - 500: Server error with logging

  - GET /api/rounds/:id/entrants
    - Purpose: List Entrants registered for a Round.
    - Path param: id: string, required
    - Success response: 200 array of Entrant objects.
    - Errors:
      - 500: Server error with logging

  - GET /api/rounds/:id/submissions
    - Purpose: List Submissions for a Round, including results if available.
    - Path param: id: string, required
    - Success response: 200 array of Submission objects with included result.
    - Errors:
      - 500: Server error with logging

**Updated** Enhanced error handling with comprehensive try-catch blocks and detailed error logging.

**Section sources**
- [rounds.js:6-116](file://backend/src/routes/rounds.js#L6-L116)

### Papers
- Base path: /api
- Endpoints:
  - POST /api/rounds/:id/papers
    - Purpose: Upload a Paper and Memo PDF for a Round, optionally with memo answers.
    - Auth: Requires organiser role.
    - Content-Type: multipart/form-data
    - Fields:
      - paper: file, required
      - memo: file, required
      - memoAnswers: JSON string, optional; must be valid JSON if provided
    - Success response: 201 with Paper object containing fileUrl and memoUrl.
    - Errors:
      - 400: Missing files or invalid memoAnswers JSON with descriptive error message
      - 403: Not authorised (not organiser)
      - 500: Server error with logging

  - GET /api/rounds/:id/papers
    - Purpose: Download the Paper for a Round when allowed.
    - Path param: id: string, required
    - Access rule: Allowed only when round state is open or released.
    - Success response: 200 Paper object with fileUrl.
    - Errors:
      - 403: Round not in open or released state with descriptive error message
      - 404: Round not found or no paper uploaded
      - 500: Server error with logging

- Storage:
  - Files saved to /uploads/papers with unique filenames.
  - Served statically at /uploads/* via Express static middleware.

**Updated** Enhanced error handling with comprehensive validation and improved logging for file operations.

**Section sources**
- [papers.js:23-97](file://backend/src/routes/papers.js#L23-L97)
- [index.js:25-26](file://backend/src/index.js#L25-L26)

### Submissions
- Base path: /api
- Endpoints:
  - POST /api/rounds/:id/submissions
    - Purpose: Submit answers for a Round's paper.
    - Auth: Requires educator role.
    - Request body:
      - roundId: inferred from path
      - entrantId: string, required
      - answers: JSON object mapping question IDs to answers, required
      - idempotencyKey: string, required; ensures duplicate submissions are ignored
    - Validation:
      - Round must exist and be in open state.
    - Behavior:
      - If the associated Paper has memoAnswers, the system auto-scores and creates a Result with score percentage.
      - Sends an email receipt to the requester using their email.
    - Success response: 201 with submission and result (if auto-scored).
    - Idempotency:
      - On duplicate idempotencyKey, returns 200 with existing submission and its result.
    - Errors:
      - 400: Missing fields with descriptive error message
      - 403: Not authorised (not educator) or round not open with descriptive error message
      - 404: Round not found
      - 500: Server error with logging

**Updated** Enhanced error handling with comprehensive try-catch blocks, improved idempotency handling, and detailed logging for database operations.

**Section sources**
- [submissions.js:8-93](file://backend/src/routes/submissions.js#L8-L93)

## Dependency Analysis
- Routing:
  - All routers mounted under /api in index.js.
  - Static assets served under /uploads.
- Authentication:
  - requireAuth reads JWT from cookie; requireRole checks role with enhanced validation.
- Data models:
  - Prisma schema defines relationships between Olympiad, Round, Paper, Submission, Result, User, Educator, School, Entrant, RoundEntrant.

```mermaid
graph LR
Index["index.js"] --> Auth["routes/auth.js"]
Index --> Rounds["routes/rounds.js"]
Index --> Papers["routes/papers.js"]
Index --> Submissions["routes/submissions.js"]
Auth --> Middleware["middleware/auth.js"]
Papers --> Middleware
Submissions --> Middleware
Rounds --> Prisma["prisma/schema.prisma"]
Papers --> Prisma
Submissions --> Prisma
Auth --> Prisma
```

**Diagram sources**
- [index.js:27-30](file://backend/src/index.js#L27-L30)
- [auth middleware:5-35](file://backend/src/middleware/auth.js#L5-L35)
- [schema.prisma:11-109](file://backend/prisma/schema.prisma#L11-L109)

**Section sources**
- [index.js:14-30](file://backend/src/index.js#L14-L30)
- [schema.prisma:11-109](file://backend/prisma/schema.prisma#L11-L109)

## Performance Considerations
- Pagination: Not implemented in current endpoints. For large datasets (e.g., rounds, submissions), consider adding query parameters like page, limit, and offset to reduce payload size.
- Filtering: No filtering beyond basic queries. Consider adding filters (e.g., by state, date ranges) for rounds and submissions.
- Rate limiting: Not configured. Implement rate limiting (e.g., per IP or per user) to protect endpoints, especially login and submissions.
- File uploads: Multer stores files on disk; ensure adequate storage capacity and consider CDN or object storage for scalability.
- Auto-scoring: Immediate scoring occurs when memo answers exist; keep memoAnswers minimal to avoid heavy payloads.
- Error handling: Enhanced error handling reduces unnecessary processing and improves response times.

## Troubleshooting Guide
- Authentication issues:
  - Ensure cookies are sent with requests (credentials: true in fetch/XHR).
  - Verify JWT_SECRET environment variable matches between login and protected routes.
  - Check cookie attributes (HttpOnly, Secure, SameSite) and browser settings.
  - Enhanced token validation provides more descriptive error messages.

- Common errors:
  - 400 Bad Request: Missing or invalid fields with descriptive error messages; check request body schema.
  - 401 Unauthorized: Missing or invalid token with detailed error information; re-login or refresh token.
  - 403 Forbidden: Insufficient role with specific role requirement; ensure user has required role (educator/organiser).
  - 404 Not Found: Resource does not exist; verify IDs.
  - 409 Conflict: Duplicate registration; use different email.
  - 500 Internal Server Error: Server-side failure with detailed logging; check logs and database connectivity.

- Submissions idempotency:
  - Use a stable idempotencyKey per logical submission to prevent duplicates.
  - Duplicate keys return existing submission without creating a new one with enhanced error handling.

- Paper downloads:
  - Ensure round state is open or released before attempting to download.
  - Confirm paper was uploaded successfully with improved error messages.

- Enhanced logging:
  - Database errors are logged with console.error for debugging.
  - Email sending failures are captured and logged without breaking the submission flow.
  - File upload errors provide detailed feedback for troubleshooting.

**Updated** Enhanced troubleshooting guidance with improved error messages and logging capabilities.

**Section sources**
- [auth.js:22-152](file://backend/src/routes/auth.js#L22-L152)
- [rounds.js:6-116](file://backend/src/routes/rounds.js#L6-L116)
- [papers.js:23-97](file://backend/src/routes/papers.js#L23-L97)
- [submissions.js:8-93](file://backend/src/routes/submissions.js#L8-L93)
- [auth middleware:5-35](file://backend/src/middleware/auth.js#L5-L35)
- [email.js:5-23](file://backend/src/lib/email.js#L5-L23)

## Conclusion
The Olympiad Portal API provides robust endpoints for managing Olympiads, Rounds, Papers, and Submissions with enhanced security, comprehensive error handling, and improved logging capabilities. The recent updates have significantly improved the reliability and maintainability of the API through better error handling patterns, consistent formatting, and detailed logging. While pagination and rate limiting are not currently implemented, the API is well-structured for extension. Consumers should handle authentication via cookies, respect role restrictions, leverage idempotency keys for reliable submissions, and utilize the enhanced error messages for effective debugging.