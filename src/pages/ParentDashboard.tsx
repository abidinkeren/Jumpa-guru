import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Calendar, CheckCircle2, CreditCard, Home, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { formatRp, getStatusLabel, type BookingItem } from '../types/index.ts';

type ParentTab = 'beranda' | 'anak' | 'jadwal' | 'transaksi' | 'pengaduan';

interface ChildLink {
  id: number;
  studentUserId: number;
  relationshipType: string;
  verificationStatus: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string | null;
  studentProfile: {
    educationLevel: string;
    schoolName: string | null;
    grade: string | null;
    learningGoals: string | null;
  } | null;
}

interface ComplaintRow {
  complaint: {
    id: number;
    category: string;
    subject: string;
    description: string;
    status: string;
    adminResponse: string | null;
    createdAt: string;
  };
}

export function ParentDashboard() {
  const { user, apiFetch } = useAuth();
  const [tab, setTab] = useState<ParentTab>('beranda');
  const [children, setChildren] = useState<ChildLink[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [feedback, setFeedback] = useState('');

  const [childEmail, setChildEmail] = useState('');
  const [relationshipType, setRelationshipType] = useState('Orang Tua');
  const [compSubject, setCompSubject] = useState('');
  const [compCategory, setCompCategory] = useState('Jadwal & Teknis');
  const [compDesc, setCompDesc] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [cData, bData, cmpData] = await Promise.all([
        apiFetch<ChildLink[]>('/api/parent/children'),
        apiFetch<BookingItem[]>('/api/bookings'),
        apiFetch<ComplaintRow[]>('/api/complaints'),
      ]);
      setChildren(cData);
      setBookings(bData);
      setComplaints(cmpData);
    } catch (err) {
      console.error(err);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLinkChild = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/parent/link-child', {
        method: 'POST',
        body: JSON.stringify({ childEmail, relationshipType }),
      });
      setChildEmail('');
      setFeedback('Permintaan tautan akun anak telah dikirim untuk verifikasi Administrator.');
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal menautkan akun anak.');
    }
  };

  const handleToggleApproval = async (bookingId: number, approved: boolean) => {
    try {
      await apiFetch(`/api/bookings/${bookingId}/parent-approve`, {
        method: 'POST',
        body: JSON.stringify({ approved }),
      });
      setFeedback('Status persetujuan orang tua berhasil diperbarui.');
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal memperbarui persetujuan.');
    }
  };

  const handleSubmitComplaint = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({
          category: compCategory,
          subject: compSubject,
          description: compDesc,
        }),
      });
      setCompSubject('');
      setCompDesc('');
      setFeedback('Laporan permasalahan berhasil dikirim ke Administrator.');
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal mengirim laporan.');
    }
  };

  const verifiedChildren = children.filter((c) => c.verificationStatus === 'verified');

  const menuItems: Array<{ id: ParentTab; label: string; icon: typeof Home }> = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'anak', label: 'Profil Anak', icon: Users },
    { id: 'jadwal', label: 'Jadwal & Persetujuan', icon: Calendar },
    { id: 'transaksi', label: 'Riwayat Transaksi', icon: CreditCard },
    { id: 'pengaduan', label: 'Laporkan Masalah', icon: AlertCircle },
  ];

  return (
    <div className="bg-slate-50 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-[#2563EB]">Dashboard Orang Tua/Wali</p>
              <h1 className="text-base font-bold text-[#1F2937] truncate mt-0.5">{user?.fullName}</h1>
              <p className="text-xs text-slate-500">Akses pemantauan terverifikasi</p>
            </div>
            <nav className="space-y-1" aria-label="Menu Orang Tua">
              {menuItems.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setTab(m.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-xl text-left ${
                      tab === m.id
                        ? 'bg-[#DBEAFE] text-[#2563EB] font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

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
                    <p className="text-xs text-slate-500">Anak Terverifikasi</p>
                    <p className="text-2xl font-bold text-[#1F2937] font-mono-tabular mt-1">{verifiedChildren.length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Total Sesi Belajar Anak</p>
                    <p className="text-2xl font-bold text-[#2563EB] font-mono-tabular mt-1">{bookings.length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Sesi Selesai</p>
                    <p className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-1">
                      {bookings.filter((b) => b.status === 'completed').length}
                    </p>
                  </div>
                </div>

                <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                  <h2 className="text-base font-bold text-[#1F2937]">Ringkasan Jadwal Belajar Anak</h2>
                  {bookings.length === 0 ? (
                    <p className="text-sm text-slate-500">Belum ada jadwal belajar anak terverifikasi.</p>
                  ) : (
                    bookings.slice(0, 5).map((b) => {
                      const st = getStatusLabel(b.status);
                      return (
                        <div key={b.id} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-[#1F2937]">
                              {b.studentName} · {b.subjectName} bersama {b.teacherName}
                            </p>
                            <p className="text-xs text-slate-600 font-mono-tabular">
                              {b.sessionDate} · {b.startTime}–{b.endTime}
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border self-start ${st.colorClass}`}>
                            {st.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </section>
              </div>
            )}

            {tab === 'anak' && (
              <div className="space-y-5">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <h2 className="text-lg font-bold text-[#1F2937]">Profil Anak Terhubung</h2>
                  {children.length === 0 ? (
                    <p className="text-sm text-slate-500">Belum ada akun anak yang ditautkan.</p>
                  ) : (
                    <div className="space-y-3">
                      {children.map((c) => {
                        const st = getStatusLabel(c.verificationStatus === 'verified' ? 'approved' : c.verificationStatus);
                        return (
                          <div key={c.id} className="border border-slate-200 rounded-xl p-4 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold text-[#1F2937]">{c.studentName}</p>
                              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${st.colorClass}`}>
                                {c.verificationStatus === 'verified' ? 'Terverifikasi' : 'Menunggu Verifikasi'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">
                              {c.studentEmail} · Hubungan: {c.relationshipType}
                            </p>
                            {c.studentProfile && (
                              <p className="text-xs text-slate-500">
                                {c.studentProfile.educationLevel} · {c.studentProfile.schoolName || '-'} ({c.studentProfile.grade || '-'})
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <form onSubmit={handleLinkChild} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-bold text-[#1F2937] inline-flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#2563EB]" />
                    Ajukan Tautan Akun Anak
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="email"
                      value={childEmail}
                      onChange={(e) => setChildEmail(e.target.value)}
                      required
                      placeholder="Email akun siswa anak"
                      className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                    />
                    <input
                      type="text"
                      value={relationshipType}
                      onChange={(e) => setRelationshipType(e.target.value)}
                      placeholder="Hubungan (Ibu / Ayah / Wali)"
                      className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                    />
                  </div>
                  <button type="submit" className="px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-xl">
                    Kirim Permintaan Verifikasi
                  </button>
                </form>
              </div>
            )}

            {tab === 'jadwal' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Pemantauan Jadwal, Guru & Persetujuan Orang Tua</h2>
                <div className="space-y-3">
                  {bookings.map((b) => {
                    const st = getStatusLabel(b.status);
                    return (
                      <div key={b.id} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono-tabular text-slate-500">{b.bookingCode}</span>
                            <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${st.colorClass}`}>{st.label}</span>
                          </div>
                          <p className="text-sm font-bold text-[#1F2937]">
                            {b.studentName} · {b.subjectName} · Guru: {b.teacherName}
                          </p>
                          <p className="text-xs text-slate-600 font-mono-tabular">
                            {b.sessionDate} · {b.startTime}–{b.endTime}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleApproval(b.id, !b.parentApproved)}
                          className={`px-3.5 py-2 text-xs font-semibold rounded-xl border inline-flex items-center gap-1.5 ${
                            b.parentApproved
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {b.parentApproved ? 'Disetujui Wali' : 'Beri Persetujuan'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === 'transaksi' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Transaksi Pembelajaran Anak</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 pr-3">Kode Booking</th>
                        <th className="py-2 px-3">Siswa & Guru</th>
                        <th className="py-2 px-3">Ref Pembayaran</th>
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 pl-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bookings.map((b) => (
                        <tr key={b.id}>
                          <td className="py-2.5 pr-3 font-mono-tabular font-semibold">{b.bookingCode}</td>
                          <td className="py-2.5 px-3">{b.studentName} · {b.teacherName}</td>
                          <td className="py-2.5 px-3 font-mono-tabular">{b.payment?.externalRef || '-'}</td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold">{formatRp(b.studentPriceSnapshot)}</td>
                          <td className="py-2.5 pl-3">{b.payment?.status || b.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'pengaduan' && (
              <div className="space-y-5">
                <form onSubmit={handleSubmitComplaint} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <h2 className="text-lg font-bold text-[#1F2937]">Laporkan Permasalahan</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="cmp-cat" className="block text-xs font-semibold mb-1">Kategori</label>
                      <select id="cmp-cat" value={compCategory} onChange={(e) => setCompCategory(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white">
                        <option value="Jadwal & Teknis">Jadwal & Teknis</option>
                        <option value="Kualitas Pengajaran">Kualitas Pengajaran</option>
                        <option value="Pembayaran">Pembayaran</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="cmp-sub" className="block text-xs font-semibold mb-1">Subjek</label>
                      <input id="cmp-sub" type="text" value={compSubject} onChange={(e) => setCompSubject(e.target.value)} required className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="cmp-desc" className="block text-xs font-semibold mb-1">Detail Laporan</label>
                    <textarea id="cmp-desc" rows={3} value={compDesc} onChange={(e) => setCompDesc(e.target.value)} required className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl" />
                  </div>
                  <button type="submit" className="px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-xl">
                    Kirim Laporan
                  </button>
                </form>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                  <h3 className="text-base font-bold text-[#1F2937]">Riwayat Pengaduan</h3>
                  {complaints.map((c) => (
                    <div key={c.complaint.id} className="border border-slate-200 rounded-xl p-4 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#1F2937]">{c.complaint.subject}</span>
                        <span className="font-semibold text-[#2563EB]">{c.complaint.status}</span>
                      </div>
                      <p className="text-xs text-slate-600">{c.complaint.description}</p>
                      {c.complaint.adminResponse && (
                        <p className="text-xs text-emerald-700 pt-1">Respons Admin: {c.complaint.adminResponse}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
