import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePricingSplit,
  canTransitionBooking,
  canTransitionWithdrawal,
  computeEndTime,
  hasScheduleConflict,
  sanitizeAvatarUrl,
  sanitizePublicTeacher,
  validateWithdrawalAmount,
} from './domainLogic';

test('calculatePricingSplit splits 100,000 at 75% accurately without rounding loss', () => {
  const split = calculatePricingSplit(100000, 75);
  assert.equal(split.studentPrice, 100000);
  assert.equal(split.teacherEarning, 75000);
  assert.equal(split.platformCommission, 25000);
  assert.equal(split.teacherEarning + split.platformCommission, split.studentPrice);
});

test('calculatePricingSplit handles 60k SD and 75k SMP pricing cleanly', () => {
  const sd = calculatePricingSplit(60000, 75);
  assert.equal(sd.teacherEarning, 45000);
  assert.equal(sd.platformCommission, 15000);

  const smp = calculatePricingSplit(75000, 75);
  assert.equal(smp.teacherEarning, 56250);
  assert.equal(smp.platformCommission, 18750);
});

test('computeEndTime calculates 60 and 90 minute durations accurately', () => {
  assert.equal(computeEndTime('14:00', 60), '15:00');
  assert.equal(computeEndTime('16:30', 90), '18:00');
  assert.throws(() => computeEndTime('14:00', 45));
});

test('hasScheduleConflict detects overlapping bookings and ignores rejected/cancelled', () => {
  const existing = [
    { sessionDate: '2026-12-01', startTime: '14:00', endTime: '15:00', status: 'scheduled' },
    { sessionDate: '2026-12-01', startTime: '16:00', endTime: '17:00', status: 'cancelled' },
  ];

  // Exact overlap
  assert.equal(hasScheduleConflict(existing, '2026-12-01', '14:00', '15:00'), true);
  // Partial overlap (14:30 - 16:00)
  assert.equal(hasScheduleConflict(existing, '2026-12-01', '14:30', '16:00'), true);
  // Adjacent slot (15:00 - 16:00) is free
  assert.equal(hasScheduleConflict(existing, '2026-12-01', '15:00', '16:00'), false);
  // Cancelled slot (16:00 - 17:00) is free
  assert.equal(hasScheduleConflict(existing, '2026-12-01', '16:00', '17:00'), false);
  // Different date is free
  assert.equal(hasScheduleConflict(existing, '2026-12-02', '14:00', '15:00'), false);
});

test('booking and withdrawal state machines enforce valid transitions', () => {
  assert.equal(canTransitionBooking('pending', 'awaiting_payment'), true);
  assert.equal(canTransitionBooking('awaiting_payment', 'paid'), true);
  assert.equal(canTransitionBooking('rejected', 'paid'), false);
  assert.equal(canTransitionBooking('completed', 'pending'), false);

  assert.equal(canTransitionWithdrawal('requested', 'paid'), true);
  assert.equal(canTransitionWithdrawal('paid', 'requested'), false);
});

test('validateWithdrawalAmount blocks insufficient balance and under-minimum amounts', () => {
  assert.equal(validateWithdrawalAmount(40000, 200000), 'Minimal pencairan saldo adalah Rp50.000');
  assert.equal(validateWithdrawalAmount(250000, 200000), 'Saldo tersedia tidak mencukupi untuk nominal pencairan ini');
  assert.equal(validateWithdrawalAmount(150000, 200000), null);
});

test('sanitizePublicTeacher strips sensitive identity documents and birthDate', () => {
  const sanitized = sanitizePublicTeacher({
    id: 1,
    fullName: 'Budi Santoso',
    idDocumentUrl: 'private://ktp-123.pdf',
    diplomaDocumentUrl: 'private://ijazah-123.pdf',
    certificateDocumentUrl: 'private://cert.pdf',
    birthDate: '1994-05-12',
    bio: 'Guru matematika',
  }) as Record<string, unknown>;

  assert.equal(sanitized.fullName, 'Budi Santoso');
  assert.equal(sanitized.idDocumentUrl, undefined);
  assert.equal(sanitized.diplomaDocumentUrl, undefined);
  assert.equal(sanitized.certificateDocumentUrl, undefined);
  assert.equal(sanitized.birthDate, undefined);
});

test('withdrawal state machine enforces processing and blocks paid from failed', () => {
  assert.equal(canTransitionWithdrawal('requested', 'processing'), true);
  assert.equal(canTransitionWithdrawal('processing', 'paid'), true);
  assert.equal(canTransitionWithdrawal('processing', 'failed'), true);
  assert.equal(canTransitionWithdrawal('failed', 'paid'), false);
});

test('calculatePricingSplit computes 90-minute SMA/SMK and Mahasiswa splits accurately', () => {
  const sma90 = calculatePricingSplit(140000, 75);
  assert.equal(sma90.teacherEarning, 105000);
  assert.equal(sma90.platformCommission, 35000);

  const mhs90 = calculatePricingSplit(175000, 75);
  assert.equal(mhs90.teacherEarning + mhs90.platformCommission, 175000);
});

test('sanitizeAvatarUrl accepts safe asset, https, and image data URLs and blocks unsafe schemes', () => {
  assert.equal(
    sanitizeAvatarUrl('/src/assets/images/teacher_portrait_1_1795536394727.jpg'),
    '/src/assets/images/teacher_portrait_1_1795536394727.jpg'
  );
  assert.equal(sanitizeAvatarUrl('https://example.com/photo.jpg'), 'https://example.com/photo.jpg');
  assert.equal(sanitizeAvatarUrl('data:image/jpeg;base64,/9j/4AAQ='), 'data:image/jpeg;base64,/9j/4AAQ=');
  assert.equal(sanitizeAvatarUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeAvatarUrl('/src/assets/images/../secret.txt'), null);
});
