/** Public interface of the Notifications module (ADR-3/11). */
export { notificationsRouter } from "./notifications.routes.js";
export { notificationService } from "./notification.service.js";
export { onStudentEnrolled, onPaymentRecorded } from "./handlers.js";
