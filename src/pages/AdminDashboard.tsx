import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Banknote,
  BookOpen,
  Calendar,
  CheckSquare,
  CreditCard,
  FileBarChart2,
  FolderTree,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Shield,
  Star,
  Tag,
  UserCheck,
  Users,
  Video,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  formatRp,
  getStatusLabel,
  type BookingItem,
  type PricingPlanItem,
  type SubjectItem,
} from '../types/index.ts';

type AdminMenu =
  | 'dashboard'
  | 'teachers'
  | 'verify_teachers'
  | 'students'
  | 'parents'
  | 'subjects'
  | 'categories'
  | 'pricing'
  | 'schedules'
  | 'bookings'
  | 'classes'
  | 'payments'
  | 'wallets'
  | 'withdrawals'
  | 'reviews'
  | 'complaints'
  | 'finance'
  | 'settings'
  | 'admins'
  | 'audit_logs';

interface AdminOverview {
  totalTeachers: number;
  totalStudents: number;
  activeTeachers: number;
  pendingVerifications: number;
  totalBookings: number;
  todayBookings: number;
  liveClasses: number;
  totalTransactions: number;
  grossTransactionVolume: number;
  platformRevenue: number;
  pendingWithdrawals: number;
}

interface AdminTeacher {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  lastEducation: string;
  institution: string;
  major: string;
  experienceYears: number;
  verificationStatus: string;
  revisionNotes: string | null;
  idDocumentUrl: string | null;
  diplomaDocumentUrl: string | null;
  totalSessions: number;
  isActiveUser: boolean;
  wallet: {
    totalEarned: number;
    availableBalance: number;
    totalWithdrawn: number;
  } | null;
}

interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  isActive: boolean;
}

interface AdminGuardian {
  id: number;
  parentName: string;
  parentEmail: string;
  studentName: string;
  studentEmail: string;
  relationshipType: string;
  verificationStatus: string;
}

interface AdminWithdrawal {
  id: number;
  teacherName: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  amount: number;
  status: string;
  payoutReference: string | null;
  requestedAt: string;
}

export function AdminDashboard() {
  const { user, apiFetch } = useAuth();
  const [menu, setMenu] = useState<AdminMenu>('dashboard');
  const [feedback, setFeedback] = useState('');

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [teachers, setTeachers] = useState<AdminTeacher[]>([]);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [guardians, setGuardians] = useState<AdminGuardian[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [pricing, setPricing] = useState<PricingPlanItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [payments, setPayments] = useState<Array<{ payment: { id: number; externalRef: string; paymentMethod: string; amount: number; status: string }; bookingCode: string; studentName: string; subjectName: string }>>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [reviewsList, setReviewsList] = useState<Array<{ review: { id: number; rating: number; comment: string; isPublished: boolean }; studentName: string }>>([]);
  const [complaints, setComplaints] = useState<Array<{ complaint: { id: number; category: string; subject: string; description: string; status: string; adminResponse: string | null }; reporterName: string; reporterRole: string }>>([]);
  const [finance, setFinance] = useState<{ summary: { totalGross: number; totalTeacherShare: number; totalPlatformCommission: number }; ledger: Array<{ id: number; referenceCode: string; type: string; amount: number; description: string }> } | null>(null);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: number; action: string; entityType: string; entityId: string; createdAt: string }>>([]);
  const [siteConfig, setSiteConfig] = useState<Record<string, unknown>>({});

  // Forms state
  const [newSubName, setNewSubName] = useState('');
  const [newSubCat, setNewSubCat] = useState('Sains & Hitungan');
  const [newSubDesc, setNewSubDesc] = useState('');
  const [editPriceValues, setEditPriceValues] = useState<Record<number, { price: string; share: string }>>({});
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [complaintReply, setComplaintReply] = useState<Record<number, string>>({});

  const loadAll = useCallback(async () => {
    try {
      const [ov, tList, uList, gList, sList, pList, bList, payList, wdList, revList, cmpList, finData, logs, cfg] =
        await Promise.all([
          apiFetch<AdminOverview>('/api/admin/overview'),
          apiFetch<AdminTeacher[]>('/api/admin/teachers'),
          apiFetch<AdminUser[]>('/api/admin/users'),
          apiFetch<AdminGuardian[]>('/api/admin/guardians'),
          fetch('/api/subjects').then((r) => r.json()),
          fetch('/api/pricing').then((r) => r.json()),
          apiFetch<BookingItem[]>('/api/bookings'),
          apiFetch<typeof payments>('/api/payments'),
          apiFetch<AdminWithdrawal[]>('/api/admin/withdrawals'),
          apiFetch<typeof reviewsList>('/api/admin/reviews'),
          apiFetch<typeof complaints>('/api/complaints'),
          apiFetch<typeof finance>('/api/admin/finance'),
          apiFetch<typeof auditLogs>('/api/admin/audit-logs'),
          fetch('/api/site-settings').then((r) => r.json()),
        ]);

      setOverview(ov);
      setTeachers(tList);
      setAllUsers(uList);
      setGuardians(gList);
      setSubjects(Array.isArray(sList) ? sList : []);
      setPricing(Array.isArray(pList) ? pList : []);
      setBookings(bList);
      setPayments(payList);
      setWithdrawals(wdList);
      setReviewsList(revList);
      setComplaints(cmpList);
      setFinance(finData);
      setAuditLogs(logs);
      setSiteConfig(cfg || {});

      const priceMap: Record<number, { price: string; share: string }> = {};
      if (Array.isArray(pList)) {
        for (const p of pList) {
          priceMap[p.id] = { price: String(p.studentPrice), share: String(p.teacherSharePercent) };
        }
      }
      setEditPriceValues(priceMap);
    } catch (err) {
      console.error(err);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleVerifyTeacher = async (teacherId: number, status: string, revisionNotes?: string) => {
    try {
      await apiFetch(`/api/admin/teachers/${teacherId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ status, revisionNotes }),
      });
      setFeedback(`Status guru diperbarui menjadi "${status}".`);
      await loadAll();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal memperbarui status guru.');
    }
  };

  const handleToggleUser = async (userId: number) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/toggle-active`, { method: 'POST' });
      setFeedback('Status aktif pengguna diperbarui.');
      await loadAll();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal mengubah status pengguna.');
    }
  };

  const handleVerifyGuardian = async (id: number, status: string) => {
    try {
      await apiFetch(`/api/admin/guardians/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      setFeedback('Status relasi orang tua diperbarui.');
      await loadAll();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal memperbarui relasi.');
    }
  };

  const handleCreateSubject = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/subjects', {
        method: 'POST',
        body: JSON.stringify({ name: newSubName, category: newSubCat, description: newSubDesc }),
      });
      setNewSubName('');
      setNewSubDesc('');
      setFeedback('Mata pelajaran baru berhasil ditambahkan.');
      await loadAll();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal menambah mata pelajaran.');
    }
  };

  const handleSavePricing = async (planId: number) => {
    const vals = editPriceValues[planId];
    if (!vals) return;
    try {
      await apiFetch(`/api/admin/pricing/${planId}`, {
        method: 'PUT',
        body: JSON.stringify({
          studentPrice: Number(vals.price),
          teacherSharePercent: Number(vals.share),
          isActive: true,
        }),
      });
      setFeedback('Paket harga resmi berhasil diperbarui.');
      await loadAll();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal menyimpan harga.');
    }
  };

  const handleProcessWithdrawal = async (wdId: number, status: 'processing' | 'paid' | 'failed') => {
    try {
      await apiFetch(`/api/admin/withdrawals/${wdId}/process`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      setFeedback(`Pencairan #${wdId} diperbarui menjadi "${status}".`);
      await loadAll();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal memproses pencairan.');
    }
  };

  const handleResolveComplaint = async (id: number) => {
    try {
      await apiFetch(`/api/admin/complaints/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'resolved',
          adminResponse: complaintReply[id] || 'Telah ditindaklanjuti oleh tim JUMPA GURU.',
        }),
      });
      setFeedback('Pengaduan ditandai selesai.');
      await loadAll();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal memproses pengaduan.');
    }
  };

  const handleCreateAdmin = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/users/admin', {
        method: 'POST',
        body: JSON.stringify({ fullName: newAdminName, email: newAdminEmail, password: newAdminPass }),
      });
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPass('');
      setFeedback('Administrator baru berhasil dibuat.');
      await loadAll();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal menambah admin.');
    }
  };

  const handleSaveSiteSettings = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/site-settings', {
        method: 'PUT',
        body: JSON.stringify(siteConfig),
      });
      setFeedback('Pengaturan website berhasil disimpan.');
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    }
  };

  const navItems: Array<{ id: AdminMenu; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'teachers', label: 'Manajemen Guru', icon: GraduationCap },
    { id: 'verify_teachers', label: 'Verifikasi Guru', icon: UserCheck },
    { id: 'students', label: 'Manajemen Siswa', icon: Users },
    { id: 'parents', label: 'Manajemen Orang Tua', icon: CheckSquare },
    { id: 'subjects', label: 'Mata Pelajaran', icon: BookOpen },
    { id: 'categories', label: 'Kategori', icon: FolderTree },
    { id: 'pricing', label: 'Paket Harga', icon: Tag },
    { id: 'schedules', label: 'Jadwal Guru', icon: Calendar },
    { id: 'bookings', label: 'Pemesanan', icon: Activity },
    { id: 'classes', label: 'Kelas Online', icon: Video },
    { id: 'payments', label: 'Pembayaran', icon: CreditCard },
    { id: 'wallets', label: 'Wallet Guru', icon: Wallet },
    { id: 'withdrawals', label: 'Pencairan Dana', icon: Banknote },
    { id: 'reviews', label: 'Ulasan', icon: Star },
    { id: 'complaints', label: 'Pengaduan', icon: AlertTriangle },
    { id: 'finance', label: 'Laporan Keuangan', icon: FileBarChart2 },
    { id: 'settings', label: 'Pengaturan Website', icon: Settings },
    { id: 'admins', label: 'Manajemen Admin', icon: Shield },
    { id: 'audit_logs', label: 'Audit Log', icon: Activity },
  ];

  const categories = Array.from(new Set(subjects.map((s) => s.category)));

  return (
    <div className="bg-slate-50 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 20-Item Admin Sidebar */}
          <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="pb-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-[#2563EB]">Administrator Console</p>
              <h1 className="text-base font-bold text-[#1F2937] truncate">{user?.fullName}</h1>
            </div>
            <nav className="space-y-0.5 max-h-[75vh] overflow-y-auto pr-1" aria-label="Menu Administrator">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMenu(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors text-left ${
                      menu === item.id
                        ? 'bg-[#DBEAFE] text-[#2563EB] font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-[#1F2937]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main Admin Viewport */}
          <main className="lg:col-span-9 space-y-5">
            {feedback && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center justify-between">
                <span>{feedback}</span>
                <button type="button" onClick={() => setFeedback('')} className="text-xs font-semibold underline">
                  Tutup
                </button>
              </div>
            )}

            {menu === 'dashboard' && overview && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-[#1F2937]">Ringkasan Operasional Platform</h2>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                  {[
                    { label: 'Total Guru', val: overview.totalTeachers },
                    { label: 'Total Siswa', val: overview.totalStudents },
                    { label: 'Guru Aktif', val: overview.activeTeachers },
                    { label: 'Menunggu Verifikasi', val: overview.pendingVerifications },
                    { label: 'Total Booking', val: overview.totalBookings },
                    { label: 'Booking Hari Ini', val: overview.todayBookings },
                    { label: 'Kelas Berlangsung', val: overview.liveClasses },
                    { label: 'Total Transaksi', val: overview.totalTransactions },
                    { label: 'Pendapatan Platform', val: formatRp(overview.platformRevenue) },
                    { label: 'Pencairan Tertunda', val: overview.pendingWithdrawals },
                  ].map((kpi) => (
                    <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-[11px] text-slate-500">{kpi.label}</p>
                      <p className="text-lg font-bold text-[#1F2937] font-mono-tabular mt-1">{kpi.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(menu === 'teachers' || menu === 'verify_teachers') && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">
                  {menu === 'verify_teachers' ? 'Verifikasi Pendaftaran & Dokumen Guru' : 'Manajemen Seluruh Guru'}
                </h2>
                <div className="space-y-3">
                  {teachers
                    .filter((t) =>
                      menu === 'verify_teachers'
                        ? ['submitted', 'under_review', 'revision_required'].includes(t.verificationStatus)
                        : true
                    )
                    .map((t) => {
                      const st = getStatusLabel(t.verificationStatus);
                      return (
                        <div key={t.id} className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#DBEAFE] border border-slate-200 shrink-0 flex items-center justify-center">
                                {t.avatarUrl ? (
                                  <img
                                    src={t.avatarUrl}
                                    alt={`Foto profil ${t.fullName}`}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <GraduationCap className="w-5 h-5 text-[#2563EB]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-[#1F2937] truncate">
                                  {t.fullName} ({t.email})
                                </p>
                                <p className="text-xs text-slate-600">
                                  {t.lastEducation} · {t.institution} · {t.experienceYears} thn
                                </p>
                              </div>
                            </div>
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${st.colorClass}`}>
                              {st.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-mono-tabular">
                            Dokumen Privat: KTP ({t.idDocumentUrl || '-'}) · Ijazah ({t.diplomaDocumentUrl || '-'})
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleVerifyTeacher(t.id, 'active')}
                              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg"
                            >
                              Setujui & Aktifkan
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleVerifyTeacher(t.id, 'revision_required', 'Mohon perjelas scan ijazah dan deskripsi mengajar.')
                              }
                              className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg"
                            >
                              Minta Revisi
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVerifyTeacher(t.id, 'suspended', 'Ditangguhkan sementara oleh admin')}
                              className="px-3 py-1.5 border border-slate-200 text-red-600 text-xs font-semibold rounded-lg"
                            >
                              Tangguhkan
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {menu === 'students' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Manajemen Siswa</h2>
                <div className="divide-y divide-slate-100">
                  {allUsers
                    .filter((u) => u.role === 'student')
                    .map((u) => (
                      <div key={u.id} className="py-3 flex items-center justify-between text-sm">
                        <div>
                          <p className="font-bold text-[#1F2937]">{u.fullName}</p>
                          <p className="text-xs text-slate-500">{u.email} · {u.phone || '-'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleUser(u.id)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                            u.isActive ? 'border-slate-200 text-slate-700' : 'bg-red-50 border-red-200 text-red-700'
                          }`}
                        >
                          {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {menu === 'parents' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Manajemen & Verifikasi Orang Tua/Wali</h2>
                <div className="space-y-3">
                  {guardians.map((g) => (
                    <div key={g.id} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#1F2937]">
                          {g.parentName} → {g.studentName} ({g.relationshipType})
                        </p>
                        <p className="text-xs text-slate-500">
                          {g.parentEmail} · Anak: {g.studentEmail} · Status: {g.verificationStatus}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleVerifyGuardian(g.id, 'verified')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg">
                          Verifikasi
                        </button>
                        <button type="button" onClick={() => handleVerifyGuardian(g.id, 'rejected')} className="px-3 py-1.5 border border-slate-200 text-red-600 text-xs font-semibold rounded-lg">
                          Tolak
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {menu === 'subjects' && (
              <div className="space-y-5">
                <form onSubmit={handleCreateSubject} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                  <h2 className="text-lg font-bold text-[#1F2937]">Tambah Mata Pelajaran</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" value={newSubName} onChange={(e) => setNewSubName(e.target.value)} placeholder="Nama Mata Pelajaran" required className="px-3 py-2 text-sm border border-slate-200 rounded-xl" />
                    <input type="text" value={newSubCat} onChange={(e) => setNewSubCat(e.target.value)} placeholder="Kategori" required className="px-3 py-2 text-sm border border-slate-200 rounded-xl" />
                  </div>
                  <input type="text" value={newSubDesc} onChange={(e) => setNewSubDesc(e.target.value)} placeholder="Deskripsi singkat" required className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl" />
                  <button type="submit" className="px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-xl">
                    Simpan Mata Pelajaran
                  </button>
                </form>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2">
                  <h3 className="text-base font-bold text-[#1F2937]">Daftar Mata Pelajaran ({subjects.length})</h3>
                  <div className="divide-y divide-slate-100">
                    {subjects.map((s) => (
                      <div key={s.id} className="py-2.5 flex items-center justify-between text-sm">
                        <div>
                          <p className="font-semibold text-[#1F2937]">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.category} · {s.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {menu === 'categories' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Kategori Mata Pelajaran</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map((cat) => (
                    <div key={cat} className="border border-slate-200 rounded-xl p-4">
                      <p className="text-sm font-bold text-[#1F2937]">{cat}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {subjects.filter((s) => s.category === cat).map((s) => s.name).join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {menu === 'pricing' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-[#1F2937]">Manajemen Paket Harga & Komisi Platform</h2>
                  <p className="text-xs text-slate-500">
                    Perubahan harga berlaku untuk pemesanan baru; transaksi lama tetap memakai snapshot harga historis.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 pr-3">Jenjang</th>
                        <th className="py-2 px-3">Durasi</th>
                        <th className="py-2 px-3">Harga Siswa (Rp)</th>
                        <th className="py-2 px-3">% Guru</th>
                        <th className="py-2 px-3">Pendapatan Guru</th>
                        <th className="py-2 px-3">Komisi Platform</th>
                        <th className="py-2 pl-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pricing.map((p) => {
                        const val = editPriceValues[p.id] || { price: String(p.studentPrice), share: String(p.teacherSharePercent) };
                        const numPrice = Number(val.price) || 0;
                        const numShare = Number(val.share) || 0;
                        const tEarn = Math.round((numPrice * numShare) / 100);
                        const comm = numPrice - tEarn;
                        return (
                          <tr key={p.id}>
                            <td className="py-2.5 pr-3 font-bold text-[#1F2937]">{p.educationLevel}</td>
                            <td className="py-2.5 px-3 font-mono-tabular">{p.durationMinutes} mnt</td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                value={val.price}
                                onChange={(e) =>
                                  setEditPriceValues((prev) => ({
                                    ...prev,
                                    [p.id]: { ...val, price: e.target.value },
                                  }))
                                }
                                className="w-28 px-2 py-1 border border-slate-200 rounded-lg font-mono-tabular"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                min={10}
                                max={95}
                                value={val.share}
                                onChange={(e) =>
                                  setEditPriceValues((prev) => ({
                                    ...prev,
                                    [p.id]: { ...val, share: e.target.value },
                                  }))
                                }
                                className="w-16 px-2 py-1 border border-slate-200 rounded-lg font-mono-tabular"
                              />
                            </td>
                            <td className="py-2.5 px-3 font-mono-tabular text-emerald-700">{formatRp(tEarn)}</td>
                            <td className="py-2.5 px-3 font-mono-tabular text-[#2563EB]">{formatRp(comm)}</td>
                            <td className="py-2.5 pl-3">
                              <button
                                type="button"
                                onClick={() => handleSavePricing(p.id)}
                                className="px-3 py-1 bg-[#2563EB] text-white font-semibold rounded-lg"
                              >
                                Simpan
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(menu === 'schedules' || menu === 'bookings' || menu === 'classes') && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">
                  {menu === 'schedules'
                    ? 'Monitoring Jadwal Mengajar'
                    : menu === 'classes'
                    ? 'Monitoring Kelas Online'
                    : 'Daftar Seluruh Pemesanan'}
                </h2>
                <div className="space-y-2.5">
                  {bookings
                    .filter((b) =>
                      menu === 'classes'
                        ? ['paid', 'scheduled', 'in_progress', 'completed'].includes(b.status)
                        : true
                    )
                    .map((b) => {
                      const st = getStatusLabel(b.status);
                      return (
                        <div key={b.id} className="border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div>
                            <p className="font-bold text-[#1F2937]">
                              {b.bookingCode} · {b.subjectName} ({b.educationLevel})
                            </p>
                            <p className="text-slate-600">
                              Siswa: {b.studentName} · Guru: {b.teacherName} · {b.sessionDate} {b.startTime}–{b.endTime}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 font-semibold rounded-md border ${st.colorClass}`}>{st.label}</span>
                            {['paid', 'scheduled', 'in_progress', 'completed'].includes(b.status) && (
                              <Link to={`/kelas/${b.id}`} className="px-3 py-1 bg-[#2563EB] text-white font-semibold rounded-lg">
                                Buka Kelas
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {menu === 'payments' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Transaksi Pembayaran Gateway</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 pr-3">Ref</th>
                        <th className="py-2 px-3">Booking</th>
                        <th className="py-2 px-3">Siswa</th>
                        <th className="py-2 px-3">Metode</th>
                        <th className="py-2 px-3 text-right">Nominal</th>
                        <th className="py-2 pl-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((row) => (
                        <tr key={row.payment.id}>
                          <td className="py-2.5 pr-3 font-mono-tabular font-semibold">{row.payment.externalRef}</td>
                          <td className="py-2.5 px-3">{row.bookingCode}</td>
                          <td className="py-2.5 px-3">{row.studentName}</td>
                          <td className="py-2.5 px-3">{row.payment.paymentMethod}</td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold">{formatRp(row.payment.amount)}</td>
                          <td className="py-2.5 pl-3">{row.payment.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {menu === 'wallets' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Monitoring Wallet Guru</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 pr-3">Guru</th>
                        <th className="py-2 px-3 text-right">Total Pendapatan</th>
                        <th className="py-2 px-3 text-right">Saldo Tersedia</th>
                        <th className="py-2 pl-3 text-right">Total Dicairkan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teachers.map((t) => (
                        <tr key={t.id}>
                          <td className="py-2.5 pr-3 font-semibold text-[#1F2937]">{t.fullName}</td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular">{formatRp(t.wallet?.totalEarned ?? 0)}</td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-[#2563EB] font-bold">{formatRp(t.wallet?.availableBalance ?? 0)}</td>
                          <td className="py-2.5 pl-3 text-right font-mono-tabular">{formatRp(t.wallet?.totalWithdrawn ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {menu === 'withdrawals' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Permintaan Pencairan Dana Guru</h2>
                <div className="space-y-3">
                  {withdrawals.map((w) => {
                    const st = getStatusLabel(w.status);
                    return (
                      <div key={w.id} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#1F2937]">
                            {w.teacherName} · <span className="font-mono-tabular text-[#2563EB]">{formatRp(w.amount)}</span>
                          </p>
                          <p className="text-xs text-slate-600 font-mono-tabular">
                            {w.bankName} · {w.accountNumber} ({w.accountHolderName}) · Ref: {w.payoutReference || '-'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-md border ${st.colorClass}`}>{st.label}</span>
                          {w.status === 'requested' && (
                            <>
                              <button type="button" onClick={() => handleProcessWithdrawal(w.id, 'paid')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg">
                                Transfer & Tandai Lunas
                              </button>
                              <button type="button" onClick={() => handleProcessWithdrawal(w.id, 'failed')} className="px-3 py-1.5 border border-slate-200 text-red-600 text-xs font-semibold rounded-lg">
                                Tolak & Kembalikan Saldo
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {menu === 'reviews' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Moderasi Ulasan</h2>
                <div className="space-y-3">
                  {reviewsList.map((r) => (
                    <div key={r.review.id} className="border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#1F2937]">{r.studentName} · Rating {r.review.rating}/5</p>
                        <p className="text-xs text-slate-600">{r.review.comment}</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/reviews/${r.review.id}/toggle`, { method: 'POST' });
                          await loadAll();
                        }}
                        className="px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-lg"
                      >
                        {r.review.isPublished ? 'Sembunyikan' : 'Tampilkan'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {menu === 'complaints' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Pengaduan Pengguna</h2>
                <div className="space-y-3">
                  {complaints.map((c) => (
                    <div key={c.complaint.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#1F2937]">{c.complaint.subject} ({c.reporterName})</span>
                        <span className="font-semibold text-[#2563EB]">{c.complaint.status}</span>
                      </div>
                      <p className="text-xs text-slate-600">{c.complaint.description}</p>
                      {c.complaint.status !== 'resolved' && (
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            value={complaintReply[c.complaint.id] || ''}
                            onChange={(e) =>
                              setComplaintReply((prev) => ({ ...prev, [c.complaint.id]: e.target.value }))
                            }
                            placeholder="Tulis tanggapan admin..."
                            className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                          />
                          <button type="button" onClick={() => handleResolveComplaint(c.complaint.id)} className="px-3 py-1.5 bg-[#2563EB] text-white text-xs font-semibold rounded-lg">
                            Selesaikan
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {menu === 'finance' && finance && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Total Transaksi Bruto</p>
                    <p className="text-xl font-bold text-[#1F2937] font-mono-tabular mt-1">{formatRp(finance.summary.totalGross)}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Total Bagian Guru</p>
                    <p className="text-xl font-bold text-emerald-700 font-mono-tabular mt-1">{formatRp(finance.summary.totalTeacherShare)}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Total Komisi Platform</p>
                    <p className="text-xl font-bold text-[#2563EB] font-mono-tabular mt-1">{formatRp(finance.summary.totalPlatformCommission)}</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                  <h2 className="text-base font-bold text-[#1F2937]">Buku Besar Keuangan (Ledger)</h2>
                  <div className="divide-y divide-slate-100 text-xs">
                    {finance.ledger.map((l) => (
                      <div key={l.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <span className="font-mono-tabular font-semibold">{l.referenceCode}</span> · {l.description}
                        </div>
                        <span className="font-mono-tabular font-bold">{formatRp(l.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {menu === 'settings' && (
              <form onSubmit={handleSaveSiteSettings} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Pengaturan Website & Operasional</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="cfg-email" className="block text-xs font-semibold mb-1">Email Dukungan</label>
                    <input
                      id="cfg-email"
                      type="email"
                      value={String(siteConfig.supportEmail || '')}
                      onChange={(e) => setSiteConfig((c) => ({ ...c, supportEmail: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label htmlFor="cfg-wa" className="block text-xs font-semibold mb-1">WhatsApp Dukungan</label>
                    <input
                      id="cfg-wa"
                      type="text"
                      value={String(siteConfig.supportWhatsapp || '')}
                      onChange={(e) => setSiteConfig((c) => ({ ...c, supportWhatsapp: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
                <button type="submit" className="px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-xl">
                  Simpan Pengaturan Website
                </button>
              </form>
            )}

            {menu === 'admins' && (
              <div className="space-y-5">
                <form onSubmit={handleCreateAdmin} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                  <h2 className="text-lg font-bold text-[#1F2937]">Tambah Administrator Baru</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input type="text" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="Nama Admin" required className="px-3 py-2 text-sm border border-slate-200 rounded-xl" />
                    <input type="email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="Email Admin" required className="px-3 py-2 text-sm border border-slate-200 rounded-xl" />
                    <input type="password" value={newAdminPass} onChange={(e) => setNewAdminPass(e.target.value)} placeholder="Kata Sandi (min 8)" required className="px-3 py-2 text-sm border border-slate-200 rounded-xl" />
                  </div>
                  <button type="submit" className="px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-xl">
                    Buat Akun Admin
                  </button>
                </form>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2">
                  <h3 className="text-base font-bold text-[#1F2937]">Daftar Administrator</h3>
                  {allUsers
                    .filter((u) => u.role === 'admin')
                    .map((a) => (
                      <div key={a.id} className="py-2 flex items-center justify-between text-sm border-b border-slate-100 last:border-0">
                        <span>{a.fullName} ({a.email})</span>
                        <span className="text-xs text-emerald-700 font-semibold">{a.isActive ? 'Aktif' : 'Nonaktif'}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {menu === 'audit_logs' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Audit Log Keamanan & Transaksi</h2>
                <div className="divide-y divide-slate-100 text-xs">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono-tabular font-semibold text-[#1F2937]">
                        {log.action} · {log.entityType} #{log.entityId}
                      </span>
                      <span className="text-slate-500 font-mono-tabular">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </span>
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
