// db.js
// Lightweight JSON-file data layer. Swap this module for a real Postgres/Supabase
// client later without changing the route files — every function below is the
// contract the routes rely on (see docs/DATABASE.md).

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

function nowISO() {
  return new Date().toISOString();
}

function nextId(rows) {
  return rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(require('./seed-data.js'), null, 2));
  }
}

function load() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function save(db) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function reset() {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(require('./seed-data.js'), null, 2));
  return load();
}

/* ---------------------------- Students ---------------------------- */

function listStudents(schoolId) {
  const db = load();
  return db.students.filter((s) => s.schoolId === schoolId);
}

function findStudentByAdmission(schoolId, admissionNo) {
  const db = load();
  return db.students.find(
    (s) => s.schoolId === schoolId && s.admissionNo.toUpperCase() === admissionNo.toUpperCase()
  );
}

function addStudent(schoolId, { name, className, admissionNo, parentPhone, expected }) {
  const db = load();
  const student = {
    id: nextId(db.students),
    schoolId,
    name,
    className,
    admissionNo,
    parentPhone: parentPhone || null,
    expected: Number(expected) || 0,
    paid: 0,
    balance: Number(expected) || 0,
    createdAt: nowISO(),
  };
  db.students.push(student);
  addAuditLog(db, { schoolId, userId: null, action: 'STUDENT_CREATED', entity: `student:${student.id}`, before: null, after: student });
  save(db);
  return student;
}

/* ------------------------ Student search (public) ------------------------ */
// Used by the parent portal when a family doesn't have the admission number
// to hand. `admissionNo`, if given, is treated as authoritative and matched
// exactly; otherwise `name` and `className` are matched as case-insensitive
// substrings. Results are capped so a very common name doesn't return a huge
// list.
function searchStudents(schoolId, { name, className, admissionNo } = {}) {
  const db = load();
  let rows = db.students.filter((s) => s.schoolId === schoolId);

  if (admissionNo && admissionNo.trim()) {
    const needle = admissionNo.trim().toUpperCase();
    return rows.filter((s) => s.admissionNo.toUpperCase() === needle).slice(0, 10);
  }

  if (name && name.trim()) {
    const needle = name.trim().toLowerCase();
    rows = rows.filter((s) => s.name.toLowerCase().includes(needle));
  }
  if (className && className.trim()) {
    const needle = className.trim().toLowerCase();
    rows = rows.filter((s) => s.className.toLowerCase().includes(needle));
  }
  return rows.slice(0, 10);
}

/* ---------------------------- Payments ----------------------------- */

function listPayments(schoolId) {
  const db = load();
  return db.payments
    .filter((p) => p.schoolId === schoolId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Simulates an inbound M-Pesa C2B confirmation being reconciled.
// `reference` is whatever the payer typed as the account number — in
// production this is the Daraja C2B callback's BillRefNumber.
function receivePayment(schoolId, { reference, payerPhone, amount }) {
  const db = load();
  const student = db.students.find(
    (s) => s.schoolId === schoolId && s.admissionNo.toUpperCase() === String(reference || '').toUpperCase()
  );

  const payment = {
    id: nextId(db.payments),
    schoolId,
    reference: `SFT${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    accountReference: reference || null,
    payerPhone: payerPhone || null,
    amount: Number(amount) || 0,
    status: student ? 'matched' : 'unmatched',
    studentId: student ? student.id : null,
    createdAt: nowISO(),
  };
  db.payments.push(payment);

  if (student) {
    const before = { paid: student.paid, balance: student.balance };
    student.paid += payment.amount;
    student.balance = Math.max(0, student.balance - payment.amount);
    addAuditLog(db, {
      schoolId,
      userId: null,
      action: 'PAYMENT_RECONCILED',
      entity: `student:${student.id}`,
      before,
      after: { paid: student.paid, balance: student.balance },
    });
    addNotification(db, {
      schoolId,
      studentId: student.id,
      type: 'payment_confirmation',
      message: `ElimuPay: Payment of KSh ${payment.amount} received for ${student.name}, ${student.className}. Amount paid this term: KSh ${student.paid}. Remaining balance: KSh ${student.balance}.`,
    });
  }

  save(db);
  return payment;
}

function reconcilePaymentManually(schoolId, paymentId, studentId) {
  const db = load();
  const payment = db.payments.find((p) => p.id === Number(paymentId) && p.schoolId === schoolId);
  if (!payment) return null;
  const student = db.students.find((s) => s.id === Number(studentId) && s.schoolId === schoolId);
  if (!student) return null;

  const before = { paid: student.paid, balance: student.balance };
  student.paid += payment.amount;
  student.balance = Math.max(0, student.balance - payment.amount);
  payment.status = 'matched';
  payment.studentId = student.id;

  addAuditLog(db, {
    schoolId,
    userId: null,
    action: 'PAYMENT_MANUALLY_RECONCILED',
    entity: `payment:${payment.id}`,
    before,
    after: { paid: student.paid, balance: student.balance },
  });

  save(db);
  return payment;
}

/* --------------------------- Notifications -------------------------- */

function addNotification(db, { schoolId, studentId, type, message }) {
  db.notifications.push({
    id: nextId(db.notifications),
    schoolId,
    studentId,
    type,
    message,
    deliveryStatus: 'queued',
    createdAt: nowISO(),
  });
}

function listReminders(schoolId) {
  const db = load();
  return db.reminderSettings.filter((r) => r.schoolId === schoolId);
}

function toggleReminder(schoolId, reminderId, enabled) {
  const db = load();
  const reminder = db.reminderSettings.find((r) => r.id === Number(reminderId) && r.schoolId === schoolId);
  if (!reminder) return null;
  reminder.enabled = !!enabled;
  save(db);
  return reminder;
}

/* ------------------------------ Reports ------------------------------ */

function dashboardStats(schoolId) {
  const db = load();
  const students = db.students.filter((s) => s.schoolId === schoolId);
  const payments = db.payments.filter((p) => p.schoolId === schoolId);

  const expected = students.reduce((sum, s) => sum + s.expected, 0);
  const collected = students.reduce((sum, s) => sum + s.paid, 0);
  const outstanding = students.reduce((sum, s) => sum + s.balance, 0);

  const today = new Date().toDateString();
  const todaysPayments = payments.filter((p) => new Date(p.createdAt).toDateString() === today && p.status === 'matched');
  const todaysCollection = todaysPayments.reduce((sum, p) => sum + p.amount, 0);

  const fullyPaid = students.filter((s) => s.balance === 0).length;
  const partial = students.filter((s) => s.balance > 0 && s.paid > 0).length;
  const outstandingCount = students.filter((s) => s.paid === 0).length;

  return {
    totalStudents: students.length,
    expected,
    collected,
    outstanding,
    todaysCollection,
    todaysTransactionCount: todaysPayments.length,
    feeStatus: { fullyPaid, partial, outstanding: outstandingCount },
    recentPayments: payments
      .filter((p) => p.status === 'matched')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6)
      .map((p) => {
        const student = students.find((s) => s.id === p.studentId);
        return { student: student ? student.name : 'Unknown', className: student ? student.className : '', amount: p.amount };
      }),
  };
}

function generateReport(schoolId, reportType) {
  const db = load();
  const students = db.students.filter((s) => s.schoolId === schoolId);
  const payments = db.payments.filter((p) => p.schoolId === schoolId);

  switch (reportType) {
    case 'daily-collection': {
      const today = new Date().toDateString();
      const rows = payments.filter((p) => new Date(p.createdAt).toDateString() === today && p.status === 'matched');
      const total = rows.reduce((s, p) => s + p.amount, 0);
      return { reportType, generatedAt: nowISO(), summary: `KSh ${total} collected across ${rows.length} transactions today.`, rows };
    }
    case 'outstanding-fees': {
      const rows = students.filter((s) => s.balance > 0);
      const total = rows.reduce((s, st) => s + st.balance, 0);
      return { reportType, generatedAt: nowISO(), summary: `${rows.length} students owe a combined KSh ${total}.`, rows };
    }
    case 'unmatched-payments': {
      const rows = payments.filter((p) => p.status === 'unmatched');
      const total = rows.reduce((s, p) => s + p.amount, 0);
      return { reportType, generatedAt: nowISO(), summary: `${rows.length} payments unmatched, totalling KSh ${total}.`, rows };
    }
    case 'term-collection': {
      const rows = payments.filter((p) => p.status === 'matched');
      const total = rows.reduce((s, p) => s + p.amount, 0);
      return { reportType, generatedAt: nowISO(), summary: `KSh ${total} collected this term across ${rows.length} transactions.`, rows };
    }
    default:
      return { reportType, generatedAt: nowISO(), summary: 'Unknown report type.', rows: [] };
  }
}

function studentStatement(schoolId, admissionNo) {
  const student = findStudentByAdmission(schoolId, admissionNo);
  if (!student) return null;
  const db = load();
  const history = db.payments
    .filter((p) => p.studentId === student.id && p.status === 'matched')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((p) => ({ amount: p.amount, date: p.createdAt, reference: p.reference }));
  return { student, history };
}

/* ----------------------------- Audit log ------------------------------ */

function addAuditLog(db, { schoolId, userId, action, entity, before, after }) {
  db.auditLogs.push({
    id: nextId(db.auditLogs),
    schoolId,
    userId,
    action,
    entity,
    before,
    after,
    at: nowISO(),
  });
}

// Admin view — one school only. (Earlier versions of this function ignored
// schoolId entirely, which would have leaked every school's history to any
// signed-in admin once a second school existed — fixed here.)
function listAuditLogs(schoolId) {
  const db = load();
  return db.auditLogs
    .filter((a) => a.schoolId === schoolId)
    .slice(-100)
    .reverse();
}

// Superadmin view — every school, for platform-wide oversight.
function listAllAuditLogs() {
  const db = load();
  return db.auditLogs.slice(-200).reverse();
}

/* -------------------------------- Auth -------------------------------- */

function findUserByEmail(email) {
  const db = load();
  return db.users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
}

function getSchool(schoolId) {
  const db = load();
  return db.schools.find((s) => s.id === Number(schoolId));
}

/* -------------------------------- Leads -------------------------------- */

function addLead({ name, schoolName, phone, email, studentCount, message }) {
  const db = load();
  const lead = {
    id: nextId(db.leads || []),
    name,
    schoolName,
    phone,
    email: email || null,
    studentCount: studentCount || null,
    message: message || null,
    status: 'new',
    createdAt: nowISO(),
  };
  if (!db.leads) db.leads = [];
  db.leads.push(lead);
  save(db);
  return lead;
}

function listLeads() {
  const db = load();
  return (db.leads || []).slice().reverse();
}

function updateLeadStatus(leadId, status) {
  const db = load();
  const lead = (db.leads || []).find((l) => l.id === Number(leadId));
  if (!lead) return null;
  lead.status = status;
  save(db);
  return lead;
}

/* ------------------------------ Schools -------------------------------- */

// Public: used by the parent portal's "find your school" search. Only
// active schools are discoverable this way — a suspended school shouldn't
// show up for parents trying to pay into it.
function searchSchools(query) {
  const db = load();
  const needle = String(query || '').trim().toLowerCase();
  let rows = db.schools.filter((s) => s.status === 'active');
  if (needle) {
    rows = rows.filter((s) => s.name.toLowerCase().includes(needle));
  }
  return rows.slice(0, 10).map((s) => ({ id: s.id, name: s.name, county: s.county }));
}

// Superadmin: every school regardless of status, with a rollup of each
// school's own numbers so the platform view doesn't need N extra requests.
function listSchoolsWithStats() {
  const db = load();
  return db.schools.map((school) => {
    const students = db.students.filter((s) => s.schoolId === school.id);
    const expected = students.reduce((sum, s) => sum + s.expected, 0);
    const collected = students.reduce((sum, s) => sum + s.paid, 0);
    const outstanding = students.reduce((sum, s) => sum + s.balance, 0);
    return {
      id: school.id,
      name: school.name,
      county: school.county,
      plan: school.plan,
      paybillNumber: school.paybillNumber,
      status: school.status,
      createdAt: school.createdAt,
      totalStudents: students.length,
      collected,
      expected,
      outstanding,
    };
  });
}

function platformOverview() {
  const db = load();
  const activeSchools = db.schools.filter((s) => s.status === 'active');
  const collected = db.students.reduce((sum, s) => sum + s.paid, 0);
  const outstanding = db.students.reduce((sum, s) => sum + s.balance, 0);
  return {
    totalSchools: db.schools.length,
    activeSchools: activeSchools.length,
    suspendedSchools: db.schools.length - activeSchools.length,
    totalStudents: db.students.length,
    totalCollected: collected,
    totalOutstanding: outstanding,
    newLeads: (db.leads || []).filter((l) => l.status === 'new').length,
  };
}

function generateTempPassword() {
  return 'Elimu-' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10);
}

// Onboards a new school and its first admin account in one step — this is
// the concrete "grant a school access" action behind the superadmin's
// "add school" form. Returns the plaintext password once, since only the
// bcrypt hash is kept from here on.
function createSchool({ name, county, paybillNumber, plan, adminName, adminEmail, adminPassword }) {
  const bcrypt = require('bcryptjs');
  const db = load();

  const school = {
    id: nextId(db.schools),
    name,
    county: county || null,
    plan: plan || 'Starter',
    paybillNumber: paybillNumber || null,
    status: 'active',
    createdAt: nowISO(),
  };
  db.schools.push(school);

  const plainPassword = adminPassword && adminPassword.trim() ? adminPassword.trim() : generateTempPassword();
  const user = {
    id: nextId(db.users),
    schoolId: school.id,
    name: adminName,
    email: adminEmail,
    passwordHash: bcrypt.hashSync(plainPassword, 10),
    role: 'admin',
  };
  db.users.push(user);

  addAuditLog(db, { schoolId: school.id, userId: null, action: 'SCHOOL_ONBOARDED', entity: `school:${school.id}`, before: null, after: school });
  save(db);
  return { school, adminEmail: user.email, adminPassword: plainPassword };
}

// Suspend, reactivate, or edit a school's details.
function updateSchool(schoolId, patch) {
  const db = load();
  const school = db.schools.find((s) => s.id === Number(schoolId));
  if (!school) return null;
  const before = Object.assign({}, school);

  if (patch.status && ['active', 'suspended'].includes(patch.status)) school.status = patch.status;
  if (patch.name) school.name = patch.name;
  if (patch.county !== undefined) school.county = patch.county;
  if (patch.plan) school.plan = patch.plan;
  if (patch.paybillNumber !== undefined) school.paybillNumber = patch.paybillNumber;

  addAuditLog(db, { schoolId: school.id, userId: null, action: 'SCHOOL_UPDATED', entity: `school:${school.id}`, before, after: school });
  save(db);
  return school;
}

// Permanently removes a school and everything scoped to it. Used when a
// school "doesn't meet expectations" and suspension isn't enough.
function deleteSchool(schoolId) {
  const db = load();
  const id = Number(schoolId);
  const school = db.schools.find((s) => s.id === id);
  if (!school) return null;

  db.schools = db.schools.filter((s) => s.id !== id);
  db.students = db.students.filter((s) => s.schoolId !== id);
  db.payments = db.payments.filter((p) => p.schoolId !== id);
  db.users = db.users.filter((u) => u.schoolId !== id);
  db.reminderSettings = db.reminderSettings.filter((r) => r.schoolId !== id);
  db.notifications = db.notifications.filter((n) => n.schoolId !== id);
  // Audit log entries are kept for the deleted school as a permanent record
  // of the fact it existed and was removed — only future access is cut off.
  addAuditLog(db, { schoolId: null, userId: null, action: 'SCHOOL_DELETED', entity: `school:${id}`, before: school, after: null });
  save(db);
  return school;
}

/* ------------------------- Platform / versioning ------------------------- */

function getPlatformInfo() {
  const db = load();
  const platform = db.platform || { maintenanceMode: false, versions: [] };
  const versions = (platform.versions || []).slice().sort((a, b) => new Date(b.releasedAt) - new Date(a.releasedAt));
  return {
    maintenanceMode: !!platform.maintenanceMode,
    current: versions[0] || null,
    history: versions,
  };
}

function addPlatformVersion({ version, notes }) {
  const db = load();
  if (!db.platform) db.platform = { maintenanceMode: false, versions: [] };
  const entry = {
    id: nextId(db.platform.versions || []),
    version,
    notes: notes || '',
    releasedAt: nowISO(),
  };
  db.platform.versions.push(entry);
  save(db);
  return entry;
}

function setMaintenanceMode(enabled) {
  const db = load();
  if (!db.platform) db.platform = { maintenanceMode: false, versions: [] };
  db.platform.maintenanceMode = !!enabled;
  save(db);
  return db.platform.maintenanceMode;
}

module.exports = {
  load,
  save,
  reset,
  listStudents,
  findStudentByAdmission,
  addStudent,
  searchStudents,
  listPayments,
  receivePayment,
  reconcilePaymentManually,
  listReminders,
  toggleReminder,
  dashboardStats,
  generateReport,
  studentStatement,
  listAuditLogs,
  listAllAuditLogs,
  findUserByEmail,
  getSchool,
  addLead,
  listLeads,
  updateLeadStatus,
  searchSchools,
  listSchoolsWithStats,
  platformOverview,
  createSchool,
  updateSchool,
  deleteSchool,
  getPlatformInfo,
  addPlatformVersion,
  setMaintenanceMode,
};
