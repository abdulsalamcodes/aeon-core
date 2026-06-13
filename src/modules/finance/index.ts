/** Public interface of the Finance module (ADR-3). */
export { financeRouter } from "./finance.routes.js";
export { financeService, FEE_ASSIGNED, PAYMENT_RECORDED } from "./finance.service.js";
export { onStudentEnrolled } from "./handlers.js";
export { computeBalances } from "./balance.js";
export type { CurrencyBalance } from "./balance.js";
