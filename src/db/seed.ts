import { eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
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
} from './schema.ts';
import { hashPassword } from '../server/auth.ts';
import { calculatePricingSplit } from '../utils/domainLogic.ts';

let seedPromise: Promise<void> | null = null;
let seededDone = false;

export async function ensureSeeded(): Promise<void> {
  if (seededDone) return;
  if (!seedPromise) {
    seedPromise = runSeed().finally(() => {
      seedPromise = null;
    });
  }
  await seedPromise;
}

async function runSeed(): Promise<void> {
  try {
    const existingSubjects = await db.select({ count: sql<number>`count(*)::int` }).from(subjects);
    if ((existingSubjects[0]?.count ?? 0) > 0) {
      // Idempotently ensure seeded pending teacher has portrait avatar
      await db
        .update(users)
        .set({ avatarUrl: '/src/assets/images/teacher_portrait_5_1795538515140.jpg' })
        .where(eq(users.email, 'calon.guru@jumpaguru.id'));
      seededDone = true;
      return;
    }

    // 1. Seed 10 official subjects
    const subjectSeeds = [
      {
        slug: 'matematika',
        name: 'Matematika',
        category: 'Sains & Hitungan',
        description: 'Aljabar, geometri, kalkulus, statistika, serta persiapan olimpiade dan UTBK.',
      },
      {
        slug: 'bahasa-indonesia',
        name: 'Bahasa Indonesia',
        category: 'Bahasa & Literasi',
        description: 'Tata bahasa baku, literasi membaca, penulisan esai, dan pemahaman teks akademik.',
      },
      {
        slug: 'bahasa-inggris',
        name: 'Bahasa Inggris',
        category: 'Bahasa & Literasi',
        description: 'Grammar, speaking practice, reading comprehension, serta persiapan TOEFL & IELTS.',
      },
      {
        slug: 'ipa',
        name: 'IPA',
        category: 'Sains Terpadu',
        description: 'Ilmu Pengetahuan Alam terpadu untuk jenjang SD dan SMP dengan eksperimen konsep.',
      },
      {
        slug: 'ips',
        name: 'IPS',
        category: 'Sosial & Humaniora',
        description: 'Sejarah, geografi, ekonomi dasar, dan sosiologi terpadu untuk SD dan SMP.',
      },
      {
        slug: 'fisika',
        name: 'Fisika',
        category: 'Sains & Hitungan',
        description: 'Mekanika, termodinamika, gelombang, optik, listrik magnet, dan fisika modern.',
      },
      {
        slug: 'kimia',
        name: 'Kimia',
        category: 'Sains & Hitungan',
        description: 'Stoikiometri, ikatan kimia, kesetimbangan, larutan, dan kimia organik.',
      },
      {
        slug: 'biologi',
        name: 'Biologi',
        category: 'Sains Terpadu',
        description: 'Biologi sel, genetika, anatomi fisiologi, ekologi, dan persiapan ujian masuk PTN.',
      },
      {
        slug: 'pendidikan-agama',
        name: 'Pendidikan Agama',
        category: 'Karakter & Etika',
        description: 'Pendidikan budi pekerti, pemahaman kitab, sejarah peradaban, dan akhlak mulia.',
      },
      {
        slug: 'komputer-teknologi',
        name: 'Komputer dan Teknologi',
        category: 'Teknologi & Koding',
        description: 'Logika pemrograman, Python, web development, algoritma, dan literasi digital.',
      },
    ];

    const insertedSubjects = await db.insert(subjects).values(subjectSeeds).returning();
    const subjectBySlug = new Map(insertedSubjects.map((s) => [s.slug, s]));

    // 2. Seed Pricing Plans (SD 60k, SMP 75k, SMA/SMK 100k, Mahasiswa 125k + 90-min options)
    const pricingSeeds = [
      { educationLevel: 'SD', durationMinutes: 60, studentPrice: 60000, teacherSharePercent: 75, platformCommissionPercent: 25 },
      { educationLevel: 'SD', durationMinutes: 90, studentPrice: 85000, teacherSharePercent: 75, platformCommissionPercent: 25 },
      { educationLevel: 'SMP', durationMinutes: 60, studentPrice: 75000, teacherSharePercent: 75, platformCommissionPercent: 25 },
      { educationLevel: 'SMP', durationMinutes: 90, studentPrice: 105000, teacherSharePercent: 75, platformCommissionPercent: 25 },
      { educationLevel: 'SMA/SMK', durationMinutes: 60, studentPrice: 100000, teacherSharePercent: 75, platformCommissionPercent: 25 },
      { educationLevel: 'SMA/SMK', durationMinutes: 90, studentPrice: 140000, teacherSharePercent: 75, platformCommissionPercent: 25 },
      { educationLevel: 'Mahasiswa', durationMinutes: 60, studentPrice: 125000, teacherSharePercent: 75, platformCommissionPercent: 25 },
      { educationLevel: 'Mahasiswa', durationMinutes: 90, studentPrice: 175000, teacherSharePercent: 75, platformCommissionPercent: 25 },
    ];
    const insertedPlans = await db.insert(pricingPlans).values(pricingSeeds).returning();
    const sma60Plan = insertedPlans.find((p) => p.educationLevel === 'SMA/SMK' && p.durationMinutes === 60)!;
    const smp60Plan = insertedPlans.find((p) => p.educationLevel === 'SMP' && p.durationMinutes === 60)!;

    // 3. Seed Demo Users across all 4 roles
    const demoPassHash = hashPassword('JumpaGuru2026!');

    const [adminUser] = await db
      .insert(users)
      .values({
        email: 'admin@jumpaguru.id',
        passwordHash: demoPassHash,
        fullName: 'Andi Pratama, M.Ed.',
        phone: '08111000222',
        role: 'admin',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
      })
      .returning();

    const [guru1User] = await db
      .insert(users)
      .values({
        email: 'guru@jumpaguru.id',
        passwordHash: demoPassHash,
        fullName: 'Rizky Maulana, S.Pd.',
        phone: '081234567801',
        role: 'teacher',
        avatarUrl: '/src/assets/images/teacher_portrait_1_1795536394727.jpg',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
      })
      .returning();

    const [guru2User] = await db
      .insert(users)
      .values({
        email: 'sari.ipa@jumpaguru.id',
        passwordHash: demoPassHash,
        fullName: 'Sari Wulandari, M.Si.',
        phone: '081234567802',
        role: 'teacher',
        avatarUrl: '/src/assets/images/teacher_portrait_2_1795536394410.jpg',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
      })
      .returning();

    const [guru3User] = await db
      .insert(users)
      .values({
        email: 'nadia.english@jumpaguru.id',
        passwordHash: demoPassHash,
        fullName: 'Nadia Kusuma, S.Hum.',
        phone: '081234567803',
        role: 'teacher',
        avatarUrl: '/src/assets/images/teacher_portrait_3_1795536395242.jpg',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
      })
      .returning();

    const [guru4User] = await db
      .insert(users)
      .values({
        email: 'bagas.tech@jumpaguru.id',
        passwordHash: demoPassHash,
        fullName: 'Bagas Wijaya, S.Kom.',
        phone: '081234567804',
        role: 'teacher',
        avatarUrl: '/src/assets/images/teacher_portrait_4_1795536395803.jpg',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
      })
      .returning();

    const [pendingGuruUser] = await db
      .insert(users)
      .values({
        email: 'calon.guru@jumpaguru.id',
        passwordHash: demoPassHash,
        fullName: 'Dewi Kartika, S.Pd.',
        phone: '081234567805',
        role: 'teacher',
        avatarUrl: '/src/assets/images/teacher_portrait_5_1795538515140.jpg',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
      })
      .returning();

    const [siswaUser] = await db
      .insert(users)
      .values({
        email: 'siswa@jumpaguru.id',
        passwordHash: demoPassHash,
        fullName: 'Aulia Rahma',
        phone: '081398765432',
        role: 'student',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
      })
      .returning();

    const [parentUser] = await db
      .insert(users)
      .values({
        email: 'orangtua@jumpaguru.id',
        passwordHash: demoPassHash,
        fullName: 'Ibu Ratna Dewi',
        phone: '081311223344',
        role: 'parent',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
      })
      .returning();

    // Student Profile + Verified Guardian Relationship
    await db.insert(studentProfiles).values({
      userId: siswaUser.id,
      educationLevel: 'SMA/SMK',
      schoolName: 'SMA Negeri 8 Jakarta',
      grade: 'Kelas 11 IPA',
      birthDate: '2009-04-17',
      learningGoals: 'Persiapan UTBK SNBT Matematika & Fisika serta pendalaman Bahasa Inggris akademik.',
      parentalConsentGiven: true,
    });

    await db.insert(guardianRelationships).values({
      parentUserId: parentUser.id,
      studentUserId: siswaUser.id,
      relationshipType: 'Ibu Kandung',
      verificationStatus: 'verified',
      approvalNotes: 'Terverifikasi melalui dokumen KK & nomor WhatsApp wali.',
    });

    // 4. Teacher Profiles
    const [tp1, tp2, tp3, tp4, tpPending] = await db
      .insert(teacherProfiles)
      .values([
        {
          userId: guru1User.id,
          birthDate: '1994-03-14',
          lastEducation: 'S1 Pendidikan Matematika',
          institution: 'Universitas Pendidikan Indonesia',
          major: 'Pendidikan Matematika',
          graduationYear: 2016,
          educationLevels: ['SD', 'SMP', 'SMA/SMK'],
          experienceYears: 7,
          bio: 'Pengajar Matematika dan Fisika berpengalaman 7 tahun membimbing siswa SD hingga persiapan SNBT/UTBK dengan pendekatan konsep visual dan latihan bertahap.',
          idDocumentUrl: 'private://docs/rizky-ktp.pdf',
          diplomaDocumentUrl: 'private://docs/rizky-ijazah.pdf',
          verificationStatus: 'active',
          ratingAvg: '4.95',
          totalReviews: 2,
          totalSessions: 48,
          teachingDurationOptions: [60, 90],
        },
        {
          userId: guru2User.id,
          birthDate: '1996-08-22',
          lastEducation: 'S2 Sains Kimia',
          institution: 'Institut Teknologi Bandung',
          major: 'Kimia',
          graduationYear: 2020,
          educationLevels: ['SMP', 'SMA/SMK', 'Mahasiswa'],
          experienceYears: 5,
          bio: 'Lulusan Magister Kimia ITB yang fokus membantu siswa memahami IPA, Kimia, dan Biologi melalui studi kasus eksperimen dan pemahaman konsep fundamental.',
          idDocumentUrl: 'private://docs/sari-ktp.pdf',
          diplomaDocumentUrl: 'private://docs/sari-ijazah.pdf',
          verificationStatus: 'active',
          ratingAvg: '4.90',
          totalReviews: 1,
          totalSessions: 36,
          teachingDurationOptions: [60, 90],
        },
        {
          userId: guru3User.id,
          birthDate: '1998-01-11',
          lastEducation: 'S1 Sastra Inggris',
          institution: 'Universitas Indonesia',
          major: 'Sastra Inggris',
          graduationYear: 2020,
          educationLevels: ['SD', 'SMP', 'SMA/SMK', 'Mahasiswa'],
          experienceYears: 4,
          bio: 'Tutor Bahasa Inggris & Bahasa Indonesia tersertifikasi TESOL. Sesi interaktif berfokus pada kepercayaan diri berbicara, tata bahasa, dan penulisan esai.',
          idDocumentUrl: 'private://docs/nadia-ktp.pdf',
          diplomaDocumentUrl: 'private://docs/nadia-ijazah.pdf',
          verificationStatus: 'active',
          ratingAvg: '4.88',
          totalReviews: 1,
          totalSessions: 29,
          teachingDurationOptions: [60, 90],
        },
        {
          userId: guru4User.id,
          birthDate: '1995-11-05',
          lastEducation: 'S1 Ilmu Komputer',
          institution: 'Universitas Gadjah Mada',
          major: 'Ilmu Komputer',
          graduationYear: 2018,
          educationLevels: ['SMP', 'SMA/SMK', 'Mahasiswa'],
          experienceYears: 6,
          bio: 'Praktisi rekayasa perangkat lunak dan pembimbing Olimpiade Informatika. Mengajar pemrograman Python, Web, serta Matematika Diskrit secara praktis.',
          idDocumentUrl: 'private://docs/bagas-ktp.pdf',
          diplomaDocumentUrl: 'private://docs/bagas-ijazah.pdf',
          verificationStatus: 'active',
          ratingAvg: '4.92',
          totalReviews: 1,
          totalSessions: 41,
          teachingDurationOptions: [60, 90],
        },
        {
          userId: pendingGuruUser.id,
          birthDate: '1997-06-19',
          lastEducation: 'S1 Pendidikan IPS',
          institution: 'Universitas Negeri Yogyakarta',
          major: 'Pendidikan IPS',
          graduationYear: 2019,
          educationLevels: ['SD', 'SMP'],
          experienceYears: 3,
          bio: 'Guru SMP bidang Ilmu Pengetahuan Sosial dan Pendidikan Agama yang siap membimbing siswa memahami materi sejarah dan ekonomi dasar.',
          idDocumentUrl: 'private://docs/dewi-ktp.pdf',
          diplomaDocumentUrl: 'private://docs/dewi-ijazah.pdf',
          verificationStatus: 'submitted',
          ratingAvg: '5.00',
          totalReviews: 0,
          totalSessions: 0,
          teachingDurationOptions: [60, 90],
        },
      ])
      .returning();

    // 5. Teacher Subjects
    await db.insert(teacherSubjects).values([
      { teacherProfileId: tp1.id, subjectId: subjectBySlug.get('matematika')!.id, educationLevels: ['SD', 'SMP', 'SMA/SMK'] },
      { teacherProfileId: tp1.id, subjectId: subjectBySlug.get('fisika')!.id, educationLevels: ['SMP', 'SMA/SMK'] },
      { teacherProfileId: tp2.id, subjectId: subjectBySlug.get('ipa')!.id, educationLevels: ['SMP'] },
      { teacherProfileId: tp2.id, subjectId: subjectBySlug.get('kimia')!.id, educationLevels: ['SMA/SMK', 'Mahasiswa'] },
      { teacherProfileId: tp2.id, subjectId: subjectBySlug.get('biologi')!.id, educationLevels: ['SMA/SMK'] },
      { teacherProfileId: tp3.id, subjectId: subjectBySlug.get('bahasa-inggris')!.id, educationLevels: ['SD', 'SMP', 'SMA/SMK', 'Mahasiswa'] },
      { teacherProfileId: tp3.id, subjectId: subjectBySlug.get('bahasa-indonesia')!.id, educationLevels: ['SD', 'SMP', 'SMA/SMK'] },
      { teacherProfileId: tp4.id, subjectId: subjectBySlug.get('komputer-teknologi')!.id, educationLevels: ['SMP', 'SMA/SMK', 'Mahasiswa'] },
      { teacherProfileId: tp4.id, subjectId: subjectBySlug.get('matematika')!.id, educationLevels: ['SMP', 'SMA/SMK'] },
      { teacherProfileId: tpPending.id, subjectId: subjectBySlug.get('ips')!.id, educationLevels: ['SD', 'SMP'] },
      { teacherProfileId: tpPending.id, subjectId: subjectBySlug.get('pendidikan-agama')!.id, educationLevels: ['SD', 'SMP'] },
    ]);

    // 6. Teacher Schedules (Monday-Saturday slots)
    const scheduleRows: Array<{ teacherProfileId: number; dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }> = [];
    for (const tp of [tp1, tp2, tp3, tp4, tpPending]) {
      for (const day of [1, 2, 3, 4, 5, 6]) {
        scheduleRows.push(
          { teacherProfileId: tp.id, dayOfWeek: day, startTime: '09:00', endTime: '12:00', isAvailable: true },
          { teacherProfileId: tp.id, dayOfWeek: day, startTime: '14:00', endTime: '17:00', isAvailable: true },
          { teacherProfileId: tp.id, dayOfWeek: day, startTime: '19:00', endTime: '21:00', isAvailable: true }
        );
      }
    }
    await db.insert(teacherSchedules).values(scheduleRows);

    // 7. Teacher Bank Accounts & Wallets
    const [bank1] = await db
      .insert(bankAccounts)
      .values([
        {
          teacherProfileId: tp1.id,
          bankName: 'Bank BCA',
          accountNumber: '5220891142',
          accountHolderName: 'Rizky Maulana',
          isVerified: true,
          isPrimary: true,
        },
        {
          teacherProfileId: tp2.id,
          bankName: 'Bank Mandiri',
          accountNumber: '132001884512',
          accountHolderName: 'Sari Wulandari',
          isVerified: true,
          isPrimary: true,
        },
        {
          teacherProfileId: tp3.id,
          bankName: 'Bank BNI',
          accountNumber: '0891224501',
          accountHolderName: 'Nadia Kusuma',
          isVerified: true,
          isPrimary: true,
        },
        {
          teacherProfileId: tp4.id,
          bankName: 'Bank BCA',
          accountNumber: '8820193341',
          accountHolderName: 'Bagas Wijaya',
          isVerified: true,
          isPrimary: true,
        },
      ])
      .returning();

    const completedSplit = calculatePricingSplit(sma60Plan.studentPrice, sma60Plan.teacherSharePercent);
    const [wallet1] = await db
      .insert(teacherWallets)
      .values([
        {
          teacherProfileId: tp1.id,
          totalEarned: 375000,
          pendingBalance: 75000,
          availableBalance: 225000,
          totalWithdrawn: 150000,
        },
        { teacherProfileId: tp2.id, totalEarned: 150000, pendingBalance: 0, availableBalance: 150000, totalWithdrawn: 0 },
        { teacherProfileId: tp3.id, totalEarned: 75000, pendingBalance: 0, availableBalance: 75000, totalWithdrawn: 0 },
        { teacherProfileId: tp4.id, totalEarned: 75000, pendingBalance: 0, availableBalance: 75000, totalWithdrawn: 0 },
        { teacherProfileId: tpPending.id, totalEarned: 0, pendingBalance: 0, availableBalance: 0, totalWithdrawn: 0 },
      ])
      .returning();

    // 8. Sample Bookings (Completed + Scheduled + Awaiting Payment)
    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const [completedBooking] = await db
      .insert(bookings)
      .values({
        bookingCode: 'JG-2026-1001',
        studentUserId: siswaUser.id,
        teacherProfileId: tp1.id,
        subjectId: subjectBySlug.get('matematika')!.id,
        pricingPlanId: sma60Plan.id,
        educationLevel: 'SMA/SMK',
        sessionDate: todayStr,
        startTime: '09:00',
        endTime: '10:00',
        durationMinutes: 60,
        status: 'completed',
        studentPriceSnapshot: completedSplit.studentPrice,
        teacherEarningSnapshot: completedSplit.teacherEarning,
        platformCommissionSnapshot: completedSplit.platformCommission,
        teacherSharePercentSnapshot: completedSplit.teacherSharePercent,
        notes: 'Fokus materi Limit Fungsi dan Turunan Aljabar.',
        parentApproved: true,
      })
      .returning();

    const [scheduledBooking] = await db
      .insert(bookings)
      .values({
        bookingCode: 'JG-2026-1002',
        studentUserId: siswaUser.id,
        teacherProfileId: tp1.id,
        subjectId: subjectBySlug.get('fisika')!.id,
        pricingPlanId: sma60Plan.id,
        educationLevel: 'SMA/SMK',
        sessionDate: tomorrow,
        startTime: '14:00',
        endTime: '15:00',
        durationMinutes: 60,
        status: 'scheduled',
        studentPriceSnapshot: completedSplit.studentPrice,
        teacherEarningSnapshot: completedSplit.teacherEarning,
        platformCommissionSnapshot: completedSplit.platformCommission,
        teacherSharePercentSnapshot: completedSplit.teacherSharePercent,
        notes: 'Pembahasan Hukum Newton dan Dinamika Gerak.',
        parentApproved: true,
      })
      .returning();

    const smpSplit = calculatePricingSplit(smp60Plan.studentPrice, smp60Plan.teacherSharePercent);
    const [awaitingBooking] = await db
      .insert(bookings)
      .values({
        bookingCode: 'JG-2026-1003',
        studentUserId: siswaUser.id,
        teacherProfileId: tp3.id,
        subjectId: subjectBySlug.get('bahasa-inggris')!.id,
        pricingPlanId: smp60Plan.id,
        educationLevel: 'SMP',
        sessionDate: tomorrow,
        startTime: '19:00',
        endTime: '20:00',
        durationMinutes: 60,
        status: 'awaiting_payment',
        studentPriceSnapshot: smpSplit.studentPrice,
        teacherEarningSnapshot: smpSplit.teacherEarning,
        platformCommissionSnapshot: smpSplit.platformCommission,
        teacherSharePercentSnapshot: smpSplit.teacherSharePercent,
        notes: 'Latihan Speaking & Tenses.',
        paymentDeadlineAt: new Date(Date.now() + 1000 * 60 * 60 * 20),
        parentApproved: true,
      })
      .returning();

    // 9. Payments & Learning Sessions
    await db.insert(payments).values([
      {
        bookingId: completedBooking.id,
        externalRef: 'PAY-SBX-1001',
        paymentMethod: 'QRIS',
        gatewayProvider: 'JumpaPay Sandbox',
        amount: completedBooking.studentPriceSnapshot,
        status: 'paid',
        paymentUrl: 'https://sandbox.jumpapay.local/qris/PAY-SBX-1001',
        verifiedAt: new Date(),
      },
      {
        bookingId: scheduledBooking.id,
        externalRef: 'PAY-SBX-1002',
        paymentMethod: 'Virtual Account',
        gatewayProvider: 'JumpaPay Sandbox',
        amount: scheduledBooking.studentPriceSnapshot,
        status: 'paid',
        vaNumber: '8801908139876543',
        verifiedAt: new Date(),
      },
      {
        bookingId: awaitingBooking.id,
        externalRef: 'PAY-SBX-1003',
        paymentMethod: 'QRIS',
        gatewayProvider: 'JumpaPay Sandbox',
        amount: awaitingBooking.studentPriceSnapshot,
        status: 'pending',
        paymentUrl: 'https://sandbox.jumpapay.local/qris/PAY-SBX-1003',
      },
    ]);

    await db.insert(learningSessions).values([
      {
        bookingId: completedBooking.id,
        roomCode: 'ROOM-JG-1001',
        meetingProvider: 'JumpaMeet WebRTC Room',
        teacherAttendedAt: new Date(),
        studentAttendedAt: new Date(),
        startedAt: new Date(),
        endedAt: new Date(),
        status: 'completed',
        materials: [
          {
            id: 'mat-1',
            title: 'Modul Ringkasan Limit & Turunan.pdf',
            type: 'PDF',
            urlOrNote: 'Ringkasan rumus cepat limit aljabar dan contoh soal UTBK.',
            addedBy: 'Rizky Maulana, S.Pd.',
          },
        ],
        chatMessages: [
          {
            id: 'msg-1',
            senderName: 'Rizky Maulana, S.Pd.',
            senderRole: 'teacher',
            message: 'Selamat pagi Aulia, hari ini kita bahas Limit Fungsi Aljabar ya.',
            sentAt: new Date().toISOString(),
          },
        ],
        summaryNotes: 'Siswa menguasai pemfaktoran limit bentuk 0/0 dan siap latihan mandiri.',
      },
      {
        bookingId: scheduledBooking.id,
        roomCode: 'ROOM-JG-1002',
        meetingProvider: 'JumpaMeet WebRTC Room',
        status: 'scheduled',
        materials: [
          {
            id: 'mat-2',
            title: 'Lembar Kerja Dinamika Gerak',
            type: 'Latihan',
            urlOrNote: '5 soal diagram gaya bebas untuk dibahas di kelas.',
            addedBy: 'Rizky Maulana, S.Pd.',
          },
        ],
        chatMessages: [],
      },
    ]);

    // 10. Wallet Ledger & Withdrawal Request
    const [pendingWd] = await db
      .insert(withdrawalRequests)
      .values({
        teacherProfileId: tp1.id,
        bankAccountId: bank1.id,
        amount: 150000,
        status: 'requested',
        notes: 'Pencairan pendapatan bulan berjalan',
      })
      .returning();

    await db.insert(walletTransactions).values([
      {
        walletId: wallet1.id,
        bookingId: completedBooking.id,
        type: 'credit_earning',
        amount: 75000,
        balanceBefore: 300000,
        balanceAfter: 375000,
        description: 'Pendapatan sesi JG-2026-1001 (Matematika SMA/SMK 60 menit)',
        referenceCode: 'LED-CR-1001',
      },
      {
        walletId: wallet1.id,
        withdrawalId: pendingWd.id,
        type: 'debit_withdrawal',
        amount: 150000,
        balanceBefore: 375000,
        balanceAfter: 225000,
        description: 'Pengajuan pencairan ke Bank BCA (5220891142)',
        referenceCode: 'LED-WD-1001',
      },
    ]);

    // 11. Reviews, Favorites, Notifications, Complaints, Agreements, Audit Logs, Site Settings
    await db.insert(reviews).values([
      {
        bookingId: completedBooking.id,
        studentUserId: siswaUser.id,
        teacherProfileId: tp1.id,
        rating: 5,
        comment: 'Penjelasan Pak Rizky sangat runtut dan mudah dipahami. Soal-soal UTBK jadi terasa jauh lebih jelas.',
        isPublished: true,
      },
    ]);

    await db.insert(favoriteTeachers).values({
      studentUserId: siswaUser.id,
      teacherProfileId: tp1.id,
    });

    await db.insert(notifications).values([
      {
        userId: siswaUser.id,
        title: 'Pembayaran Menunggu Konfirmasi',
        message: 'Tagihan sesi Bahasa Inggris (JG-2026-1003) telah terbit. Selesaikan pembayaran sebelum batas waktu.',
        type: 'payment',
        relatedUrl: '/dashboard/siswa',
      },
      {
        userId: guru1User.id,
        title: 'Jadwal Kelas Baru Terkonfirmasi',
        message: 'Sesi Fisika bersama Aulia Rahma (JG-2026-1002) telah dibayar dan siap dilaksanakan.',
        type: 'booking',
        relatedUrl: '/dashboard/guru',
      },
      {
        userId: adminUser.id,
        title: 'Pendaftar Guru Menunggu Verifikasi',
        message: 'Dewi Kartika, S.Pd. telah mengirim berkas pendaftaran guru dan menunggu peninjauan.',
        type: 'verification',
        relatedUrl: '/dashboard/admin',
      },
    ]);

    await db.insert(complaints).values({
      reporterUserId: parentUser.id,
      bookingId: completedBooking.id,
      category: 'Jadwal & Teknis',
      subject: 'Mohon konfirmasi jadwal kelas berikutnya',
      description: 'Apakah memungkinkan untuk menambah sesi latihan tambahan menjelang ujian semester?',
      status: 'open',
    });

    await db.insert(agreements).values({
      userId: guru1User.id,
      agreementType: 'teacher_partnership',
      version: '1.0',
      ipAddress: '127.0.0.1',
    });

    await db.insert(auditLogs).values({
      actorUserId: adminUser.id,
      action: 'SYSTEM_INITIALIZED',
      entityType: 'platform',
      entityId: 'seed',
      details: { subjects: insertedSubjects.length, plans: insertedPlans.length },
    });

    await db.insert(siteSettings).values({
      key: 'platform_config',
      value: {
        brandName: 'JUMPA GURU',
        slogan: 'Website Mencari Guru Belajar Kamu.',
        supportEmail: 'bantuan@jumpaguru.id',
        supportWhatsapp: '+62 811-2233-4455',
        paymentExpiryHours: 24,
        defaultTeacherSharePercent: 75,
        minimumWithdrawal: 50000,
      },
    });

    seededDone = true;
  } catch (err) {
    console.error('Seed check error:', err);
  }
}
