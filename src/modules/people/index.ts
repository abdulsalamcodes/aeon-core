/** Public interface of the People module (ADR-3). */
export { peopleRouter } from "./people.routes.js";
export { enrollmentService, STUDENT_ENROLLED } from "./enrollment.service.js";
export type { EnrollInput } from "./enrollment.service.js";
export { guardianshipService } from "./guardianship.service.js";
export type { LinkGuardianInput } from "./guardianship.service.js";
