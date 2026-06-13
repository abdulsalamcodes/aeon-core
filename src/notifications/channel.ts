/**
 * Notification channel abstraction (ADR-11). The notification service talks to
 * THIS, not to Termii/Africa's Talking/SES directly. SMS-first for African
 * guardians; WhatsApp/email slot in by registering another channel.
 */
export type ChannelKind = "sms" | "whatsapp" | "email";

export interface SendParams {
  to: string;
  body: string;
}

export interface SendResult {
  status: "sent" | "failed";
  providerRef?: string;
}

export interface Channel {
  readonly kind: ChannelKind;
  send(p: SendParams): Promise<SendResult>;
}

const registry = new Map<ChannelKind, Channel>();

export function registerChannel(c: Channel): void {
  registry.set(c.kind, c);
}

export function channelFor(kind: ChannelKind): Channel {
  const c = registry.get(kind);
  if (!c) throw new Error(`No channel configured for ${kind}`);
  return c;
}
