// seed-data.js
// Initial dataset: two pilot schools (so multi-school search/oversight has
// something real to show), plus one platform-owner (superadmin) account.
// Running `npm run seed` in backend/ regenerates data/db.json from this file.

const students = [
  // Bungoma Hill Academy (schoolId 1)
  { id: 1, schoolId: 1, name: 'Brian Wekesa', className: 'Class 3', admissionNo: 'BHA-014', parentPhone: '254712000014', expected: 10000, paid: 8000, balance: 2000, createdAt: '2026-05-04T08:00:00.000Z' },
  { id: 2, schoolId: 1, name: 'Mary Achieng', className: 'Class 6', admissionNo: 'BHA-027', parentPhone: '254712000027', expected: 12000, paid: 12000, balance: 0, createdAt: '2026-05-04T08:00:00.000Z' },
  { id: 3, schoolId: 1, name: 'John Barasa', className: 'Class 4', admissionNo: 'BHA-005', parentPhone: '254712000005', expected: 10000, paid: 6600, balance: 3400, createdAt: '2026-05-04T08:00:00.000Z' },
  { id: 4, schoolId: 1, name: 'Faith Nafula', className: 'Class 2', admissionNo: 'BHA-032', parentPhone: '254712000032', expected: 9000, paid: 8100, balance: 900, createdAt: '2026-05-04T08:00:00.000Z' },
  { id: 5, schoolId: 1, name: 'Kevin Simiyu', className: 'Class 7', admissionNo: 'BHA-041', parentPhone: '254712000041', expected: 13000, paid: 13000, balance: 0, createdAt: '2026-05-04T08:00:00.000Z' },
  { id: 6, schoolId: 1, name: 'Diana Nekesa', className: 'Class 5', admissionNo: 'BHA-019', parentPhone: '254712000019', expected: 11000, paid: 3000, balance: 8000, createdAt: '2026-05-04T08:00:00.000Z' },
  { id: 7, schoolId: 1, name: 'Peter Wafula', className: 'Class 1', admissionNo: 'BHA-052', parentPhone: '254712000052', expected: 8000, paid: 0, balance: 8000, createdAt: '2026-05-04T08:00:00.000Z' },
  { id: 8, schoolId: 1, name: 'Sharon Chebet', className: 'Class 8', admissionNo: 'BHA-008', parentPhone: '254712000008', expected: 14000, paid: 14000, balance: 0, createdAt: '2026-05-04T08:00:00.000Z' },

  // Sunrise Academy (schoolId 2) — second school, for multi-tenant testing
  { id: 9, schoolId: 2, name: 'Brian Kiptoo', className: 'Class 3', admissionNo: 'SUA-101', parentPhone: '254733000101', expected: 9500, paid: 4500, balance: 5000, createdAt: '2026-05-10T08:00:00.000Z' },
  { id: 10, schoolId: 2, name: 'Esther Nanjala', className: 'Class 2', admissionNo: 'SUA-102', parentPhone: '254733000102', expected: 8500, paid: 8500, balance: 0, createdAt: '2026-05-10T08:00:00.000Z' },
  { id: 11, schoolId: 2, name: 'Brian Otieno', className: 'Class 5', admissionNo: 'SUA-103', parentPhone: '254733000103', expected: 11000, paid: 2000, balance: 9000, createdAt: '2026-05-10T08:00:00.000Z' }
];

const payments = [
  { id: 1, schoolId: 1, reference: 'SFT2K9L3M1', accountReference: 'BHA-014', payerPhone: '254712000014', amount: 500, status: 'matched', studentId: 1, createdAt: new Date().toISOString() },
  { id: 2, schoolId: 1, reference: 'SFT2K9R2S8', accountReference: 'BHA-027', payerPhone: '254712000027', amount: 2000, status: 'matched', studentId: 2, createdAt: new Date().toISOString() },
  { id: 3, schoolId: 1, reference: 'SFT2K9P7Q4', accountReference: '0712345XXX', payerPhone: '254712345678', amount: 1000, status: 'unmatched', studentId: null, createdAt: new Date().toISOString() },
  { id: 4, schoolId: 1, reference: 'SFT2K9T5U6', accountReference: '0722987XXX', payerPhone: '254722987654', amount: 300, status: 'unmatched', studentId: null, createdAt: new Date().toISOString() },
  { id: 5, schoolId: 2, reference: 'SFT3L1A2B3', accountReference: 'SUA-102', payerPhone: '254733000102', amount: 8500, status: 'matched', studentId: 10, createdAt: new Date().toISOString() }
];

const reminderSettings = [
  { id: 1, schoolId: 1, key: 'weekly_balance_reminder', label: 'Weekly balance reminder', description: 'Sent every Monday to parents with an outstanding balance.', enabled: true },
  { id: 2, schoolId: 1, key: 'payment_confirmation', label: 'Payment confirmation', description: 'Sent immediately after every payment is reconciled.', enabled: true },
  { id: 3, schoolId: 1, key: 'end_of_term_notice', label: 'End-of-term notice', description: 'Sent two weeks before the term closes to unpaid accounts.', enabled: false },
  { id: 4, schoolId: 2, key: 'weekly_balance_reminder', label: 'Weekly balance reminder', description: 'Sent every Monday to parents with an outstanding balance.', enabled: true },
  { id: 5, schoolId: 2, key: 'payment_confirmation', label: 'Payment confirmation', description: 'Sent immediately after every payment is reconciled.', enabled: true },
  { id: 6, schoolId: 2, key: 'end_of_term_notice', label: 'End-of-term notice', description: 'Sent two weeks before the term closes to unpaid accounts.', enabled: false }
];

module.exports = {
  schools: [
    { id: 1, name: 'Bungoma Hill Academy', county: 'Bungoma', plan: 'School', paybillNumber: '400200', status: 'active', createdAt: '2026-05-01T08:00:00.000Z' },
    { id: 2, name: 'Sunrise Academy', county: 'Bungoma', plan: 'Starter', paybillNumber: '400555', status: 'active', createdAt: '2026-05-08T08:00:00.000Z' }
  ],
  users: [
    {
      id: 1,
      schoolId: 1,
      name: 'Administrator',
      email: 'admin@bungomahill.ac.ke',
      // Password: ElimuPay2026!  (see README "Demo administrator login")
      passwordHash: '$2b$10$p9UhwqozqHLi8gXjy4v09eqjGfzwmfrHSaPVWV3utbmDUa3.kKjky',
      role: 'admin'
    },
    {
      id: 2,
      schoolId: 2,
      name: 'Sunrise Admin',
      email: 'admin@sunriseacademy.ac.ke',
      // Password: SunriseAdmin2026!
      passwordHash: '$2b$10$R2kbI8ZXg2dgk8gaSutATeVDz0tJQpE2QwJKazomGZplazGjgBskC',
      role: 'admin'
    },
    {
      id: 3,
      schoolId: null,
      name: 'ElimuPay Founder',
      email: 'founder@elimupay.co.ke',
      // Password: FounderAccess2026!  (see README "Signing in as the platform administrator")
      passwordHash: '$2b$10$XhQvUmDT0QB3f.UPVZiFY.v3EVMk0hQF85R9Fp8HPGFsd8P9P4v6.',
      role: 'superadmin'
    }
  ],
  students,
  payments,
  notifications: [],
  reminderSettings,
  auditLogs: [],
  leads: [],
  platform: {
    maintenanceMode: false,
    versions: [
      { id: 1, version: '1.0.0', notes: 'Initial pilot release: fee reconciliation, admin dashboard, parent portal.', releasedAt: '2026-09-01T08:00:00.000Z' }
    ]
  }
};
