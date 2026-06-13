import { describe, it, expect } from "vitest";
import { enrollInput } from "./enrollment.service.js";
import { recordGradeInput } from "../academics/grade.service.js";
import { markInput } from "../academics/attendance.service.js";

const uuid = "11111111-1111-1111-1111-111111111111";

describe("enrollInput", () => {
  it("requires uuids for student, class, term", () => {
    expect(enrollInput.safeParse({ studentId: uuid, classId: uuid, termId: uuid }).success).toBe(true);
    expect(enrollInput.safeParse({ studentId: "x", classId: uuid, termId: uuid }).success).toBe(false);
  });
});

describe("recordGradeInput", () => {
  it("bounds scores to 0..100 integers", () => {
    expect(recordGradeInput.safeParse({ studentId: uuid, subjectId: uuid, termId: uuid, caScore: 30, examScore: 60 }).success).toBe(true);
    expect(recordGradeInput.safeParse({ studentId: uuid, subjectId: uuid, termId: uuid, caScore: 30, examScore: 140 }).success).toBe(false);
    expect(recordGradeInput.safeParse({ studentId: uuid, subjectId: uuid, termId: uuid, caScore: 30.5, examScore: 60 }).success).toBe(false);
  });
});

describe("markInput", () => {
  it("only accepts known statuses", () => {
    expect(markInput.safeParse({ attendanceId: uuid, status: "present" }).success).toBe(true);
    expect(markInput.safeParse({ attendanceId: uuid, status: "vacation" }).success).toBe(false);
  });
});
