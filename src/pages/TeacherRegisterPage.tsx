import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DAY_NAMES, type AuthUser, type SubjectItem } from '../types/index.ts';
import { resizeAvatarFile, TEACHER_PORTRAIT_PRESETS } from '../utils/imageUpload.ts';

const STEP_TITLES = [
  'Identitas',
  'Pendidikan',
  'Kompetensi',
  'Dokumen',
  'Operasional',
  'Persetujuan',
];

const AVATAR_OPTIONS = TEACHER_PORTRAIT_PRESETS;

export function TeacherRegisterPage() {
  const navigate = useNavigate();
  const { setSessionFromToken } = useAuth();
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Tahap 1: Identitas
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('1995-05-15');
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_OPTIONS[0].url);

  // Tahap 2: Pendidikan
  const [lastEducation, setLastEducation] = useState('S1 Pendidikan');
  const [institution, setInstitution] = useState('');
  const [major, setMajor] = useState('');
  const [graduationYear, setGraduationYear] = useState('2020');

  // Tahap 3: Kompetensi
  const [subjectIds, setSubjectIds] = useState<number[]>([]);
  const [educationLevels, setEducationLevels] = useState<string[]>(['SMP', 'SMA/SMK']);
  const [experienceYears, setExperienceYears] = useState('3');
  const [bio, setBio] = useState('');

  // Tahap 4: Dokumen (private storage path/reference)
  const [idDocumentUrl, setIdDocumentUrl] = useState('private://ktp-pengajar.pdf');
  const [diplomaDocumentUrl, setDiplomaDocumentUrl] = useState('private://ijazah-terakhir.pdf');
  const [certificateDocumentUrl, setCertificateDocumentUrl] = useState('');

  // Tahap 5: Operasional
  const [schedules, setSchedules] = useState<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>([
    { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' },
    { dayOfWeek: 3, startTime: '14:00', endTime: '17:00' },
    { dayOfWeek: 5, startTime: '19:00', endTime: '21:00' },
  ]);
  const [durations, setDurations] = useState<number[]>([60, 90]);
  const [bankName, setBankName] = useState('Bank BCA');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');

  // Tahap 6: Persetujuan
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPartnership, setAgreedPartnership] = useState(false);

  useEffect(() => {
    fetch('/api/subjects')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setSubjects(d);
          if (d[0]) setSubjectIds([d[0].id]);
        }
      })
      .catch(() => {});
  }, []);

  const toggleSubject = (id: number) => {
    setSubjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleLevel = (lvl: string) => {
    setEducationLevels((prev) => (prev.includes(lvl) ? prev.filter((x) => x !== lvl) : [...prev, lvl]));
  };

  const toggleDuration = (d: number) => {
    setDurations((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const validateStep = (): string | null => {
    if (step === 1) {
      if (!fullName.trim() || !email.trim() || password.length < 8 || !phone.trim()) {
        return 'Lengkapi nama lengkap, email, kata sandi (min. 8 karakter), dan nomor WhatsApp.';
      }
    } else if (step === 2) {
      if (!institution.trim() || !major.trim()) {
        return 'Nama institusi dan jurusan wajib diisi.';
      }
    } else if (step === 3) {
      if (subjectIds.length === 0 || educationLevels.length === 0 || !bio.trim()) {
        return 'Pilih minimal 1 mata pelajaran, 1 jenjang, dan tuliskan deskripsi profil Anda.';
      }
    } else if (step === 4) {
      if (!idDocumentUrl.trim() || !diplomaDocumentUrl.trim()) {
        return 'Dokumen identitas diri dan ijazah wajib dilampirkan.';
      }
    } else if (step === 5) {
      if (!accountNumber.trim() || !accountHolderName.trim() || durations.length === 0) {
        return 'Pilih durasi pembelajaran dan lengkapi informasi rekening pencairan.';
      }
    }
    return null;
  };

  const handleAvatarFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeAvatarFile(file);
      setAvatarUrl(dataUrl);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memproses foto profil.');
    }
  };

  const nextStep = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setStep((s) => Math.min(6, s + 1));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!agreedTerms || !agreedPartnership) {
      setError('Anda harus menyetujui syarat & ketentuan serta perjanjian kerja sama JUMPA GURU.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/teachers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          phone,
          birthDate,
          avatarUrl,
          lastEducation,
          institution,
          major,
          graduationYear: Number(graduationYear),
          subjectIds,
          educationLevels,
          experienceYears: Number(experienceYears),
          bio,
          idDocumentUrl,
          diplomaDocumentUrl,
          certificateDocumentUrl: certificateDocumentUrl || null,
          schedules,
          teachingDurationOptions: durations,
          bankName,
          accountNumber,
          accountHolderName,
          agreedTerms,
          agreedPartnership,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pendaftaran gagal.');

      setSessionFromToken(data.token, data.user as AuthUser);
      navigate('/dashboard/guru');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim pendaftaran.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1F2937]">Daftar Menjadi Guru JUMPA GURU</h1>
          <p className="text-sm text-slate-600">
            Lengkapi 6 tahap verifikasi berikut. Profil Anda akan ditinjau Administrator sebelum dipublikasikan.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {STEP_TITLES.map((title, idx) => {
            const num = idx + 1;
            const active = step === num;
            const done = step > num;
            return (
              <button
                key={title}
                type="button"
                onClick={() => num < step && setStep(num)}
                className={`p-2.5 rounded-xl border text-left transition-colors ${
                  active
                    ? 'bg-[#2563EB] text-white border-[#2563EB]'
                    : done
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                <span className="block text-[11px] font-mono-tabular">Tahap {num}</span>
                <span className="block text-xs font-bold truncate">{title}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#1F2937]">Tahap 1: Identitas Diri</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-t-name" className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Lengkap & Gelar</label>
                  <input id="reg-t-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" placeholder="Contoh: Hendra Wijaya, S.Pd." />
                </div>
                <div>
                  <label htmlFor="reg-t-email" className="block text-xs font-semibold text-slate-700 mb-1.5">Email Aktif</label>
                  <input id="reg-t-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" placeholder="hendra@contoh.id" />
                </div>
                <div>
                  <label htmlFor="reg-t-pass" className="block text-xs font-semibold text-slate-700 mb-1.5">Kata Sandi (min. 8 karakter)</label>
                  <input id="reg-t-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label htmlFor="reg-t-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">Nomor WhatsApp</label>
                  <input id="reg-t-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" placeholder="0812xxxxxxxx" />
                </div>
                <div>
                  <label htmlFor="reg-t-dob" className="block text-xs font-semibold text-slate-700 mb-1.5">Tanggal Lahir</label>
                  <input id="reg-t-dob" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" />
                </div>
                <div className="sm:col-span-2 pt-2 border-t border-slate-100 space-y-3">
                  <span className="block text-xs font-semibold text-slate-700">Foto Profil Guru</span>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#DBEAFE] border border-slate-200 shrink-0 flex items-center justify-center">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Pratinjau foto profil guru"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera className="w-6 h-6 text-[#2563EB]" />
                      )}
                    </div>
                    <div className="space-y-2.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#2563EB] bg-[#DBEAFE]/50 hover:bg-[#DBEAFE] rounded-xl cursor-pointer transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          Unggah Foto Sendiri
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleAvatarFile}
                            className="sr-only"
                          />
                        </label>
                        <span className="text-xs text-slate-500">atau pilih potret studio:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {AVATAR_OPTIONS.map((opt) => (
                          <button
                            key={opt.url}
                            type="button"
                            onClick={() => setAvatarUrl(opt.url)}
                            aria-label={opt.label}
                            className={`w-11 h-11 rounded-xl overflow-hidden border-2 transition-all ${
                              avatarUrl === opt.url ? 'border-[#2563EB] ring-2 ring-[#DBEAFE]' : 'border-slate-200 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <img src={opt.url} alt={opt.label} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#1F2937]">Tahap 2: Latar Belakang Pendidikan</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-t-edu" className="block text-xs font-semibold text-slate-700 mb-1.5">Pendidikan Terakhir</label>
                  <select id="reg-t-edu" value={lastEducation} onChange={(e) => setLastEducation(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white">
                    <option value="Mahasiswa Aktif">Mahasiswa Aktif (Tutor)</option>
                    <option value="S1 Pendidikan">S1 Pendidikan</option>
                    <option value="S1 Non-Pendidikan">S1 Non-Pendidikan</option>
                    <option value="S2 Magister">S2 Magister</option>
                    <option value="S3 Doktor">S3 Doktor</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-t-inst" className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Universitas / Institusi</label>
                  <input id="reg-t-inst" type="text" value={institution} onChange={(e) => setInstitution(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" placeholder="Contoh: Universitas Negeri Jakarta" />
                </div>
                <div>
                  <label htmlFor="reg-t-major" className="block text-xs font-semibold text-slate-700 mb-1.5">Jurusan / Program Studi</label>
                  <input id="reg-t-major" type="text" value={major} onChange={(e) => setMajor(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" placeholder="Contoh: Pendidikan Matematika" />
                </div>
                <div>
                  <label htmlFor="reg-t-grad" className="block text-xs font-semibold text-slate-700 mb-1.5">Tahun Kelulusan / Perkiraan</label>
                  <input id="reg-t-grad" type="number" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#1F2937]">Tahap 3: Kompetensi Mengajar</h2>
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2">Mata Pelajaran yang Dikuasai</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {subjects.map((sub) => {
                    const checked = subjectIds.includes(sub.id);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => toggleSubject(sub.id)}
                        className={`px-3 py-2 text-xs font-semibold rounded-xl border text-left transition-colors ${
                          checked ? 'bg-[#DBEAFE] border-[#2563EB] text-[#2563EB]' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {sub.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2">Jenjang yang Dapat Diajar</span>
                <div className="flex flex-wrap gap-2">
                  {['SD', 'SMP', 'SMA/SMK', 'Mahasiswa'].map((lvl) => {
                    const checked = educationLevels.includes(lvl);
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => toggleLevel(lvl)}
                        className={`px-4 py-2 text-xs font-semibold rounded-xl border ${
                          checked ? 'bg-[#2563EB] border-[#2563EB] text-white' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {lvl}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="reg-t-exp" className="block text-xs font-semibold text-slate-700 mb-1.5">Pengalaman Mengajar (Tahun)</label>
                <input id="reg-t-exp" type="number" min={0} value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} className="w-full sm:w-40 px-3 py-2.5 text-sm border border-slate-200 rounded-xl" />
              </div>

              <div>
                <label htmlFor="reg-t-bio" className="block text-xs font-semibold text-slate-700 mb-1.5">Deskripsi Profil Mengajar</label>
                <textarea id="reg-t-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" placeholder="Jelaskan metode mengajar, pencapaian, dan pendekatan belajar Anda..." />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#1F2937]">Tahap 4: Dokumen Verifikasi Privat</h2>
              <p className="text-xs text-slate-600">
                Dokumen disimpan secara privat dan hanya dapat diakses oleh Administrator untuk verifikasi. Tidak pernah ditampilkan ke publik atau siswa.
              </p>
              <div className="space-y-3">
                <div>
                  <label htmlFor="reg-t-ktp" className="block text-xs font-semibold text-slate-700 mb-1.5">Referensi / Berkas KTP atau Identitas Diri</label>
                  <input id="reg-t-ktp" type="text" value={idDocumentUrl} onChange={(e) => setIdDocumentUrl(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl font-mono-tabular" />
                </div>
                <div>
                  <label htmlFor="reg-t-ijazah" className="block text-xs font-semibold text-slate-700 mb-1.5">Referensi / Berkas Ijazah atau KTM</label>
                  <input id="reg-t-ijazah" type="text" value={diplomaDocumentUrl} onChange={(e) => setDiplomaDocumentUrl(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl font-mono-tabular" />
                </div>
                <div>
                  <label htmlFor="reg-t-cert" className="block text-xs font-semibold text-slate-700 mb-1.5">Sertifikat Pendukung (Opsional)</label>
                  <input id="reg-t-cert" type="text" value={certificateDocumentUrl} onChange={(e) => setCertificateDocumentUrl(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl font-mono-tabular" placeholder="Contoh: private://sertifikat-olimpiade.pdf" />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#1F2937]">Tahap 5: Operasional & Rekening Pencairan</h2>
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2">Durasi Mengajar yang Didukung</span>
                <div className="flex gap-3">
                  {[60, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDuration(d)}
                      className={`px-4 py-2 text-xs font-semibold rounded-xl border ${
                        durations.includes(d) ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {d} Menit
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2">Jadwal Mengajar Default</span>
                <div className="space-y-2">
                  {schedules.map((sc, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                      <select
                        value={sc.dayOfWeek}
                        onChange={(e) => {
                          const next = [...schedules];
                          next[i].dayOfWeek = Number(e.target.value);
                          setSchedules(next);
                        }}
                        className="px-3 py-2 border border-slate-200 rounded-xl bg-white"
                      >
                        {Object.entries(DAY_NAMES).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={sc.startTime}
                        onChange={(e) => {
                          const next = [...schedules];
                          next[i].startTime = e.target.value;
                          setSchedules(next);
                        }}
                        className="px-3 py-2 border border-slate-200 rounded-xl"
                      />
                      <span>s/d</span>
                      <input
                        type="time"
                        value={sc.endTime}
                        onChange={(e) => {
                          const next = [...schedules];
                          next[i].endTime = e.target.value;
                          setSchedules(next);
                        }}
                        className="px-3 py-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="reg-t-bank" className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Bank</label>
                  <select id="reg-t-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white">
                    <option value="Bank BCA">Bank BCA</option>
                    <option value="Bank Mandiri">Bank Mandiri</option>
                    <option value="Bank BNI">Bank BNI</option>
                    <option value="Bank BRI">Bank BRI</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-t-accnum" className="block text-xs font-semibold text-slate-700 mb-1.5">Nomor Rekening</label>
                  <input id="reg-t-accnum" type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl font-mono-tabular" placeholder="1234567890" />
                </div>
                <div>
                  <label htmlFor="reg-t-accholder" className="block text-xs font-semibold text-slate-700 mb-1.5">Atas Nama</label>
                  <input id="reg-t-accholder" type="text" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl" placeholder="Nama pemilik rekening" />
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#1F2937]">Tahap 6: Persetujuan Kerja Sama</h2>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>1. Tarif sesi pembelajaran ditetapkan secara resmi oleh JUMPA GURU per jenjang dan durasi.</p>
                <p>2. Guru memperoleh bagi hasil sesuai persentase paket (default 75% untuk guru, 25% komisi platform) yang dicatat ke Wallet setelah sesi selesai.</p>
                <p>3. Guru wajib menjaga ketepatan jadwal dan etika mengajar privat online 1-on-1.</p>
              </div>
              <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-1 rounded border-slate-300" />
                <span>Saya menyetujui Syarat dan Ketentuan serta Kebijakan Privasi JUMPA GURU.</span>
              </label>
              <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={agreedPartnership} onChange={(e) => setAgreedPartnership(e.target.checked)} className="mt-1 rounded border-slate-300" />
                <span>Saya menyetujui Perjanjian Kerja Sama Pengajar dan sistem pembagian hasil platform.</span>
              </label>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="px-4 py-2.5 text-sm font-semibold text-slate-700 border border-slate-200 rounded-xl disabled:opacity-40 inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Sebelumnya
            </button>

            {step < 6 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-xl inline-flex items-center gap-1"
              >
                Lanjut Tahap {step + 1}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 rounded-xl inline-flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {submitting ? 'Mengirim Pendaftaran...' : 'Kirim Pendaftaran Guru'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
