/**
 * Public interface of the Subjects module. Anything NOT exported here is private
 * to the module; other modules must import only from this barrel (enforced by
 * the import-boundary lint rule — ADR-3).
 */
export { subjectRouter } from "./subject.routes.js";
export { subjectService } from "./subject.service.js";
export type { CreateSubjectInput } from "./subjects.schema.js";
