import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Home,
  Settings,
  Star,
  Upload,
  User,
  Users,
  Video,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  DAY_NAMES,
  formatRp,
  getStatusLabel,
  type BookingItem,
  type SubjectItem,
} from '../types/index.ts';
import { resizeAvatarFile, TEACHER_PORTRAIT_PRESETS } from '../utils/imageUpload.ts';

type TeacherTab =
  | 'beranda'
  | 'profil'
  | 'mapel'
  | 'jadwal'
  | 'permintaan'
  | 'kelas'
  | 'siswa'
  | 'riwayat'
  | 'pendapatan'
  | 'pencairan'
  | 'ulasan'
  | 'pengaturan';

interface WalletData {
  wallet: {
    id: number;
    totalEarned: number;
    pendingBalance: number;
    availableBalance: number;
    totalWithdrawn: number;
  };
  transactions: Array<{
    id: number;
    type: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    description: string;
    referenceCode: string;
    createdAt: string;
  }>;
  bankAccounts: Array<{
    id: number;
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    isVerified: boolean;
  }>;
  withdrawals: Array<{
    id: number;
    amount: number;
    status: string;
    payoutReference: string | null;
    requestedAt: string;
  }>;
}

export function TeacherDashboard() {
  const { user, apiFetch, refreshProfile } = useAuth();
  const [tab, setTab] = useState<TeacherTab>('beranda');
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [myProfile, setMyProfile] = useState<{
    profile: {
      id: number;
      lastEducation: string;
      institution: string;
      major: string;
      bio: string;
      verificationStatus: string;
      revisionNotes: string | null;
      educationLevels: string[];
      totalSessions: number;
      ratingAvg: string;
    };
    subjects: Array<{ subjectId: number; subjectName: string }>;
    schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }>;
  } | null>(null);
  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);
  const [feedback, setFeedback] = useState('');

  // Bank & Withdrawal forms
  const [bankName, setBankName] = useState('Bank BCA');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState(user?.fullName || '');
  const [wdBankId, setWdBankId] = useState<number>(0);
  const [wdAmount, setWdAmount] = useState('100000');

  // Schedule & Subject forms
  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState('16:00');
  const [newEnd, setNewEnd] = useState('18:00');

  // Resubmission & profile photo form
  const [revBio, setRevBio] = useState('');
  const [revInst, setRevInst] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || TEACHER_PORTRAIT_PRESETS[0].url);
  const [sidebarImgError, setSidebarImgError] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const loadData = useCallback(async () => {
    try {
      const [bData, wData, pData, sData] = await Promise.all([
        apiFetch<BookingItem[]>('/api/bookings'),
        apiFetch<WalletData>('/api/wallet/me'),
        apiFetch<typeof myProfile>('/api/teachers/me/profile'),
        fetch('/api/subjects').then((r) => r.json()),
      ]);
      setBookings(bData);
      setWalletData(wData);
      setMyProfile(pData);
      setAllSubjects(Array.isArray(sData) ? sData : []);
      if (wData.bankAccounts[0] && wdBankId === 0) {
        setWdBankId(wData.bankAccounts[0].id);
      }
      if (pData?.profile) {
        setRevBio(pData.profile.bio);
        setRevInst(pData.profile.institution);
      }
    } catch (err) {
      console.error(err);
    }
  }, [apiFetch, wdBankId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRespondBooking = async (bookingId: number, decision: 'accept' | 'reject') => {
    try {
      await apiFetch(`/api/bookings/${bookingId}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          rejectionReason: decision === 'reject' ? 'Jadwal mengajar penuh pada slot tersebut' : undefined,
        }),
      });
      setFeedback(
        decision === 'accept'
          ? 'Pemesanan diterima! Tagihan otomatis dikirim ke siswa.'
          : 'Pemesanan ditolak.'
      );
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal memproses permintaan.');
    }
  };

  const handleAddBank = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/wallet/bank-accounts', {
        method: 'POST',
        body: JSON.stringify({ bankName, accountNumber, accountHolderName }),
      });
      setAccountNumber('');
      setFeedback('Rekening pencairan berhasil ditambahkan.');
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal menambah rekening.');
    }
  };

  const handleWithdraw = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/wallet/withdrawals', {
        method: 'POST',
        body: JSON.stringify({ bankAccountId: wdBankId, amount: Number(wdAmount) }),
      });
      setFeedback('Pengajuan pencairan dana berhasil dikirim ke Administrator.');
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal mengajukan pencairan.');
    }
  };

  const handleAddSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!myProfile) return;
    try {
      const updated = [
        ...myProfile.schedules,
        { dayOfWeek: newDay, startTime: newStart, endTime: newEnd, isAvailable: true },
      ];
      await apiFetch('/api/teachers/me/schedules', {
        method: 'PUT',
        body: JSON.stringify({ schedules: updated }),
      });
      setFeedback('Slot jadwal mengajar berhasil ditambahkan.');
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal menyimpan jadwal.');
    }
  };

  const handleResubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/teachers/me/resubmit', {
        method: 'PUT',
        body: JSON.stringify({ bio: revBio, institution: revInst, avatarUrl }),
      });
      await refreshProfile();
      setFeedback('Profil & foto pengajar berhasil diperbarui untuk ditinjau Administrator.');
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal mengirim ulang data.');
    }
  };

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeAvatarFile(file);
      setAvatarUrl(dataUrl);
      setSidebarImgError(false);
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      await refreshProfile();
      setFeedback('Foto profil guru berhasil diunggah dan disimpan.');
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal mengunggah foto profil.');
    }
  };

  const handleSaveAvatarPreset = async (presetUrl: string) => {
    setAvatarUrl(presetUrl);
    setSidebarImgError(false);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ avatarUrl: presetUrl }),
      });
      await refreshProfile();
      setFeedback('Foto profil guru berhasil diperbarui.');
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal memperbarui foto profil.');
    }
  };

  const handleToggleSubject = async (subjectId: number) => {
    if (!myProfile) return;
    const currentIds = myProfile.subjects.map((s) => s.subjectId);
    const nextIds = currentIds.includes(subjectId)
      ? currentIds.filter((id) => id !== subjectId)
      : [...currentIds, subjectId];
    if (nextIds.length === 0) return;
    try {
      await apiFetch('/api/teachers/me/subjects', {
        method: 'PUT',
        body: JSON.stringify({
          subjectIds: nextIds,
          educationLevels: myProfile.profile.educationLevels,
        }),
      });
      setFeedback('Daftar mata pelajaran yang diajar diperbarui.');
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal memperbarui mata pelajaran.');
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName, phone, avatarUrl }),
      });
      await refreshProfile();
      setFeedback('Pengaturan akun guru disimpan.');
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const pendingRequests = bookings.filter((b) => b.status === 'pending');
  const todaySchedule = bookings.filter((b) => b.sessionDate === todayStr && ['scheduled', 'in_progress', 'paid'].includes(b.status));
  const completedSessions = bookings.filter((b) => b.status === 'completed');
  const uniqueStudents = Array.from(new Map(bookings.map((b) => [b.studentUserId, { name: b.studentName, email: b.studentEmail }])).values());
  const verifStatus = myProfile ? getStatusLabel(myProfile.profile.verificationStatus) : null;

  const menuItems: Array<{ id: TeacherTab; label: string; icon: typeof Home }> = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'profil', label: 'Profil Saya', icon: User },
    { id: 'mapel', label: 'Mata Pelajaran', icon: BookOpen },
    { id: 'jadwal', label: 'Jadwal Mengajar', icon: Calendar },
    { id: 'permintaan', label: 'Permintaan Siswa', icon: ClipboardList },
    { id: 'kelas', label: 'Kelas Online', icon: Video },
    { id: 'siswa', label: 'Daftar Siswa', icon: Users },
    { id: 'riwayat', label: 'Riwayat Pembelajaran', icon: CheckCircle2 },
    { id: 'pendapatan', label: 'Pendapatan', icon: Wallet },
    { id: 'pencairan', label: 'Pencairan', icon: Banknote },
    { id: 'ulasan', label: 'Ulasan', icon: Star },
    { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <div className="bg-slate-50 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sidebar */}
          <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#DBEAFE] border border-slate-200 shrink-0 flex items-center justify-center">
                {(user?.avatarUrl || avatarUrl) && !sidebarImgError ? (
                  <img
                    src={user?.avatarUrl || avatarUrl}
                    alt={`Foto ${user?.fullName || 'Guru'}`}
                    referrerPolicy="no-referrer"
                    onError={() => setSidebarImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <GraduationCap className="w-6 h-6 text-[#2563EB]" />
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold text-[#2563EB]">Dashboard Guru</p>
                <h1 className="text-sm font-bold text-[#1F2937] truncate">{user?.fullName}</h1>
                {verifStatus && (
                  <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-md border ${verifStatus.colorClass}`}>
                    {verifStatus.label}
                  </span>
                )}
              </div>
            </div>
            <nav className="space-y-1" aria-label="Menu Guru">
              {menuItems.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setTab(m.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-xl transition-colors text-left ${
                      tab === m.id
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500">Jumlah Siswa</p>
                    <p className="text-2xl font-bold text-[#1F2937] font-mono-tabular mt-1">{uniqueStudents.length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500">Pemesanan Baru</p>
                    <p className="text-2xl font-bold text-amber-600 font-mono-tabular mt-1">{pendingRequests.length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500">Jadwal Hari Ini</p>
                    <p className="text-2xl font-bold text-[#2563EB] font-mono-tabular mt-1">{todaySchedule.length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500">Total Sesi Selesai</p>
                    <p className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-1">
                      {myProfile?.profile.totalSessions ?? completedSessions.length}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500">Total Pendapatan</p>
                    <p className="text-xl font-bold text-[#1F2937] font-mono-tabular mt-1">
                      {formatRp(walletData?.wallet.totalEarned ?? 0)}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500">Saldo Tersedia</p>
                    <p className="text-xl font-bold text-[#2563EB] font-mono-tabular mt-1">
                      {formatRp(walletData?.wallet.availableBalance ?? 0)}
                    </p>
                  </div>
                </div>

                {/* Pending Requests Quick Action */}
                <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                  <h2 className="text-base font-bold text-[#1F2937]">Permintaan Siswa Menunggu Respons</h2>
                  {pendingRequests.length === 0 ? (
                    <p className="text-sm text-slate-500">Tidak ada permintaan pemesanan baru.</p>
                  ) : (
                    pendingRequests.map((b) => (
                      <div key={b.id} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#1F2937]">
                            {b.studentName} · {b.subjectName} ({b.educationLevel})
                          </p>
                          <p className="text-xs text-slate-600 font-mono-tabular">
                            {b.sessionDate} · {b.startTime}–{b.endTime} · Bagian Guru: {formatRp(b.teacherEarningSnapshot)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleRespondBooking(b.id, 'accept')}
                            className="px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-xl"
                          >
                            Terima Jadwal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespondBooking(b.id, 'reject')}
                            className="px-3 py-2 border border-slate-200 text-xs font-semibold text-red-600 rounded-xl"
                          >
                            Tolak
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </section>
              </div>
            )}

            {tab === 'profil' && myProfile && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <h2 className="text-lg font-bold text-[#1F2937]">Profil Pengajar & Status Verifikasi</h2>
                {myProfile.profile.revisionNotes && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                    Catatan Revisi Admin: {myProfile.profile.revisionNotes}
                  </div>
                )}

                {/* Teacher Photo Editor */}
                <div className="pb-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#DBEAFE] border border-slate-200 shrink-0 flex items-center justify-center">
                    {(user?.avatarUrl || avatarUrl) && !sidebarImgError ? (
                      <img
                        src={user?.avatarUrl || avatarUrl}
                        alt={`Foto profil ${user?.fullName || 'Guru'}`}
                        referrerPolicy="no-referrer"
                        onError={() => setSidebarImgError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <GraduationCap className="w-9 h-9 text-[#2563EB]" />
                    )}
                  </div>
                  <div className="space-y-2.5 flex-1">
                    <div>
                      <p className="text-sm font-bold text-[#1F2937]">Foto Profil Pengajar</p>
                      <p className="text-xs text-slate-500">
                        Ditampilkan di halaman Cari Guru, Kartu Profil, dan halaman pemesanan siswa.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#2563EB] bg-[#DBEAFE]/50 hover:bg-[#DBEAFE] rounded-xl cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        Unggah Foto Baru
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleAvatarFileChange}
                          className="sr-only"
                        />
                      </label>
                      <span className="text-xs text-slate-500">atau pilih preset:</span>
                      <div className="flex items-center gap-2">
                        {TEACHER_PORTRAIT_PRESETS.map((preset) => (
                          <button
                            key={preset.url}
                            type="button"
                            onClick={() => handleSaveAvatarPreset(preset.url)}
                            aria-label={preset.label}
                            className={`w-9 h-9 rounded-lg overflow-hidden border-2 transition-all ${
                              (user?.avatarUrl || avatarUrl) === preset.url
                                ? 'border-[#2563EB] ring-2 ring-[#DBEAFE]'
                                : 'border-slate-200 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <img src={preset.url} alt={preset.label} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleResubmit} className="space-y-4">
                  <div>
                    <label htmlFor="t-inst" className="block text-xs font-semibold text-slate-700 mb-1">Institusi Pendidikan</label>
                    <input id="t-inst" type="text" value={revInst} onChange={(e) => setRevInst(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label htmlFor="t-bio" className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi Profil</label>
                    <textarea id="t-bio" rows={3} value={revBio} onChange={(e) => setRevBio(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" />
                  </div>
                  <button type="submit" className="px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-xl">
                    Perbarui & Kirim Ulang Verifikasi
                  </button>
                </form>
              </div>
            )}

            {tab === 'mapel' && myProfile && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Mata Pelajaran yang Diajar</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {allSubjects.map((s) => {
                    const active = myProfile.subjects.some((ms) => ms.subjectId === s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleToggleSubject(s.id)}
                        className={`p-3 rounded-xl border text-left text-xs font-semibold ${
                          active ? 'bg-[#DBEAFE] border-[#2563EB] text-[#2563EB]' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === 'jadwal' && myProfile && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <h2 className="text-lg font-bold text-[#1F2937]">Jadwal Mengajar Mingguan</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {myProfile.schedules.map((sc, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1F2937]">{DAY_NAMES[sc.dayOfWeek]}</span>
                      <span className="font-mono-tabular text-slate-600">{sc.startTime}–{sc.endTime}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddSchedule} className="pt-4 border-t border-slate-100 flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="sc-day" className="block text-xs font-semibold mb-1">Hari</label>
                    <select id="sc-day" value={newDay} onChange={(e) => setNewDay(Number(e.target.value))} className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white">
                      {Object.entries(DAY_NAMES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="sc-start" className="block text-xs font-semibold mb-1">Mulai</label>
                    <input id="sc-start" type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label htmlFor="sc-end" className="block text-xs font-semibold mb-1">Selesai</label>
                    <input id="sc-end" type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl" />
                  </div>
                  <button type="submit" className="px-4 py-2.5 bg-[#2563EB] text-white text-xs font-semibold rounded-xl">
                    Tambah Slot
                  </button>
                </form>
              </div>
            )}

            {(tab === 'permintaan' || tab === 'kelas' || tab === 'riwayat') && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">
                  {tab === 'permintaan'
                    ? 'Semua Permintaan & Pemesanan Siswa'
                    : tab === 'kelas'
                    ? 'Kelas Online Siap Dilaksanakan'
                    : 'Riwayat Pembelajaran Selesai'}
                </h2>
                <div className="space-y-3">
                  {bookings
                    .filter((b) =>
                      tab === 'kelas'
                        ? ['paid', 'scheduled', 'in_progress'].includes(b.status)
                        : tab === 'riwayat'
                        ? b.status === 'completed'
                        : true
                    )
                    .map((b) => {
                      const st = getStatusLabel(b.status);
                      return (
                        <div key={b.id} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono-tabular text-slate-500">{b.bookingCode}</span>
                              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${st.colorClass}`}>
                                {st.label}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-[#1F2937] mt-1">
                              {b.studentName} · {b.subjectName} ({b.educationLevel})
                            </p>
                            <p className="text-xs text-slate-600 font-mono-tabular">
                              {b.sessionDate} · {b.startTime}–{b.endTime} · Pendapatan Guru: {formatRp(b.teacherEarningSnapshot)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {b.status === 'pending' && (
                              <>
                                <button type="button" onClick={() => handleRespondBooking(b.id, 'accept')} className="px-3.5 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-xl">
                                  Terima
                                </button>
                                <button type="button" onClick={() => handleRespondBooking(b.id, 'reject')} className="px-3 py-2 border border-slate-200 text-red-600 text-xs font-semibold rounded-xl">
                                  Tolak
                                </button>
                              </>
                            )}
                            {['paid', 'scheduled', 'in_progress'].includes(b.status) && (
                              <Link to={`/kelas/${b.id}`} className="px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-xl">
                                Masuk Ruang Kelas
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {tab === 'siswa' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Daftar Siswa Saya</h2>
                {uniqueStudents.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada siswa yang terdaftar di sesi Anda.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {uniqueStudents.map((s) => (
                      <div key={s.email} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-[#1F2937]">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'pendapatan' && walletData && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500">Total Pendapatan</p>
                    <p className="text-lg font-bold text-[#1F2937] font-mono-tabular mt-1">{formatRp(walletData.wallet.totalEarned)}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500">Saldo Tertunda</p>
                    <p className="text-lg font-bold text-amber-600 font-mono-tabular mt-1">{formatRp(walletData.wallet.pendingBalance)}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500">Saldo Tersedia</p>
                    <p className="text-lg font-bold text-[#2563EB] font-mono-tabular mt-1">{formatRp(walletData.wallet.availableBalance)}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500">Total Pencairan</p>
                    <p className="text-lg font-bold text-emerald-700 font-mono-tabular mt-1">{formatRp(walletData.wallet.totalWithdrawn)}</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <h2 className="text-base font-bold text-[#1F2937]">Ledger Transaksi Wallet</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 pr-3">Kode Ref</th>
                          <th className="py-2 px-3">Keterangan</th>
                          <th className="py-2 px-3 text-right">Nominal</th>
                          <th className="py-2 pl-3 text-right">Saldo Akhir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {walletData.transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-2.5 pr-3 font-mono-tabular">{tx.referenceCode}</td>
                            <td className="py-2.5 px-3">{tx.description}</td>
                            <td className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${tx.type === 'credit_earning' || tx.type === 'reversal' ? 'text-emerald-700' : 'text-red-600'}`}>
                              {tx.type === 'credit_earning' || tx.type === 'reversal' ? '+' : '-'}{formatRp(tx.amount)}
                            </td>
                            <td className="py-2.5 pl-3 text-right font-mono-tabular">{formatRp(tx.balanceAfter)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === 'pencairan' && walletData && (
              <div className="space-y-5">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[#1F2937]">Ajukan Pencairan Saldo</h2>
                    <span className="text-sm font-bold text-[#2563EB] font-mono-tabular">
                      Saldo Tersedia: {formatRp(walletData.wallet.availableBalance)}
                    </span>
                  </div>
                  <form onSubmit={handleWithdraw} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label htmlFor="wd-bank" className="block text-xs font-semibold mb-1">Rekening Tujuan</label>
                      <select id="wd-bank" value={wdBankId} onChange={(e) => setWdBankId(Number(e.target.value))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white">
                        {walletData.bankAccounts.map((ba) => (
                          <option key={ba.id} value={ba.id}>
                            {ba.bankName} · {ba.accountNumber} ({ba.isVerified ? 'Terverifikasi' : 'Menunggu'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="wd-amt" className="block text-xs font-semibold mb-1">Nominal (Min. Rp50.000)</label>
                      <input id="wd-amt" type="number" min={50000} step={5000} value={wdAmount} onChange={(e) => setWdAmount(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl font-mono-tabular" />
                    </div>
                    <button type="submit" className="py-2.5 px-4 bg-[#2563EB] text-white text-sm font-semibold rounded-xl">
                      Ajukan Pencairan
                    </button>
                  </form>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-bold text-[#1F2937]">Riwayat Pencairan</h3>
                  <div className="space-y-2">
                    {walletData.withdrawals.map((w) => {
                      const st = getStatusLabel(w.status);
                      return (
                        <div key={w.id} className="border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold font-mono-tabular text-sm text-[#1F2937]">{formatRp(w.amount)}</p>
                            <p className="text-slate-500">Ref Payout: {w.payoutReference || 'Menunggu proses admin'}</p>
                          </div>
                          <span className={`px-2.5 py-1 font-semibold rounded-md border ${st.colorClass}`}>{st.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={handleAddBank} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-bold text-[#1F2937]">Tambah Rekening Pencairan</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select value={bankName} onChange={(e) => setBankName(e.target.value)} className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white">
                      <option value="Bank BCA">Bank BCA</option>
                      <option value="Bank Mandiri">Bank Mandiri</option>
                      <option value="Bank BNI">Bank BNI</option>
                      <option value="Bank BRI">Bank BRI</option>
                    </select>
                    <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Nomor Rekening" required className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl font-mono-tabular" />
                    <input type="text" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} placeholder="Nama Pemilik" required className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl" />
                  </div>
                  <button type="submit" className="px-4 py-2 bg-white border border-slate-200 hover:border-[#2563EB] text-sm font-semibold rounded-xl">
                    Simpan Rekening
                  </button>
                </form>
              </div>
            )}

            {tab === 'ulasan' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Ulasan dari Siswa</h2>
                {bookings.filter((b) => b.review).length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada ulasan masuk.</p>
                ) : (
                  bookings
                    .filter((b) => b.review)
                    .map((b) => (
                      <div key={b.id} className="border border-slate-200 rounded-xl p-4 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#1F2937]">{b.studentName}</span>
                          <span className="font-bold text-amber-600">{b.review?.rating}/5</span>
                        </div>
                        <p className="text-sm text-slate-600">{b.review?.comment}</p>
                      </div>
                    ))
                )}
              </div>
            )}

            {tab === 'pengaturan' && (
              <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2937]">Pengaturan Akun Guru</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="tg-name" className="block text-xs font-semibold mb-1">Nama Lengkap</label>
                    <input id="tg-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label htmlFor="tg-phone" className="block text-xs font-semibold mb-1">Nomor WhatsApp</label>
                    <input id="tg-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" />
                  </div>
                </div>
                <button type="submit" className="px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-xl">
                  Simpan Pengaturan
                </button>
              </form>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
