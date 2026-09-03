import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Obviously fake values; never real credentials.
const FAKE_SECRET = "test-secret-not-real";
const FAKE_TOKEN = "test-token";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  // Deterministic env regardless of the host machine.
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  vi.stubEnv("TURNSTILE_REQUIRED", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.mocked(console.warn).mockRestore();
  vi.mocked(console.error).mockRestore();
});

describe("dev mode (TURNSTILE_SECRET_KEY unset)", () => {
  test("passes without a token and never calls siteverify", async () => {
    await expect(verifyTurnstile(undefined)).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("passes even when a token is supplied", async () => {
    await expect(verifyTurnstile(FAKE_TOKEN)).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("TURNSTILE_REQUIRED=false (string) still counts as dev mode", async () => {
    vi.stubEnv("TURNSTILE_REQUIRED", "false");
    await expect(verifyTurnstile(undefined)).resolves.toBe(true);
  });
});

describe("fail-closed guard (TURNSTILE_REQUIRED=true, secret missing)", () => {
  test("fails without a token", async () => {
    vi.stubEnv("TURNSTILE_REQUIRED", "true");
    await expect(verifyTurnstile(undefined)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("fails even with a token — a token cannot substitute for the secret", async () => {
    vi.stubEnv("TURNSTILE_REQUIRED", "true");
    await expect(verifyTurnstile(FAKE_TOKEN)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("secret configured", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", FAKE_SECRET);
  });

  test("missing token fails without a network call", async () => {
    await expect(verifyTurnstile(undefined)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("empty-string token fails without a network call", async () => {
    await expect(verifyTurnstile("")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("siteverify success:true passes and posts secret + response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    await expect(verifyTurnstile(FAKE_TOKEN)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(init.body);
    expect(body.get("secret")).toBe(FAKE_SECRET);
    expect(body.get("response")).toBe(FAKE_TOKEN);
  });

  test("siteverify success:false fails", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
    });
    await expect(verifyTurnstile(FAKE_TOKEN)).resolves.toBe(false);
  });

  test("siteverify body without a success field fails (no truthy coercion)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    await expect(verifyTurnstile(FAKE_TOKEN)).resolves.toBe(false);
  });

  test("non-2xx siteverify response fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: true }),
    });
    await expect(verifyTurnstile(FAKE_TOKEN)).resolves.toBe(false);
  });

  test("network error fails closed instead of throwing", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(verifyTurnstile(FAKE_TOKEN)).resolves.toBe(false);
  });

  test("malformed JSON reply fails closed instead of throwing", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    });
    await expect(verifyTurnstile(FAKE_TOKEN)).resolves.toBe(false);
  });
});
