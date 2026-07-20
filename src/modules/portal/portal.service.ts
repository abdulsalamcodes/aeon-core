import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { schools, persons, studentProfiles, grades, attendance, ledgerEntries, enrollments, classes, subjects } from "../../db/schema/index.js";
import { runWithTenant, withTenant } from "../../tenant/context.js";
import { signAccessToken } from "../../auth/jwt.js";
import { HttpError } from "../../lib/http-error.js";
import { computeBalances } from "../finance/balance.js";
import { financeService } from "../finance/index.js";
import { termService } from "../academic/index.js";
import type { StudentLoginInput } from "./portal.schema.js";

// Paystack currently settles NGN only; other currencies stay on offline payment.
const PAYABLE_CURRENCY = "NGN";

export interface PortalStudent {
  id: string;
  firstname: string;
  lastname: string;
  studentNumber: string;
  dob: string;
  gender: string;
  classId: string;
  className: string;
  schoolId: string;
}

async function loadStudent(schoolId: string, orgId: string, studentId: string): Promise<PortalStudent | null> {
  return runWithTenant({ schoolId, orgId }, () =>
    withTenant(async (tx) => {
      const [row] = await tx
        .select({
          id: persons.id,
          firstName: persons.firstName,
          lastName: persons.lastName,
          dob: persons.dob,
          studentNumber: studentProfiles.studentNumber,
          gender: studentProfiles.gender,
          classId: enrollments.classId,
          className: classes.name,
        })
        .from(studentProfiles)
        .innerJoin(persons, eq(persons.id, studentProfiles.personId))
        .leftJoin(enrollments, eq(enrollments.studentId, persons.id))
        .leftJoin(classes, eq(classes.id, enrollments.classId))
        .where(eq(persons.id, studentId))
        .limit(1);
      if (!row) return null;
      return {
        id: row.id,
        firstname: row.firstName,
        lastname: row.lastName,
        studentNumber: row.studentNumber ?? "",
        dob: row.dob ?? "",
        gender: row.gender ?? "",
        classId: row.classId ?? "",
        className: row.className ?? "",
        schoolId,
      };
    }),
  );
}

export const portalService = {
  async login(input: StudentLoginInput): Promise<{ accessToken: string; student: PortalStudent }> {
    const [school] = await db
      .select({ id: schools.id, orgId: schools.orgId })
      .from(schools)
      .where(eq(schools.slug, input.schoolSlug))
      .limit(1);
    if (!school) throw new HttpError(404, "School not found");

    const found = await runWithTenant({ schoolId: school.id, orgId: school.orgId }, () =>
      withTenant(async (tx) => {
        const [row] = await tx
          .select({ personId: persons.id, dob: persons.dob })
          .from(studentProfiles)
          .innerJoin(persons, eq(persons.id, studentProfiles.personId))
          .where(eq(studentProfiles.studentNumber, input.studentNumber))
          .limit(1);
        return row ?? null;
      }),
    );
    if (!found || (found.dob ?? "") !== input.dob) throw new HttpError(401, "Invalid admission number or date of birth");

    const accessToken = await signAccessToken({
      sub: found.personId,
      schoolId: school.id,
      orgId: school.orgId,
      role: "student",
      orgWide: false,
      studentId: found.personId,
    });
    const student = await loadStudent(school.id, school.orgId, found.personId);
    if (!student) throw new HttpError(500, "Student load failed");
    return { accessToken, student };
  },

  async me(schoolId: string, orgId: string, studentId: string): Promise<PortalStudent | null> {
    return loadStudent(schoolId, orgId, studentId);
  },

  async grades(studentId: string) {
    return withTenant((tx) =>
      tx
        .select({
          id: grades.id,
          subjectId: grades.subjectId,
          subjectName: subjects.name,
          termId: grades.termId,
          caScore: grades.caScore,
          examScore: grades.examScore,
        })
        .from(grades)
        .leftJoin(subjects, eq(subjects.id, grades.subjectId))
        .where(eq(grades.studentId, studentId)),
    );
  },

  async attendance(studentId: string) {
    return withTenant((tx) => tx.select().from(attendance).where(eq(attendance.studentId, studentId)));
  },

  async fees(studentId: string) {
    const rows = await withTenant((tx) =>
      tx.select().from(ledgerEntries).where(eq(ledgerEntries.studentId, studentId)),
    );
    return { entries: rows, balances: computeBalances(rows) };
  },

  /**
   * Starts a Paystack checkout for the student's own outstanding term fee. The
   * student, amount, and email are all derived server-side from the token — the
   * caller cannot pay a different student or a forged amount.
   */
  async startFeePayment(studentId: string): Promise<{ redirectUrl: string }> {
    const term = await termService.current();
    if (!term) throw new HttpError(409, "No active term to pay for");

    const balances = await financeService.balanceFor(studentId, term.id);
    const outstanding = balances.find((b) => b.currency === PAYABLE_CURRENCY && b.balanceMinor > 0);
    if (!outstanding) throw new HttpError(409, "No outstanding fees to pay online");

    const email = await guardianEmail(studentId);
    if (!email) throw new HttpError(422, "Add a guardian email to your profile before paying online");

    const { redirectUrl } = await financeService.initiateOnlinePayment({
      studentId,
      termId: term.id,
      amountMinor: outstanding.balanceMinor,
      currency: PAYABLE_CURRENCY,
      email,
    });
    if (!redirectUrl) throw new HttpError(502, "Payment gateway did not return a checkout link");
    return { redirectUrl };
  },
};

async function guardianEmail(studentId: string): Promise<string | null> {
  const rows = await withTenant((tx) =>
    tx.select({ email: studentProfiles.guardianEmail }).from(studentProfiles).where(eq(studentProfiles.personId, studentId)).limit(1),
  );
  return rows[0]?.email ?? null;
}
