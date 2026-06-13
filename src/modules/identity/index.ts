/**
 * Public interface of the Identity module (ADR-3). Auth, login, and the
 * provisioning primitive other modules use to create principals.
 */
export { authRouter } from "./identity.routes.js";
export { authService, loginInput } from "./auth.service.js";
export type { LoginInput, LoginResult, MembershipSummary } from "./auth.service.js";
export { provisionService, SYSTEM_ROLES } from "./provision.service.js";
export type { SystemRole } from "./provision.service.js";
