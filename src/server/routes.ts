import crypto from 'node:crypto';
import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  agreements,
  auditLogs,
  bankAccounts,
  bookings,
  complaints,
  favoriteTeachers,
  guardianRelationships,
  learningSessions,
  notifications,
  payments,
  pricingPlans,
  reviews,
  siteSettings,
  studentProfiles,
  subjects,
  teacherProfiles,
  teacherSchedules,
  teacherSubjects,
  teacherWallets,
  users,
  walletTransactions,
  withdrawalRequests,
} from '../db/schema.ts';
import { ensureSeeded } from '../db/seed.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import {
  calculatePricingSplit,
  canTransitionBooking,
  canTransitionWithdrawal,
  computeEndTime,
  hasScheduleConflict,
  sanitizeAvatarUrl,
  sanitizePublicTeacher,
  validateWithdrawalAmount,
  type BookingStatus,
  type UserRole,
  type WithdrawalStatus,
} from '../utils/domainLogic.ts';
import {
  type AuthRequest,
  getOrCreateFirebaseUser,
  hashPassword,
  hashToken,
  optionalAuth,
  rateLimit,
  requireAuth,
  requireRole,
  signSessionToken,
  verifyPassword,
} from './auth.ts';

export const apiRouter = Router();

// Lazily ensure seed data exists on first API call (no top-level startup DB probe)
apiRouter.use(async (_req, _res, next) => {
  try {
    await ensureSeeded();
  } catch (err) {
    console.error('Lazy seed error:', err);
  }
  next();
});

async function writeAuditLog(
  actorUserId: number | null,
  action: string,
  entityType: string,
  entityId: string | number,
  details?: Record<string, unknown>
) {
  try {
    await db.insert(auditLogs).values({
      actorUserId,
      action,
      entityType,
      entityId: String(entityId),
      details: details || {},
    });
  } catch (err) {
    console.error('Audit log insert failed:', err);
  }
}

async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: string,
  relatedUrl?: string
) {
  try {
    await db.insert(notifications).values({
      userId,
      title,
      message,
      type,
      relatedUrl: relatedUrl || null,
    });
  } catch (err) {
    console.error('Notification insert failed:', err);
  }
}

// ==================== 1. AUTHENTICATION ====================

apiRouter.post('/auth/register', rateLimit(20, 60_000), async (req, res) => {
  try {
    const {
      email,
      password,
      fullName,
      phone,
      role = 'student',
      educationLevel = 'SMA/SMK',
      schoolName,
      grade,
      childEmail,
    } = req.body ?? {};

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Nama lengkap, email, dan kata sandi wajib diisi.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Kata sandi minimal 8 karakter.' });
    }
    const allowedRegisterRoles: UserRole[] = ['student', 'parent', 'teacher'];
    const targetRole: UserRole = allowedRegisterRoles.includes(role) ? role : 'student';

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email tersebut sudah terdaftar. Silakan masuk.' });
    }

    const passwordHash = hashPassword(String(password));
    const [created] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        fullName: String(fullName).trim(),
        phone: phone ? String(phone).trim() : null,
        role: targetRole,
        isEmailVerified: false,
        isPhoneVerified: Boolean(phone),
        isActive: true,
      })
      .returning();

    if (targetRole === 'student') {
      await db.insert(studentProfiles).values({
        userId: created.id,
        educationLevel: String(educationLevel || 'SMA/SMK'),
        schoolName: schoolName ? String(schoolName).trim() : null,
        grade: grade ? String(grade).trim() : null,
        parentalConsentGiven: true,
      });
    } else if (targetRole === 'parent' && childEmail) {
      const childRows = await db
        .select()
        .from(users)
        .where(eq(users.email, String(childEmail).trim().toLowerCase()))
        .limit(1);
      if (childRows.length > 0 && childRows[0].role === 'student') {
        await db
          .insert(guardianRelationships)
          .values({
            parentUserId: created.id,
            studentUserId: childRows[0].id,
            relationshipType: 'Orang Tua/Wali',
            verificationStatus: 'pending',
          })
          .onConflictDoNothing();
      }
    }

    await db.insert(agreements).values({
      userId: created.id,
      agreementType: 'terms_of_service',
      version: '1.0',
      ipAddress: req.ip || 'unknown',
    });

    await writeAuditLog(created.id, 'USER_REGISTERED', 'user', created.id, { role: targetRole });

    const token = signSessionToken({
      userId: created.id,
      email: created.email,
      role: created.role as UserRole,
    });

    res.status(201).json({
      token,
      user: {
        id: created.id,
        email: created.email,
        fullName: created.fullName,
        phone: created.phone,
        role: created.role,
        avatarUrl: created.avatarUrl,
        isEmailVerified: created.isEmailVerified,
        isPhoneVerified: created.isPhoneVerified,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Gagal mendaftarkan akun. Silakan coba lagi.' });
  }
});

apiRouter.post('/auth/login', rateLimit(30, 60_000), async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const rows = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    const user = rows[0];
    if (!user || !user.passwordHash || !verifyPassword(String(password), user.passwordHash)) {
      return res.status(401).json({ error: 'Email atau kata sandi salah.' });
    }
    if (!user.isActive || user.deletedAt) {
      return res.status(403).json({ error: 'Akun Anda sedang dinonaktifkan oleh administrator.' });
    }

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    });
    await writeAuditLog(user.id, 'USER_LOGIN', 'user', user.id, { method: 'password' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Gagal memproses login.' });
  }
});

apiRouter.post('/auth/firebase', rateLimit(30, 60_000), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token Google Sign-In tidak ditemukan.' });
    }
    const idToken = authHeader.slice('Bearer '.length).trim();
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.email) {
      return res.status(400).json({ error: 'Akun Google tidak memiliki alamat email.' });
    }
    const user = await getOrCreateFirebaseUser(
      decoded.uid,
      decoded.email,
      decoded.name,
      decoded.picture
    );
    if (!user.isActive || user.deletedAt) {
      return res.status(403).json({ error: 'Akun Anda sedang dinonaktifkan.' });
    }
    await writeAuditLog(user.id, 'USER_LOGIN', 'user', user.id, { method: 'google_firebase' });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    });
  } catch (err) {
    console.error('Firebase auth error:', err);
    res.status(401).json({ error: 'Verifikasi Google Sign-In gagal.' });
  }
});

apiRouter.post('/auth/forgot-password', rateLimit(10, 60_000), async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ error: 'Email wajib diisi.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const rows = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (rows.length === 0) {
      return res.json({
        message: 'Jika email terdaftar, instruksi reset kata sandi telah dikirim.',
      });
    }
    const rawResetToken = crypto.randomBytes(20).toString('hex');
    await db
      .update(users)
      .set({
        resetTokenHash: hashToken(rawResetToken),
        resetTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 30),
      })
      .where(eq(users.id, rows[0].id));

    await writeAuditLog(rows[0].id, 'PASSWORD_RESET_REQUESTED', 'user', rows[0].id);

    res.json({
      message: 'Token reset kata sandi telah dibuat (mode sandbox: berlaku 30 menit).',
      sandboxResetToken: rawResetToken,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Gagal memproses permintaan reset kata sandi.' });
  }
});

apiRouter.post('/auth/reset-password', rateLimit(10, 60_000), async (req, res) => {
  try {
    const { token, newPassword } = req.body ?? {};
    if (!token || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Token dan kata sandi baru (minimal 8 karakter) wajib diisi.' });
    }
    const tokenHash = hashToken(String(token).trim());
    const rows = await db.select().from(users).where(eq(users.resetTokenHash, tokenHash)).limit(1);
    const user = rows[0];
    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Token reset tidak valid atau sudah kedaluwarsa.' });
    }

    await db
      .update(users)
      .set({
        passwordHash: hashPassword(String(newPassword)),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await writeAuditLog(user.id, 'PASSWORD_RESET_COMPLETED', 'user', user.id);
    res.json({ message: 'Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Gagal mereset kata sandi.' });
  }
});

apiRouter.post('/auth/verify-email', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(users)
      .set({ isEmailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, req.currentUser!.id));
    res.json({ message: 'Email berhasil diverifikasi.' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Gagal memverifikasi email.' });
  }
});

apiRouter.get('/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.currentUser!;
    let studentProfile = null;
    let teacherProfile = null;
    if (user.role === 'student') {
      const rows = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, user.id))
        .limit(1);
      studentProfile = rows[0] || null;
    } else if (user.role === 'teacher') {
      const rows = await db
        .select()
        .from(teacherProfiles)
        .where(eq(teacherProfiles.userId, user.id))
        .limit(1);
      teacherProfile = rows[0] || null;
    }
    res.json({ user, studentProfile, teacherProfile });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Gagal memuat profil pengguna.' });
  }
});

apiRouter.put('/auth/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.currentUser!;
    const { fullName, phone, avatarUrl, educationLevel, schoolName, grade, learningGoals } = req.body ?? {};
    const safeAvatar = avatarUrl !== undefined ? sanitizeAvatarUrl(avatarUrl) : undefined;
    if (avatarUrl !== undefined && avatarUrl !== '' && safeAvatar === null) {
      return res.status(400).json({ error: 'Format URL foto profil tidak valid.' });
    }
    const [updated] = await db
      .update(users)
      .set({
        fullName: fullName ? String(fullName).trim() : user.fullName,
        phone: phone !== undefined ? String(phone).trim() : user.phone,
        avatarUrl: safeAvatar !== undefined ? safeAvatar : user.avatarUrl,
        isPhoneVerified: phone ? true : user.isPhoneVerified,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    if (user.role === 'student') {
      await db
        .update(studentProfiles)
        .set({
          educationLevel: educationLevel || undefined,
          schoolName: schoolName !== undefined ? String(schoolName) : undefined,
          grade: grade !== undefined ? String(grade) : undefined,
          learningGoals: learningGoals !== undefined ? String(learningGoals) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(studentProfiles.userId, user.id));
    }

    res.json({
      user: {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        phone: updated.phone,
        role: updated.role,
        avatarUrl: updated.avatarUrl,
        isEmailVerified: updated.isEmailVerified,
        isPhoneVerified: updated.isPhoneVerified,
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Gagal memperbarui profil.' });
  }
});

// ==================== 2. PUBLIC DISCOVERY (SUBJECTS, PRICING, TEACHERS) ====================

apiRouter.get('/subjects', async (_req, res) => {
  try {
    const list = await db
      .select()
      .from(subjects)
      .where(eq(subjects.isActive, true))
      .orderBy(subjects.id);
    res.json(list);
  } catch (err) {
    console.error('Get subjects error:', err);
    res.status(500).json({ error: 'Gagal memuat daftar mata pelajaran.' });
  }
});

apiRouter.get('/pricing', async (_req, res) => {
  try {
    const list = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.isActive, true))
      .orderBy(pricingPlans.studentPrice);
    res.json(list);
  } catch (err) {
    console.error('Get pricing error:', err);
    res.status(500).json({ error: 'Gagal memuat daftar paket harga.' });
  }
});

apiRouter.get('/site-settings', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, 'platform_config'))
      .limit(1);
    res.json(rows[0]?.value ?? {});
  } catch (err) {
    console.error('Get site settings error:', err);
    res.status(500).json({ error: 'Gagal memuat pengaturan platform.' });
  }
});

async function buildTeacherDirectory(onlyActive = true) {
  const teacherRows = await db
    .select({
      id: teacherProfiles.id,
      userId: teacherProfiles.userId,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      lastEducation: teacherProfiles.lastEducation,
      institution: teacherProfiles.institution,
      major: teacherProfiles.major,
      graduationYear: teacherProfiles.graduationYear,
      educationLevels: teacherProfiles.educationLevels,
      experienceYears: teacherProfiles.experienceYears,
      bio: teacherProfiles.bio,
      verificationStatus: teacherProfiles.verificationStatus,
      ratingAvg: teacherProfiles.ratingAvg,
      totalReviews: teacherProfiles.totalReviews,
      totalSessions: teacherProfiles.totalSessions,
      teachingDurationOptions: teacherProfiles.teachingDurationOptions,
      isActiveUser: users.isActive,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id));

  const filtered = onlyActive
    ? teacherRows.filter((t) => t.verificationStatus === 'active' && t.isActiveUser)
    : teacherRows;

  const allTeacherSubjects = await db
    .select({
      teacherProfileId: teacherSubjects.teacherProfileId,
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectSlug: subjects.slug,
      subjectCategory: subjects.category,
      educationLevels: teacherSubjects.educationLevels,
    })
    .from(teacherSubjects)
    .innerJoin(subjects, eq(teacherSubjects.subjectId, subjects.id));

  const allSchedules = await db
    .select()
    .from(teacherSchedules)
    .where(eq(teacherSchedules.isAvailable, true));

  const activePlans = await db
    .select()
    .from(pricingPlans)
    .where(eq(pricingPlans.isActive, true));

  return filtered.map((t) => {
    const tSubjects = allTeacherSubjects.filter((s) => s.teacherProfileId === t.id);
    const tSchedules = allSchedules.filter((s) => s.teacherProfileId === t.id);
    const matchingPlans = activePlans.filter(
      (p) => p.durationMinutes === 60 && t.educationLevels.includes(p.educationLevel)
    );
    const startingPrice =
      matchingPlans.length > 0
        ? Math.min(...matchingPlans.map((p) => p.studentPrice))
        : 60000;

    return sanitizePublicTeacher({
      ...t,
      ratingAvg: Number(t.ratingAvg),
      subjects: tSubjects,
      schedules: tSchedules,
      startingPrice,
    });
  });
}

apiRouter.get('/teachers', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const {
      q = '',
      subject = '',
      level = '',
      maxPrice = '',
      minRating = '',
      minExperience = '',
      dayOfWeek = '',
      sort = 'rating_desc',
      page = '1',
      limit = '12',
    } = req.query as Record<string, string>;

    let list = await buildTeacherDirectory(true);

    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.fullName.toLowerCase().includes(needle) ||
          t.bio.toLowerCase().includes(needle) ||
          t.institution.toLowerCase().includes(needle) ||
          t.subjects.some((s) => s.subjectName.toLowerCase().includes(needle))
      );
    }

    if (subject.trim()) {
      const subNeedle = subject.trim().toLowerCase();
      list = list.filter((t) =>
        t.subjects.some(
          (s) =>
            s.subjectSlug.toLowerCase() === subNeedle ||
            s.subjectName.toLowerCase().includes(subNeedle) ||
            String(s.subjectId) === subNeedle
        )
      );
    }

    if (level.trim()) {
      list = list.filter((t) => t.educationLevels.includes(level.trim()));
    }

    if (maxPrice && Number(maxPrice) > 0) {
      list = list.filter((t) => t.startingPrice <= Number(maxPrice));
    }

    if (minRating && Number(minRating) > 0) {
      list = list.filter((t) => t.ratingAvg >= Number(minRating));
    }

    if (minExperience && Number(minExperience) > 0) {
      list = list.filter((t) => t.experienceYears >= Number(minExperience));
    }

    if (dayOfWeek !== '' && !Number.isNaN(Number(dayOfWeek))) {
      const targetDay = Number(dayOfWeek);
      list = list.filter((t) => t.schedules.some((sc) => sc.dayOfWeek === targetDay));
    }

    // Sorting
    if (sort === 'price_asc') {
      list.sort((a, b) => a.startingPrice - b.startingPrice);
    } else if (sort === 'price_desc') {
      list.sort((a, b) => b.startingPrice - a.startingPrice);
    } else if (sort === 'sessions_desc') {
      list.sort((a, b) => b.totalSessions - a.totalSessions);
    } else if (sort === 'experience_desc') {
      list.sort((a, b) => b.experienceYears - a.experienceYears);
    } else {
      list.sort((a, b) => b.ratingAvg - a.ratingAvg || b.totalSessions - a.totalSessions);
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 12));
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    const items = list.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    console.error('Search teachers error:', err);
    res.status(500).json({ error: 'Gagal mencari daftar guru.' });
  }
});

apiRouter.get('/teachers/:id', async (req, res) => {
  try {
    const teacherId = Number(req.params.id);
    if (!Number.isInteger(teacherId) || teacherId <= 0) {
      return res.status(400).json({ error: 'ID guru tidak valid.' });
    }
    const list = await buildTeacherDirectory(true);
    const teacher = list.find((t) => t.id === teacherId);
    if (!teacher) {
      return res.status(404).json({ error: 'Profil guru tidak ditemukan atau belum aktif.' });
    }

    const teacherReviews = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        studentName: users.fullName,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.studentUserId, users.id))
      .where(and(eq(reviews.teacherProfileId, teacherId), eq(reviews.isPublished, true)))
      .orderBy(desc(reviews.createdAt));

    const plans = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.isActive, true))
      .orderBy(pricingPlans.studentPrice);

    const existingBookings = await db
      .select({
        sessionDate: bookings.sessionDate,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.teacherProfileId, teacherId),
          inArray(bookings.status, [
            'pending',
            'accepted',
            'awaiting_payment',
            'paid',
            'scheduled',
            'in_progress',
          ])
        )
      );

    res.json({
      teacher,
      reviews: teacherReviews,
      pricingPlans: plans.filter((p) => teacher.educationLevels.includes(p.educationLevel)),
      bookedSlots: existingBookings,
    });
  } catch (err) {
    console.error('Teacher detail error:', err);
    res.status(500).json({ error: 'Gagal memuat detail profil guru.' });
  }
});

// ==================== 3. TEACHER 6-STEP REGISTRATION & PROFILE ====================

apiRouter.post('/teachers/register', rateLimit(15, 60_000), async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      phone,
      birthDate,
      avatarUrl,
      lastEducation,
      institution,
      major,
      graduationYear,
      subjectIds,
      educationLevels,
      experienceYears,
      bio,
      idDocumentUrl,
      diplomaDocumentUrl,
      certificateDocumentUrl,
      schedules,
      teachingDurationOptions,
      bankName,
      accountNumber,
      accountHolderName,
      agreedTerms,
      agreedPartnership,
    } = req.body ?? {};

    if (!fullName || !email || !password || !phone || !lastEducation || !institution || !major || !bio) {
      return res.status(400).json({ error: 'Mohon lengkapi seluruh data wajib pendaftaran guru.' });
    }
    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      return res.status(400).json({ error: 'Pilih minimal satu mata pelajaran yang dikuasai.' });
    }
    if (!Array.isArray(educationLevels) || educationLevels.length === 0) {
      return res.status(400).json({ error: 'Pilih minimal satu jenjang pendidikan.' });
    }
    if (!bankName || !accountNumber || !accountHolderName) {
      return res.status(400).json({ error: 'Informasi rekening pencairan wajib dilengkapi.' });
    }
    if (!agreedTerms || !agreedPartnership) {
      return res.status(400).json({ error: 'Anda harus menyetujui syarat, ketentuan, dan perjanjian kerja sama.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email sudah terdaftar. Silakan gunakan email lain atau masuk.' });
    }

    const safeAvatar =
      sanitizeAvatarUrl(avatarUrl) || '/src/assets/images/teacher_portrait_2_1795536394410.jpg';

    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: normalizedEmail,
          passwordHash: hashPassword(String(password)),
          fullName: String(fullName).trim(),
          phone: String(phone).trim(),
          role: 'teacher',
          avatarUrl: safeAvatar,
          isEmailVerified: true,
          isPhoneVerified: true,
          isActive: true,
        })
        .returning();

      const [tp] = await tx
        .insert(teacherProfiles)
        .values({
          userId: user.id,
          birthDate: birthDate ? String(birthDate) : null,
          lastEducation: String(lastEducation).trim(),
          institution: String(institution).trim(),
          major: String(major).trim(),
          graduationYear: graduationYear ? Number(graduationYear) : null,
          educationLevels: educationLevels.map(String),
          experienceYears: Math.max(0, Number(experienceYears) || 1),
          bio: String(bio).trim(),
          idDocumentUrl: idDocumentUrl ? String(idDocumentUrl) : 'private://uploaded-ktp.pdf',
          diplomaDocumentUrl: diplomaDocumentUrl ? String(diplomaDocumentUrl) : 'private://uploaded-ijazah.pdf',
          certificateDocumentUrl: certificateDocumentUrl ? String(certificateDocumentUrl) : null,
          verificationStatus: 'submitted',
          teachingDurationOptions:
            Array.isArray(teachingDurationOptions) && teachingDurationOptions.length > 0
              ? teachingDurationOptions.map(Number)
              : [60, 90],
        })
        .returning();

      for (const sid of subjectIds) {
        await tx.insert(teacherSubjects).values({
          teacherProfileId: tp.id,
          subjectId: Number(sid),
          educationLevels: educationLevels.map(String),
        });
      }

      const schedList =
        Array.isArray(schedules) && schedules.length > 0
          ? schedules
          : [
              { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' },
              { dayOfWeek: 3, startTime: '14:00', endTime: '17:00' },
              { dayOfWeek: 5, startTime: '19:00', endTime: '21:00' },
            ];

      for (const s of schedList) {
        await tx.insert(teacherSchedules).values({
          teacherProfileId: tp.id,
          dayOfWeek: Number(s.dayOfWeek),
          startTime: String(s.startTime),
          endTime: String(s.endTime),
          isAvailable: true,
        });
      }

      await tx.insert(bankAccounts).values({
        teacherProfileId: tp.id,
        bankName: String(bankName).trim(),
        accountNumber: String(accountNumber).trim(),
        accountHolderName: String(accountHolderName).trim(),
        isVerified: false,
        isPrimary: true,
      });

      await tx.insert(teacherWallets).values({
        teacherProfileId: tp.id,
      });

      await tx.insert(agreements).values([
        { userId: user.id, agreementType: 'terms_of_service', version: '1.0', ipAddress: req.ip || 'unknown' },
        { userId: user.id, agreementType: 'teacher_partnership', version: '1.0', ipAddress: req.ip || 'unknown' },
      ]);

      return { user, tp };
    });

    await writeAuditLog(result.user.id, 'TEACHER_REGISTERED', 'teacher_profile', result.tp.id, {
      status: 'submitted',
    });

    const admins = await db.select().from(users).where(eq(users.role, 'admin'));
    for (const adm of admins) {
      await createNotification(
        adm.id,
        'Pendaftaran Guru Baru',
        `${result.user.fullName} telah mengajukan pendaftaran guru dan menunggu verifikasi.`,
        'verification',
        '/dashboard/admin'
      );
    }

    const token = signSessionToken({
      userId: result.user.id,
      email: result.user.email,
      role: 'teacher',
    });

    res.status(201).json({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        phone: result.user.phone,
        role: result.user.role,
        avatarUrl: result.user.avatarUrl,
      },
      teacherProfile: result.tp,
    });
  } catch (err) {
    console.error('Teacher registration error:', err);
    res.status(500).json({ error: 'Gagal mengirim pendaftaran guru.' });
  }
});

apiRouter.get('/teachers/me/profile', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const tpRows = await db
      .select()
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, req.currentUser!.id))
      .limit(1);
    const tp = tpRows[0];
    if (!tp) {
      return res.status(404).json({ error: 'Profil guru tidak ditemukan.' });
    }
    const mySubjects = await db
      .select({
        id: teacherSubjects.id,
        subjectId: subjects.id,
        subjectName: subjects.name,
        educationLevels: teacherSubjects.educationLevels,
      })
      .from(teacherSubjects)
      .innerJoin(subjects, eq(teacherSubjects.subjectId, subjects.id))
      .where(eq(teacherSubjects.teacherProfileId, tp.id));

    const mySchedules = await db
      .select()
      .from(teacherSchedules)
      .where(eq(teacherSchedules.teacherProfileId, tp.id));

    res.json({ profile: tp, subjects: mySubjects, schedules: mySchedules });
  } catch (err) {
    console.error('Get my teacher profile error:', err);
    res.status(500).json({ error: 'Gagal memuat profil guru.' });
  }
});

apiRouter.put('/teachers/me/resubmit', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const { bio, lastEducation, institution, major, idDocumentUrl, diplomaDocumentUrl, avatarUrl } = req.body ?? {};
    const tpRows = await db
      .select()
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, req.currentUser!.id))
      .limit(1);
    const tp = tpRows[0];
    if (!tp) return res.status(404).json({ error: 'Profil guru tidak ditemukan.' });

    const safeAvatar = avatarUrl !== undefined ? sanitizeAvatarUrl(avatarUrl) : undefined;
    if (safeAvatar) {
      await db
        .update(users)
        .set({ avatarUrl: safeAvatar, updatedAt: new Date() })
        .where(eq(users.id, req.currentUser!.id));
    }

    const [updated] = await db
      .update(teacherProfiles)
      .set({
        bio: bio ? String(bio).trim() : tp.bio,
        lastEducation: lastEducation ? String(lastEducation).trim() : tp.lastEducation,
        institution: institution ? String(institution).trim() : tp.institution,
        major: major ? String(major).trim() : tp.major,
        idDocumentUrl: idDocumentUrl || tp.idDocumentUrl,
        diplomaDocumentUrl: diplomaDocumentUrl || tp.diplomaDocumentUrl,
        verificationStatus: 'submitted',
        revisionNotes: null,
        updatedAt: new Date(),
      })
      .where(eq(teacherProfiles.id, tp.id))
      .returning();

    await writeAuditLog(req.currentUser!.id, 'TEACHER_RESUBMITTED', 'teacher_profile', tp.id);
    res.json(updated);
  } catch (err) {
    console.error('Resubmit teacher error:', err);
    res.status(500).json({ error: 'Gagal mengirim ulang berkas guru.' });
  }
});

apiRouter.put('/teachers/me/schedules', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const { schedules } = req.body ?? {};
    if (!Array.isArray(schedules)) {
      return res.status(400).json({ error: 'Format jadwal tidak valid.' });
    }
    const tpRows = await db
      .select()
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, req.currentUser!.id))
      .limit(1);
    const tp = tpRows[0];
    if (!tp) return res.status(404).json({ error: 'Profil guru tidak ditemukan.' });

    await db.transaction(async (tx) => {
      await tx.delete(teacherSchedules).where(eq(teacherSchedules.teacherProfileId, tp.id));
      for (const s of schedules) {
        await tx.insert(teacherSchedules).values({
          teacherProfileId: tp.id,
          dayOfWeek: Number(s.dayOfWeek),
          startTime: String(s.startTime),
          endTime: String(s.endTime),
          isAvailable: s.isAvailable !== false,
        });
      }
    });

    const updated = await db
      .select()
      .from(teacherSchedules)
      .where(eq(teacherSchedules.teacherProfileId, tp.id));
    res.json(updated);
  } catch (err) {
    console.error('Update schedules error:', err);
    res.status(500).json({ error: 'Gagal menyimpan jadwal mengajar.' });
  }
});

apiRouter.put('/teachers/me/subjects', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const { subjectIds, educationLevels } = req.body ?? {};
    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      return res.status(400).json({ error: 'Pilih minimal satu mata pelajaran.' });
    }
    const tpRows = await db
      .select()
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, req.currentUser!.id))
      .limit(1);
    const tp = tpRows[0];
    if (!tp) return res.status(404).json({ error: 'Profil guru tidak ditemukan.' });

    const levels = Array.isArray(educationLevels) && educationLevels.length > 0 ? educationLevels : tp.educationLevels;

    await db.transaction(async (tx) => {
      await tx.delete(teacherSubjects).where(eq(teacherSubjects.teacherProfileId, tp.id));
      for (const sid of subjectIds) {
        await tx.insert(teacherSubjects).values({
          teacherProfileId: tp.id,
          subjectId: Number(sid),
          educationLevels: levels.map(String),
        });
      }
      await tx
        .update(teacherProfiles)
        .set({ educationLevels: levels.map(String), updatedAt: new Date() })
        .where(eq(teacherProfiles.id, tp.id));
    });

    res.json({ message: 'Kompetensi mata pelajaran berhasil diperbarui.' });
  } catch (err) {
    console.error('Update teacher subjects error:', err);
    res.status(500).json({ error: 'Gagal memperbarui mata pelajaran.' });
  }
});

// ==================== 4. FAVORITE TEACHERS ====================

apiRouter.get('/favorites', requireAuth, async (req: AuthRequest, res) => {
  try {
    const favs = await db
      .select()
      .from(favoriteTeachers)
      .where(eq(favoriteTeachers.studentUserId, req.currentUser!.id));
    res.json(favs.map((f) => f.teacherProfileId));
  } catch (err) {
    console.error('Get favorites error:', err);
    res.status(500).json({ error: 'Gagal memuat guru favorit.' });
  }
});

apiRouter.post('/favorites/:teacherProfileId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tpId = Number(req.params.teacherProfileId);
    const existing = await db
      .select()
      .from(favoriteTeachers)
      .where(
        and(
          eq(favoriteTeachers.studentUserId, req.currentUser!.id),
          eq(favoriteTeachers.teacherProfileId, tpId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db.delete(favoriteTeachers).where(eq(favoriteTeachers.id, existing[0].id));
      return res.json({ favorited: false });
    }
    await db.insert(favoriteTeachers).values({
      studentUserId: req.currentUser!.id,
      teacherProfileId: tpId,
    });
    res.json({ favorited: true });
  } catch (err) {
    console.error('Toggle favorite error:', err);
    res.status(500).json({ error: 'Gagal mengubah status guru favorit.' });
  }
});

// ==================== 5. BOOKINGS & DOUBLE-BOOKING PREVENTION ====================

async function getHydratedBookings(filter: {
  studentUserIds?: number[];
  teacherProfileId?: number;
}) {
  const rows = await db
    .select({
      booking: bookings,
      studentName: users.fullName,
      studentEmail: users.email,
      subjectName: subjects.name,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.studentUserId, users.id))
    .innerJoin(subjects, eq(bookings.subjectId, subjects.id))
    .orderBy(desc(bookings.createdAt));

  let filtered = rows;
  if (filter.studentUserIds) {
    const idSet = new Set(filter.studentUserIds);
    filtered = filtered.filter((r) => idSet.has(r.booking.studentUserId));
  }
  if (filter.teacherProfileId !== undefined) {
    filtered = filtered.filter((r) => r.booking.teacherProfileId === filter.teacherProfileId);
  }

  const tpList = await db
    .select({
      tpId: teacherProfiles.id,
      teacherName: users.fullName,
      avatarUrl: users.avatarUrl,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id));
  const tpMap = new Map(tpList.map((t) => [t.tpId, t]));

  const allPayments = await db.select().from(payments);
  const payMap = new Map(allPayments.map((p) => [p.bookingId, p]));

  const allSessions = await db.select().from(learningSessions);
  const sessMap = new Map(allSessions.map((s) => [s.bookingId, s]));

  const allReviews = await db.select().from(reviews);
  const revMap = new Map(allReviews.map((r) => [r.bookingId, r]));

  return filtered.map((r) => {
    const tInfo = tpMap.get(r.booking.teacherProfileId);
    const pay = payMap.get(r.booking.id) || null;
    const sess = sessMap.get(r.booking.id) || null;
    const rev = revMap.get(r.booking.id) || null;
    return {
      ...r.booking,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      subjectName: r.subjectName,
      teacherName: tInfo?.teacherName || 'Guru',
      teacherAvatarUrl: tInfo?.avatarUrl || null,
      payment: pay,
      learningSession: sess ? { id: sess.id, roomCode: sess.roomCode, status: sess.status } : null,
      review: rev,
    };
  });
}

apiRouter.get('/bookings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.currentUser!;
    if (user.role === 'admin') {
      return res.json(await getHydratedBookings({}));
    }
    if (user.role === 'student') {
      return res.json(await getHydratedBookings({ studentUserIds: [user.id] }));
    }
    if (user.role === 'teacher') {
      const tp = await db
        .select()
        .from(teacherProfiles)
        .where(eq(teacherProfiles.userId, user.id))
        .limit(1);
      if (tp.length === 0) return res.json([]);
      return res.json(await getHydratedBookings({ teacherProfileId: tp[0].id }));
    }
    if (user.role === 'parent') {
      const links = await db
        .select()
        .from(guardianRelationships)
        .where(
          and(
            eq(guardianRelationships.parentUserId, user.id),
            eq(guardianRelationships.verificationStatus, 'verified')
          )
        );
      if (links.length === 0) return res.json([]);
      return res.json(await getHydratedBookings({ studentUserIds: links.map((l) => l.studentUserId) }));
    }
    res.json([]);
  } catch (err) {
    console.error('Get bookings error:', err);
    res.status(500).json({ error: 'Gagal memuat daftar pemesanan.' });
  }
});

apiRouter.post('/bookings', requireAuth, requireRole('student', 'admin'), async (req: AuthRequest, res) => {
  try {
    const {
      teacherProfileId,
      subjectId,
      educationLevel,
      sessionDate,
      startTime,
      durationMinutes,
      notes,
    } = req.body ?? {};

    if (!teacherProfileId || !subjectId || !educationLevel || !sessionDate || !startTime || !durationMinutes) {
      return res.status(400).json({ error: 'Lengkapi guru, mata pelajaran, jenjang, tanggal, jam, dan durasi.' });
    }

    const dur = Number(durationMinutes);
    const endTime = computeEndTime(String(startTime), dur);

    const createdBooking = await db.transaction(async (tx) => {
      // Lock teacher profile row to prevent race-condition double booking
      const tpRows = await tx
        .select()
        .from(teacherProfiles)
        .where(eq(teacherProfiles.id, Number(teacherProfileId)))
        .for('update');
      const tp = tpRows[0];
      if (!tp || tp.verificationStatus !== 'active') {
        throw new Error('Guru tidak tersedia atau belum terverifikasi.');
      }

      const existing = await tx
        .select({
          sessionDate: bookings.sessionDate,
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          status: bookings.status,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.teacherProfileId, tp.id),
            eq(bookings.sessionDate, String(sessionDate))
          )
        );

      if (hasScheduleConflict(existing, String(sessionDate), String(startTime), endTime)) {
        throw new Error('DOUBLE_BOOKING');
      }

      // Resolve official pricing plan from DB
      const plans = await tx
        .select()
        .from(pricingPlans)
        .where(
          and(
            eq(pricingPlans.educationLevel, String(educationLevel)),
            eq(pricingPlans.durationMinutes, dur),
            eq(pricingPlans.isActive, true)
          )
        )
        .limit(1);
      const plan = plans[0];
      if (!plan) {
        throw new Error('Paket harga untuk jenjang dan durasi ini belum tersedia.');
      }

      const split = calculatePricingSplit(plan.studentPrice, plan.teacherSharePercent);
      const bookingCode = `JG-${new Date().getFullYear()}-${crypto.randomInt(10000, 99999)}`;

      const [inserted] = await tx
        .insert(bookings)
        .values({
          bookingCode,
          studentUserId: req.currentUser!.id,
          teacherProfileId: tp.id,
          subjectId: Number(subjectId),
          pricingPlanId: plan.id,
          educationLevel: String(educationLevel),
          sessionDate: String(sessionDate),
          startTime: String(startTime),
          endTime,
          durationMinutes: dur,
          status: 'pending',
          studentPriceSnapshot: split.studentPrice,
          teacherEarningSnapshot: split.teacherEarning,
          platformCommissionSnapshot: split.platformCommission,
          teacherSharePercentSnapshot: split.teacherSharePercent,
          notes: notes ? String(notes).trim() : null,
          parentApproved: true,
        })
        .returning();

      return { inserted, teacherUserId: tp.userId };
    });

    await createNotification(
      createdBooking.teacherUserId,
      'Permintaan Pemesanan Baru',
      `${req.currentUser!.fullName} mengajukan pemesanan belajar untuk tanggal ${sessionDate} pukul ${startTime}.`,
      'booking',
      '/dashboard/guru'
    );
    await writeAuditLog(req.currentUser!.id, 'BOOKING_CREATED', 'booking', createdBooking.inserted.id, {
      bookingCode: createdBooking.inserted.bookingCode,
    });

    res.status(201).json(createdBooking.inserted);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'DOUBLE_BOOKING') {
      return res.status(409).json({
        error: 'Jadwal yang dipilih sudah dipesan oleh siswa lain. Silakan pilih jam atau tanggal lain.',
      });
    }
    console.error('Create booking error:', err);
    res.status(400).json({ error: message || 'Gagal membuat pemesanan.' });
  }
});

apiRouter.post('/bookings/:id/respond', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    const { decision, rejectionReason } = req.body ?? {};
    if (decision !== 'accept' && decision !== 'reject') {
      return res.status(400).json({ error: 'Keputusan harus accept atau reject.' });
    }

    const tpRows = await db
      .select()
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, req.currentUser!.id))
      .limit(1);
    const tp = tpRows[0];
    if (!tp) return res.status(403).json({ error: 'Profil guru tidak ditemukan.' });

    const updated = await db.transaction(async (tx) => {
      const bRows = await tx
        .select()
        .from(bookings)
        .where(and(eq(bookings.id, bookingId), eq(bookings.teacherProfileId, tp.id)))
        .for('update');
      const booking = bRows[0];
      if (!booking) throw new Error('NOT_FOUND');

      const targetStatus: BookingStatus = decision === 'accept' ? 'awaiting_payment' : 'rejected';
      if (!canTransitionBooking(booking.status as BookingStatus, targetStatus)) {
        throw new Error('INVALID_STATE');
      }

      const paymentDeadlineAt =
        decision === 'accept' ? new Date(Date.now() + 1000 * 60 * 60 * 24) : null;

      const [nextBooking] = await tx
        .update(bookings)
        .set({
          status: targetStatus,
          rejectionReason: decision === 'reject' ? String(rejectionReason || 'Jadwal berhalangan') : null,
          paymentDeadlineAt,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, booking.id))
        .returning();

      if (decision === 'accept') {
        const extRef = `PAY-SBX-${booking.id}-${crypto.randomInt(1000, 9999)}`;
        await tx
          .insert(payments)
          .values({
            bookingId: booking.id,
            externalRef: extRef,
            paymentMethod: 'QRIS',
            gatewayProvider: 'JumpaPay Sandbox',
            amount: booking.studentPriceSnapshot,
            status: 'pending',
            paymentUrl: `https://sandbox.jumpapay.local/pay/${extRef}`,
          })
          .onConflictDoNothing();
      }

      return nextBooking;
    });

    await createNotification(
      updated.studentUserId,
      decision === 'accept' ? 'Pemesanan Diterima Guru' : 'Pemesanan Ditolak Guru',
      decision === 'accept'
        ? `Pemesanan ${updated.bookingCode} diterima. Silakan selesaikan pembayaran dalam 24 jam.`
        : `Pemesanan ${updated.bookingCode} ditolak: ${updated.rejectionReason}`,
      decision === 'accept' ? 'payment' : 'booking',
      '/dashboard/siswa'
    );

    await writeAuditLog(req.currentUser!.id, `BOOKING_${decision.toUpperCase()}`, 'booking', updated.id);
    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') return res.status(404).json({ error: 'Pemesanan tidak ditemukan.' });
    if (msg === 'INVALID_STATE') return res.status(400).json({ error: 'Status pemesanan tidak dapat diubah.' });
    console.error('Respond booking error:', err);
    res.status(500).json({ error: 'Gagal memproses respons pemesanan.' });
  }
});

apiRouter.post('/bookings/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    const bRows = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    const booking = bRows[0];
    if (!booking) return res.status(404).json({ error: 'Pemesanan tidak ditemukan.' });

    const user = req.currentUser!;
    if (user.role === 'student' && booking.studentUserId !== user.id) {
      return res.status(403).json({ error: 'Tidak memiliki akses.' });
    }
    if (!canTransitionBooking(booking.status as BookingStatus, 'cancelled')) {
      return res.status(400).json({ error: 'Pemesanan pada tahap ini tidak dapat dibatalkan.' });
    }

    const [updated] = await db
      .update(bookings)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    await writeAuditLog(user.id, 'BOOKING_CANCELLED', 'booking', bookingId);
    res.json(updated);
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ error: 'Gagal membatalkan pemesanan.' });
  }
});

apiRouter.post('/bookings/:id/parent-approve', requireAuth, requireRole('parent'), async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    const { approved } = req.body ?? {};
    const bRows = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    const booking = bRows[0];
    if (!booking) return res.status(404).json({ error: 'Pemesanan tidak ditemukan.' });

    const link = await db
      .select()
      .from(guardianRelationships)
      .where(
        and(
          eq(guardianRelationships.parentUserId, req.currentUser!.id),
          eq(guardianRelationships.studentUserId, booking.studentUserId),
          eq(guardianRelationships.verificationStatus, 'verified')
        )
      )
      .limit(1);
    if (link.length === 0) {
      return res.status(403).json({ error: 'Hubungan orang tua dan anak belum terverifikasi.' });
    }

    const [updated] = await db
      .update(bookings)
      .set({ parentApproved: Boolean(approved), updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    await writeAuditLog(req.currentUser!.id, 'PARENT_APPROVAL_UPDATED', 'booking', bookingId, {
      approved: Boolean(approved),
    });
    res.json(updated);
  } catch (err) {
    console.error('Parent approve error:', err);
    res.status(500).json({ error: 'Gagal memperbarui persetujuan orang tua.' });
  }
});

// ==================== 6. PAYMENT GATEWAY SANDBOX & WEBHOOK ====================

apiRouter.get('/payments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.currentUser!;
    const rows = await db
      .select({
        payment: payments,
        bookingCode: bookings.bookingCode,
        sessionDate: bookings.sessionDate,
        startTime: bookings.startTime,
        studentUserId: bookings.studentUserId,
        studentName: users.fullName,
        subjectName: subjects.name,
      })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .innerJoin(users, eq(bookings.studentUserId, users.id))
      .innerJoin(subjects, eq(bookings.subjectId, subjects.id))
      .orderBy(desc(payments.createdAt));

    if (user.role === 'admin') return res.json(rows);
    if (user.role === 'student') return res.json(rows.filter((r) => r.studentUserId === user.id));
    if (user.role === 'parent') {
      const links = await db
        .select()
        .from(guardianRelationships)
        .where(
          and(
            eq(guardianRelationships.parentUserId, user.id),
            eq(guardianRelationships.verificationStatus, 'verified')
          )
        );
      const childIds = new Set(links.map((l) => l.studentUserId));
      return res.json(rows.filter((r) => childIds.has(r.studentUserId)));
    }
    res.json([]);
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ error: 'Gagal memuat riwayat pembayaran.' });
  }
});

apiRouter.post('/payments/initiate', requireAuth, requireRole('student', 'parent', 'admin'), async (req: AuthRequest, res) => {
  try {
    const { bookingId, paymentMethod } = req.body ?? {};
    const validMethods = ['QRIS', 'Virtual Account', 'Transfer Bank', 'E-Wallet'];
    if (!bookingId || !validMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Metode pembayaran tidak valid.' });
    }

    const bRows = await db.select().from(bookings).where(eq(bookings.id, Number(bookingId))).limit(1);
    const booking = bRows[0];
    if (!booking) return res.status(404).json({ error: 'Pemesanan tidak ditemukan.' });
    if (req.currentUser!.role === 'student' && booking.studentUserId !== req.currentUser!.id) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }
    if (booking.status !== 'awaiting_payment' && booking.status !== 'accepted') {
      return res.status(400).json({ error: 'Tagihan untuk pemesanan ini tidak dalam status menunggu pembayaran.' });
    }
    if (booking.paymentDeadlineAt && booking.paymentDeadlineAt.getTime() < Date.now()) {
      await db
        .update(bookings)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(bookings.id, booking.id));
      return res.status(400).json({ error: 'Batas waktu pembayaran telah berakhir. Jadwal dilepaskan.' });
    }

    const vaNumber =
      paymentMethod === 'Virtual Account' || paymentMethod === 'Transfer Bank'
        ? `88019${String(booking.id).padStart(6, '0')}${crypto.randomInt(100, 999)}`
        : null;

    const existingPay = await db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, booking.id))
      .limit(1);

    let paymentRecord;
    if (existingPay.length > 0) {
      if (existingPay[0].status === 'paid') {
        return res.status(409).json({ error: 'Pembayaran untuk pemesanan ini sudah lunas.' });
      }
      const [updated] = await db
        .update(payments)
        .set({
          paymentMethod,
          vaNumber,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existingPay[0].id))
        .returning();
      paymentRecord = updated;
    } else {
      const extRef = `PAY-SBX-${booking.id}-${crypto.randomInt(1000, 9999)}`;
      const [inserted] = await db
        .insert(payments)
        .values({
          bookingId: booking.id,
          externalRef: extRef,
          paymentMethod,
          gatewayProvider: 'JumpaPay Sandbox',
          amount: booking.studentPriceSnapshot,
          status: 'pending',
          vaNumber,
          paymentUrl: `https://sandbox.jumpapay.local/pay/${extRef}`,
        })
        .returning();
      paymentRecord = inserted;
    }

    res.json({
      payment: paymentRecord,
      sandboxMode: true,
      instructions:
        paymentMethod === 'QRIS'
          ? 'Pindai QR Sandbox atau kirim konfirmasi webhook server untuk simulasi pelunasan.'
          : `Gunakan nomor VA ${vaNumber} di portal sandbox JumpaPay.`,
    });
  } catch (err) {
    console.error('Initiate payment error:', err);
    res.status(500).json({ error: 'Gagal menginisiasi pembayaran.' });
  }
});

// Server-verified payment webhook (prevents duplicate payment recording)
apiRouter.post('/payments/webhook', rateLimit(30, 60_000), async (req, res) => {
  try {
    const expectedSecret = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET;
    if (expectedSecret) {
      const incomingSecret = req.headers['x-webhook-secret'];
      if (incomingSecret !== expectedSecret) {
        return res.status(401).json({ error: 'Webhook signature tidak valid.' });
      }
    }

    const { externalRef, status, gatewayRef } = req.body ?? {};
    if (!externalRef || status !== 'paid') {
      return res.status(400).json({ error: 'Payload webhook tidak valid.' });
    }

    const result = await db.transaction(async (tx) => {
      const payRows = await tx
        .select()
        .from(payments)
        .where(eq(payments.externalRef, String(externalRef)))
        .for('update');
      const pay = payRows[0];
      if (!pay) throw new Error('PAYMENT_NOT_FOUND');
      if (pay.status === 'paid') {
        return { alreadyPaid: true, payment: pay, booking: null, session: null };
      }

      const [updatedPay] = await tx
        .update(payments)
        .set({
          status: 'paid',
          verifiedAt: new Date(),
          webhookPayload: {
            gatewayRef: gatewayRef || `GW-${crypto.randomInt(100000, 999999)}`,
            verifiedByServerAt: new Date().toISOString(),
            mode: 'sandbox',
          },
          updatedAt: new Date(),
        })
        .where(eq(payments.id, pay.id))
        .returning();

      const [updatedBooking] = await tx
        .update(bookings)
        .set({
          status: 'scheduled',
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, pay.bookingId))
        .returning();

      const roomCode = `ROOM-${updatedBooking.bookingCode}-${crypto.randomInt(100, 999)}`;
      const [session] = await tx
        .insert(learningSessions)
        .values({
          bookingId: updatedBooking.id,
          roomCode,
          meetingProvider:
            process.env.VIDEO_PROVIDER_MODE && process.env.VIDEO_PROVIDER_MODE !== 'sandbox'
              ? process.env.VIDEO_PROVIDER_MODE
              : 'JumpaMeet WebRTC Room',
          status: 'scheduled',
        })
        .onConflictDoNothing()
        .returning();

      return { alreadyPaid: false, payment: updatedPay, booking: updatedBooking, session };
    });

    if (result.alreadyPaid) {
      return res.json({
        message: 'Pembayaran sudah tercatat sebelumnya (idempoten).',
        payment: result.payment,
      });
    }

    if (result.booking) {
      const tp = await db
        .select()
        .from(teacherProfiles)
        .where(eq(teacherProfiles.id, result.booking.teacherProfileId))
        .limit(1);

      await createNotification(
        result.booking.studentUserId,
        'Pembayaran Terkonfirmasi',
        `Pembayaran ${result.booking.bookingCode} berhasil diverifikasi. Ruang kelas online siap digunakan.`,
        'payment',
        `/kelas/${result.booking.id}`
      );
      if (tp[0]) {
        await createNotification(
          tp[0].userId,
          'Kelas Siap Dilaksanakan',
          `Siswa telah melunasi tagihan ${result.booking.bookingCode}. Jadwal dikunci pada ${result.booking.sessionDate} pukul ${result.booking.startTime}.`,
          'booking',
          `/kelas/${result.booking.id}`
        );
      }
      await writeAuditLog(null, 'PAYMENT_WEBHOOK_VERIFIED', 'payment', result.payment.id, {
        externalRef: result.payment.externalRef,
        amount: result.payment.amount,
      });
    }

    res.json({
      message: 'Webhook pembayaran terverifikasi. Kelas resmi dijadwalkan.',
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'PAYMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Referensi pembayaran tidak ditemukan.' });
    }
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Gagal memproses webhook pembayaran.' });
  }
});

// ==================== 7. VIRTUAL CLASSROOM & SESSION COMPLETION ====================

async function authorizeClassroomAccess(userId: number, userRole: UserRole, bookingId: number) {
  const bRows = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  const booking = bRows[0];
  if (!booking) return null;

  const tpRows = await db
    .select({ tp: teacherProfiles, teacherName: users.fullName })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .where(eq(teacherProfiles.id, booking.teacherProfileId))
    .limit(1);
  const teacher = tpRows[0];

  const stRows = await db.select().from(users).where(eq(users.id, booking.studentUserId)).limit(1);
  const student = stRows[0];

  const subRows = await db.select().from(subjects).where(eq(subjects.id, booking.subjectId)).limit(1);

  const isAllowed =
    userRole === 'admin' ||
    booking.studentUserId === userId ||
    (teacher && teacher.tp.userId === userId);

  if (!isAllowed) return 'FORBIDDEN' as const;

  const sessRows = await db
    .select()
    .from(learningSessions)
    .where(eq(learningSessions.bookingId, booking.id))
    .limit(1);

  return {
    booking,
    teacherName: teacher?.teacherName || 'Guru',
    teacherUserId: teacher?.tp.userId || null,
    studentName: student?.fullName || 'Siswa',
    subjectName: subRows[0]?.name || 'Mata Pelajaran',
    session: sessRows[0] || null,
  };
}

apiRouter.get('/classroom/:bookingId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    const access = await authorizeClassroomAccess(
      req.currentUser!.id,
      req.currentUser!.role,
      bookingId
    );
    if (access === null) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
    if (access === 'FORBIDDEN') {
      return res.status(403).json({
        error: 'Akses ruang kelas ditolak. Hanya guru dan siswa terdaftar yang dapat masuk.',
      });
    }
    if (
      !['paid', 'scheduled', 'in_progress', 'completed'].includes(access.booking.status)
    ) {
      return res.status(400).json({
        error: 'Kelas belum dapat diakses sebelum pembayaran terkonfirmasi.',
      });
    }
    res.json(access);
  } catch (err) {
    console.error('Get classroom error:', err);
    res.status(500).json({ error: 'Gagal memuat ruang kelas online.' });
  }
});

apiRouter.post('/classroom/:bookingId/attendance', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    const access = await authorizeClassroomAccess(
      req.currentUser!.id,
      req.currentUser!.role,
      bookingId
    );
    if (!access || access === 'FORBIDDEN' || !access.session) {
      return res.status(403).json({ error: 'Akses ruang kelas tidak valid.' });
    }

    const now = new Date();
    const isTeacher = req.currentUser!.id === access.teacherUserId;
    const isStudent = req.currentUser!.id === access.booking.studentUserId;

    const [updatedSession] = await db
      .update(learningSessions)
      .set({
        teacherAttendedAt: isTeacher ? access.session.teacherAttendedAt || now : access.session.teacherAttendedAt,
        studentAttendedAt: isStudent ? access.session.studentAttendedAt || now : access.session.studentAttendedAt,
        startedAt: access.session.startedAt || now,
        status: access.session.status === 'completed' ? 'completed' : 'live',
        updatedAt: now,
      })
      .where(eq(learningSessions.id, access.session.id))
      .returning();

    if (access.booking.status === 'scheduled' || access.booking.status === 'paid') {
      await db
        .update(bookings)
        .set({ status: 'in_progress', updatedAt: now })
        .where(eq(bookings.id, access.booking.id));
    }

    res.json(updatedSession);
  } catch (err) {
    console.error('Attendance error:', err);
    res.status(500).json({ error: 'Gagal mencatat kehadiran kelas.' });
  }
});

apiRouter.post('/classroom/:bookingId/chat', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    const { message } = req.body ?? {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
    }
    const access = await authorizeClassroomAccess(
      req.currentUser!.id,
      req.currentUser!.role,
      bookingId
    );
    if (!access || access === 'FORBIDDEN' || !access.session) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }

    const newMsg = {
      id: crypto.randomUUID(),
      senderName: req.currentUser!.fullName,
      senderRole: req.currentUser!.role,
      message: String(message).trim(),
      sentAt: new Date().toISOString(),
    };

    const nextMessages = [...(access.session.chatMessages || []), newMsg];
    const [updated] = await db
      .update(learningSessions)
      .set({ chatMessages: nextMessages, updatedAt: new Date() })
      .where(eq(learningSessions.id, access.session.id))
      .returning();

    res.json(updated.chatMessages);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Gagal mengirim pesan kelas.' });
  }
});

apiRouter.post('/classroom/:bookingId/materials', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    const { title, type = 'Catatan', urlOrNote } = req.body ?? {};
    if (!title || !urlOrNote) {
      return res.status(400).json({ error: 'Judul dan isi materi wajib diisi.' });
    }
    const access = await authorizeClassroomAccess(
      req.currentUser!.id,
      req.currentUser!.role,
      bookingId
    );
    if (!access || access === 'FORBIDDEN' || !access.session) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }

    const nextMaterials = [
      ...(access.session.materials || []),
      {
        id: crypto.randomUUID(),
        title: String(title).trim(),
        type: String(type),
        urlOrNote: String(urlOrNote).trim(),
        addedBy: req.currentUser!.fullName,
      },
    ];

    const [updated] = await db
      .update(learningSessions)
      .set({ materials: nextMaterials, updatedAt: new Date() })
      .where(eq(learningSessions.id, access.session.id))
      .returning();

    res.json(updated.materials);
  } catch (err) {
    console.error('Materials error:', err);
    res.status(500).json({ error: 'Gagal menambahkan materi pembelajaran.' });
  }
});

apiRouter.post('/classroom/:bookingId/complete', requireAuth, requireRole('teacher', 'admin'), async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    const { summaryNotes } = req.body ?? {};

    const result = await db.transaction(async (tx) => {
      const bRows = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for('update');
      const booking = bRows[0];
      if (!booking) throw new Error('NOT_FOUND');

      if (req.currentUser!.role === 'teacher') {
        const tp = await tx
          .select()
          .from(teacherProfiles)
          .where(eq(teacherProfiles.id, booking.teacherProfileId))
          .limit(1);
        if (!tp[0] || tp[0].userId !== req.currentUser!.id) {
          throw new Error('FORBIDDEN');
        }
      }

      if (booking.status === 'completed') {
        return { alreadyCompleted: true, booking };
      }
      if (!['paid', 'scheduled', 'in_progress'].includes(booking.status)) {
        throw new Error('INVALID_STATE');
      }

      const now = new Date();
      const [updatedBooking] = await tx
        .update(bookings)
        .set({ status: 'completed', updatedAt: now })
        .where(eq(bookings.id, booking.id))
        .returning();

      await tx
        .update(learningSessions)
        .set({
          status: 'completed',
          endedAt: now,
          summaryNotes: summaryNotes ? String(summaryNotes).trim() : null,
          updatedAt: now,
        })
        .where(eq(learningSessions.bookingId, booking.id));

      await tx
        .update(teacherProfiles)
        .set({
          totalSessions: sql`${teacherProfiles.totalSessions} + 1`,
          updatedAt: now,
        })
        .where(eq(teacherProfiles.id, booking.teacherProfileId));

      // Idempotency check on ledger before crediting teacher wallet
      const existingCredit = await tx
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.bookingId, booking.id),
            eq(walletTransactions.type, 'credit_earning')
          )
        )
        .limit(1);

      if (existingCredit.length === 0) {
        let wRows = await tx
          .select()
          .from(teacherWallets)
          .where(eq(teacherWallets.teacherProfileId, booking.teacherProfileId))
          .for('update');
        if (wRows.length === 0) {
          wRows = await tx
            .insert(teacherWallets)
            .values({ teacherProfileId: booking.teacherProfileId })
            .returning();
        }
        const wallet = wRows[0];
        const before = wallet.availableBalance;
        const after = before + booking.teacherEarningSnapshot;

        await tx
          .update(teacherWallets)
          .set({
            totalEarned: wallet.totalEarned + booking.teacherEarningSnapshot,
            availableBalance: after,
            updatedAt: now,
          })
          .where(eq(teacherWallets.id, wallet.id));

        await tx.insert(walletTransactions).values({
          walletId: wallet.id,
          bookingId: booking.id,
          type: 'credit_earning',
          amount: booking.teacherEarningSnapshot,
          balanceBefore: before,
          balanceAfter: after,
          description: `Pendapatan sesi ${booking.bookingCode} (${booking.educationLevel} ${booking.durationMinutes} menit)`,
          referenceCode: `LED-CR-${booking.id}-${crypto.randomInt(100, 999)}`,
        });
      }

      return { alreadyCompleted: false, booking: updatedBooking };
    });

    if (!result.alreadyCompleted) {
      await createNotification(
        result.booking.studentUserId,
        'Sesi Belajar Selesai',
        `Sesi ${result.booking.bookingCode} telah selesai. Silakan berikan ulasan untuk guru Anda.`,
        'booking',
        '/dashboard/siswa'
      );
      await writeAuditLog(req.currentUser!.id, 'SESSION_COMPLETED', 'booking', result.booking.id, {
        teacherEarning: result.booking.teacherEarningSnapshot,
      });
    }

    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') return res.status(404).json({ error: 'Pemesanan tidak ditemukan.' });
    if (msg === 'FORBIDDEN') return res.status(403).json({ error: 'Akses ditolak.' });
    if (msg === 'INVALID_STATE') return res.status(400).json({ error: 'Sesi belum berstatus aktif.' });
    console.error('Complete session error:', err);
    res.status(500).json({ error: 'Gagal menyelesaikan sesi pembelajaran.' });
  }
});

// ==================== 8. REVIEWS ====================

apiRouter.post('/reviews', requireAuth, requireRole('student'), async (req: AuthRequest, res) => {
  try {
    const { bookingId, rating, comment } = req.body ?? {};
    const numRating = Number(rating);
    if (!bookingId || !Number.isInteger(numRating) || numRating < 1 || numRating > 5 || !comment) {
      return res.status(400).json({ error: 'Rating (1-5) dan komentar ulasan wajib diisi.' });
    }

    const bRows = await db.select().from(bookings).where(eq(bookings.id, Number(bookingId))).limit(1);
    const booking = bRows[0];
    if (!booking || booking.studentUserId !== req.currentUser!.id) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses untuk mengulas sesi ini.' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ error: 'Ulasan hanya dapat diberikan setelah kelas selesai.' });
    }

    const created = await db.transaction(async (tx) => {
      const [rev] = await tx
        .insert(reviews)
        .values({
          bookingId: booking.id,
          studentUserId: req.currentUser!.id,
          teacherProfileId: booking.teacherProfileId,
          rating: numRating,
          comment: String(comment).trim(),
          isPublished: true,
        })
        .returning();

      const allTeacherRevs = await tx
        .select()
        .from(reviews)
        .where(eq(reviews.teacherProfileId, booking.teacherProfileId));

      const avg =
        allTeacherRevs.reduce((acc, r) => acc + r.rating, 0) / Math.max(1, allTeacherRevs.length);

      await tx
        .update(teacherProfiles)
        .set({
          ratingAvg: avg.toFixed(2),
          totalReviews: allTeacherRevs.length,
          updatedAt: new Date(),
        })
        .where(eq(teacherProfiles.id, booking.teacherProfileId));

      return rev;
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('Create review error:', err);
    res.status(400).json({ error: 'Ulasan sudah pernah dikirim atau gagal disimpan.' });
  }
});

// ==================== 9. TEACHER WALLET, BANK ACCOUNTS & WITHDRAWALS ====================

apiRouter.get('/wallet/me', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const tpRows = await db
      .select()
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, req.currentUser!.id))
      .limit(1);
    const tp = tpRows[0];
    if (!tp) return res.status(404).json({ error: 'Profil guru tidak ditemukan.' });

    let wRows = await db
      .select()
      .from(teacherWallets)
      .where(eq(teacherWallets.teacherProfileId, tp.id))
      .limit(1);
    if (wRows.length === 0) {
      wRows = await db.insert(teacherWallets).values({ teacherProfileId: tp.id }).returning();
    }
    const wallet = wRows[0];

    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.walletId, wallet.id))
      .orderBy(desc(walletTransactions.createdAt));

    const accounts = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.teacherProfileId, tp.id));

    const withdrawals = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.teacherProfileId, tp.id))
      .orderBy(desc(withdrawalRequests.requestedAt));

    res.json({ wallet, transactions, bankAccounts: accounts, withdrawals });
  } catch (err) {
    console.error('Get wallet error:', err);
    res.status(500).json({ error: 'Gagal memuat data dompet guru.' });
  }
});

apiRouter.post('/wallet/bank-accounts', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const { bankName, accountNumber, accountHolderName } = req.body ?? {};
    if (!bankName || !accountNumber || !accountHolderName) {
      return res.status(400).json({ error: 'Nama bank, nomor rekening, dan atas nama wajib diisi.' });
    }
    const tpRows = await db
      .select()
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, req.currentUser!.id))
      .limit(1);
    const tp = tpRows[0];
    if (!tp) return res.status(404).json({ error: 'Profil guru tidak ditemukan.' });

    const [created] = await db
      .insert(bankAccounts)
      .values({
        teacherProfileId: tp.id,
        bankName: String(bankName).trim(),
        accountNumber: String(accountNumber).trim(),
        accountHolderName: String(accountHolderName).trim(),
        isVerified: true,
        isPrimary: true,
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    console.error('Add bank account error:', err);
    res.status(500).json({ error: 'Gagal menambahkan rekening bank.' });
  }
});

apiRouter.post('/wallet/withdrawals', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const { bankAccountId, amount, notes } = req.body ?? {};
    const numAmount = Math.round(Number(amount));

    const tpRows = await db
      .select()
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, req.currentUser!.id))
      .limit(1);
    const tp = tpRows[0];
    if (!tp) return res.status(404).json({ error: 'Profil guru tidak ditemukan.' });

    const created = await db.transaction(async (tx) => {
      const bankRows = await tx
        .select()
        .from(bankAccounts)
        .where(and(eq(bankAccounts.id, Number(bankAccountId)), eq(bankAccounts.teacherProfileId, tp.id)))
        .limit(1);
      if (bankRows.length === 0) throw new Error('Rekening tujuan tidak valid.');

      const wRows = await tx
        .select()
        .from(teacherWallets)
        .where(eq(teacherWallets.teacherProfileId, tp.id))
        .for('update');
      const wallet = wRows[0];
      if (!wallet) throw new Error('Dompet guru tidak ditemukan.');

      const valErr = validateWithdrawalAmount(numAmount, wallet.availableBalance);
      if (valErr) throw new Error(valErr);

      const before = wallet.availableBalance;
      const after = before - numAmount;

      const [wd] = await tx
        .insert(withdrawalRequests)
        .values({
          teacherProfileId: tp.id,
          bankAccountId: bankRows[0].id,
          amount: numAmount,
          status: 'requested',
          notes: notes ? String(notes).trim() : null,
        })
        .returning();

      await tx
        .update(teacherWallets)
        .set({
          availableBalance: after,
          totalWithdrawn: wallet.totalWithdrawn + numAmount,
          updatedAt: new Date(),
        })
        .where(eq(teacherWallets.id, wallet.id));

      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        withdrawalId: wd.id,
        type: 'debit_withdrawal',
        amount: numAmount,
        balanceBefore: before,
        balanceAfter: after,
        description: `Pengajuan pencairan ke ${bankRows[0].bankName} (${bankRows[0].accountNumber})`,
        referenceCode: `LED-WD-${wd.id}-${crypto.randomInt(100, 999)}`,
      });

      return wd;
    });

    await writeAuditLog(req.currentUser!.id, 'WITHDRAWAL_REQUESTED', 'withdrawal', created.id, {
      amount: numAmount,
    });
    res.status(201).json(created);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    console.error('Withdrawal error:', err);
    res.status(400).json({ error: msg || 'Gagal mengajukan pencairan dana.' });
  }
});

// ==================== 10. PARENT / GUARDIAN & COMPLAINTS & NOTIFICATIONS ====================

apiRouter.get('/parent/children', requireAuth, requireRole('parent'), async (req: AuthRequest, res) => {
  try {
    const links = await db
      .select({
        relationship: guardianRelationships,
        studentName: users.fullName,
        studentEmail: users.email,
        studentPhone: users.phone,
      })
      .from(guardianRelationships)
      .innerJoin(users, eq(guardianRelationships.studentUserId, users.id))
      .where(eq(guardianRelationships.parentUserId, req.currentUser!.id));

    const profiles = await db.select().from(studentProfiles);
    const profMap = new Map(profiles.map((p) => [p.userId, p]));

    res.json(
      links.map((l) => ({
        ...l.relationship,
        studentName: l.studentName,
        studentEmail: l.studentEmail,
        studentPhone: l.studentPhone,
        studentProfile: profMap.get(l.relationship.studentUserId) || null,
      }))
    );
  } catch (err) {
    console.error('Parent children error:', err);
    res.status(500).json({ error: 'Gagal memuat data anak.' });
  }
});

apiRouter.post('/parent/link-child', requireAuth, requireRole('parent'), async (req: AuthRequest, res) => {
  try {
    const { childEmail, relationshipType = 'Orang Tua' } = req.body ?? {};
    if (!childEmail) return res.status(400).json({ error: 'Email akun anak wajib diisi.' });
    const childRows = await db
      .select()
      .from(users)
      .where(eq(users.email, String(childEmail).trim().toLowerCase()))
      .limit(1);
    if (childRows.length === 0 || childRows[0].role !== 'student') {
      return res.status(404).json({ error: 'Akun siswa dengan email tersebut tidak ditemukan.' });
    }
    const [created] = await db
      .insert(guardianRelationships)
      .values({
        parentUserId: req.currentUser!.id,
        studentUserId: childRows[0].id,
        relationshipType: String(relationshipType),
        verificationStatus: 'pending',
      })
      .onConflictDoNothing()
      .returning();
    res.status(201).json(created || { message: 'Permintaan verifikasi sudah diajukan.' });
  } catch (err) {
    console.error('Link child error:', err);
    res.status(500).json({ error: 'Gagal menautkan akun anak.' });
  }
});

apiRouter.get('/complaints', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.currentUser!;
    const rows = await db
      .select({
        complaint: complaints,
        reporterName: users.fullName,
        reporterRole: users.role,
      })
      .from(complaints)
      .innerJoin(users, eq(complaints.reporterUserId, users.id))
      .orderBy(desc(complaints.createdAt));

    if (user.role === 'admin') return res.json(rows);
    res.json(rows.filter((r) => r.complaint.reporterUserId === user.id));
  } catch (err) {
    console.error('Get complaints error:', err);
    res.status(500).json({ error: 'Gagal memuat pengaduan.' });
  }
});

apiRouter.post('/complaints', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { bookingId, category = 'Layanan', subject, description } = req.body ?? {};
    if (!subject || !description) {
      return res.status(400).json({ error: 'Subjek dan deskripsi permasalahan wajib diisi.' });
    }
    const [created] = await db
      .insert(complaints)
      .values({
        reporterUserId: req.currentUser!.id,
        bookingId: bookingId ? Number(bookingId) : null,
        category: String(category),
        subject: String(subject).trim(),
        description: String(description).trim(),
        status: 'open',
      })
      .returning();

    await writeAuditLog(req.currentUser!.id, 'COMPLAINT_SUBMITTED', 'complaint', created.id);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create complaint error:', err);
    res.status(500).json({ error: 'Gagal mengirim pengaduan.' });
  }
});

apiRouter.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.currentUser!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    res.json(list);
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Gagal memuat notifikasi.' });
  }
});

apiRouter.post('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, Number(req.params.id)),
          eq(notifications.userId, req.currentUser!.id)
        )
      );
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Gagal memperbarui notifikasi.' });
  }
});

// ==================== 11. ADMINISTRATOR ENDPOINTS ====================

apiRouter.get('/admin/overview', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const allTeachers = await db.select().from(teacherProfiles);
    const allStudents = await db.select().from(users).where(eq(users.role, 'student'));
    const allBookings = await db.select().from(bookings);
    const allPayments = await db.select().from(payments);
    const allWithdrawals = await db.select().from(withdrawalRequests);

    const todayStr = new Date().toISOString().slice(0, 10);
    const paidPayments = allPayments.filter((p) => p.status === 'paid');
    const platformRevenue = allBookings
      .filter((b) => ['paid', 'scheduled', 'in_progress', 'completed'].includes(b.status))
      .reduce((sum, b) => sum + b.platformCommissionSnapshot, 0);

    res.json({
      totalTeachers: allTeachers.length,
      totalStudents: allStudents.length,
      activeTeachers: allTeachers.filter((t) => t.verificationStatus === 'active').length,
      pendingVerifications: allTeachers.filter((t) =>
        ['submitted', 'under_review', 'revision_required'].includes(t.verificationStatus)
      ).length,
      totalBookings: allBookings.length,
      todayBookings: allBookings.filter((b) => b.sessionDate === todayStr).length,
      liveClasses: allBookings.filter((b) => b.status === 'in_progress').length,
      totalTransactions: paidPayments.length,
      grossTransactionVolume: paidPayments.reduce((sum, p) => sum + p.amount, 0),
      platformRevenue,
      pendingWithdrawals: allWithdrawals.filter((w) =>
        ['requested', 'processing'].includes(w.status)
      ).length,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Gagal memuat statistik administrator.' });
  }
});

apiRouter.get('/admin/teachers', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const rows = await db
      .select({
        profile: teacherProfiles,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        isActiveUser: users.isActive,
      })
      .from(teacherProfiles)
      .innerJoin(users, eq(teacherProfiles.userId, users.id))
      .orderBy(desc(teacherProfiles.createdAt));

    const allWallets = await db.select().from(teacherWallets);
    const walletMap = new Map(allWallets.map((w) => [w.teacherProfileId, w]));

    res.json(
      rows.map((r) => ({
        ...r.profile,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        avatarUrl: r.avatarUrl,
        isActiveUser: r.isActiveUser,
        wallet: walletMap.get(r.profile.id) || null,
      }))
    );
  } catch (err) {
    console.error('Admin teachers error:', err);
    res.status(500).json({ error: 'Gagal memuat data guru.' });
  }
});

apiRouter.post('/admin/teachers/:id/verify', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const teacherProfileId = Number(req.params.id);
    const { status, revisionNotes } = req.body ?? {};
    const allowed = ['under_review', 'revision_required', 'approved', 'active', 'suspended', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Status verifikasi tidak valid.' });
    }

    const [updated] = await db
      .update(teacherProfiles)
      .set({
        verificationStatus: status,
        revisionNotes: revisionNotes ? String(revisionNotes).trim() : null,
        updatedAt: new Date(),
      })
      .where(eq(teacherProfiles.id, teacherProfileId))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Profil guru tidak ditemukan.' });

    if (status === 'active' || status === 'approved') {
      await db
        .update(bankAccounts)
        .set({ isVerified: true })
        .where(eq(bankAccounts.teacherProfileId, teacherProfileId));
    }

    await createNotification(
      updated.userId,
      'Pembaruan Status Verifikasi Guru',
      `Status akun guru Anda kini: ${status}${revisionNotes ? ` (${revisionNotes})` : ''}.`,
      'verification',
      '/dashboard/guru'
    );
    await writeAuditLog(req.currentUser!.id, 'TEACHER_VERIFICATION_UPDATED', 'teacher_profile', teacherProfileId, {
      status,
      revisionNotes,
    });

    res.json(updated);
  } catch (err) {
    console.error('Verify teacher error:', err);
    res.status(500).json({ error: 'Gagal memperbarui verifikasi guru.' });
  }
});

apiRouter.get('/admin/users', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const list = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        role: users.role,
        isEmailVerified: users.isEmailVerified,
        isPhoneVerified: users.isPhoneVerified,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    res.json(list);
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Gagal memuat daftar pengguna.' });
  }
});

apiRouter.post('/admin/users/:id/toggle-active', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.currentUser!.id) {
      return res.status(400).json({ error: 'Anda tidak dapat menonaktifkan akun sendiri.' });
    }
    const rows = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (rows.length === 0) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

    const [updated] = await db
      .update(users)
      .set({ isActive: !rows[0].isActive, updatedAt: new Date() })
      .where(eq(users.id, targetId))
      .returning();

    await writeAuditLog(req.currentUser!.id, 'USER_ACTIVE_TOGGLED', 'user', targetId, {
      isActive: updated.isActive,
    });
    res.json({ id: updated.id, isActive: updated.isActive });
  } catch (err) {
    console.error('Toggle user active error:', err);
    res.status(500).json({ error: 'Gagal mengubah status aktif pengguna.' });
  }
});

apiRouter.post('/admin/users/admin', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { fullName, email, password, phone } = req.body ?? {};
    if (!fullName || !email || !password || String(password).length < 8) {
      return res.status(400).json({ error: 'Nama, email, dan kata sandi minimal 8 karakter wajib diisi.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const [created] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash: hashPassword(String(password)),
        fullName: String(fullName).trim(),
        phone: phone ? String(phone).trim() : null,
        role: 'admin',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
      })
      .returning();

    await writeAuditLog(req.currentUser!.id, 'ADMIN_CREATED', 'user', created.id);
    res.status(201).json({
      id: created.id,
      email: created.email,
      fullName: created.fullName,
      role: created.role,
      isActive: created.isActive,
    });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(400).json({ error: 'Email admin mungkin sudah terdaftar.' });
  }
});

apiRouter.get('/admin/guardians', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: guardianRelationships.id,
        parentUserId: guardianRelationships.parentUserId,
        studentUserId: guardianRelationships.studentUserId,
        relationshipType: guardianRelationships.relationshipType,
        verificationStatus: guardianRelationships.verificationStatus,
        approvalNotes: guardianRelationships.approvalNotes,
        createdAt: guardianRelationships.createdAt,
      })
      .from(guardianRelationships)
      .orderBy(desc(guardianRelationships.createdAt));

    const allUsers = await db.select().from(users);
    const uMap = new Map(allUsers.map((u) => [u.id, u]));

    res.json(
      rows.map((r) => ({
        ...r,
        parentName: uMap.get(r.parentUserId)?.fullName || '-',
        parentEmail: uMap.get(r.parentUserId)?.email || '-',
        studentName: uMap.get(r.studentUserId)?.fullName || '-',
        studentEmail: uMap.get(r.studentUserId)?.email || '-',
      }))
    );
  } catch (err) {
    console.error('Admin guardians error:', err);
    res.status(500).json({ error: 'Gagal memuat relasi orang tua.' });
  }
});

apiRouter.post('/admin/guardians/:id/verify', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { status } = req.body ?? {};
    if (!['verified', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Status verifikasi tidak valid.' });
    }
    const [updated] = await db
      .update(guardianRelationships)
      .set({ verificationStatus: status })
      .where(eq(guardianRelationships.id, Number(req.params.id)))
      .returning();
    await writeAuditLog(req.currentUser!.id, 'GUARDIAN_VERIFIED', 'guardian', req.params.id, { status });
    res.json(updated);
  } catch (err) {
    console.error('Verify guardian error:', err);
    res.status(500).json({ error: 'Gagal memverifikasi relasi orang tua.' });
  }
});

apiRouter.post('/admin/subjects', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { name, category, description } = req.body ?? {};
    if (!name || !category || !description) {
      return res.status(400).json({ error: 'Nama, kategori, dan deskripsi mata pelajaran wajib diisi.' });
    }
    const slug = String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const [created] = await db
      .insert(subjects)
      .values({ slug, name: String(name).trim(), category: String(category).trim(), description: String(description).trim() })
      .returning();
    await writeAuditLog(req.currentUser!.id, 'SUBJECT_CREATED', 'subject', created.id);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create subject error:', err);
    res.status(400).json({ error: 'Gagal menambah mata pelajaran.' });
  }
});

apiRouter.put('/admin/subjects/:id', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { name, category, description, isActive } = req.body ?? {};
    const [updated] = await db
      .update(subjects)
      .set({
        name: name ? String(name).trim() : undefined,
        category: category ? String(category).trim() : undefined,
        description: description ? String(description).trim() : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
      })
      .where(eq(subjects.id, Number(req.params.id)))
      .returning();
    res.json(updated);
  } catch (err) {
    console.error('Update subject error:', err);
    res.status(500).json({ error: 'Gagal memperbarui mata pelajaran.' });
  }
});

apiRouter.post('/admin/pricing', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { educationLevel, durationMinutes, studentPrice, teacherSharePercent } = req.body ?? {};
    const split = calculatePricingSplit(Number(studentPrice), Number(teacherSharePercent));
    const [created] = await db
      .insert(pricingPlans)
      .values({
        educationLevel: String(educationLevel),
        durationMinutes: Number(durationMinutes),
        studentPrice: split.studentPrice,
        teacherSharePercent: split.teacherSharePercent,
        platformCommissionPercent: split.platformCommissionPercent,
        isActive: true,
      })
      .returning();
    await writeAuditLog(req.currentUser!.id, 'PRICING_CREATED', 'pricing_plan', created.id, {
      studentPrice: split.studentPrice,
    });
    res.status(201).json(created);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal membuat paket harga.';
    res.status(400).json({ error: msg });
  }
});

apiRouter.put('/admin/pricing/:id', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { studentPrice, teacherSharePercent, isActive } = req.body ?? {};
    const split = calculatePricingSplit(Number(studentPrice), Number(teacherSharePercent));
    const [updated] = await db
      .update(pricingPlans)
      .set({
        studentPrice: split.studentPrice,
        teacherSharePercent: split.teacherSharePercent,
        platformCommissionPercent: split.platformCommissionPercent,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        updatedAt: new Date(),
      })
      .where(eq(pricingPlans.id, Number(req.params.id)))
      .returning();

    await writeAuditLog(req.currentUser!.id, 'PRICING_UPDATED', 'pricing_plan', req.params.id, {
      studentPrice: split.studentPrice,
      teacherSharePercent: split.teacherSharePercent,
    });
    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal memperbarui paket harga.';
    res.status(400).json({ error: msg });
  }
});

apiRouter.get('/admin/withdrawals', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const rows = await db
      .select({
        withdrawal: withdrawalRequests,
        bankName: bankAccounts.bankName,
        accountNumber: bankAccounts.accountNumber,
        accountHolderName: bankAccounts.accountHolderName,
      })
      .from(withdrawalRequests)
      .innerJoin(bankAccounts, eq(withdrawalRequests.bankAccountId, bankAccounts.id))
      .orderBy(desc(withdrawalRequests.requestedAt));

    const tps = await db
      .select({ tpId: teacherProfiles.id, teacherName: users.fullName })
      .from(teacherProfiles)
      .innerJoin(users, eq(teacherProfiles.userId, users.id));
    const tpMap = new Map(tps.map((t) => [t.tpId, t.teacherName]));

    res.json(
      rows.map((r) => ({
        ...r.withdrawal,
        teacherName: tpMap.get(r.withdrawal.teacherProfileId) || 'Guru',
        bankName: r.bankName,
        accountNumber: r.accountNumber,
        accountHolderName: r.accountHolderName,
      }))
    );
  } catch (err) {
    console.error('Admin withdrawals error:', err);
    res.status(500).json({ error: 'Gagal memuat daftar pencairan.' });
  }
});

apiRouter.post('/admin/withdrawals/:id/process', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const wdId = Number(req.params.id);
    const { status, payoutReference, notes } = req.body ?? {};
    const targetStatus = status as WithdrawalStatus;

    const updated = await db.transaction(async (tx) => {
      const wdRows = await tx
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.id, wdId))
        .for('update');
      const wd = wdRows[0];
      if (!wd) throw new Error('NOT_FOUND');
      if (!canTransitionWithdrawal(wd.status as WithdrawalStatus, targetStatus)) {
        throw new Error('INVALID_STATE');
      }

      const [nextWd] = await tx
        .update(withdrawalRequests)
        .set({
          status: targetStatus,
          payoutReference:
            payoutReference ||
            (targetStatus === 'paid' ? `WD-PAYOUT-${wd.id}-${crypto.randomInt(1000, 9999)}` : wd.payoutReference),
          processedByUserId: req.currentUser!.id,
          notes: notes ? String(notes).trim() : wd.notes,
          processedAt: new Date(),
        })
        .where(eq(withdrawalRequests.id, wd.id))
        .returning();

      // Refund wallet balance safely once if failed or reversed
      if (targetStatus === 'failed' || targetStatus === 'reversed') {
        const wRows = await tx
          .select()
          .from(teacherWallets)
          .where(eq(teacherWallets.teacherProfileId, wd.teacherProfileId))
          .for('update');
        const wallet = wRows[0];
        if (wallet) {
          const before = wallet.availableBalance;
          const after = before + wd.amount;
          await tx
            .update(teacherWallets)
            .set({
              availableBalance: after,
              totalWithdrawn: Math.max(0, wallet.totalWithdrawn - wd.amount),
              updatedAt: new Date(),
            })
            .where(eq(teacherWallets.id, wallet.id));

          await tx.insert(walletTransactions).values({
            walletId: wallet.id,
            withdrawalId: wd.id,
            type: 'reversal',
            amount: wd.amount,
            balanceBefore: before,
            balanceAfter: after,
            description: `Pengembalian saldo pencairan #${wd.id} (${targetStatus})`,
            referenceCode: `LED-REV-${wd.id}-${crypto.randomInt(100, 999)}`,
          });
        }
      }

      return nextWd;
    });

    await writeAuditLog(req.currentUser!.id, 'WITHDRAWAL_PROCESSED', 'withdrawal', wdId, {
      status: targetStatus,
      payoutReference: updated.payoutReference,
    });
    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') return res.status(404).json({ error: 'Permintaan pencairan tidak ditemukan.' });
    if (msg === 'INVALID_STATE') return res.status(400).json({ error: 'Transisi status pencairan tidak valid.' });
    console.error('Process withdrawal error:', err);
    res.status(500).json({ error: 'Gagal memproses pencairan dana.' });
  }
});

apiRouter.get('/admin/reviews', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const rows = await db
      .select({
        review: reviews,
        studentName: users.fullName,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.studentUserId, users.id))
      .orderBy(desc(reviews.createdAt));
    res.json(rows);
  } catch (err) {
    console.error('Admin reviews error:', err);
    res.status(500).json({ error: 'Gagal memuat ulasan.' });
  }
});

apiRouter.post('/admin/reviews/:id/toggle', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(reviews).where(eq(reviews.id, Number(req.params.id))).limit(1);
    if (!rows[0]) return res.status(404).json({ error: 'Ulasan tidak ditemukan.' });
    const [updated] = await db
      .update(reviews)
      .set({ isPublished: !rows[0].isPublished })
      .where(eq(reviews.id, rows[0].id))
      .returning();
    res.json(updated);
  } catch (err) {
    console.error('Toggle review error:', err);
    res.status(500).json({ error: 'Gagal mengubah status ulasan.' });
  }
});

apiRouter.post('/admin/complaints/:id/resolve', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { status = 'resolved', adminResponse } = req.body ?? {};
    const [updated] = await db
      .update(complaints)
      .set({
        status: String(status),
        adminResponse: adminResponse ? String(adminResponse).trim() : null,
        updatedAt: new Date(),
      })
      .where(eq(complaints.id, Number(req.params.id)))
      .returning();
    await writeAuditLog(req.currentUser!.id, 'COMPLAINT_UPDATED', 'complaint', req.params.id, { status });
    res.json(updated);
  } catch (err) {
    console.error('Resolve complaint error:', err);
    res.status(500).json({ error: 'Gagal memperbarui status pengaduan.' });
  }
});

apiRouter.get('/admin/finance', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const paidBookings = await db
      .select()
      .from(bookings)
      .where(inArray(bookings.status, ['paid', 'scheduled', 'in_progress', 'completed']))
      .orderBy(desc(bookings.createdAt));

    const ledger = await db
      .select()
      .from(walletTransactions)
      .orderBy(desc(walletTransactions.createdAt))
      .limit(100);

    const totalGross = paidBookings.reduce((s, b) => s + b.studentPriceSnapshot, 0);
    const totalTeacherShare = paidBookings.reduce((s, b) => s + b.teacherEarningSnapshot, 0);
    const totalPlatformCommission = paidBookings.reduce((s, b) => s + b.platformCommissionSnapshot, 0);

    res.json({
      summary: { totalGross, totalTeacherShare, totalPlatformCommission },
      bookings: paidBookings,
      ledger,
    });
  } catch (err) {
    console.error('Admin finance error:', err);
    res.status(500).json({ error: 'Gagal memuat laporan keuangan.' });
  }
});

apiRouter.get('/admin/audit-logs', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    res.json(logs);
  } catch (err) {
    console.error('Admin audit logs error:', err);
    res.status(500).json({ error: 'Gagal memuat audit log.' });
  }
});

apiRouter.put('/admin/site-settings', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const payload = req.body ?? {};
    const [updated] = await db
      .insert(siteSettings)
      .values({ key: 'platform_config', value: payload })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: payload, updatedAt: new Date() },
      })
      .returning();
    await writeAuditLog(req.currentUser!.id, 'SITE_SETTINGS_UPDATED', 'site_settings', 'platform_config');
    res.json(updated.value);
  } catch (err) {
    console.error('Site settings update error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pengaturan website.' });
  }
});
