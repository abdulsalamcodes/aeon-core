import { sql as raw } from "drizzle-orm";
import { db } from "./client.js";
import { organizations, schools, accounts } from "./schema/index.js";
import { runWithTenant } from "../tenant/context.js";
import { hashPassword } from "../auth/password.js";
import { provisionService } from "../modules/identity/index.js";
import {
  studentService,
  enrollmentService,
  staffService,
} from "../modules/people/index.js";
import { classService } from "../modules/classes/index.js";
import { subjectService } from "../modules/subjects/index.js";
import { termService } from "../modules/academic/index.js";
import { financeService } from "../modules/finance/index.js";
import { gradeService, attendanceService } from "../modules/academics/index.js";
import {
  calendarService,
  timetableService,
} from "../modules/schedule/index.js";
import { logger } from "../config/logger.js";

/**
 * Production seed — runs once (idempotent guard on org count).
 *
 * Creates:
 *   Platform admin  superadmin@aeon.app  / Aeon-Admin-2024!   → /login
 *   School admin    admin@greenfield.edu / School-Admin-2024!  → /staff/greenfield-academy
 *   4 teachers + 1 bursar
 *   3 classes, 8 subjects, 2 academic terms
 *   20 students across JSS 1–3, enrolled + billed + graded + attendance
 *
 * Change credentials immediately after first login.
 */
export async function seedProd(opts: { force?: boolean } = {}): Promise<void> {
  const force = opts.force ?? process.env["SEED_FORCE"] === "1";

  const existing = await db.execute(
    raw`select count(*)::int as n from organizations`,
  );
  const rows = (
    Array.isArray(existing)
      ? existing
      : ((existing as { rows?: unknown[] }).rows ?? [])
  ) as { n: number }[];
  if ((rows[0]?.n ?? 0) > 0 && !force) {
    logger.info("prod seed skipped — data already exists");
    return;
  }

  if (force) {
    logger.info("SEED_FORCE=1 — wiping existing seed data");
    await db.execute(raw`truncate organizations cascade`);
    await db.execute(raw`truncate accounts cascade`);
    await db.execute(raw`truncate roles cascade`);
  }

  // ── Platform admin ────────────────────────────────────────────────────────
  await provisionService.ensureSystemRoles();
  await db.insert(accounts).values({
    email: "superadmin@aeon.app",
    passwordHash: await hashPassword("Aeon-Admin-2024!"),
    isSuperAdmin: true,
  });

  // ── Org + school ──────────────────────────────────────────────────────────
  const [org] = await db
    .insert(organizations)
    .values({ name: "Greenfield Schools Group", slug: "greenfield" })
    .returning();
  const [school] = await db
    .insert(schools)
    .values({
      orgId: org!.id,
      name: "Greenfield Academy",
      slug: "greenfield-academy",
    })
    .returning();

  const today = new Date().toISOString().slice(0, 10);

  await runWithTenant({ schoolId: school!.id, orgId: org!.id }, async () => {
    // ── Staff ─────────────────────────────────────────────────────────────
    await provisionService.addPrincipal({
      email: "admin@greenfield.edu",
      password: "School-Admin-2024!",
      firstName: "Ngozi",
      lastName: "Okonkwo",
      role: "school-admin",
    });

    const teachers: { name: string; email: string }[] = [
      { name: "Emeka Eze", email: "emeka@greenfield.edu" },
      { name: "Funmi Adeyemi", email: "funmi@greenfield.edu" },
      { name: "Biodun Lawal", email: "biodun@greenfield.edu" },
      { name: "Chinyere Obi", email: "chinyere@greenfield.edu" },
    ];
    for (const t of teachers) {
      await staffService.create({
        name: t.name,
        email: t.email,
        password: "Teacher-2024!",
        role: "teacher",
      });
    }
    await staffService.create({
      name: "Tunde Bursar",
      email: "bursar@greenfield.edu",
      password: "Bursar-2024!",
      role: "teacher",
    });

    // ── Academic calendar ────────────────────────────────────────────────
    const term1 = await termService.create({
      name: "First Term 2024/2025",
      isCurrent: false,
    });
    const term2 = await termService.create({
      name: "Second Term 2024/2025",
      isCurrent: true,
    });

    // ── Subjects ──────────────────────────────────────────────────────────
    const maths = await subjectService.create({ name: "Mathematics" });
    const english = await subjectService.create({ name: "English Language" });
    const basic = await subjectService.create({ name: "Basic Science" });
    const social = await subjectService.create({ name: "Social Studies" });
    const civic = await subjectService.create({ name: "Civic Education" });
    const agric = await subjectService.create({ name: "Agricultural Science" });
    const ict = await subjectService.create({ name: "Computer Science" });
    const french = await subjectService.create({ name: "French" });

    // ── Classes ───────────────────────────────────────────────────────────
    const jss1 = await classService.create({ name: "JSS 1A" });
    const jss2 = await classService.create({ name: "JSS 2A" });
    const jss3 = await classService.create({ name: "JSS 3A" });

    // ── Fee structures ────────────────────────────────────────────────────
    const tuition1 = await financeService.createFeeStructure({
      termId: term1.id,
      name: "School Fees – First Term",
      amountMinor: 45_000_00,
      currency: "NGN",
      isDefault: false,
    });
    const tuition2 = await financeService.createFeeStructure({
      termId: term2.id,
      name: "School Fees – Second Term",
      amountMinor: 45_000_00,
      currency: "NGN",
      isDefault: true,
    });
    const devLevy = await financeService.createFeeStructure({
      termId: term2.id,
      name: "Development Levy",
      amountMinor: 10_000_00,
      currency: "NGN",
      isDefault: false,
    });

    // ── Students ──────────────────────────────────────────────────────────
    type StudentSeed = {
      firstName: string;
      lastName: string;
      gender: "male" | "female";
      studentNumber: string;
      dob: string;
      guardianName: string;
      guardianPhone: string;
      classId: string;
      ca1: number;
      exam1: number;
      ca2: number;
      exam2: number;
      paid1Minor: number;
      paid2Minor: number;
    };

    const studentSeeds: StudentSeed[] = [
      // JSS 1A
      {
        firstName: "Tomi",
        lastName: "Adeyemi",
        gender: "female",
        studentNumber: "GFA/001/24",
        dob: "2012-03-04",
        guardianName: "Mrs Adeyemi",
        guardianPhone: "+2348031000001",
        classId: jss1.id,
        ca1: 38,
        exam1: 57,
        ca2: 40,
        exam2: 60,
        paid1Minor: 45_000_00,
        paid2Minor: 30_000_00,
      },
      {
        firstName: "Chidi",
        lastName: "Okafor",
        gender: "male",
        studentNumber: "GFA/002/24",
        dob: "2011-09-21",
        guardianName: "Mr Okafor",
        guardianPhone: "+2348031000002",
        classId: jss1.id,
        ca1: 30,
        exam1: 48,
        ca2: 33,
        exam2: 52,
        paid1Minor: 45_000_00,
        paid2Minor: 45_000_00,
      },
      {
        firstName: "Aisha",
        lastName: "Bello",
        gender: "female",
        studentNumber: "GFA/003/24",
        dob: "2012-01-15",
        guardianName: "Alhaji Bello",
        guardianPhone: "+2348031000003",
        classId: jss1.id,
        ca1: 35,
        exam1: 62,
        ca2: 37,
        exam2: 58,
        paid1Minor: 45_000_00,
        paid2Minor: 45_000_00,
      },
      {
        firstName: "Seun",
        lastName: "Ojo",
        gender: "male",
        studentNumber: "GFA/004/24",
        dob: "2012-07-08",
        guardianName: "Mrs Ojo",
        guardianPhone: "+2348031000004",
        classId: jss1.id,
        ca1: 22,
        exam1: 40,
        ca2: 25,
        exam2: 42,
        paid1Minor: 20_000_00,
        paid2Minor: 0,
      },
      {
        firstName: "Kemi",
        lastName: "Afolabi",
        gender: "female",
        studentNumber: "GFA/005/24",
        dob: "2012-11-22",
        guardianName: "Mr Afolabi",
        guardianPhone: "+2348031000005",
        classId: jss1.id,
        ca1: 40,
        exam1: 68,
        ca2: 39,
        exam2: 65,
        paid1Minor: 45_000_00,
        paid2Minor: 45_000_00,
      },
      {
        firstName: "Femi",
        lastName: "Owolabi",
        gender: "male",
        studentNumber: "GFA/006/24",
        dob: "2012-05-17",
        guardianName: "Mr Owolabi",
        guardianPhone: "+2348031000006",
        classId: jss1.id,
        ca1: 27,
        exam1: 44,
        ca2: 28,
        exam2: 45,
        paid1Minor: 45_000_00,
        paid2Minor: 10_000_00,
      },
      {
        firstName: "Amaka",
        lastName: "Nwosu",
        gender: "female",
        studentNumber: "GFA/007/24",
        dob: "2012-08-30",
        guardianName: "Mrs Nwosu",
        guardianPhone: "+2348031000007",
        classId: jss1.id,
        ca1: 36,
        exam1: 55,
        ca2: 38,
        exam2: 57,
        paid1Minor: 45_000_00,
        paid2Minor: 45_000_00,
      },
      // JSS 2A
      {
        firstName: "Ibrahim",
        lastName: "Musa",
        gender: "male",
        studentNumber: "GFA/008/24",
        dob: "2011-04-12",
        guardianName: "Alhaji Musa",
        guardianPhone: "+2348031000008",
        classId: jss2.id,
        ca1: 33,
        exam1: 52,
        ca2: 35,
        exam2: 55,
        paid1Minor: 45_000_00,
        paid2Minor: 45_000_00,
      },
      {
        firstName: "Ngozi",
        lastName: "Eze",
        gender: "female",
        studentNumber: "GFA/009/24",
        dob: "2011-02-28",
        guardianName: "Mr Eze",
        guardianPhone: "+2348031000009",
        classId: jss2.id,
        ca1: 39,
        exam1: 64,
        ca2: 40,
        exam2: 66,
        paid1Minor: 45_000_00,
        paid2Minor: 45_000_00,
      },
      {
        firstName: "Sola",
        lastName: "Bankole",
        gender: "male",
        studentNumber: "GFA/010/24",
        dob: "2011-06-03",
        guardianName: "Mrs Bankole",
        guardianPhone: "+2348031000010",
        classId: jss2.id,
        ca1: 18,
        exam1: 35,
        ca2: 20,
        exam2: 38,
        paid1Minor: 30_000_00,
        paid2Minor: 0,
      },
      {
        firstName: "Yetunde",
        lastName: "Fadipe",
        gender: "female",
        studentNumber: "GFA/011/24",
        dob: "2011-10-19",
        guardianName: "Mr Fadipe",
        guardianPhone: "+2348031000011",
        classId: jss2.id,
        ca1: 37,
        exam1: 60,
        ca2: 38,
        exam2: 62,
        paid1Minor: 45_000_00,
        paid2Minor: 45_000_00,
      },
      {
        firstName: "Uche",
        lastName: "Nwachukwu",
        gender: "male",
        studentNumber: "GFA/012/24",
        dob: "2011-12-05",
        guardianName: "Mrs Nwachukwu",
        guardianPhone: "+2348031000012",
        classId: jss2.id,
        ca1: 29,
        exam1: 46,
        ca2: 31,
        exam2: 50,
        paid1Minor: 45_000_00,
        paid2Minor: 22_000_00,
      },
      {
        firstName: "Fatima",
        lastName: "Ahmed",
        gender: "female",
        studentNumber: "GFA/013/24",
        dob: "2011-08-14",
        guardianName: "Alhaji Ahmed",
        guardianPhone: "+2348031000013",
        classId: jss2.id,
        ca1: 34,
        exam1: 58,
        ca2: 36,
        exam2: 60,
        paid1Minor: 45_000_00,
        paid2Minor: 45_000_00,
      },
      // JSS 3A
      {
        firstName: "Bayo",
        lastName: "Adesanya",
        gender: "male",
        studentNumber: "GFA/014/24",
        dob: "2010-03-22",
        guardianName: "Mr Adesanya",
        guardianPhone: "+2348031000014",
        classId: jss3.id,
        ca1: 36,
        exam1: 60,
        ca2: 38,
        exam2: 62,
        paid1Minor: 45_000_00,
        paid2Minor: 45_000_00,
      },
      {
        firstName: "Chisom",
        lastName: "Ikenna",
        gender: "female",
        studentNumber: "GFA/015/24",
        dob: "2010-07-11",
        guardianName: "Mrs Ikenna",
        guardianPhone: "+2348031000015",
        classId: jss3.id,
        ca1: 40,
        exam1: 70,
        ca2: 40,
        exam2: 72,
        paid1Minor: 45_000_00,
        paid2Minor: 45_000_00,
      },
      {
        firstName: "Hassan",
        lastName: "Danladi",
        gender: "male",
        studentNumber: "GFA/016/24",
        dob: "2010-01-09",
        guardianName: "Alhaji Danladi",
        guardianPhone: "+2348031000016",
        classId: jss3.id,
        ca1: 24,
        exam1: 42,
        ca2: 26,
        exam2: 43,
        paid1Minor: 45_000_00,
        paid2Minor: 0,
      },
      {
        firstName: "Blessing",
        lastName: "Udoh",
        gender: "female",
        studentNumber: "GFA/017/24",
        dob: "2010-09-25",
        guardianName: "Mr Udoh",
        guardianPhone: "+2348031000017",
        classId: jss3.id,
        ca1: 38,
        exam1: 65,
        ca2: 39,
        exam2: 67,
        paid1Minor: 45_000_00,
        paid2Minor: 45_000_00,
      },
      {
        firstName: "Emeka",
        lastName: "Ogbonna",
        gender: "male",
        studentNumber: "GFA/018/24",
        dob: "2010-05-16",
        guardianName: "Mrs Ogbonna",
        guardianPhone: "+2348031000018",
        classId: jss3.id,
        ca1: 31,
        exam1: 50,
        ca2: 32,
        exam2: 52,
        paid1Minor: 45_000_00,
        paid2Minor: 35_000_00,
      },
      {
        firstName: "Sandra",
        lastName: "Effiong",
        gender: "female",
        studentNumber: "GFA/019/24",
        dob: "2010-11-30",
        guardianName: "Mr Effiong",
        guardianPhone: "+2348031000019",
        classId: jss3.id,
        ca1: 35,
        exam1: 57,
        ca2: 37,
        exam2: 59,
        paid1Minor: 45_000_00,
        paid2Minor: 45_000_00,
      },
      {
        firstName: "Lanre",
        lastName: "Balogun",
        gender: "male",
        studentNumber: "GFA/020/24",
        dob: "2010-06-04",
        guardianName: "Mrs Balogun",
        guardianPhone: "+2348031000020",
        classId: jss3.id,
        ca1: 20,
        exam1: 38,
        ca2: 22,
        exam2: 40,
        paid1Minor: 10_000_00,
        paid2Minor: 0,
      },
    ];

    const subjectList = [
      maths,
      english,
      basic,
      social,
      civic,
      agric,
      ict,
      french,
    ];

    for (const s of studentSeeds) {
      logger.info({ student: s.studentNumber }, "seeding student");
      const student = await studentService.create({
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        studentNumber: s.studentNumber,
        dob: s.dob,
        guardianName: s.guardianName,
        guardianPhone: s.guardianPhone,
      });

      // Enroll + bill for both terms
      await enrollmentService.enroll({
        studentId: student.id,
        classId: s.classId,
        termId: term1.id,
      });
      await enrollmentService.enroll({
        studentId: student.id,
        classId: s.classId,
        termId: term2.id,
      });
      await financeService.assignFee({
        studentId: student.id,
        feeStructureId: tuition1.id,
      });
      await financeService.assignFee({
        studentId: student.id,
        feeStructureId: tuition2.id,
      });
      await financeService.assignFee({
        studentId: student.id,
        feeStructureId: devLevy.id,
      });

      // Record payment for term 1
      if (s.paid1Minor > 0) {
        await financeService.recordPayment({
          studentId: student.id,
          termId: term1.id,
          amountMinor: s.paid1Minor,
          currency: "NGN",
          idempotencyKey: `seed-${s.studentNumber}-t1`,
          method: "cash",
        });
      }
      // Record payment for term 2
      if (s.paid2Minor > 0) {
        await financeService.recordPayment({
          studentId: student.id,
          termId: term2.id,
          amountMinor: s.paid2Minor,
          currency: "NGN",
          idempotencyKey: `seed-${s.studentNumber}-t2`,
          method: "transfer",
        });
      }

      // Grades for term 1 — all subjects
      for (const [i, subj] of subjectList.entries()) {
        const offset = i * 2;
        await gradeService.record({
          studentId: student.id,
          subjectId: subj.id,
          termId: term1.id,
          caScore: Math.min(40, s.ca1 + (offset % 5) - 2),
          examScore: Math.min(60, s.exam1 + (offset % 7) - 3),
        });
      }
      // Grades for term 2 — all subjects
      for (const [i, subj] of subjectList.entries()) {
        const offset = i * 2;
        await gradeService.record({
          studentId: student.id,
          subjectId: subj.id,
          termId: term2.id,
          caScore: Math.min(40, s.ca2 + (offset % 5) - 2),
          examScore: Math.min(60, s.exam2 + (offset % 7) - 3),
        });
      }

      // Attendance — 5 recent days present, mark one absent and one late for variety
      const dates = [-4, -3, -2, -1, 0].map((d) => {
        const dt = new Date();
        dt.setDate(dt.getDate() + d);
        return dt.toISOString().slice(0, 10);
      });
      for (const [di, date] of dates.entries()) {
        const status = di === 1 ? "absent" : di === 3 ? "late" : "present";
        await attendanceService.bulkMark({
          classId: s.classId,
          termId: term2.id,
          date,
          records: [{ studentId: student.id, status }],
        });
      }
    }

    // ── Timetable (current term, all three classes) ────────────────────────
    const scheduleFor = (subjs: typeof subjectList) => [
      {
        day: "Monday",
        periods: [
          {
            subjectId: subjs[0]!.id,
            subjectName: subjs[0]!.name,
            startTime: "08:00",
            endTime: "09:00",
          },
          {
            subjectId: subjs[1]!.id,
            subjectName: subjs[1]!.name,
            startTime: "09:00",
            endTime: "10:00",
          },
        ],
      },
      {
        day: "Tuesday",
        periods: [
          {
            subjectId: subjs[2]!.id,
            subjectName: subjs[2]!.name,
            startTime: "08:00",
            endTime: "09:00",
          },
          {
            subjectId: subjs[3]!.id,
            subjectName: subjs[3]!.name,
            startTime: "09:00",
            endTime: "10:00",
          },
        ],
      },
      {
        day: "Wednesday",
        periods: [
          {
            subjectId: subjs[4]!.id,
            subjectName: subjs[4]!.name,
            startTime: "08:00",
            endTime: "09:00",
          },
          {
            subjectId: subjs[5]!.id,
            subjectName: subjs[5]!.name,
            startTime: "09:00",
            endTime: "10:00",
          },
        ],
      },
      {
        day: "Thursday",
        periods: [
          {
            subjectId: subjs[6]!.id,
            subjectName: subjs[6]!.name,
            startTime: "08:00",
            endTime: "09:00",
          },
          {
            subjectId: subjs[7]!.id,
            subjectName: subjs[7]!.name,
            startTime: "09:00",
            endTime: "10:00",
          },
        ],
      },
      {
        day: "Friday",
        periods: [
          {
            subjectId: subjs[0]!.id,
            subjectName: subjs[0]!.name,
            startTime: "08:00",
            endTime: "09:00",
          },
          {
            subjectId: subjs[2]!.id,
            subjectName: subjs[2]!.name,
            startTime: "09:00",
            endTime: "10:00",
          },
        ],
      },
    ];

    for (const cls of [jss1, jss2, jss3]) {
      await timetableService.upsert({
        classId: cls.id,
        termId: term2.id,
        schedule: scheduleFor(subjectList),
      });
    }

    // ── Calendar events ───────────────────────────────────────────────────
    const events = [
      {
        title: "Second Term Begins",
        type: "term-start" as const,
        startDate: "2025-01-06",
        endDate: "2025-01-06",
        description: "First day of second term",
      },
      {
        title: "Mid-term Break",
        type: "holiday" as const,
        startDate: "2025-02-17",
        endDate: "2025-02-21",
        description: "Mid-term holidays",
      },
      {
        title: "Mock Examinations Begin",
        type: "exam" as const,
        startDate: "2025-03-03",
        endDate: "2025-03-07",
        description: "JSS 3 mock exams week",
      },
      {
        title: "End-of-Term Exams",
        type: "exam" as const,
        startDate: "2025-03-24",
        endDate: "2025-03-28",
        description: "All-class terminal examinations",
      },
      {
        title: "Second Term Ends",
        type: "term-end" as const,
        startDate: "2025-03-28",
        endDate: "2025-03-28",
        description: "Last day of second term",
      },
      {
        title: "Easter Break",
        type: "holiday" as const,
        startDate: "2025-04-07",
        endDate: "2025-04-22",
        description: "Easter holidays",
      },
    ];
    for (const ev of events) {
      await calendarService.create(ev);
    }
  });

  logger.info(
    { school: "greenfield-academy", students: 20 },
    "prod seed complete",
  );
}

// Script entry point — run directly with tsx or node.
if (
  process.argv[1]?.endsWith("seed-prod.ts") ||
  process.argv[1]?.endsWith("seed-prod.js")
) {
  const { sql } = await import("./client.js");
  const { applyMigrations } = await import("./run-migrations.js");
  await applyMigrations();
  await seedProd();
  await sql.end();
}
