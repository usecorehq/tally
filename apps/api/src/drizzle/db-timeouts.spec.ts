import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { createServer, type Server, type Socket } from "node:net";
import { buildTallyDb, sql } from "@tally/db";

/**
 * A full Supabase pooler accepts TCP but never finishes the handshake; queries (queued ones too)
 * must fail on the connect timeout instead of leaving a stock-take "running".
 */
describe("buildTallyDb against a pooler that never answers", () => {
  let server: Server;
  let port: number;
  const sockets = new Set<Socket>();

  beforeAll(async () => {
    server = createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as { port: number }).port;
  });
  afterAll(async () => {
    for (const s of sockets) s.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("30 concurrent queries all fail with CONNECT_TIMEOUT, bounded, instead of hanging", async () => {
    const db = buildTallyDb(`postgres://u:p@127.0.0.1:${port}/db`, { max: 2, connectTimeout: 1 });
    const t0 = Date.now();
    const results = await Promise.allSettled(Array.from({ length: 30 }, () => db.execute(sql`select 1`)));
    const ms = Date.now() - t0;

    expect(results.every((r) => r.status === "rejected")).toBe(true);
    // Slots fail once per connect timeout, so queued queries fail in waves of about (queries / max) × timeout.
    // Bounded but not instant, which is why the stock-take also has its own deadlines.
    expect(ms).toBeLessThan(20_000);
    const reasons = new Set(results.map((r) => String((r as PromiseRejectedResult).reason?.cause?.code ?? (r as PromiseRejectedResult).reason?.code)));
    expect([...reasons]).toEqual(["CONNECT_TIMEOUT"]);
  }, 30_000);
});
