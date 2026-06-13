import { AsyncLocalStorage } from "node:async_hooks";
import { sql as raw } from "drizzle-orm";
import { db } from "../db/client.js";

export interface TenantContext {
  schoolId: string;
  orgId: string;
  /** Set when the principal may read across their whole org (e.g. a director). */
  orgWide?: boolean;
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
