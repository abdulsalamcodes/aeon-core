/**
 * Public interface of the Identity module (ADR-3). Auth, login, and the
 * provisioning primitive other modules use to create principals.
 */
export { authRouter } from "./identity.routes.js";
export { authService } from "./auth.service.js";
export { loginInput } from "./identity.schema.js";
export type { LoginInput } from "./identity.schema.js";
export type { LoginResult, MembershipSummary } from "./auth.service.js";
export { provisionService, SYSTEM_ROLES } from "./provision.service.js";
export type { SystemRole } from "./provision.service.js";
