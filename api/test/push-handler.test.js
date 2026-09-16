const assert = require("assert");
const { describe, it, before } = require("node:test");

process.env.ADMIN_SECRET = "test-admin-secret";

function mockRes() {
  const captured = { statusCode: 0, body: null };
  return {
    captured,
    status(code) {
      captured.statusCode = code;
      return this;
    },
    json(body) {
      captured.body = body;
      return this;
    },
  };
}

describe("POST /api/push handler", () => {
  let handler;

  before(() => {
    handler = require("../.test-out/push").default;
  });

  it("rejects unauthenticated requests", async () => {
    const res = mockRes();
    await handler(
      {
        method: "POST",
        headers: {},
        body: {
          to: "ExponentPushToken[test]",
          title: "Hello",
          body: "World",
        },
      },
      res
    );
    assert.equal(res.captured.statusCode, 401);
    assert.equal(res.captured.body.error, "Sign in required");
  });

  it("rejects an invalid Bearer token", async () => {
    const res = mockRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer not-a-real-token" },
        body: {
          to: "ExponentPushToken[test]",
          title: "Hello",
          body: "World",
        },
      },
      res
    );
    assert.equal(res.captured.statusCode, 401);
  });

  it("rejects a wrong admin secret", async () => {
    const res = mockRes();
    await handler(
      {
        method: "POST",
        headers: { "x-admin-secret": "wrong-secret" },
        body: {
          to: "ExponentPushToken[test]",
          title: "Hello",
          body: "World",
        },
      },
      res
    );
    assert.equal(res.captured.statusCode, 401);
  });

  it("sends to Expo after backend authorization", async () => {
    const originalFetch = global.fetch;
    const expoCalls = [];
    global.fetch = async (url, opts) => {
      const href = String(url);
      expoCalls.push({ href, body: opts?.body });
      if (href.includes("push/send")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { status: "ok", id: "ticket-1" } }),
        };
      }
      if (href.includes("getReceipts")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { "ticket-1": { status: "ok" } } }),
        };
      }
      throw new Error(`unexpected fetch ${href}`);
    };

    try {
      const res = mockRes();
      await handler(
        {
          method: "POST",
          headers: { "x-admin-secret": "test-admin-secret" },
          body: {
            to: "ExponentPushToken[test]",
            title: "Hello",
            body: "World",
            data: { screen: "home" },
          },
        },
        res
      );
      assert.equal(res.captured.statusCode, 200);
      assert.equal(res.captured.body.success, true);
      const sent = JSON.parse(expoCalls[0].body);
      assert.equal(sent.to, "ExponentPushToken[test]");
      assert.equal(sent.title, "Hello");
      assert.equal(sent.body, "World");
      assert.equal(sent.data.screen, "home");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
