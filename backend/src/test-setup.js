// Set test environment variables before any modules are loaded
process.env.JWT_SECRET = 'test-secret';
process.env.SENDGRID_API_KEY = 'SG.test-key';
process.env.SENDGRID_FROM_EMAIL = 'from@test.com';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
