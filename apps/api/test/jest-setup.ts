process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.AI_PROVIDER = process.env.AI_PROVIDER ?? "mock";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret-do-not-use-in-prod";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://scribe:scribe@localhost:5433/scribe";
process.env.AI_EMBEDDING_DIMENSIONS = process.env.AI_EMBEDDING_DIMENSIONS ?? "1024";

jest.setTimeout(30_000);
