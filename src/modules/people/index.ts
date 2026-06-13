/** Public interface of the People module (ADR-3). */
export { peopleRouter } from "./people.routes.js";
export { enrollmentService, STUDENT_ENROLLED } from "./enrollment.service.js";
export type { EnrollInput } from "./enrollment.service.js";
export { guardianshipService } from "./guardianship.service.js";
export type { LinkGuardianInput } from "./guardianship.service.js";
export { studentService } from "./student.service.js";
export type { CreateStudentInput, StudentRow } from "./student.service.js";
export { staffService } from "./staff.service.js";
export type { StaffRow } from "./staff.service.js";
