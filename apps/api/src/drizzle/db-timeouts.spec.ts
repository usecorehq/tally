import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { createServer, type Server, type Socket } from "node:net";
import { buildTallyDb, sql } from "@tally/db";

/**
 * A full Supabase pooler looks like a server that accepts the TCP connection
 * but never finishes the Postgres handshake. Queries must fail fast (connect
 * timeout), including the ones queued behind busy connections, instead of
 * hanging: that hang kept a stock-take "running" for minutes.
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
    // Each connection slot fails once per connect timeout, so queued queries fail in waves:
    // about (queries / max) × timeout (here 30 / 2 × 1 s ≈ 15 s; in production 5 slots × 10 s).
    // Bounded, but not instant, which is why the stock-take also has its own deadlines.
    expect(ms).toBeLessThan(20_000);
    const reasons = new Set(results.map((r) => String((r as PromiseRejectedResult).reason?.cause?.code ?? (r as PromiseRejectedResult).reason?.code)));
    expect([...reasons]).toEqual(["CONNECT_TIMEOUT"]);
  }, 30_000);
});
