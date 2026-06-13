import type { Channel, ChannelKind, SendParams, SendResult } from "./channel.js";
import { logger } from "../config/logger.js";

/**
 * Dev/test channel: "delivers" by logging. Real channels (Termii SMS, WhatsApp
 * Business, SES email) replace these behind the same interface.
 */
export class LogChannel implements Channel {
  constructor(public readonly kind: ChannelKind) {}
  async send(p: SendParams): Promise<SendResult> {
    logger.info({ channel: this.kind, to: p.to, body: p.body }, "notification dispatched (log channel)");
    return { status: "sent", providerRef: `log_${Date.now()}` };
  }
}
