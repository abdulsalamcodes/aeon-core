import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../db/client.js";
import { applyMigrations } from "../../db/run-migrations.js";
import { organizations, schools } from "../../db/schema/index.js";
import { runWithTenant } from "../../tenant/context.js";
import { schoolService } from "./school.service.js";
import { workflowService } from "../workflow/workflow.service.js";

let orgId: string;
let schoolId: string;

beforeAll(async () => {
  await applyMigrations();
  const [org] = await db.insert(organizations).values({ name: "Settings Org", slug: "settings-org" }).returning();
  orgId = org!.id;
  const [school] = await db.insert(schools).values({ orgId, name: "Settings School", slug: "settings-school" }).returning();
  schoolId = school!.id;
});

const tenant = () => ({ schoolId, orgId });

describe("school settings", () => {
  it("defaults to an empty object", async () => {
    expect(await schoolService.getSettings(schoolId)).toEqual({});
  });

  it("shallow-merges patches across saves", async () => {
    await schoolService.updateSettings(schoolId, { billing: { plan: "growth" } });
    const merged = await schoolService.updateSettings(schoolId, { activation: { isLive: true } });
    expect(merged).toEqual({ billing: { plan: "growth" }, activation: { isLive: true } });
    expect(await schoolService.getSettings(schoolId)).toEqual(merged);
  });
});

describe("workflow listing", () => {
  it("lists definitions and pending tasks with subject + key context", async () => {
    await runWithTenant(tenant(), async () => {
      await workflowService.define({
        key: "result-approval",
        steps: [{ name: "HOD Review", approverRole: "teacher" }, { name: "Principal Sign-off", approverRole: "school-admin" }],
      });

      const definitions = await workflowService.listDefinitions();
      expect(definitions.map((d) => d.key)).toContain("result-approval");

      await workflowService.start({ key: "result-approval", subjectRef: "grade:demo-1" });
      const pending = await workflowService.listTasks("pending");
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({
        workflowKey: "result-approval",
        subjectRef: "grade:demo-1",
        approverRole: "teacher",
        status: "pending",
      });

      await workflowService.decide({ taskId: pending[0]!.id, decision: "approve" });
      const nextPending = await workflowService.listTasks("pending");
      expect(nextPending).toHaveLength(1);
      expect(nextPending[0]!.approverRole).toBe("school-admin");
    });
  });
});
