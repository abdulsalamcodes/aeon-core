import { pgTable, uuid, text, timestamp, jsonb, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";

/**
 * Generic workflow/approval engine (ADR-10). One reusable primitive drives
 * result approval, fee waivers, admissions, leave, app activation — every
 * module gets approvals for free.
 *
 * A definition is an ordered list of steps (each with an approver role); an
 * instance walks those steps; a task is one pending decision.
 */
export interface WorkflowStep {
  name: string;
  approverRole: string;
}

export const workflowDefinitions = pgTable(
  "workflow_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // e.g. "result-approval"
    steps: jsonb("steps").notNull().$type<WorkflowStep[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ keyUq: uniqueIndex("wf_def_key_uq").on(t.schoolId, t.key) }),
);

export const workflowInstances = pgTable("workflow_instances", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  definitionId: uuid("definition_id").notNull().references(() => workflowDefinitions.id, { onDelete: "restrict" }),
  subjectRef: text("subject_ref").notNull(), // what's being approved, e.g. "grade:<id>"
  state: text("state", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  currentStep: integer("current_step").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workflowTasks = pgTable("workflow_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  instanceId: uuid("instance_id").notNull().references(() => workflowInstances.id, { onDelete: "cascade" }),
  stepIndex: integer("step_index").notNull(),
  approverRole: text("approver_role").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  decidedBy: uuid("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type WorkflowDefinition = typeof workflowDefinitions.$inferSelect;
export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type WorkflowTask = typeof workflowTasks.$inferSelect;
