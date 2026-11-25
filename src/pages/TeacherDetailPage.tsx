import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, CheckCircle2, Clock, GraduationCap, ShieldCheck, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DAY_NAMES, formatRp, type PricingPlanItem, type TeacherDirectoryItem } from '../types/index.ts';

interface ReviewItem {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  studentName: string;
}

interface BookedSlot {
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: string;
}

export function TeacherDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, apiFetch } = useAuth();

  const [teacher, setTeacher] = useState<TeacherDirectoryItem | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [pricingPlans, setPricingPlans] = useState<PricingPlanItem[]>([]);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);

  // Booking form state
  const [subjectId, setSubjectId] = useState<number>(0);
  const [educationLevel, setEducationLevel] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [sessionDate, setSessionDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState<string>('14:00');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/teachers/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Profil guru tidak ditemukan.');
        return data;
      })
      .then((data) => {
        if (!active) return;
        setTeacher(data.teacher);
        setReviews(data.reviews || []);
        setPricingPlans(data.pricingPlans || []);
        setBookedSlots(data.bookedSlots || []);
        if (data.teacher?.subjects?.[0]) {
          setSubjectId(data.teacher.subjects[0].subjectId);
        }
        if (data.teacher?.educationLevels?.[0]) {
          setEducationLevel(data.teacher.educationLevels[0]);
        }
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const selectedPlan = pricingPlans.find(
    (p) => p.educationLevel === educationLevel && p.durationMinutes === durationMinutes
  );

  const timeOptions = ['09:00', '10:30', '14:00', '15:30', '19:00', '20:00'];

  const isSlotTaken = (slotTime: string) => {
    const startH = Number(slotTime.split(':')[0]) * 60 + Number(slotTime.split(':')[1]);
    const endH = startH + durationMinutes;
    return bookedSlots.some((b) => {
      if (b.sessionDate !== sessionDate) return false;
      const bStart = Number(b.startTime.split(':')[0]) * 60 + Number(b.startTime.split(':')[1]);
      const bEnd = Number(b.endTime.split(':')[0]) * 60 + Number(b.endTime.split(':')[1]);
      return startH < bEnd && endH > bStart;
    });
  };

  const handleBooking = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'student' && user.role !== 'admin') {
      setBookingMessage({
        type: 'err',
        text: 'Pemesanan kelas hanya dapat diajukan menggunakan akun Siswa.',
      });
      return;
    }

    setSubmitting(true);
    setBookingMessage(null);
    try {
      const created = await apiFetch<{ bookingCode: string }>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          teacherProfileId: teacher?.id,
          subjectId,
          educationLevel,
          sessionDate,
          startTime,
          durationMinutes,
          notes,
        }),
      });
      setBookingMessage({
        type: 'ok',
        text: `Pemesanan ${created.bookingCode} berhasil diajukan. Menunggu konfirmasi guru.`,
      });
      setBookedSlots((prev) => [
        ...prev,
        { sessionDate, startTime, endTime: startTime, status: 'pending' },
      ]);
    } catch (err: unknown) {
      setBookingMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal membuat pemesanan.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="h-80 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !teacher) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-[#1F2937]">Profil Guru Tidak Tersedia</h1>
        <p className="text-slate-600">{error || 'Data guru tidak ditemukan.'}</p>
        <Link to="/cari-guru" className="inline-block px-5 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold">
          Kembali ke Pencarian Guru
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <Link to="/cari-guru" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#2563EB]">
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Daftar Guru
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Public Teacher Info */}
          <div className="lg:col-span-7 space-y-6">
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row items-start gap-5">
                <div className="w-28 h-28 rounded-2xl overflow-hidden bg-[#DBEAFE] shrink-0 flex items-center justify-center border border-slate-200">
                  {teacher.avatarUrl && !imgError ? (
                    <img
                      src={teacher.avatarUrl}
                      alt={`Foto profil ${teacher.fullName}`}
                      referrerPolicy="no-referrer"
                      onError={() => setImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <GraduationCap className="w-11 h-11 text-[#2563EB]" />
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guru Terverifikasi JUMPA GURU</span>
                  </div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">{teacher.fullName}</h1>
                  <p className="text-sm text-slate-600">
                    {teacher.lastEducation} · {teacher.institution} ({teacher.major})
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700 tabular-nums pt-1">
                    <span className="inline-flex items-center gap-1 font-bold">
                      <Star className="w-4 h-4 fill-[#FBBF24] text-[#FBBF24]" />
                      {teacher.ratingAvg.toFixed(1)} ({teacher.totalReviews} ulasan)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{teacher.totalSessions} sesi selesai</span>
                    <span aria-hidden="true">·</span>
                    <span>{teacher.experienceYears} tahun pengalaman</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h2 className="text-base font-bold text-[#1F2937]">Tentang Pengajar</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{teacher.bio}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1.5">Bidang Studi</h3>
                  <p className="text-sm font-semibold text-[#1F2937]">
                    {teacher.subjects.map((s) => s.subjectName).join(' · ')}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1.5">Jenjang yang Diajar</h3>
                  <p className="text-sm font-semibold text-[#1F2937]">
                    {teacher.educationLevels.join(' · ')}
                  </p>
                </div>
              </div>
            </section>

            {/* Weekly Schedule */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-[#1F2937] inline-flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#2563EB]" />
                Jadwal Mengajar Tersedia
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                  const slots = teacher.schedules.filter((s) => s.dayOfWeek === day);
                  if (slots.length === 0) return null;
                  return (
                    <div key={day} className="border border-slate-200 rounded-xl p-3.5">
                      <p className="text-xs font-bold text-[#1F2937] mb-1">{DAY_NAMES[day]}</p>
                      <p className="text-xs text-slate-600 font-mono-tabular">
                        {slots.map((s) => `${s.startTime}–${s.endTime}`).join(' · ')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Official Pricing Table */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-[#1F2937]">Tarif Resmi Platform</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 pr-4">Jenjang</th>
                      <th className="py-2 px-4">Durasi</th>
                      <th className="py-2 pl-4 text-right">Harga Belajar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pricingPlans.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 pr-4 font-semibold text-[#1F2937]">{p.educationLevel}</td>
                        <td className="py-2.5 px-4 text-slate-600 tabular-nums">{p.durationMinutes} menit</td>
                        <td className="py-2.5 pl-4 text-right font-bold text-[#2563EB] font-mono-tabular">
                          {formatRp(p.studentPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Student Reviews */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-[#1F2937]">Ulasan Siswa ({reviews.length})</h2>
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada ulasan tertulis untuk guru ini.</p>
              ) : (
                <div className="space-y-4 divide-y divide-slate-100">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="pt-3 first:pt-0 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#1F2937]">{rev.studentName}</span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-[#FBBF24] text-[#FBBF24]" />
                          {rev.rating}.0
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Booking Form */}
          <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sticky top-24 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-[#1F2937]">Pesan Guru Ini</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Privat 1-on-1 Online · Jadwal dikunci otomatis untuk mencegah bentrok
              </p>
            </div>

            {bookingMessage && (
              <div
                className={`p-3.5 rounded-xl text-sm border ${
                  bookingMessage.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                <p>{bookingMessage.text}</p>
                {bookingMessage.type === 'ok' && (
                  <Link to="/dashboard/siswa" className="inline-block mt-2 font-semibold underline">
                    Lihat Pemesanan di Dashboard Siswa
                  </Link>
                )}
              </div>
            )}

            <form onSubmit={handleBooking} className="space-y-4">
              <div>
                <label htmlFor="book-subject" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mata Pelajaran
                </label>
                <select
                  id="book-subject"
                  value={subjectId}
                  onChange={(e) => setSubjectId(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white"
                >
                  {teacher.subjects.map((s) => (
                    <option key={s.subjectId} value={s.subjectId}>
                      {s.subjectName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="book-level" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Jenjang
                  </label>
                  <select
                    id="book-level"
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white"
                  >
                    {teacher.educationLevels.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="book-duration" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Durasi Sesi
                  </label>
                  <select
                    id="book-duration"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white"
                  >
                    <option value={60}>60 Menit</option>
                    <option value={90}>90 Menit</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="book-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tanggal Belajar
                </label>
                <input
                  id="book-date"
                  type="date"
                  value={sessionDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setSessionDate(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pilih Jam Tersedia
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {timeOptions.map((slot) => {
                    const taken = isSlotTaken(slot);
                    const active = startTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={taken}
                        onClick={() => setStartTime(slot)}
                        className={`py-2 px-2 rounded-xl text-xs font-mono-tabular font-semibold border transition-colors ${
                          taken
                            ? 'bg-slate-100 text-slate-400 border-slate-200 line-through cursor-not-allowed'
                            : active
                            ? 'bg-[#2563EB] text-white border-[#2563EB]'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-[#2563EB]'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="book-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Catatan Topik / Materi (Opsional)
                </label>
                <textarea
                  id="book-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Persiapan ulangan bab Persamaan Kuadrat..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>

              {selectedPlan && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Paket {selectedPlan.educationLevel} ({selectedPlan.durationMinutes} menit)</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      1-on-1 Online
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-semibold text-[#1F2937]">Total Biaya Sesi</span>
                    <span className="text-lg font-extrabold text-[#2563EB] font-mono-tabular">
                      {formatRp(selectedPlan.studentPrice)}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || isSlotTaken(startTime)}
                className="w-full py-3 px-4 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {submitting ? 'Memproses Pemesanan...' : user ? 'Ajukan Pemesanan Belajar' : 'Login untuk Memesan Guru'}
              </button>

              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Pembayaran ditagih hanya setelah guru menyetujui jadwal Anda.
              </p>
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}
