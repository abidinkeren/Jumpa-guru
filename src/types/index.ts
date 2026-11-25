export type UserRole = 'admin' | 'teacher' | 'student' | 'parent';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
}

export interface SubjectItem {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string;
  isActive: boolean;
}

export interface PricingPlanItem {
  id: number;
  subjectId: number | null;
  educationLevel: string;
  durationMinutes: number;
  studentPrice: number;
  teacherSharePercent: number;
  platformCommissionPercent: number;
  isActive: boolean;
}

export interface TeacherScheduleItem {
  id: number;
  teacherProfileId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface TeacherSubjectItem {
  teacherProfileId: number;
  subjectId: number;
  subjectName: string;
  subjectSlug: string;
  subjectCategory: string;
  educationLevels: string[];
}

export interface TeacherDirectoryItem {
  id: number;
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  lastEducation: string;
  institution: string;
  major: string;
  graduationYear: number | null;
  educationLevels: string[];
  experienceYears: number;
  bio: string;
  verificationStatus: string;
  ratingAvg: number;
  totalReviews: number;
  totalSessions: number;
  teachingDurationOptions: number[];
  subjects: TeacherSubjectItem[];
  schedules: TeacherScheduleItem[];
  startingPrice: number;
}

export interface PaymentItem {
  id: number;
  bookingId: number;
  externalRef: string;
  paymentMethod: string;
  gatewayProvider: string;
  amount: number;
  status: string;
  paymentUrl: string | null;
  vaNumber: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface BookingItem {
  id: number;
  bookingCode: string;
  studentUserId: number;
  teacherProfileId: number;
  subjectId: number;
  educationLevel: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: string;
  studentPriceSnapshot: number;
  teacherEarningSnapshot: number;
  platformCommissionSnapshot: number;
  teacherSharePercentSnapshot: number;
  notes: string | null;
  rejectionReason: string | null;
  paymentDeadlineAt: string | null;
  parentApproved: boolean;
  createdAt: string;
  studentName: string;
  studentEmail: string;
  subjectName: string;
  teacherName: string;
  teacherAvatarUrl: string | null;
  payment: PaymentItem | null;
  learningSession: { id: number; roomCode: string; status: string } | null;
  review: { id: number; rating: number; comment: string } | null;
}

export interface NotificationItem {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  relatedUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export const DAY_NAMES: Record<number, string> = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};

export function formatRp(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function getStatusLabel(status: string): { label: string; colorClass: string } {
  const map: Record<string, { label: string; colorClass: string }> = {
    pending: { label: 'Menunggu Guru', colorClass: 'text-amber-700 bg-amber-50 border-amber-200' },
    accepted: { label: 'Diterima', colorClass: 'text-blue-700 bg-blue-50 border-blue-200' },
    awaiting_payment: { label: 'Menunggu Pembayaran', colorClass: 'text-amber-700 bg-amber-50 border-amber-200' },
    paid: { label: 'Dibayar', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    scheduled: { label: 'Terjadwal', colorClass: 'text-blue-700 bg-blue-50 border-blue-200' },
    in_progress: { label: 'Berlangsung', colorClass: 'text-blue-700 bg-blue-50 border-blue-200' },
    completed: { label: 'Selesai', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    rejected: { label: 'Ditolak', colorClass: 'text-red-700 bg-red-50 border-red-200' },
    cancelled: { label: 'Dibatalkan', colorClass: 'text-slate-600 bg-slate-100 border-slate-200' },
    refunded: { label: 'Dikembalikan', colorClass: 'text-slate-700 bg-slate-100 border-slate-200' },
    active: { label: 'Aktif', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    submitted: { label: 'Diajukan', colorClass: 'text-amber-700 bg-amber-50 border-amber-200' },
    under_review: { label: 'Ditinjau', colorClass: 'text-blue-700 bg-blue-50 border-blue-200' },
    revision_required: { label: 'Perlu Revisi', colorClass: 'text-amber-800 bg-amber-50 border-amber-300' },
    approved: { label: 'Disetujui', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    suspended: { label: 'Ditangguhkan', colorClass: 'text-red-700 bg-red-50 border-red-200' },
    requested: { label: 'Diajukan', colorClass: 'text-amber-700 bg-amber-50 border-amber-200' },
    processing: { label: 'Diproses', colorClass: 'text-blue-700 bg-blue-50 border-blue-200' },
    failed: { label: 'Gagal', colorClass: 'text-red-700 bg-red-50 border-red-200' },
    reversed: { label: 'Dikembalikan', colorClass: 'text-slate-700 bg-slate-100 border-slate-200' },
    open: { label: 'Terbuka', colorClass: 'text-amber-700 bg-amber-50 border-amber-200' },
    investigating: { label: 'Diselidiki', colorClass: 'text-blue-700 bg-blue-50 border-blue-200' },
    resolved: { label: 'Selesai', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  };
  return map[status] || { label: status, colorClass: 'text-slate-700 bg-slate-100 border-slate-200' };
}
