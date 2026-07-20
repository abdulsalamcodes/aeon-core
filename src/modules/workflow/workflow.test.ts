import { describe, it, expect } from "vitest";
import { defineInput, decideInput } from "./workflow.schema.js";
import { sendInput } from "../notifications/notifications.schema.js";

const uuid = "11111111-1111-1111-1111-111111111111";

describe("workflow defineInput", () => {
  it("requires at least one step with name + approverRole", () => {
    expect(defineInput.safeParse({ key: "result-approval", steps: [{ name: "HOD", approverRole: "hod" }] }).success).toBe(true);
    expect(defineInput.safeParse({ key: "x", steps: [] }).success).toBe(false);
    expect(defineInput.safeParse({ key: "x", steps: [{ name: "", approverRole: "hod" }] }).success).toBe(false);
  });
});

describe("workflow decideInput", () => {
  it("only allows approve/reject", () => {
    expect(decideInput.safeParse({ taskId: uuid, decision: "approve" }).success).toBe(true);
    expect(decideInput.safeParse({ taskId: uuid, decision: "maybe" }).success).toBe(false);
  });
});

describe("notification sendInput", () => {
  it("validates channel and required fields", () => {
    expect(sendInput.safeParse({ channel: "sms", to: "+2348000000000", template: "t", body: "hi" }).success).toBe(true);
    expect(sendInput.safeParse({ channel: "carrier-pigeon", to: "x", template: "t", body: "hi" }).success).toBe(false);
  });
});
