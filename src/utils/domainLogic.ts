export type UserRole = 'admin' | 'teacher' | 'student' | 'parent';

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'awaiting_payment'
  | 'paid'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type TeacherVerificationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'revision_required'
  | 'approved'
  | 'active'
  | 'suspended'
  | 'rejected';

export type WithdrawalStatus = 'requested' | 'processing' | 'paid' | 'failed' | 'reversed';

export interface PricingSplitResult {
  studentPrice: number;
  teacherEarning: number;
  platformCommission: number;
  teacherSharePercent: number;
  platformCommissionPercent: number;
}

/**
 * Computes exact integer Rupiah split between teacher earnings and platform commission.
 * Guarantees teacherEarning + platformCommission === studentPrice.
 */
export function calculatePricingSplit(
  studentPrice: number,
  teacherSharePercent: number
): PricingSplitResult {
  if (!Number.isFinite(studentPrice) || studentPrice <= 0) {
    throw new Error('Harga siswa harus lebih besar dari 0');
  }
  if (!Number.isFinite(teacherSharePercent) || teacherSharePercent < 0 || teacherSharePercent > 100) {
    throw new Error('Persentase guru harus antara 0 hingga 100');
  }
  const roundedShare = Math.round(teacherSharePercent);
  const teacherEarning = Math.round((studentPrice * roundedShare) / 100);
  const platformCommission = studentPrice - teacherEarning;
  return {
    studentPrice: Math.round(studentPrice),
    teacherEarning,
    platformCommission,
    teacherSharePercent: roundedShare,
    platformCommissionPercent: 100 - roundedShare,
  };
}

/**
 * Parses HH:MM into minutes since midnight.
 */
export function timeToMinutes(timeStr: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeStr.trim());
  if (!match) {
    throw new Error(`Format waktu tidak valid: ${timeStr}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function computeEndTime(startTime: string, durationMinutes: number): string {
  const start = timeToMinutes(startTime);
  if (durationMinutes !== 60 && durationMinutes !== 90) {
    throw new Error('Durasi pembelajaran harus 60 atau 90 menit');
  }
  const end = start + durationMinutes;
  if (end > 24 * 60) {
    throw new Error('Sesi tidak boleh melewati tengah malam');
  }
  return minutesToTime(end);
}

const ACTIVE_SLOT_LOCK_STATUSES = new Set<string>([
  'pending',
  'accepted',
  'awaiting_payment',
  'paid',
  'scheduled',
  'in_progress',
]);

export function isSlotLockingStatus(status: string): boolean {
  return ACTIVE_SLOT_LOCK_STATUSES.has(status);
}

export interface ExistingSlotBooking {
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: string;
}

/**
 * Checks if a candidate time slot overlaps any active booking on the same date.
 */
export function hasScheduleConflict(
  existingBookings: ExistingSlotBooking[],
  candidateDate: string,
  candidateStart: string,
  candidateEnd: string
): boolean {
  const candStartMin = timeToMinutes(candidateStart);
  const candEndMin = timeToMinutes(candidateEnd);

  return existingBookings.some((b) => {
    if (b.sessionDate !== candidateDate) return false;
    if (!isSlotLockingStatus(b.status)) return false;
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);
    return candStartMin < bEnd && candEndMin > bStart;
  });
}

const ALLOWED_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['accepted', 'awaiting_payment', 'rejected', 'cancelled'],
  accepted: ['awaiting_payment', 'paid', 'cancelled'],
  rejected: [],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['scheduled', 'in_progress', 'refunded'],
  scheduled: ['in_progress', 'cancelled', 'refunded'],
  in_progress: ['completed', 'cancelled'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

const ALLOWED_WITHDRAWAL_TRANSITIONS: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  requested: ['processing', 'paid', 'failed'],
  processing: ['paid', 'failed', 'reversed'],
  paid: ['reversed'],
  failed: [],
  reversed: [],
};

export function canTransitionWithdrawal(from: WithdrawalStatus, to: WithdrawalStatus): boolean {
  return ALLOWED_WITHDRAWAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function validateWithdrawalAmount(amount: number, availableBalance: number): string | null {
  if (!Number.isFinite(amount) || amount < 50000) {
    return 'Minimal pencairan saldo adalah Rp50.000';
  }
  if (amount > availableBalance) {
    return 'Saldo tersedia tidak mencukupi untuk nominal pencairan ini';
  }
  return null;
}

export function sanitizePublicTeacher<T extends Record<string, unknown>>(
  teacher: T
): Omit<T, 'idDocumentUrl' | 'diplomaDocumentUrl' | 'certificateDocumentUrl' | 'birthDate'> {
  const {
    idDocumentUrl: _idDoc,
    diplomaDocumentUrl: _dipDoc,
    certificateDocumentUrl: _certDoc,
    birthDate: _bd,
    ...safe
  } = teacher;
  return safe;
}

export function sanitizeAvatarUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/src/assets/images/') && !trimmed.includes('..')) {
    return trimmed;
  }
  if (/^https:\/\/[^\s]+$/i.test(trimmed) && trimmed.length <= 1024) {
    return trimmed;
  }
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length <= 1_500_000) {
    return trimmed;
  }
  return null;
}
