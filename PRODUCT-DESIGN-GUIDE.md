# Aeon School Management — Product Design Guide

> **Audience:** UI/UX Designer  
> **Purpose:** This document describes every feature, screen, user role, data entity, and interaction the Aeon backend supports, so you know exactly what to design and how it works under the hood.  
> **Status:** Phase 0-4 complete, production-ready API. 26+ endpoints across 12 domain modules.

---

## 1. Product Vision & Design Direction

### Mission
A modern, modular School Management System for African schools. Replace legacy spreadsheets and fragmented tools with a single platform that handles the entire student lifecycle: **admission → enrolment → attendance → grades → fee billing → payment → guardian communication**.

### Design Principles (from architecture)
1. **Multi-tenant by default** — One Aeon instance serves many schools. Every user sees only their school's data. No "where am I?" confusion.
2. **Role-based everything** — What you can see and do depends on who you are (super-admin, school-admin, teacher, student, guardian). The UI should adapt to role.
3. **Event-driven ripple** — When a student enrols, three things happen automatically (attendance register is seeded, term fee is billed, guardian gets an SMS). The UI should communicate these cause-and-effect chains.
4. **Append-only ledger** — Money entries are never deleted or edited. Balances are computed. The UI should reflect "audit trail" behaviour, not mutable spreadsheets.
5. **SMS-first** — Guardian communication targets SMS (high mobile penetration in Africa). WhatsApp and email are secondary channels.
6. **Progressive disclosure** — Schools start simple and grow. The system handles 1 teacher with 20 students just as well as 200 staff with 5000 students.

### Visual Direction (inferred)
- Clean, professional, education-focused
- High information density (tables, lists, dashboards)
- Strong colour coding: green = present/paid/approved, red = absent/unpaid/rejected, amber = late/pending
- Mobile-responsive for guardian-facing views (SMS-first, but SMS links to mobile web)
- Academic year / term-based navigation (not calendar months)

---

## 2. User Roles & Permissions

| Role | Scope | Can Do | Portal Access |
|------|-------|--------|---------------|
| **Super Admin** | Global (all schools) | Create schools, manage all tenants, system-wide reports | Admin dashboard |
| **School Admin** | One school | Manage all school settings: classes, staff, students, terms, subjects, fees, attendance, grades, workflows | Full admin panel |
| **Teacher** | One school | Mark attendance for their class(es), record grades, view class sheets, view student profiles | Teacher dashboard |
| **Student** | Self (within one school) | View their own grades, attendance record, fee balance, timetable, calendar | Student portal |
| **Guardian** | Their wards (within one school) | View their children's grades, attendance, fee balance (via the student portal link shared by SMS) | Student portal (shared access) |

> **Note:** There is no dedicated "guardian" login flow yet. Guardians receive SMS notifications with updates. Full guardian portal is a future phase.

---

## 3. Information Architecture — All Modules & What They Do

### 3.1 Identity & Authentication

**Purpose:** One account per human. One person can be a teacher at school A and a guardian at school B.

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| Login (email + password) | email, password, optional school selection | Returns JWT + list of all memberships across schools |
| Login (student portal) | student number, date of birth, school slug | Returns student-scoped JWT |
| Login (super admin) | email + password (super admin check) | Returns global-scoped JWT |
| Profile / "Me" | display name, active school, role, list of all memberships | Shows which schools the user belongs to |

**Key UX consideration:** Users who belong to multiple schools need a way to *switch schools* without logging out. The JWT is bound to one school at a time. Re-login with `schoolSlug` selects a different active school.

### 3.2 Institution Management (Super Admin)

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| List institutions | school name, slug, org name, total students, total staff | Global view, no tenant filter |
| Create institution | school name, admin name, admin email, admin password | Creates org + school + first school-admin account in one step |
| Institution detail | school info, stats breakdown | Not yet built |

### 3.3 People (Students, Staff, Guardians)

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| **Students list** | name, student number, gender, guardian contact, created date | Filterable/sortable |
| **Create student** | first name, last name, student number (auto-generated), gender, DOB, guardian name/phone/email, optional class + term for auto-enrolment | If class + term provided, student is both created AND enrolled in one action |
| **Staff list** | name, email, role | Filtered from memberships where role != student |
| **Guardianship linking** | guardian person + student person + relationship label | Both people must already exist in the system |
| **Enrolment list** | student, class, term, enrolled at date | Active enrolments only (unenrolled ones filtered out) |
| **Create enrolment** | student ID, class ID, term ID | Triggers the 3-module ripple: attendance seeded, fee billed, SMS sent |

**Key UX consideration:** Students and staff are all "persons." A person can have both a student profile AND a staff profile (e.g., a teaching assistant who is also a student). The UI should handle this gracefully.

### 3.4 Academics — Classes

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| **Classes list** | class name, class teacher name | No pagination, returns all |
| **Create class** | class name, optional class teacher | Name must be unique per school |

### 3.5 Academics — Subjects

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| **Subjects list** | subject name | Soft-delete enabled |
| **Create subject** | subject name | Unique per school |

### 3.6 Academics — Terms

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| **Terms list** | name, start date, end date, is current flag | |
| **Set current term** | — | Only one term can be current at a time |
| **Create term** | name, start/end dates, optional isCurrent | Academic period within a school year |

### 3.7 Academics — Attendance

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| **Class register (attendance list)** | all students in a class on a date, each with status | Seeded automatically when a student enrols |
| **Mark single attendance** | attendance ID + status (present/absent/late/excused/unmarked) | Quick tap-to-mark UX ideal |
| **Bulk mark attendance** | class ID + term ID + date + array of {studentId, status} | "Mark all" then override individuals |

**Key UX consideration:** The daily register is the most-used feature for teachers. It should be fast — tap to mark, swipe between dates, visual status indicators.

### 3.8 Academics — Grades

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| **Class grade sheet** | full class roster with each student's grades per subject | Left-join: students without grades still appear (null scores) |
| **Student grades list** | one student's grades across subjects for a term | |
| **Record/upsert grade** | student ID, subject ID, term ID, CA score (0-100), exam score (0-100) | Upsert: entering a grade twice overwrites |

**Key UX consideration:** Each student has one grade row per subject per term. CA (Continuous Assessment) and Exam are separate integer scores. Total and letter grade are computed by the frontend or a future grading config. The backend just stores raw scores.

### 3.9 Finance — Fee Structures

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| **Fee structures list** | name, amount, currency, term, isDefault flag | |
| **Create fee structure** | term ID, name, amount (minor units), currency (ISO-4217), optional isDefault | Money is always in minor units (e.g., 50000 = NGN 500.00) |

### 3.10 Finance — Ledger & Payments

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| **Assign fee to student** | student ID + fee structure ID | Creates a debit entry + emits FeeAssigned event |
| **Record payment** | student ID, term ID, amount, currency, idempotency key, method (cash/transfer/card/mobile-money), optional reference | Creates a credit entry. Idempotent — same key won't double-post. |
| **Webhook receiver** | provider name + raw payload | For payment gateway callbacks. Currently stubbed. |
| **Student balance** | billed amount, paid amount, balance, per currency | Multi-currency: one student can have NGN and USD balances |
| **Outstanding report** | per-student: amount due, amount paid, balance, status (paid/partial/unpaid) | One row per enrolled student for a given term |

**Key UX consideration:** The ledger is APPE ND-ONLY. There is no "edit" or "delete" for any entry. If a correction is needed, a new adjustment/refund entry is created. The UI must never show edit/delete actions on financial entries.

### 3.11 Notifications

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| **Notifications log** | channel, to address, template, body, status (queued/sent/failed), meta | Last 50 notifications for the school |
| **Send notification (manual)** | channel (sms/whatsapp/email), to, template name, body | Admin can manually dispatch |
| **Auto-notifications** | — | Triggered on enrolment ("guardian-invite" SMS) and payment ("payment-receipt" SMS) |

### 3.12 Calendar

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| **Calendar events list** | title, description, start/end dates, type (holiday/exam/event/term-start/term-end) | |
| **Create event** | title, description, start date, end date, type | |
| **Delete event** | event ID | Only delete — no update endpoint |

### 3.13 Timetable

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| **Class timetable** | day + periods (each with subject, teacher, time) | One timetable per class per term |
| **Upsert timetable** | class ID, term ID, schedule (array of days with periods) | Upsert — create or replace |

### 3.14 Workflow (Approval Engine)

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| **Define workflow** | key (e.g., "result-approval") + ordered steps (each with name + approver role) | |
| **Start workflow instance** | definition key + subject reference (e.g., "grade:<uuid>") | Creates instance + first task |
| **Decide on task** | task ID + approve/reject + optional decider ID | Approving last step completes instance. Rejecting any step rejects instance. |
| **Pending tasks** | — | Not yet built — the UI would query workflow_tasks by approver role |

**Key UX consideration:** The workflow engine is generic. Each domain (grades, fee waivers, admissions) defines its own workflow keys and steps. The UI should show pending approval tasks in a unified inbox, filtered by role.

### 3.15 Dashboard / Insights

| Screen/Feature | Data | Notes |
|---------------|------|-------|
| **School dashboard** | total students, total staff, total classes, present today, today's date | At-a-glance headline numbers |
| **Activity feed** | last 40 outbox events (enrolments, grade recordings, payments, etc.) | Chronological feed of what happened in the school |

---

## 4. School Configuration — What Schools Can Set Up

Every school starts blank and must be configured before use. Below are all the knobs and levers a School Admin can configure.

### 4.1 School Profile

| Setting | Type | Notes |
|---------|------|-------|
| School name | Text | Display name throughout the system |
| School slug | Text (auto-generated) | Used in URLs (`/s/{slug}`) and student portal login |

**Not yet built:** Logo upload, contact info (phone, email, address), school motto, term dates per academic year, timezone.

### 4.2 Academic Configuration

#### Terms
Each school defines its own academic periods. Terms are free-form — the system does not enforce "3 terms per year." A school can have 1, 2, 3, or more overlapping terms.

| Setting | Type | Notes |
|---------|------|-------|
| Term name | Text | e.g., "Term 1 2026", "Summer Session" |
| Start date | Date | Optional |
| End date | Date | Optional |
| Is current | Boolean | Only one term can be current. Setting a new current term unsets the old one. |

**Config screen:** A list of terms with create/edit/set-current actions. The "current term" anchors all academic views — attendance, grades, fee billing default to it.

#### Subjects
School-defined list of teachable subjects.

| Setting | Type | Notes |
|---------|------|-------|
| Subject name | Text | Unique per school. Soft-delete available. |

**Config screen:** Simple list with add/remove. Used when recording grades and building timetables.

#### Classes (Arms/Grades)
School-defined classrooms/groups.

| Setting | Type | Notes |
|---------|------|-------|
| Class name | Text | Unique per school. e.g., "JSS1A", "SSS3" |
| Class teacher | Person (optional) | A staff member assigned as homeroom teacher |

**Config screen:** List with create/edit. Used everywhere — enrolment, attendance register, grade sheet, timetable.

### 4.3 Fee Configuration

#### Fee Structures
Billable items that can be assigned to students per term.

| Setting | Type | Notes |
|---------|------|-------|
| Name | Text | e.g., "Tuition", "Lab Fee", "Sports Levy" |
| Amount (minor units) | Integer | In minor currency units (e.g., 50000 = NGN 500.00) |
| Currency | Text (ISO-4217) | e.g., NGN, GHS, KES, USD, ZAR |
| Term | Reference | Which term this fee applies to |
| Is default | Boolean | If true, this fee is automatically billed to every newly enrolled student |

**Config screen:** Per-term list of fee items. Each item has amount, currency, and a "default" toggle. The default fee powers the enrolment ripple — when a student enrols, the default fee for that term is automatically debited to their ledger.

> **Multi-currency:** A school can define fees in different currencies for the same term. E.g., Tuition in NGN and USD. Each student's balance is tracked per currency independently — currencies are never summed.

### 4.4 Role & Staff Configuration

#### Staff Members
Staff are persons with a non-student membership. Adding a staff member involves:

| Step | What happens |
|------|-------------|
| 1. Create account | Global login identity (email + password) |
| 2. Create person | Tenant-owned PII record |
| 3. Create membership | Join: person + role + school |
| 4. (Optional) Staff profile | HR details: employee number, department, title, hire date |

**Config screen:** Staff list (with name, email, role) + add/edit flow. The system roles available for assignment are: `school-admin`, `teacher`, `guardian`. (Super-admin and student are not assignable — super-admin is global, student is set by student profile creation.)

#### Staff Profiles (HR Data)
Hangs off a staff person. Separate from membership (membership = system access, profile = employment fact).

| Setting | Type | Notes |
|---------|------|-------|
| Employee number | Text | Optional, unique per school |
| Department | Text | Optional |
| Title | Text | Optional |
| Hire date | Date | Optional |

**Config screen:** Part of the staff detail/edit view.

### 4.5 Workflow Configuration (Approval Flows)

Schools define their own approval workflows for different processes. The engine is generic — a single "define → start → decide" pipeline powers result approval, fee waivers, admissions, leave requests, and more.

| Setting | Type | Notes |
|---------|------|-------|
| Workflow key | Text | Unique identifier per school. e.g., `result-approval`, `fee-waiver-approval` |
| Steps (ordered array) | Array of `{name, approverRole}` | Each step has a display name and the role that can approve it |

**Config screen:** A list of defined workflows with a visual step builder. Each step specifies:
- Step name (e.g., "Head of Department Review", "Principal Approval")
- Approver role (e.g., `hod`, `principal`, `bursar`)

**Available approver roles:** Any of the system roles (`school-admin`, `teacher`) or custom-defined roles. The school decides the convention — common patterns include `hod`, `principal`, `vice-principal`, `bursar`, `director`.

### 4.6 Calendar Configuration

School-wide calendar events for the academic year.

| Setting | Type | Notes |
|---------|------|-------|
| Title | Text | Event name |
| Description | Text (optional) | Details |
| Start date | Date | |
| End date | Date | |
| Type | Enum | `holiday`, `exam`, `event`, `term-start`, `term-end` |

**Config screen:** Calendar view with ability to add/edit/delete events. Event types drive visual distinction (colour-coded markers).

### 4.7 Timetable Configuration

Weekly timetable per class per term.

| Setting | Type | Notes |
|---------|------|-------|
| Class | Reference | Which class this timetable is for |
| Term | Reference | Which term this timetable covers |
| Schedule | Array of days | Each day has periods with `{subjectId, subjectName?, teacherId?, teacherName?, startTime, endTime}` |

**Config screen:** Visual timetable builder. Grid layout with days as columns and time slots as rows. Each cell picks a subject and optionally a teacher. Validation: one timetable per class per term (upsert replaces the whole schedule).

### 4.8 Notification Templates

> **Note:** Template content is currently **hardcoded** in the backend handlers. Future phases will make templates configurable per school.

Current hardcoded templates:

| Template Key | Triggered By | Current Body |
|-------------|-------------|-------------|
| `guardian-invite` | Student enrolment | "A student linked to you was enrolled. Sign in to Aeon to follow their progress." |
| `payment-receipt` | Payment recorded | "Payment received: {amount} {currency}. Thank you." |

**Future config screen:** Template editor where schools can customise SMS/email content with variable placeholders like `{{studentName}}`, `{{schoolName}}`, `{{amount}}`, `{{termName}}`.

### 4.9 Membership Scope & Org-Wide Access

Each membership has two advanced settings:

| Setting | Type | Notes |
|---------|------|-------|
| Scope | JSON object | Future use — narrows what a role can touch (e.g., `{ "classes": ["JSS1A", "JSS1B"] }`). Currently ignored by the engine. |
| Org-wide | Toggle (on/off) | If on, the principal can read data across ALL schools in the organization (for org-level directors/administrators). |

**Config screen:** Part of staff add/edit. The org-wide toggle is a checkbox visible only to school-admin and above.

### 4.10 Custom Roles (Future)

The `roles` table supports school-specific custom roles in addition to the 5 system roles.

| Setting | Type | Notes |
|---------|------|-------|
| Role name | Text | Unique per school |
| Permissions | Array of strings | Currently stored but not enforced by the engine |

**Future config screen:** Custom role builder where School Admins can create roles like "Head of Department", "Bursar", "Librarian" with granular permission toggles.

### 4.11 Configuration Summary Table

| Configuration Area | Status | Screens Needed |
|-------------------|--------|---------------|
| School profile (name, slug) | Built (via super-admin) | Settings page for school-admin |
| Terms (CRUD + set current) | Built | Terms list + create/edit form |
| Subjects (CRUD) | Built | Subjects list + create form |
| Classes (CRUD + teacher assign) | Built | Classes list + create/edit form |
| Fee structures (CRUD + set default) | Built | Fee list per term + create form |
| Staff accounts + memberships | Built | Staff list + add/edit flow |
| Staff profiles (HR data) | Built | Staff detail / profile tab |
| Workflow definitions (step builder) | Built | Workflow list + step visual builder |
| Calendar events (CRUD) | Built | Calendar view + event form |
| Timetable (upsert per class/term) | Built | Visual timetable grid editor |
| Notification templates | **Not built** | Template editor (future) |
| Custom roles & permissions | **Not built** | Role builder (future) |
| Grading boundaries / config | **Not built** | Grade scale editor (future) |
| Payment provider selection | **Not built** | Provider settings (future) |
| Notification channel config | **Not built** | SMS/email provider settings (future) |
| Student number format | **Not built** | Admission settings (future) |
| General school settings (logo, address, etc.) | **Not built** | School settings page (future) |

### Flow 1: School Onboarding (Super Admin)

```
Super Admin logs in → Lists institutions → Clicks "Add School"
  → Fills: school name, admin name, admin email, admin password
  → System creates: organization + school + first school-admin account
  → Redirects to institution list with new school visible
  → Login URL shown: /s/{school-slug}
```

### Flow 2: School Setup (School Admin)

```
School Admin logs in for first time → Lands on empty dashboard
  → Creates terms (e.g., "Term 1 2026", "Term 2 2026")
  → Sets one term as current
  → Creates classes (e.g., "JSS1A", "JSS1B", "SSS3")
  → Creates subjects (e.g., "Mathematics", "English", "Biology")
  → Creates fee structures (e.g., "Tuition - NGN 50,000")
  → Marks one fee structure as default
  → School is ready for student enrolment
```

### Flow 3: Student Enrolment (The Ripple)

```
School Admin or Staff → "Add Student"
  → Fills: first name, last name, optional student number/gender/DOB,
    guardian name/phone/email, *class* + *term* (for auto-enrolment)
  → Click Save
  → Student is created AND enrolled in class+term
  → BEHIND THE SCENES (user doesn't need to know, but see it reflected):
    1. Attendance register seeded (student appears in daily register)
    2. Default fee billed to student's ledger
    3. Guardian SMS sent (if phone provided)
  → Redirect to student profile showing: personal info, class, fee balance
```

### Flow 4: Daily Attendance (Teacher)

```
Teacher logs in → Dashboard shows today's classes
  → Selects class → Sees student roster for today
  → Each student has status: unmarked (default), present, absent, late, excused
  → Tap/click to toggle status
  → "Mark All Present" button speeds up routine
  → Swipe to previous/next day to retroactively mark
```

### Flow 5: Grade Recording (Teacher)

```
Teacher logs in → Selects class → Selects subject → Sees class grade sheet
  → Each student row: name, CA score field, Exam score field
  → Enter scores (0-100 integers)
  → Save → Upserts grade record
  → If approval workflow enabled: grade goes to "pending approval" state
```

### Flow 6: Payment (Finance / Admin)

```
Admin → Selects student → Views fee balance
  → Sees: billed amount NGN 50,000, paid amount NGN 20,000, balance NGN 30,000
  → "Record Payment" button
  → Fills: amount, currency, method (cash/transfer/card/mobile-money),
    idempotency key (auto-generated or manual)
  → System creates credit entry, updates balance view
  → BEHIND THE SCENES: Payment receipt SMS sent to guardian
```

### Flow 7: Student Portal

```
Student (or guardian) → Opens student portal link (or scans QR)
  → Enters: admission number + date of birth + school slug
  → Views dashboard:
    - Current class & term
    - Attendance summary (% present)
    - Grade summary (per subject: CA, exam, total)
    - Fee balance (amount owed)
    - Timetable (if set)
    - Calendar events
```

### Flow 8: Approval Workflow (e.g., Result Approval)

```
Teacher records grades for a term
  → Principal starts a "result-approval" workflow for the grade sheet
  → Task created: "Head of Department must approve"
  → HOD logs in → Sees pending approval task → Reviews grades → Approves
  → Task created: "Principal must approve"
  → Principal logs in → Sees pending task → Reviews → Approves
  → Workflow completed → Grades are now "published"
  → (Future: results sent to student portal / SMS)
```

---

## 6. Data Entity Reference (for UI Designers)

### Core Entities

| Entity | Key Fields | UI Notes |
|--------|-----------|----------|
| **Organization** | name, slug | Top-level tenant group (a school chain/district) |
| **School** | name, slug, organization | The "tenant" — every user action is scoped to one school |
| **Account** | email, phone, password hash, status, is_super_admin | Global login identity. Not school-specific. |
| **Person** | first name, last name, DOB, account (optional), school | A human. Can be student, staff, guardian, or multiple. |
| **Membership** | person, account, school, role, status, scope, org_wide | The join: "this person is a teacher at this school" |
| **Role** | name, permissions, is_system | System roles: super-admin, school-admin, teacher, student, guardian |

### Academic Entities

| Entity | Key Fields | UI Notes |
|--------|-----------|----------|
| **Term** | name, start date, end date, is_current | Academic period. Only one term can be active/current. |
| **Class** | name, class teacher (person) | A class/arm/grade (e.g., "JSS1A") |
| **Subject** | name | School-wide (e.g., "Mathematics") |
| **Enrolment** | student, class, term, enrolled_at, unenrolled_at | Links student → class → term. One per student per term. |
| **Attendance** | student, class, term, date, status | One row per student per day per class |
| **Grade** | student, subject, term, ca_score, exam_score | One row per student per subject per term |

### Finance Entities

| Entity | Key Fields | UI Notes |
|--------|-----------|----------|
| **Fee Structure** | name, amount (minor units), currency, term, is_default | Template for what to charge |
| **Ledger Entry** | student, term, direction (debit/credit), kind (fee/payment/adjustment/refund), amount, currency, idempotency_key, meta | Append-only. Never edited or deleted. |

### Other Entities

| Entity | Key Fields | UI Notes |
|--------|-----------|----------|
| **Notification** | channel, to_address, template, body, status (queued/sent/failed) | Log of all outbound messages |
| **Calendar Event** | title, description, start/end dates, type (holiday/exam/event/term-start/term-end) | School calendar |
| **Timetable** | class, term, schedule (JSON: day + periods) | Weekly timetable per class per term |
| **Workflow Definition** | key, steps (ordered array of {name, approverRole}) | Generic approval blueprint |
| **Workflow Instance** | definition, subject_ref, state (pending/approved/rejected), current_step | One running approval process |
| **Workflow Task** | instance, step_index, approver_role, status (pending/approved/rejected), decided_by, decided_at | One pending decision |

### Event / Outbox Entity

| Entity | Key Fields | UI Notes |
|--------|-----------|----------|
| **Outbox Event** | aggregate, aggregate_id, event_type, payload, published_at | System-level. Shown in activity feed. |

---

## 7. API Endpoint Reference (for API Mocking / Data Shape)

### Authentication

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| POST | `/v1/auth/login` | School staff login | `{ email, password, schoolId?, schoolSlug? }` | `{ accessToken, accountId, displayName, active, memberships[] }` |
| GET | `/v1/auth/me` | Current user profile | — | `{ accountId, displayName, active, memberships[] }` |
| POST | `/v1/admin/auth/login` | Super admin login | `{ email, password }` | `{ accessToken, email }` |
| POST | `/v1/portal/auth/student-login` | Student portal login | `{ studentNumber, dob, schoolSlug }` | `{ accessToken, student }` |

### Institution Management (Super Admin)

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| GET | `/v1/admin/institutions` | List all schools | — | `[{ id, name, slug, orgName, totalStudents, totalStaff, createdAt }]` |
| POST | `/v1/admin/institutions` | Create a school | `{ schoolName, name, email, password }` | `{ id, name, slug, orgId, loginUrl }` |

### People

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| GET | `/v1/people/students` | List all students | — | `StudentRow[]` |
| POST | `/v1/people/students` | Create student | `{ firstName, lastName, studentNumber?, gender?, dob?, guardianName?, guardianPhone?, guardianEmail?, classId?, termId? }` | `StudentRow` (201) |
| GET | `/v1/people/staff` | List all staff | — | `StaffRow[]` |
| GET | `/v1/people/enrollments` | List active enrolments | — | `Enrollment[]` |
| POST | `/v1/people/enrollments` | Create enrolment | `{ studentId, classId, termId }` | `Enrollment` (201) |
| POST | `/v1/people/guardianships` | Link guardian | `{ guardianId, studentId, relationship? }` | `Guardianship` (201) |

### Academic Terms

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| GET | `/v1/academic/terms` | List terms | — | `Term[]` |
| GET | `/v1/academic/terms/current` | Get current term | — | `Term \| null` |
| POST | `/v1/academic/terms` | Create term | `{ name, startDate?, endDate?, isCurrent? }` | `Term` (201) |
| POST | `/v1/academic/terms/:id/set-current` | Set current term | — | `Term` |

### Classes

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| GET | `/v1/classes` | List classes | — | `ClassRow[]` (with teacher name) |
| POST | `/v1/classes` | Create class | `{ name, classTeacherId? }` | `ClassRow` (201) |

### Subjects

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| GET | `/v1/subjects` | List subjects | — | `Subject[]` |
| POST | `/v1/subjects` | Create subject | `{ name }` | `Subject` (201) |

### Attendance

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| GET | `/v1/academics/attendance` | List attendance | `?classId&date` | `Attendance[]` |
| POST | `/v1/academics/attendance/mark` | Mark one student | `{ attendanceId, status }` | `Attendance` |
| POST | `/v1/academics/attendance/bulk` | Bulk mark class | `{ classId, termId, date, records:[{studentId, status}] }` | `{ count }` |

### Grades

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| GET | `/v1/academics/grades` | Student grades | `?studentId&termId` | `Grade[]` |
| GET | `/v1/academics/grades/class` | Class grade sheet | `?classId&termId` | Sheet rows with student names + grades |
| POST | `/v1/academics/grades` | Record/upsert grade | `{ studentId, subjectId, termId, caScore, examScore }` | `Grade` (201) |

### Finance

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| GET | `/v1/finance/fee-structures` | List fee structures | `?termId` | `FeeStructure[]` |
| POST | `/v1/finance/fee-structures` | Create fee structure | `{ termId, name, amountMinor, currency, isDefault? }` | `FeeStructure` (201) |
| POST | `/v1/finance/assign` | Assign fee to student | `{ studentId, feeStructureId }` | `LedgerEntry` (201) |
| POST | `/v1/finance/payments` | Record payment | `{ studentId, termId, amountMinor, currency, idempotencyKey, method, reference? }` | `LedgerEntry` (201) |
| POST | `/v1/finance/payments/webhook/:provider` | Webhook receiver | Raw provider payload | `{ data, recorded }` |
| GET | `/v1/finance/outstanding` | Outstanding report | `?termId` | Per-student: due, paid, balance, status |
| GET | `/v1/finance/balance` | Student balance | `?studentId&termId` | `CurrencyBalance[]` |

### Calendar

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| GET | `/v1/calendar` | List events | — | `CalendarEvent[]` |
| POST | `/v1/calendar` | Create event | `{ title, description?, startDate, endDate, type }` | `CalendarEvent` (201) |
| DELETE | `/v1/calendar/:id` | Delete event | — | 204 |

### Timetable

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| GET | `/v1/timetable` | Get timetable | `?classId&termId` | `Timetable \| null` |
| POST | `/v1/timetable` | Upsert timetable | `{ classId, termId, schedule }` | `Timetable` |

### Notifications

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| GET | `/v1/notifications` | List recent notifications | — | `Notification[]` (last 50) |
| POST | `/v1/notifications/send` | Send notification | `{ channel, to, template, body }` | `Notification` (201) |

### Workflow (Approval)

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| POST | `/v1/workflows/definitions` | Define workflow | `{ key, steps:[{name, approverRole}] }` | `{ key }` (201) |
| POST | `/v1/workflows/start` | Start instance | `{ key, subjectRef }` | `{ instance, task }` (201) |
| POST | `/v1/workflows/decide` | Approve/reject task | `{ taskId, decision, deciderId? }` | `{ instance }` |

### Dashboard

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| GET | `/v1/stats` | Dashboard summary | — | `{ totalStudents, totalStaff, totalClasses, presentToday }` |
| GET | `/v1/stats/activity` | Recent activity | — | `OutboxEvent[]` (last 40) |

### Student Portal

| Method | Path | Purpose | Input | Output |
|--------|------|---------|-------|--------|
| GET | `/v1/portal/me` | Portal profile | — | `PortalStudent` |
| GET | `/v1/portal/grades` | My grades | — | Grades with subject names |
| GET | `/v1/portal/attendance` | My attendance | — | `Attendance[]` |
| GET | `/v1/portal/fees` | My fees | — | `{ entries, balances }` |

---

## 8. UI Patterns & Conventions

### Response Shape
All successful responses wrap data in `{ data: ... }`. Errors return `{ error: "message" }` or `{ error: "Validation failed", details: {...} }` (422).

### Money Display
- Always in **minor units** from the API (e.g., `50000` = NGN 500.00)
- The frontend should format for display: `NGN 500.00`
- Multi-currency is supported per student. Display balance per currency, never sum across currencies.

### Attendance Statuses
- `present` — green
- `absent` — red
- `late` — amber
- `excused` — blue/grey
- `unmarked` — light grey (default)

### Attendance Score Display
- CA score and Exam score are both 0-100 integers
- Total and letter grade are **computed on the frontend** until the grading config is built

### Date/Time
- API uses ISO 8601 strings (`"2026-06-14T10:30:00Z"`) or date strings (`"2026-06-14"`)
- Academic navigation is **term-based**, not calendar-month-based

### Enums Used in the API
```
Account status:      active, disabled
Membership status:   active, suspended
Gender:              male, female
Attendance status:   present, absent, late, excused, unmarked
Calendar event type: holiday, exam, event, term-start, term-end
Ledger direction:    debit, credit
Ledger kind:         fee, payment, adjustment, refund
Notification channel: sms, whatsapp, email
Notification status: queued, sent, failed
Workflow state:      pending, approved, rejected
Workflow task:       pending, approved, rejected
Payment method:      cash, transfer, card, mobile-money
Org-wide:            on, off
```

### System Roles (seeded)
```
super-admin, school-admin, teacher, student, guardian
```

### Workflow Approver Roles (example — school defines these)
```
hod, principal, bursar, director
```

---

## 9. What's NOT Yet Built (Phase 4+ Tail)

These features are on the roadmap but do NOT have backend endpoints yet. Design with them in mind but don't expect data:

1. **Guardian-specific portal** — Separate login for guardians to view multiple children. Currently guardians receive SMS but must use the student portal (student number + DOB) to log in.
2. **SaaS billing / plan management** — Usage-based or per-student pricing tiers.
3. **Public API + webhooks** — For third-party integrations. Currently webhooks are inbound (payment gateways). Outbound webhooks not built.
4. **Read replica / reporting** — Dedicated reporting database for complex analytics.
5. **Grading configuration** — Configurable grade boundaries (e.g., A = 70+, B = 60-69) stored as data rather than code.
6. **Fee waiver approval workflow** — Workflow engine exists but no domain module uses it yet.
7. **Admission approval workflow** — Same, workflow engine wired up but admission module not built.
8. **Bulk student import** — CSV/Excel upload for large cohorts.
9. **Real payment providers** — Currently stubbed. Paystack, Flutterwave, Stripe implementations are TODO.
10. **Real SMS/email providers** — Currently logging. Termii, Africa's Talking, AWS SES implementations are TODO.
11. **File/attachment upload** — No document management yet.
12. **Communication / messaging** — No in-app messaging or discussion threads.
13. **Lesson notes / lesson plans** — Not in scope yet.
14. **Behavior / discipline tracking** — Not in scope yet.
15. **Transport / bus routing** — Not in scope yet.
16. **Library management** — Not in scope yet.

---

## 10. Design Constraints

- **Mobile-first for student/guardian portal** — Many users access via low-end smartphones.
- **Desktop-first for admin/teacher dashboard** — High information density expected.
- **Responsive** — The portal should work on both.
- **Offline resilience** — Future consideration (PWA). Not required now.
- **Print styles** — Class sheets, fee reports, report cards are commonly printed.
- **Accessibility** — Aim for WCAG 2.1 AA. Colour should not be the only differentiator (patterns + labels as backup).
- **Loading states** — API responses are fast (local Postgres) but spinners/skeletons are expected.
- **Empty states** — Every list view should show a helpful empty state with a CTA (e.g., "No students yet. Add your first student.").
- **Error states** — Validation errors come as `422` with per-field details. Show inline validation messages.
