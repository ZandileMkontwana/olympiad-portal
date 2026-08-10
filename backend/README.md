## Database
Uses PostgreSQL (hosted on Railway) via Prisma. Run migrations with:
npx prisma migrate dev

## Scheduler
The round lifecycle scheduler runs automatically on server start, ticking every 30s to transition round states based on openTime/closeTime.

## API Endpoints
- POST /olympiads
- POST /rounds
- GET /rounds/:id
- GET /olympiads/:id/rounds