import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { feeStructures, type FeeStructure } from "../../db/schema/feeStructures.js";
import { ledgerEntries, type LedgerEntry } from "../../db/schema/ledgerEntries.js";
import { persons } from "../../db/schema/persons.js";
import { enrollments } from "../../db/schema/enrollments.js";
import { currentTenant, withTenant } from "../../tenant/context.js";
import { emit } from "../../events/outbox.js";
import { computeBalances, type CurrencyBalance } from "./balance.js";
import { providerByName } from "../../payments/index.js";

const ISO_CCY = z.string().length(3).toUpperCase();

export const createFeeStructureInput = z.object({
  termId: z.string().uuid(),
  name: z.string().trim().min(1),
  amountMinor: z.number().int().positive(),
  currency: ISO_CCY,
  isDefault: z.boolean().optional(),
});
export const assignFeeInput = z.object({
  studentId: z.string().uuid(),
  feeStructureId: z.string().uuid(),
});
export const recordPaymentInput = z.object({
  studentId: z.string().uuid(),
  termId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  currency: ISO_CCY,
  idempotencyKey: z.string().min(8),
  method: z.enum(["cash", "transfer", "card", "mobile-money"]).default("cash"),
  reference: z.string().optional(),
});

export const FEE_ASSIGNED = "FeeAssigned";
export const PAYMENT_RECORDED = "PaymentRecorded";

export const financeService = {
  async createFeeStructure(input: z.infer<typeof createFeeStructureInput>): Promise<FeeStructure> {
    const { schoolId, orgId } = currentTenant();
    return withTenant(async (tx) => {
      const [row] = await tx
        .insert(feeStructures)
        .values({
          schoolId,
          orgId,
          termId: input.termId,
          name: input.name,
          amountMinor: input.amountMinor,
          currency: input.currency,
          isDefault: input.isDefault ?? false,
        })
        .returning();
      if (!row) throw new Error("Failed to create fee structure");
      return row;
    });
  },

  /** Assigns a fee to a student = a DEBIT ledger entry (ADR-8). Emits FeeAssigned. */
  async assignFee(input: z.infer<typeof assignFeeInput>): Promise<LedgerEntry> {
    const { schoolId, orgId } = currentTenant();
    return withTenant(async (tx) => {
      const [fee] = await tx
        .select()
        .from(feeStructures)
        .where(eq(feeStructures.id, input.feeStructureId))
        .limit(1);
      if (!fee) throw new Error("Fee structure not found");

      const [entry] = await tx
        .insert(ledgerEntries)
        .values({
          schoolId,
          studentId: input.studentId,
          termId: fee.termId,
          direction: "debit",
          kind: "fee",
          amountMinor: fee.amountMinor,
          currency: fee.currency,
          reference: fee.name,
        })
        .returning();
      if (!entry) throw new Error("Failed to assign fee");

      await emit(tx, schoolId, {
        aggregate: "ledger",
        aggregateId: entry.id,
        eventType: FEE_ASSIGNED,
        payload: { studentId: input.studentId, termId: fee.termId, amountMinor: fee.amountMinor, currency: fee.currency, schoolId, orgId },
      });
      return entry;
    });
  },

  /**
   * Records a payment = an idempotent CREDIT entry (ADR-8). The unique
   * (school, idempotencyKey) index means a webhook replayed N times nets ONE
   * entry. Returns the entry; on a duplicate key it returns the existing one.
   */
  async recordPayment(input: z.infer<typeof recordPaymentInput>): Promise<LedgerEntry> {
    const { schoolId, orgId } = currentTenant();
    return withTenant(async (tx) => {
      const inserted = await tx
        .insert(ledgerEntries)
        .values({
          schoolId,
          studentId: input.studentId,
          termId: input.termId,
          direction: "credit",
          kind: "payment",
          amountMinor: input.amountMinor,
          currency: input.currency,
          reference: input.reference,
          idempotencyKey: input.idempotencyKey,
          meta: { method: input.method },
        })
        .onConflictDoNothing({ target: [ledgerEntries.schoolId, ledgerEntries.idempotencyKey] })
        .returning();

      const entry =
        inserted[0] ??
        (await tx
          .select()
          .from(ledgerEntries)
          .where(and(eq(ledgerEntries.schoolId, schoolId), eq(ledgerEntries.idempotencyKey, input.idempotencyKey)))
          .limit(1))[0];
      if (!entry) throw new Error("Failed to record payment");

      // Only emit on a genuinely new credit (avoid duplicate downstream effects).
      if (inserted[0]) {
        await emit(tx, schoolId, {
          aggregate: "ledger",
          aggregateId: entry.id,
          eventType: PAYMENT_RECORDED,
          payload: { studentId: input.studentId, termId: input.termId, amountMinor: input.amountMinor, currency: input.currency, schoolId, orgId },
        });
      }
      return entry;
    });
  },

  /**
   * Gateway webhook → ledger (ADR-8/11). The provider verifies + normalizes its
   * own payload into one canonical event; we record an idempotent credit. The
   * provider's idempotencyKey makes at-least-once webhooks safe to replay.
   */
  async recordFromWebhook(providerName: string, raw: unknown, termId: string): Promise<LedgerEntry | null> {
    const evt = providerByName(providerName).parseEvent(raw);
    if (evt.status !== "succeeded") return null;
    return this.recordPayment({
      studentId: evt.studentId,
      termId,
      amountMinor: evt.amountMinor,
      currency: evt.currency,
      idempotencyKey: evt.idempotencyKey,
      method: "card",
      reference: evt.providerRef,
    });
  },

  /** Per-student balances for a term (for the payments / overview screens). */
  async outstanding(termId: string) {
    const rows = await withTenant((tx) =>
      tx
        .select({
          studentId: ledgerEntries.studentId,
          firstName: persons.firstName,
          lastName: persons.lastName,
          direction: ledgerEntries.direction,
          amountMinor: ledgerEntries.amountMinor,
          currency: ledgerEntries.currency,
        })
        .from(ledgerEntries)
        .innerJoin(persons, eq(persons.id, ledgerEntries.studentId))
        .where(eq(ledgerEntries.termId, termId)),
    );
    const byStudent = new Map<string, { studentId: string; name: string; amountDue: number; amountPaid: number; currency: string }>();
    for (const r of rows) {
      const acc = byStudent.get(r.studentId) ?? { studentId: r.studentId, name: `${r.firstName} ${r.lastName}`, amountDue: 0, amountPaid: 0, currency: r.currency };
      if (r.direction === "debit") acc.amountDue += r.amountMinor;
      else acc.amountPaid += r.amountMinor;
      byStudent.set(r.studentId, acc);
    }
    return [...byStudent.values()].map((a) => {
      const balance = a.amountDue - a.amountPaid;
      return { ...a, balance, status: balance <= 0 ? "paid" : a.amountPaid > 0 ? "partial" : "unpaid" };
    });
  },

  async updateStructure(id: string, patch: { name?: string; amountMinor?: number; isDefault?: boolean }): Promise<void> {
    await withTenant((tx) =>
      tx
        .update(feeStructures)
        .set({
          ...(patch.name ? { name: patch.name } : {}),
          ...(patch.amountMinor !== undefined ? { amountMinor: patch.amountMinor } : {}),
          ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
        })
        .where(eq(feeStructures.id, id)),
    );
  },

  /** Assigns a fee structure to every student enrolled in a class for the term. */
  async assignToClass(input: { classId: string; feeStructureId: string; termId: string }): Promise<{ assigned: number; skipped: number; total: number }> {
    const studentIds = await withTenant((tx) =>
      tx
        .select({ studentId: enrollments.studentId })
        .from(enrollments)
        .where(and(eq(enrollments.classId, input.classId), eq(enrollments.termId, input.termId))),
    );
    let assigned = 0;
    for (const s of studentIds) {
      try {
        await this.assignFee({ studentId: s.studentId, feeStructureId: input.feeStructureId });
        assigned++;
      } catch {
        /* skip duplicates / failures */
      }
    }
    return { assigned, skipped: studentIds.length - assigned, total: studentIds.length };
  },

  /** Student fee summary for a term (totals + ledger entries). */
  async studentTerm(studentId: string, termId: string) {
    const balances = await this.balanceFor(studentId, termId);
    const b = balances[0];
    return {
      student: studentId,
      term: termId,
      summary: {
        totalDue: (b?.billedMinor ?? 0) / 100,
        totalPaid: (b?.paidMinor ?? 0) / 100,
        totalBalance: (b?.balanceMinor ?? 0) / 100,
      },
      payments: [],
    };
  },

  async listStructures(termId?: string): Promise<FeeStructure[]> {
    return withTenant((tx) =>
      termId
        ? tx.select().from(feeStructures).where(eq(feeStructures.termId, termId))
        : tx.select().from(feeStructures),
    );
  },

  async balanceFor(studentId: string, termId: string): Promise<CurrencyBalance[]> {
    const rows = await withTenant((tx) =>
      tx
        .select()
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.studentId, studentId), eq(ledgerEntries.termId, termId))),
    );
    return computeBalances(rows);
  },

  /** Used by the StudentEnrolled ripple: the default fee structure for a term, if any. */
  async defaultFeeForTerm(termId: string): Promise<FeeStructure | null> {
    const rows = await withTenant((tx) =>
      tx
        .select()
        .from(feeStructures)
        .where(and(eq(feeStructures.termId, termId), eq(feeStructures.isDefault, true)))
        .limit(1),
    );
    return rows[0] ?? null;
  },
};
