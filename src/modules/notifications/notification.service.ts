import { desc, eq } from "drizzle-orm";
import { notifications, type Notification } from "../../db/schema/notifications.js";
import { currentTenant, withTenant } from "../../tenant/context.js";
import { channelFor, type ChannelKind } from "../../notifications/index.js";
import type { SendInput } from "./notifications.schema.js";

export const notificationService = {
  /**
   * Logs and dispatches a notification through the configured channel. Writes a
   * `queued` row, sends, then records the outcome — so the log is the source of
   * truth for delivery (ADR-11).
   */
  async send(input: SendInput): Promise<Notification> {
    const { schoolId } = currentTenant();
    const [row] = await withTenant((tx) =>
      tx
        .insert(notifications)
        .values({
          schoolId,
          channel: input.channel,
          toAddress: input.to,
          template: input.template,
          body: input.body,
          status: "queued",
        })
        .returning(),
    );
    if (!row) throw new Error("Failed to queue notification");

    let status: "sent" | "failed" = "failed";
    let meta: Record<string, unknown> = {};
    try {
      const res = await channelFor(input.channel as ChannelKind).send({ to: input.to, body: input.body });
      status = res.status;
      meta = { providerRef: res.providerRef };
    } catch (err) {
      meta = { error: String(err) };
    }

    const [updated] = await withTenant((tx) =>
      tx.update(notifications).set({ status, meta }).where(eq(notifications.id, row.id)).returning(),
    );
    return updated ?? row;
  },

  async listRecent(limit = 50): Promise<Notification[]> {
    return withTenant((tx) =>
      tx.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit),
    );
  },
};
