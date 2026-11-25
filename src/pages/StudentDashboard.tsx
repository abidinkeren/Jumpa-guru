import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Calendar,
  CreditCard,
  Heart,
  Home,
  Search,
  Settings,
  Star,
  Video,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  formatRp,
  getStatusLabel,
  type BookingItem,
  type NotificationItem,
  type TeacherDirectoryItem,
} from '../types/index.ts';

type StudentTab =
  | 'beranda'
  | 'cari'
  | 'favorit'
  | 'pemesanan'
  | 'jadwal'
  | 'kelas'
  | 'pembayaran'
  | 'ulasan'
  | 'pengaturan';

export function StudentDashboard() {
  const { user, apiFetch, refreshProfile } = useAuth();
  const [tab, setTab] = useState<StudentTab>('beranda');
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [favoriteTeachers, setFavoriteTeachers] = useState<TeacherDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  // Sandbox Payment Modal State
  const [payBooking, setPayBooking] = useState<BookingItem | null>(null);
  const [payMethod, setPayMethod] = useState<'QRIS' | 'Virtual Account' | 'Transfer Bank' | 'E-Wallet'>('QRIS');
  const [initiatedPayment, setInitiatedPayment] = useState<{
    externalRef: string;
    vaNumber?: string | null;
    instructions: string;
  } | null>(null);
  const [payProcessing, setPayProcessing] = useState(false);

  // Review state
  const [reviewBookingId, setReviewBookingId] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Profile Settings state
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [educationLevel, setEducationLevel] = useState('SMA/SMK');
  const [schoolName, setSchoolName] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bData, nData, favIds, teachersRes, meRes] = await Promise.all([
        apiFetch<BookingItem[]>('/api/bookings'),
        apiFetch<NotificationItem[]>('/api/notifications'),
        apiFetch<number[]>('/api/favorites'),
        fetch('/api/teachers?limit=50').then((r) => r.json()),
        apiFetch<{ studentProfile?: { educationLevel: string; schoolName: string | null } }>('/api/auth/me'),
      ]);
      setBookings(bData);
      setNotifications(nData);
      const favSet = new Set(favIds);
      const allT: TeacherDirectoryItem[] = teachersRes?.items || [];
      setFavoriteTeachers(allT.filter((t) => favSet.has(t.id)));
      if (meRes.studentProfile) {
        setEducationLevel(meRes.studentProfile.educationLevel || 'SMA/SMK');
        setSchoolName(meRes.studentProfile.schoolName || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInitiatePayment = async () => {
    if (!payBooking) return;
    setPayProcessing(true);
    try {
      const res = await apiFetch<{
        payment: { externalRef: string; vaNumber?: string | null };
        instructions: string;
      }>('/api/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({ bookingId: payBooking.id, paymentMethod: payMethod }),
      });
      setInitiatedPayment({
        externalRef: res.payment.externalRef,
        vaNumber: res.payment.vaNumber,
        instructions: res.instructions,
      });
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal membuat tagihan pembayaran.');
    } finally {
      setPayProcessing(false);
    }
  };

  const handleSimulateWebhookConfirm = async () => {
    if (!initiatedPayment) return;
    setPayProcessing(true);
    try {
      const res = await fetch('/api/payments/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalRef: initiatedPayment.externalRef,
          status: 'paid',
          gatewayRef: `SBX-CONFIRMED-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedback('Pembayaran berhasil dikonfirmasi melalui webhook server. Kelas siap dimasuki!');
      setPayBooking(null);
      setInitiatedPayment(null);
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Konfirmasi webhook gagal.');
    } finally {
      setPayProcessing(false);
    }
  };

  const handleCancelBooking = async (bookingId: number) => {
    try {
      await apiFetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
      setFeedback('Pemesanan berhasil dibatalkan.');
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal membatalkan.');
    }
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewBookingId) return;
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: reviewBookingId,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      setFeedback('Terima kasih! Ulasan Anda telah dipublikasikan.');
      setReviewBookingId(null);
      setReviewComment('');
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal mengirim ulasan.');
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName, phone, educationLevel, schoolName }),
      });
      await refreshProfile();
      setFeedback('Pengaturan profil siswa berhasil disimpan.');
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal menyimpan profil.');
    }
  };

  const activeBookings = bookings.filter((b) =>
    ['pending', 'accepted', 'awaiting_payment', 'paid', 'scheduled', 'in_progress'].includes(b.status)
  );
  const upcomingClasses = bookings.filter((b) =>
    ['paid', 'scheduled', 'in_progress'].includes(b.status)
  );
  const completedBookings = bookings.filter((b) => b.status === 'completed');

  const menuItems: Array<{ id: StudentTab; label: string; icon: typeof Home }> = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'cari', label: 'Cari Guru', icon: Search },
    { id: 'favorit', label: 'Guru Favorit', icon: Heart },
    { id: 'pemesanan', label: 'Pemesanan Saya', icon: BookOpen },
    { id: 'jadwal', label: 'Jadwal Belajar', icon: Calendar },
    { id: 'kelas', label: 'Kelas Online', icon: Video },
    { id: 'pembayaran', label: 'Riwayat Pembayaran', icon: CreditCard },
    { id: 'ulasan', label: 'Ulasan', icon: Star },
    { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <div className="bg-slate-50 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sidebar */}
          <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-[#2563EB]">Dashboard Siswa</p>
              <h1 className="text-base font-bold text-[#1F2937] truncate mt-0.5">{user?.fullName}</h1>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
            <nav className="space-y-1" aria-label="Menu Siswa">
              {menuItems.map((m) => {
                const Icon = m.icon;
                const active = tab === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setTab(m.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-xl transition-colors text-left ${
                      active
                        ? 'bg-[#DBEAFE] text-[#2563EB] font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-[#1F2937]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-9 space-y-5">
            {feedback && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center justify-between">
                <span>{feedback}</span>
                <button type="button" onClick={() => setFeedback('')} className="text-xs font-semibold underline">
                  Tutup
                </button>
              </div>
            )}

            {tab === 'beranda' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Pemesanan Aktif</p>
                    <p className="text-2xl font-bold text-[#1F2937] font-mono-tabular mt-1">
                      {activeBookings.length}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Kelas Berikutnya</p>
                    <p className="text-2xl font-bold text-[#2563EB] font-mono-tabular mt-1">
                      {upcomingClasses.length}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Sesi Selesai</p>
                    <p className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-1">
                      {completedBookings.length}
                    </p>
                  </div>
                </div>

                {/* Next Class Highlight */}
                <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-[#1F2937]">Kelas Berikutnya</h2>
                    <Link to="/cari-guru" className="text-xs font-semibold text-[#2563EB] hover:underline">
                      + Pesan Kelas Baru
                    </Link>
                  </div>
                  {loading ? (
                    <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
                  ) : upcomingClasses.length === 0 ? (
                    <p className="text-sm text-slate-500">Belum ada kelas terjadwal. Pesan guru pilihan Anda sekarang.</p>
                  ) : (
                    upcomingClasses.map((b) => (
                      <div key={b.id} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#1F2937]">
                            {b.subjectName} · {b.teacherName}
                          </p>
                          <p className="text-xs text-slate-600 font-mono-tabular mt-0.5">
                            {b.sessionDate} · {b.startTime}–{b.endTime} ({b.durationMinutes} mnt)
                          </p>
                        </div>
                        <Link
                          to={`/kelas/${b.id}`}
                          className="px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-xl whitespace-nowrap self-start sm:self-auto"
                        >
                          Masuk Ruang Kelas
                        </Link>
                      </div>
                    ))
                  )}
                </section>

                {/* Notifications */}
                <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                  <h2 className="text-base font-bold text-[#1F2937] inline-flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#2563EB]" />
                    Notifikasi Terbaru
                  </h2>
                  {notifications.length === 0 ? (
                    <p className="text-sm text-slate-500">Belum ada notifikasi.</p>
                  ) : (
                    <div className="space-y-2">
                      {notifications.slice(0, 5).map((n) => (
                        <div key={n.id} className="border border-slate-100 bg-slate-50 rounded-xl p-3">
                          <p className="text-xs font-bold text-[#1F2937]">{n.title}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {tab === 'cari' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Cari Guru Belajar</h2>
                <p className="text-sm text-slate-600">
                  Buka halaman direktori guru lengkap dengan filter mata pelajaran, jenjang, tarif, dan jadwal tersedia.
                </p>
                <Link to="/cari-guru" className="inline-block px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-xl">
                  Buka Direktori Cari Guru
                </Link>
              </div>
            )}

            {tab === 'favorit' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Guru Favorit Saya</h2>
                {favoriteTeachers.length === 0 ? (
                  <p className="text-sm text-slate-500">Anda belum menandai guru favorit.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {favoriteTeachers.map((t) => (
                      <div key={t.id} className="border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#1F2937]">{t.fullName}</p>
                          <p className="text-xs text-slate-500">
                            {t.subjects.map((s) => s.subjectName).join(', ')}
                          </p>
                        </div>
                        <Link to={`/guru/${t.id}`} className="px-3 py-1.5 bg-[#2563EB] text-white text-xs font-semibold rounded-lg">
                          Pesan
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(tab === 'pemesanan' || tab === 'jadwal' || tab === 'kelas') && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">
                  {tab === 'pemesanan'
                    ? 'Pemesanan Saya'
                    : tab === 'jadwal'
                    ? 'Jadwal Belajar'
                    : 'Ruang Kelas Online'}
                </h2>
                {bookings.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada pemesanan belajar.</p>
                ) : (
                  <div className="space-y-3">
                    {bookings
                      .filter((b) =>
                        tab === 'kelas'
                          ? ['paid', 'scheduled', 'in_progress', 'completed'].includes(b.status)
                          : true
                      )
                      .map((b) => {
                        const st = getStatusLabel(b.status);
                        return (
                          <div key={b.id} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-mono-tabular font-semibold text-slate-500">
                                  {b.bookingCode}
                                </span>
                                <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${st.colorClass}`}>
                                  {st.label}
                                </span>
                              </div>
                              <p className="text-sm font-bold text-[#1F2937]">
                                {b.subjectName} ({b.educationLevel}) · {b.teacherName}
                              </p>
                              <p className="text-xs text-slate-600 font-mono-tabular">
                                {b.sessionDate} · {b.startTime}–{b.endTime} · {formatRp(b.studentPriceSnapshot)}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {b.status === 'awaiting_payment' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPayBooking(b);
                                    setInitiatedPayment(null);
                                  }}
                                  className="px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-xl"
                                >
                                  Bayar Sekarang
                                </button>
                              )}
                              {['paid', 'scheduled', 'in_progress'].includes(b.status) && (
                                <Link
                                  to={`/kelas/${b.id}`}
                                  className="px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-xl"
                                >
                                  Masuk Kelas Online
                                </Link>
                              )}
                              {['pending', 'awaiting_payment'].includes(b.status) && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelBooking(b.id)}
                                  className="px-3 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50"
                                >
                                  Batalkan
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {tab === 'pembayaran' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Riwayat Pembayaran & Bukti Transaksi</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 pr-3">Ref Transaksi</th>
                        <th className="py-2 px-3">Booking</th>
                        <th className="py-2 px-3">Metode</th>
                        <th className="py-2 px-3 text-right">Nominal</th>
                        <th className="py-2 pl-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bookings
                        .filter((b) => b.payment)
                        .map((b) => {
                          const p = b.payment!;
                          const st = getStatusLabel(p.status);
                          return (
                            <tr key={p.id}>
                              <td className="py-3 pr-3 font-mono-tabular text-xs font-semibold">{p.externalRef}</td>
                              <td className="py-3 px-3 text-xs">{b.bookingCode} · {b.subjectName}</td>
                              <td className="py-3 px-3 text-xs">{p.paymentMethod}</td>
                              <td className="py-3 px-3 text-right font-mono-tabular font-semibold">
                                {formatRp(p.amount)}
                              </td>
                              <td className="py-3 pl-3">
                                <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${st.colorClass}`}>
                                  {st.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'ulasan' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Ulasan Sesi Belajar</h2>
                {completedBookings.length === 0 ? (
                  <p className="text-sm text-slate-500">Selesaikan sesi belajar untuk menulis ulasan.</p>
                ) : (
                  <div className="space-y-3">
                    {completedBookings.map((b) => (
                      <div key={b.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-[#1F2937]">
                            {b.subjectName} · {b.teacherName} ({b.bookingCode})
                          </p>
                          {!b.review && (
                            <button
                              type="button"
                              onClick={() => setReviewBookingId(b.id)}
                              className="px-3 py-1.5 bg-[#2563EB] text-white text-xs font-semibold rounded-lg"
                            >
                              Tulis Ulasan
                            </button>
                          )}
                        </div>
                        {b.review && (
                          <p className="text-xs text-slate-600">
                            Rating {b.review.rating}/5 — "{b.review.comment}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {reviewBookingId && (
                  <form onSubmit={handleSubmitReview} className="border-t border-slate-200 pt-4 space-y-3">
                    <h3 className="text-sm font-bold text-[#1F2937]">Kirim Ulasan Guru</h3>
                    <div>
                      <label htmlFor="rev-rating" className="block text-xs font-semibold mb-1">Rating (1–5)</label>
                      <select
                        id="rev-rating"
                        value={reviewRating}
                        onChange={(e) => setReviewRating(Number(e.target.value))}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>{n} Bintang</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="rev-comment" className="block text-xs font-semibold mb-1">Komentar</label>
                      <textarea
                        id="rev-comment"
                        rows={2}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                      />
                    </div>
                    <button type="submit" className="px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-xl">
                      Simpan Ulasan
                    </button>
                  </form>
                )}
              </div>
            )}

            {tab === 'pengaturan' && (
              <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Pengaturan Profil Siswa</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="st-name" className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                    <input id="st-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label htmlFor="st-phone" className="block text-xs font-semibold text-slate-700 mb-1">Nomor WhatsApp</label>
                    <input id="st-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label htmlFor="st-lvl" className="block text-xs font-semibold text-slate-700 mb-1">Jenjang Pendidikan</label>
                    <select id="st-lvl" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white">
                      <option value="SD">SD</option>
                      <option value="SMP">SMP</option>
                      <option value="SMA/SMK">SMA/SMK</option>
                      <option value="Mahasiswa">Mahasiswa</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="st-school" className="block text-xs font-semibold text-slate-700 mb-1">Sekolah / Universitas</label>
                    <input id="st-school" type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" />
                  </div>
                </div>
                <button type="submit" className="px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-xl">
                  Simpan Perubahan
                </button>
              </form>
            )}
          </main>
        </div>
      </div>

      {/* Sandbox Payment Gateway Modal */}
      {payBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1F2937]">Pembayaran Sesi Belajar</h2>
                <p className="text-xs text-slate-500 font-mono-tabular">{payBooking.bookingCode}</p>
              </div>
              <button type="button" onClick={() => setPayBooking(null)} className="text-xs font-semibold text-slate-500">
                Tutup
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Total Tagihan</span>
              <span className="text-lg font-extrabold text-[#2563EB] font-mono-tabular">
                {formatRp(payBooking.studentPriceSnapshot)}
              </span>
            </div>

            {!initiatedPayment ? (
              <div className="space-y-3">
                <span className="block text-xs font-semibold text-slate-700">Pilih Metode Pembayaran Sandbox</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['QRIS', 'Virtual Account', 'Transfer Bank', 'E-Wallet'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      className={`py-2.5 px-3 text-xs font-semibold rounded-xl border ${
                        payMethod === m
                          ? 'bg-[#DBEAFE] border-[#2563EB] text-[#2563EB]'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={payProcessing}
                  onClick={handleInitiatePayment}
                  className="w-full py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-xl"
                >
                  {payProcessing ? 'Membuat Tagihan...' : 'Buat Kode Pembayaran Sandbox'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                  <p className="font-bold">Ref Gateway: <span className="font-mono-tabular">{initiatedPayment.externalRef}</span></p>
                  {initiatedPayment.vaNumber && (
                    <p>Nomor VA: <span className="font-mono-tabular font-bold">{initiatedPayment.vaNumber}</span></p>
                  )}
                  <p>{initiatedPayment.instructions}</p>
                </div>
                <button
                  type="button"
                  disabled={payProcessing}
                  onClick={handleSimulateWebhookConfirm}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl"
                >
                  {payProcessing ? 'Memverifikasi Webhook...' : 'Konfirmasi Pembayaran via Webhook Server (Sandbox)'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
