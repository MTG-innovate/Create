import { startMockClaude } from "./mock-claude";

export default async function globalSetup() {
  const server = await startMockClaude();
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
