// School grades — the only grades an entrant can be registered in.
// Mirrors the backend validation in backend/src/routes/entrants.js:
// a whole number from 1 to 12 (South African school grades).

export const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));
