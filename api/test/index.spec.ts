import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("CORS", () => {
  it("許可された Origin の GET に CORS ヘッダーを返す", async () => {
    const request = new IncomingRequest("https://example.com/", {
      headers: {
        Origin: "https://pc.tokusatsu-fc.jp",
      },
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);

    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://pc.tokusatsu-fc.jp");
    expect(response.headers.get("Vary")).toContain("Origin");
  });

  it("許可された Origin の preflight に 204 を返す", async () => {
    const request = new IncomingRequest("https://example.com/episodes?name=test", {
      method: "OPTIONS",
      headers: {
        Origin: "https://pc.tokusatsu-fc.jp",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);

    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://pc.tokusatsu-fc.jp");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("content-type");
  });

  it("許可されていない Origin には Access-Control-Allow-Origin を返さない", async () => {
    const request = new IncomingRequest("https://example.com/", {
      headers: {
        Origin: "https://example.com",
      },
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);

    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
