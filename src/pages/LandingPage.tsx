import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarCheck, CheckCircle2, CreditCard, Search, ShieldCheck, Video } from 'lucide-react';
import { TeacherCard } from '../components/TeacherCard.tsx';
import { formatRp, type PricingPlanItem, type SubjectItem, type TeacherDirectoryItem } from '../types/index.ts';

export function LandingPage() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherDirectoryItem[]>([]);
  const [pricing, setPricing] = useState<PricingPlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');

  useEffect(() => {
    let active = true;
    async function loadLanding() {
      try {
        const [subRes, teachRes, priceRes] = await Promise.all([
          fetch('/api/subjects').then((r) => r.json()),
          fetch('/api/teachers?limit=4&sort=rating_desc').then((r) => r.json()),
          fetch('/api/pricing').then((r) => r.json()),
        ]);
        if (!active) return;
        setSubjects(Array.isArray(subRes) ? subRes : []);
        setTeachers(Array.isArray(teachRes?.items) ? teachRes.items : []);
        setPricing(Array.isArray(priceRes) ? priceRes : []);
      } catch (err) {
        console.error('Failed to load landing data:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadLanding();
    return () => {
      active = false;
    };
  }, []);

  const handleHeroSearch = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchText.trim()) params.set('q', searchText.trim());
    if (selectedSubject) params.set('subject', selectedSubject);
    if (selectedLevel) params.set('level', selectedLevel);
    navigate(`/cari-guru${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const basePlans60 = pricing.filter((p) => p.durationMinutes === 60);

  return (
    <div className="bg-white">
      {/* 1. HERO SECTION */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-[#DBEAFE]/40 via-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Left Content */}
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <div className="space-y-4">
                <p className="text-sm font-semibold text-[#2563EB]">
                  JUMPA GURU · Website Mencari Guru Belajar Kamu
                </p>
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#1F2937] leading-[1.12]">
                  Temukan Guru Terbaik untuk Perjalanan Belajarmu!
                </h1>
                <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                  Belajar lebih mudah, kapan saja dan di mana saja. Temukan guru yang tepat sesuai kebutuhan belajarmu bersama JUMPA GURU.
                </p>
              </div>

              {/* Search Bar Form */}
              <form
                onSubmit={handleHeroSearch}
                className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="hero-q" className="sr-only">Kata kunci guru atau materi</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="hero-q"
                        type="text"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Nama guru atau materi..."
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="hero-subject" className="sr-only">Pilih mata pelajaran</label>
                    <select
                      id="hero-subject"
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="">Semua Mata Pelajaran</option>
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.slug}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="hero-level" className="sr-only">Pilih jenjang pendidikan</label>
                    <select
                      id="hero-level"
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="">Semua Jenjang</option>
                      <option value="SD">SD</option>
                      <option value="SMP">SMP</option>
                      <option value="SMA/SMK">SMA/SMK</option>
                      <option value="Mahasiswa">Mahasiswa</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-slate-500">
                    Privat 1-on-1 online · Pilihan durasi 60 menit & 90 menit
                  </p>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    Cari Guru
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 pt-1">
                <Link to="/daftar-guru" className="font-semibold text-[#2563EB] hover:underline">
                  Ingin mengajar? Daftar Menjadi Guru
                </Link>
                <span aria-hidden="true" className="hidden sm:inline text-slate-300">|</span>
                <Link to="/login" className="font-medium text-slate-700 hover:text-[#2563EB]">
                  Masuk ke Akun Demo 4 Peran
                </Link>
              </div>
            </div>

            {/* Right Visual */}
            <div className="lg:col-span-5 flex">
              <div className="w-full rounded-2xl overflow-hidden border border-slate-200 bg-[#DBEAFE]/30 min-h-[280px] lg:min-h-[380px]">
                <img
                  src="/src/assets/images/hero_online_tutoring_1795536394387.jpg"
                  alt="Guru dan siswa belajar privat secara online melalui video conference di JUMPA GURU"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Official Transparent Pricing Strip below hero split */}
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4 pt-8 border-t border-slate-200">
            {(basePlans60.length > 0
              ? basePlans60
              : [
                  { id: 1, educationLevel: 'SD', durationMinutes: 60, studentPrice: 60000 },
                  { id: 2, educationLevel: 'SMP', durationMinutes: 60, studentPrice: 75000 },
                  { id: 3, educationLevel: 'SMA/SMK', durationMinutes: 60, studentPrice: 100000 },
                  { id: 4, educationLevel: 'Mahasiswa', durationMinutes: 60, studentPrice: 125000 },
                ]
            ).map((plan) => (
              <div
                key={plan.id}
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-medium text-slate-500">Tarif Resmi {plan.educationLevel}</p>
                  <p className="text-base font-bold text-[#1F2937] font-mono-tabular mt-0.5">
                    {formatRp(plan.studentPrice)}
                  </p>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">60 menit</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. KATEGORI MATA PELAJARAN */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1F2937]">Kategori Mata Pelajaran</h2>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Pilih mata pelajaran yang ingin Anda kuasai dari jenjang SD hingga Mahasiswa.
            </p>
          </div>
          <Link to="/cari-guru" className="text-sm font-semibold text-[#2563EB] hover:underline whitespace-nowrap">
            Lihat seluruh guru
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {subjects.map((sub) => (
            <Link
              key={sub.id}
              to={`/cari-guru?subject=${encodeURIComponent(sub.slug)}`}
              className="group bg-white border border-slate-200 hover:border-[#2563EB] hover:bg-[#DBEAFE]/20 rounded-xl p-4 transition-colors"
            >
              <p className="text-xs text-slate-500 mb-1">{sub.category}</p>
              <h3 className="text-sm font-bold text-[#1F2937] group-hover:text-[#2563EB] transition-colors">
                {sub.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{sub.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. GURU PILIHAN */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1F2937]">Guru Pilihan Terverifikasi</h2>
              <p className="text-sm sm:text-base text-slate-600 mt-1">
                Setiap pengajar telah melalui verifikasi ijazah, identitas, dan kompetensi mengajar oleh tim JUMPA GURU.
              </p>
            </div>
            <Link
              to="/cari-guru"
              className="px-4 py-2 text-sm font-semibold text-[#2563EB] bg-white border border-slate-200 rounded-xl hover:border-[#2563EB] transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              Eksplorasi Semua Guru
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {teachers.map((t) => (
                <TeacherCard key={t.id} teacher={t} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. CARA KERJA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="max-w-2xl mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1F2937]">Cara Kerja JUMPA GURU</h2>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            Empat langkah sederhana dari pendaftaran hingga sesi belajar privat online dimulai.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              step: '01',
              title: 'Daftar sebagai siswa',
              desc: 'Buat akun siswa atau orang tua/wali dalam hitungan menit dan tentukan jenjang pendidikan Anda.',
            },
            {
              step: '02',
              title: 'Cari guru sesuai kebutuhan',
              desc: 'Filter pengajar berdasarkan mata pelajaran, jenjang, jadwal tersedia, pengalaman, dan rating.',
            },
            {
              step: '03',
              title: 'Pilih jadwal dan lakukan pembayaran',
              desc: 'Ajukan tanggal serta jam belajar. Setelah guru menyetujui, selesaikan pembayaran aman via platform.',
            },
            {
              step: '04',
              title: 'Mulai belajar secara online',
              desc: 'Masuk ke Ruang Kelas Online JUMPA GURU dengan video conference, materi, dan absensi tercatat.',
            },
          ].map((item) => (
            <div key={item.step} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
              <span className="text-sm font-bold text-[#2563EB] font-mono-tabular">{item.step}</span>
              <h3 className="text-base font-bold text-[#1F2937]">{item.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. BAGIAN KEUNGGULAN */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1F2937]">
                Mengapa Belajar Bersama JUMPA GURU?
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Seluruh tarif, penjadwalan, ruang kelas, hingga pembagian pendapatan guru dikelola secara transparan oleh platform agar siswa dan pengajar fokus pada hasil belajar.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <Link
                  to="/daftar"
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#2563EB] rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Daftar Siswa Sekarang
                </Link>
                <Link
                  to="/daftar-guru"
                  className="px-5 py-2.5 text-sm font-semibold text-[#1F2937] bg-white border border-slate-200 rounded-xl hover:border-[#2563EB] transition-colors"
                >
                  Daftar Menjadi Guru
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Guru terverifikasi',
                  desc: 'Dokumen identitas, ijazah, dan latar belakang pendidikan diperiksa administrator sebelum profil tayang.',
                },
                {
                  icon: CalendarCheck,
                  title: 'Jadwal fleksibel',
                  desc: 'Sistem penguncian jadwal otomatis mencegah bentrok dan memastikan waktu belajar tepat sesuai pilihan.',
                },
                {
                  icon: CreditCard,
                  title: 'Pembayaran terintegrasi',
                  desc: 'Mendukung QRIS, Virtual Account, Transfer Bank, dan E-Wallet dengan verifikasi webhook server.',
                },
                {
                  icon: Video,
                  title: 'Pembelajaran online',
                  desc: 'Ruang kelas privat 1-on-1 lengkap dengan kamera, mikrofon, screen sharing, chat, dan materi.',
                },
                {
                  icon: BookOpen,
                  title: 'Harga transparan',
                  desc: 'Tarif resmi ditentukan platform per jenjang dan durasi (60 atau 90 menit) tanpa biaya tersembunyi.',
                },
                {
                  icon: CheckCircle2,
                  title: 'Pengawasan orang tua',
                  desc: 'Orang tua/wali terverifikasi dapat memantau jadwal belajar anak, riwayat sesi, serta transaksi.',
                },
              ].map((adv) => {
                const Icon = adv.icon;
                return (
                  <div key={adv.title} className="bg-white border border-slate-200 rounded-xl p-5 flex gap-3.5">
                    <div className="w-10 h-10 rounded-lg bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1F2937]">{adv.title}</h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{adv.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
