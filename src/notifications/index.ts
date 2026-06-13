import { registerChannel } from "./channel.js";
import { LogChannel } from "./log-channel.js";

export * from "./channel.js";
export { LogChannel } from "./log-channel.js";

let registered = false;

/** Registers the configured channels at boot (today: log channels). */
export function registerDefaultChannels(): void {
  if (registered) return;
  registerChannel(new LogChannel("sms"));
  registerChannel(new LogChannel("whatsapp"));
  registerChannel(new LogChannel("email"));
  registered = true;
}
