import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import {
  workflowDefinitions,
  workflowInstances,
  workflowTasks,
  type WorkflowStep,
  type WorkflowDefinition,
  type WorkflowInstance,
  type WorkflowTask,
} from "../../db/schema/workflows.js";
import { currentTenant, withTenant } from "../../tenant/context.js";
import { emit } from "../../events/outbox.js";
import { HttpError } from "../../lib/http-error.js";

export const defineInput = z.object({
  key: z.string().min(1),
  steps: z.array(z.object({ name: z.string().min(1), approverRole: z.string().min(1) })).min(1),
});
export const startInput = z.object({
  key: z.string().min(1),
  subjectRef: z.string().min(1),
});
export const decideInput = z.object({
  taskId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  deciderId: z.string().uuid().optional(),
});

export const WORKFLOW_COMPLETED = "WorkflowCompleted";

export type TaskStatus = WorkflowTask["status"];

/** A pending/decided task enriched with what it approves and which chain owns it. */
export interface WorkflowTaskView extends WorkflowTask {
  workflowKey: string;
  subjectRef: string;
}

export const workflowService = {
  async listDefinitions(): Promise<WorkflowDefinition[]> {
    return withTenant((tx) =>
      tx.select().from(workflowDefinitions).orderBy(asc(workflowDefinitions.key)),
    );
  },

  async listTasks(status?: TaskStatus): Promise<WorkflowTaskView[]> {
    return withTenant(async (tx) => {
      const base = tx
        .select({
          task: workflowTasks,
          workflowKey: workflowDefinitions.key,
          subjectRef: workflowInstances.subjectRef,
        })
        .from(workflowTasks)
        .innerJoin(workflowInstances, eq(workflowTasks.instanceId, workflowInstances.id))
        .innerJoin(workflowDefinitions, eq(workflowInstances.definitionId, workflowDefinitions.id))
        .orderBy(desc(workflowTasks.createdAt));
      const rows = status ? await base.where(eq(workflowTasks.status, status)) : await base;
      return rows.map((r) => ({ ...r.task, workflowKey: r.workflowKey, subjectRef: r.subjectRef }));
    });
  },

  async define(input: z.infer<typeof defineInput>): Promise<void> {
    const { schoolId } = currentTenant();
    await withTenant((tx) =>
      tx
        .insert(workflowDefinitions)
        .values({ schoolId, key: input.key, steps: input.steps as WorkflowStep[] })
        .onConflictDoUpdate({
          target: [workflowDefinitions.schoolId, workflowDefinitions.key],
          set: { steps: input.steps as WorkflowStep[] },
        }),
    );
  },

  /** Starts an instance and opens the first approval task. */
  async start(input: z.infer<typeof startInput>): Promise<{ instance: WorkflowInstance; task: WorkflowTask }> {
    const { schoolId } = currentTenant();
    return withTenant(async (tx) => {
      const [def] = await tx
        .select()
        .from(workflowDefinitions)
        .where(eq(workflowDefinitions.key, input.key))
        .limit(1);
      if (!def) throw new HttpError(404, `No workflow definition '${input.key}'`);
      const first = def.steps[0];
      if (!first) throw new HttpError(422, "Workflow has no steps");

      const [instance] = await tx
        .insert(workflowInstances)
        .values({ schoolId, definitionId: def.id, subjectRef: input.subjectRef })
        .returning();
      if (!instance) throw new Error("Failed to create instance");

      const [task] = await tx
        .insert(workflowTasks)
        .values({ schoolId, instanceId: instance.id, stepIndex: 0, approverRole: first.approverRole })
        .returning();
      if (!task) throw new Error("Failed to create task");
      return { instance, task };
    });
  },

  /**
   * Records a decision and advances the state machine. Approve → open the next
   * step's task, or complete the instance if it was the last step. Reject →
   * complete immediately. Emits `WorkflowCompleted` when the instance finishes.
   */
  async decide(input: z.infer<typeof decideInput>): Promise<WorkflowInstance> {
    const { schoolId } = currentTenant();
    return withTenant(async (tx) => {
      const [task] = await tx.select().from(workflowTasks).where(eq(workflowTasks.id, input.taskId)).limit(1);
      if (!task) throw new HttpError(404, "Task not found");
      if (task.status !== "pending") throw new HttpError(409, "Task already decided");

      const [instance] = await tx
        .select()
        .from(workflowInstances)
        .where(eq(workflowInstances.id, task.instanceId))
        .limit(1);
      if (!instance) throw new HttpError(404, "Instance not found");
      const [def] = await tx
        .select()
        .from(workflowDefinitions)
        .where(eq(workflowDefinitions.id, instance.definitionId))
        .limit(1);
      if (!def) throw new HttpError(404, "Definition not found");

      await tx
        .update(workflowTasks)
        .set({
          status: input.decision === "approve" ? "approved" : "rejected",
          decidedBy: input.deciderId ?? null,
          decidedAt: new Date(),
        })
        .where(eq(workflowTasks.id, task.id));

      let finalState: WorkflowInstance["state"] = "pending";

      if (input.decision === "reject") {
        finalState = "rejected";
        await tx.update(workflowInstances).set({ state: "rejected" }).where(eq(workflowInstances.id, instance.id));
      } else {
        const nextStep = task.stepIndex + 1;
        if (nextStep < def.steps.length) {
          await tx
            .update(workflowInstances)
            .set({ currentStep: nextStep })
            .where(eq(workflowInstances.id, instance.id));
          await tx.insert(workflowTasks).values({
            schoolId,
            instanceId: instance.id,
            stepIndex: nextStep,
            approverRole: def.steps[nextStep]!.approverRole,
          });
        } else {
          finalState = "approved";
          await tx.update(workflowInstances).set({ state: "approved" }).where(eq(workflowInstances.id, instance.id));
        }
      }

      if (finalState !== "pending") {
        await emit(tx, schoolId, {
          aggregate: "workflow",
          aggregateId: instance.id,
          eventType: WORKFLOW_COMPLETED,
          payload: { instanceId: instance.id, key: def.key, subjectRef: instance.subjectRef, state: finalState, schoolId },
        });
      }

      return { ...instance, state: finalState, currentStep: instance.currentStep };
    });
  },
};
