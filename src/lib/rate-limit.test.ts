import { describe, it, expect, vi, afterEach } from "vitest";
import type { Request, Response } from "express";
import { rateLimit } from "./rate-limit.js";

function fakeResponse() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) { this.headers[name] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

const requestFrom = (ip: string) => ({ ip, headers: {} }) as unknown as Request;

afterEach(() => vi.useRealTimers());

describe("rateLimit", () => {
  it("allows requests up to the limit then blocks with 429", () => {
    const limit = rateLimit({ name: "test", max: 2, windowMs: 60_000 });
    const req = requestFrom("1.1.1.1");
    const next = vi.fn();

    limit(req, fakeResponse(), next);
    limit(req, fakeResponse(), next);
    expect(next).toHaveBeenCalledTimes(2);

    const blocked = fakeResponse();
    limit(req, blocked, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(blocked.statusCode).toBe(429);
  });

  it("keeps separate budgets per client IP", () => {
    const limit = rateLimit({ name: "test", max: 1, windowMs: 60_000 });
    const next = vi.fn();
    limit(requestFrom("1.1.1.1"), fakeResponse(), next);
    limit(requestFrom("2.2.2.2"), fakeResponse(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("resets the budget after the window elapses", () => {
    vi.useFakeTimers();
    const limit = rateLimit({ name: "test", max: 1, windowMs: 1_000 });
    const req = requestFrom("1.1.1.1");
    const next = vi.fn();

    limit(req, fakeResponse(), next);
    limit(req, fakeResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_001);
    limit(req, fakeResponse(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
