import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  role: text('role').notNull().default('student'), // 'admin' | 'teacher' | 'student' | 'parent'
  avatarUrl: text('avatar_url'),
  isEmailVerified: boolean('is_email_verified').notNull().default(false),
  isPhoneVerified: boolean('is_phone_verified').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  resetTokenHash: text('reset_token_hash'),
  resetTokenExpiresAt: timestamp('reset_token_expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// 2. teacher_profiles
export const teacherProfiles = pgTable('teacher_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  birthDate: text('birth_date'),
  lastEducation: text('last_education').notNull(),
  institution: text('institution').notNull(),
  major: text('major').notNull(),
  graduationYear: integer('graduation_year'),
  educationLevels: jsonb('education_levels').$type<string[]>().notNull().default([]),
  experienceYears: integer('experience_years').notNull().default(1),
  bio: text('bio').notNull(),
  idDocumentUrl: text('id_document_url'),
  diplomaDocumentUrl: text('diploma_document_url'),
  certificateDocumentUrl: text('certificate_document_url'),
  verificationStatus: text('verification_status').notNull().default('submitted'),
  // 'draft' | 'submitted' | 'under_review' | 'revision_required' | 'approved' | 'active' | 'suspended' | 'rejected'
  revisionNotes: text('revision_notes'),
  ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }).notNull().default('5.00'),
  totalReviews: integer('total_reviews').notNull().default(0),
  totalSessions: integer('total_sessions').notNull().default(0),
  teachingDurationOptions: jsonb('teaching_duration_options').$type<number[]>().notNull().default([60, 90]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. student_profiles
export const studentProfiles = pgTable('student_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  educationLevel: text('education_level').notNull().default('SMA/SMK'), // 'SD' | 'SMP' | 'SMA/SMK' | 'Mahasiswa'
  schoolName: text('school_name'),
  grade: text('grade'),
  birthDate: text('birth_date'),
  learningGoals: text('learning_goals'),
  parentalConsentGiven: boolean('parental_consent_given').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. guardian_relationships
export const guardianRelationships = pgTable(
  'guardian_relationships',
  {
    id: serial('id').primaryKey(),
    parentUserId: integer('parent_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    studentUserId: integer('student_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    relationshipType: text('relationship_type').notNull().default('Orang Tua'),
    verificationStatus: text('verification_status').notNull().default('pending'), // 'pending' | 'verified' | 'rejected'
    approvalNotes: text('approval_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('guardian_parent_student_idx').on(table.parentUserId, table.studentUserId)]
);

// 5. subjects
export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. teacher_subjects
export const teacherSubjects = pgTable(
  'teacher_subjects',
  {
    id: serial('id').primaryKey(),
    teacherProfileId: integer('teacher_profile_id')
      .references(() => teacherProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id, { onDelete: 'cascade' })
      .notNull(),
    educationLevels: jsonb('education_levels').$type<string[]>().notNull().default([]),
  },
  (table) => [uniqueIndex('teacher_subject_unique_idx').on(table.teacherProfileId, table.subjectId)]
);

// 7. pricing_plans
export const pricingPlans = pgTable('pricing_plans', {
  id: serial('id').primaryKey(),
  subjectId: integer('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
  educationLevel: text('education_level').notNull(), // 'SD' | 'SMP' | 'SMA/SMK' | 'Mahasiswa'
  durationMinutes: integer('duration_minutes').notNull(), // 60 | 90
  studentPrice: integer('student_price').notNull(),
  teacherSharePercent: integer('teacher_share_percent').notNull().default(75),
  platformCommissionPercent: integer('platform_commission_percent').notNull().default(25),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. teacher_schedules
export const teacherSchedules = pgTable('teacher_schedules', {
  id: serial('id').primaryKey(),
  teacherProfileId: integer('teacher_profile_id')
    .references(() => teacherProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  dayOfWeek: integer('day_of_week').notNull(), // 0 (Minggu) - 6 (Sabtu)
  startTime: text('start_time').notNull(), // 'HH:MM'
  endTime: text('end_time').notNull(), // 'HH:MM'
  isAvailable: boolean('is_available').notNull().default(true),
});

// 9. bookings
export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  bookingCode: text('booking_code').notNull().unique(),
  studentUserId: integer('student_user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  teacherProfileId: integer('teacher_profile_id')
    .references(() => teacherProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  subjectId: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'restrict' })
    .notNull(),
  pricingPlanId: integer('pricing_plan_id').references(() => pricingPlans.id, { onDelete: 'set null' }),
  educationLevel: text('education_level').notNull(),
  sessionDate: text('session_date').notNull(), // 'YYYY-MM-DD'
  startTime: text('start_time').notNull(), // 'HH:MM'
  endTime: text('end_time').notNull(), // 'HH:MM'
  durationMinutes: integer('duration_minutes').notNull(),
  status: text('status').notNull().default('pending'),
  // 'pending' | 'accepted' | 'rejected' | 'awaiting_payment' | 'paid' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'refunded'
  studentPriceSnapshot: integer('student_price_snapshot').notNull(),
  teacherEarningSnapshot: integer('teacher_earning_snapshot').notNull(),
  platformCommissionSnapshot: integer('platform_commission_snapshot').notNull(),
  teacherSharePercentSnapshot: integer('teacher_share_percent_snapshot').notNull(),
  notes: text('notes'),
  rejectionReason: text('rejection_reason'),
  paymentDeadlineAt: timestamp('payment_deadline_at'),
  parentApproved: boolean('parent_approved').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 10. payments
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id')
    .references(() => bookings.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  externalRef: text('external_ref').notNull().unique(),
  paymentMethod: text('payment_method').notNull(), // 'QRIS' | 'Virtual Account' | 'Transfer Bank' | 'E-Wallet'
  gatewayProvider: text('gateway_provider').notNull().default('JumpaPay Sandbox'),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'paid' | 'expired' | 'failed' | 'refunded'
  paymentUrl: text('payment_url'),
  vaNumber: text('va_number'),
  webhookPayload: jsonb('webhook_payload'),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 11. learning_sessions
export const learningSessions = pgTable('learning_sessions', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id')
    .references(() => bookings.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  roomCode: text('room_code').notNull().unique(),
  meetingProvider: text('meeting_provider').notNull().default('JumpaMeet WebRTC Room'),
  teacherAttendedAt: timestamp('teacher_attended_at'),
  studentAttendedAt: timestamp('student_attended_at'),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  status: text('status').notNull().default('scheduled'), // 'scheduled' | 'live' | 'completed' | 'cancelled'
  materials: jsonb('materials')
    .$type<Array<{ id: string; title: string; type: string; urlOrNote: string; addedBy: string }>>()
    .notNull()
    .default([]),
  chatMessages: jsonb('chat_messages')
    .$type<Array<{ id: string; senderName: string; senderRole: string; message: string; sentAt: string }>>()
    .notNull()
    .default([]),
  summaryNotes: text('summary_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 12. teacher_wallets
export const teacherWallets = pgTable('teacher_wallets', {
  id: serial('id').primaryKey(),
  teacherProfileId: integer('teacher_profile_id')
    .references(() => teacherProfiles.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  totalEarned: integer('total_earned').notNull().default(0),
  pendingBalance: integer('pending_balance').notNull().default(0),
  availableBalance: integer('available_balance').notNull().default(0),
  totalWithdrawn: integer('total_withdrawn').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 13. bank_accounts (defined before withdrawalRequests so FK works cleanly)
export const bankAccounts = pgTable('bank_accounts', {
  id: serial('id').primaryKey(),
  teacherProfileId: integer('teacher_profile_id')
    .references(() => teacherProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  bankName: text('bank_name').notNull(),
  accountNumber: text('account_number').notNull(),
  accountHolderName: text('account_holder_name').notNull(),
  isVerified: boolean('is_verified').notNull().default(false),
  isPrimary: boolean('is_primary').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 14. withdrawal_requests
export const withdrawalRequests = pgTable('withdrawal_requests', {
  id: serial('id').primaryKey(),
  teacherProfileId: integer('teacher_profile_id')
    .references(() => teacherProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  bankAccountId: integer('bank_account_id')
    .references(() => bankAccounts.id, { onDelete: 'restrict' })
    .notNull(),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('requested'), // 'requested' | 'processing' | 'paid' | 'failed' | 'reversed'
  payoutReference: text('payout_reference').unique(),
  processedByUserId: integer('processed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes'),
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
});

// 15. wallet_transactions
export const walletTransactions = pgTable('wallet_transactions', {
  id: serial('id').primaryKey(),
  walletId: integer('wallet_id')
    .references(() => teacherWallets.id, { onDelete: 'cascade' })
    .notNull(),
  bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  withdrawalId: integer('withdrawal_id').references(() => withdrawalRequests.id, { onDelete: 'set null' }),
  type: text('type').notNull(), // 'credit_earning' | 'debit_withdrawal' | 'reversal' | 'adjustment'
  amount: integer('amount').notNull(),
  balanceBefore: integer('balance_before').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  description: text('description').notNull(),
  referenceCode: text('reference_code').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 16. reviews
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id')
    .references(() => bookings.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  studentUserId: integer('student_user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  teacherProfileId: integer('teacher_profile_id')
    .references(() => teacherProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  rating: integer('rating').notNull(),
  comment: text('comment').notNull(),
  isPublished: boolean('is_published').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 17. notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'), // 'booking' | 'payment' | 'verification' | 'withdrawal' | 'info'
  relatedUrl: text('related_url'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. complaints
export const complaints = pgTable('complaints', {
  id: serial('id').primaryKey(),
  reporterUserId: integer('reporter_user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  category: text('category').notNull().default('Layanan'),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('open'), // 'open' | 'investigating' | 'resolved' | 'closed'
  adminResponse: text('admin_response'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 19. agreements
export const agreements = pgTable('agreements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  agreementType: text('agreement_type').notNull(), // 'terms_of_service' | 'teacher_partnership' | 'parent_consent'
  version: text('version').notNull().default('1.0'),
  acceptedAt: timestamp('accepted_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
});

// 20. audit_logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Supporting tables for Favorite Teachers & Website Settings
export const favoriteTeachers = pgTable(
  'favorite_teachers',
  {
    id: serial('id').primaryKey(),
    studentUserId: integer('student_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    teacherProfileId: integer('teacher_profile_id')
      .references(() => teacherProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('favorite_student_teacher_idx').on(table.studentUserId, table.teacherProfileId)]
);

export const siteSettings = pgTable('site_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  teacherProfile: one(teacherProfiles, { fields: [users.id], references: [teacherProfiles.userId] }),
  studentProfile: one(studentProfiles, { fields: [users.id], references: [studentProfiles.userId] }),
  notifications: many(notifications),
  bookingsAsStudent: many(bookings),
}));

export const teacherProfilesRelations = relations(teacherProfiles, ({ one, many }) => ({
  user: one(users, { fields: [teacherProfiles.userId], references: [users.id] }),
  subjects: many(teacherSubjects),
  schedules: many(teacherSchedules),
  bookings: many(bookings),
  wallet: one(teacherWallets, { fields: [teacherProfiles.id], references: [teacherWallets.teacherProfileId] }),
  bankAccounts: many(bankAccounts),
  reviews: many(reviews),
}));

export const teacherSubjectsRelations = relations(teacherSubjects, ({ one }) => ({
  teacherProfile: one(teacherProfiles, { fields: [teacherSubjects.teacherProfileId], references: [teacherProfiles.id] }),
  subject: one(subjects, { fields: [teacherSubjects.subjectId], references: [subjects.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  student: one(users, { fields: [bookings.studentUserId], references: [users.id] }),
  teacherProfile: one(teacherProfiles, { fields: [bookings.teacherProfileId], references: [teacherProfiles.id] }),
  subject: one(subjects, { fields: [bookings.subjectId], references: [subjects.id] }),
  payment: one(payments, { fields: [bookings.id], references: [payments.bookingId] }),
  learningSession: one(learningSessions, { fields: [bookings.id], references: [learningSessions.bookingId] }),
  review: one(reviews, { fields: [bookings.id], references: [reviews.bookingId] }),
}));
