import { AsyncLocalStorage } from "node:async_hooks";
import { sql as raw } from "drizzle-orm";
import { db } from "../db/client.js";

export interface TenantContext {
  schoolId: string;
  orgId: string;
  /** Set when the principal may read across their whole org (e.g. a director). */
  orgWide?: boolean;
  /** Acting principal (for audit attribution on emitted events). */
  actorId?: string;
  actorName?: string;
}

const als = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function currentTenant(): TenantContext {
  const ctx = als.getStore();
  if (!ctx) throw new Error("No tenant context — request not tenant-resolved");
  return ctx;
}

/** The acting principal, if any (used for audit attribution). Never throws. */
export function currentActor(): { actorId?: string; actorName?: string } {
  const ctx = als.getStore();
  return { actorId: ctx?.actorId, actorName: ctx?.actorName };
}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `fn` inside a transaction with the tenant bound at the DATABASE layer.
 * `set_config(..., true)` is transaction-local, so RLS policies that read
 * `current_setting('app.current_school')` filter every query for the life of
 * this transaction — even if a query forgets an explicit WHERE (ADR-2).
 */
export async function withTenant<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const { schoolId, orgId, orgWide } = currentTenant();
  return db.transaction(async (tx) => {
    await tx.execute(raw`select set_config('app.current_school', ${schoolId}, true)`);
    await tx.execute(raw`select set_config('app.current_org', ${orgId}, true)`);
    await tx.execute(raw`select set_config('app.org_wide', ${orgWide ? "on" : "off"}, true)`);
    return fn(tx);
  });
}

/**
 * Login-only context (ADR-4). Before any tenant is chosen, an authenticating
 * account may read its OWN memberships across schools. Sets `app.current_account`
 * (transaction-local) which the membership RLS policy allows. No school/org is
 * bound, so this can ONLY see rows belonging to this account.
 */
export async function withAccount<T>(accountId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(raw`select set_config('app.current_account', ${accountId}, true)`);
    return fn(tx);
  });
}
