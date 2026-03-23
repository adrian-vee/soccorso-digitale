import { beforeAll, afterAll } from "vitest";

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long-for-testing";
  // DATABASE_URL must be set externally for integration tests
});

afterAll(async () => {
  // Close DB connections if opened during tests
});
