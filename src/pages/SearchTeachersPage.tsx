import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react';
import { TeacherCard } from '../components/TeacherCard.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { DAY_NAMES, type SubjectItem, type TeacherDirectoryItem } from '../types/index.ts';

export function SearchTeachersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, apiFetch } = useAuth();

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherDirectoryItem[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [subject, setSubject] = useState(searchParams.get('subject') || '');
  const [level, setLevel] = useState(searchParams.get('level') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '');
  const [minExperience, setMinExperience] = useState(searchParams.get('minExperience') || '');
  const [dayOfWeek, setDayOfWeek] = useState(searchParams.get('dayOfWeek') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'rating_desc');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  useEffect(() => {
    fetch('/api/subjects')
      .then((r) => r.json())
      .then((d) => setSubjects(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      apiFetch<number[]>('/api/favorites')
        .then(setFavorites)
        .catch(() => {});
    } else {
      setFavorites([]);
    }
  }, [user, apiFetch]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (subject) params.set('subject', subject);
    if (level) params.set('level', level);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (minRating) params.set('minRating', minRating);
    if (minExperience) params.set('minExperience', minExperience);
    if (dayOfWeek !== '') params.set('dayOfWeek', dayOfWeek);
    if (sort) params.set('sort', sort);
    params.set('page', String(page));
    params.set('limit', '9');

    fetch(`/api/teachers?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setTeachers(Array.isArray(data?.items) ? data.items : []);
        setTotal(data?.pagination?.total ?? 0);
        setTotalPages(data?.pagination?.totalPages ?? 1);
      })
      .catch(() => {
        if (active) setTeachers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [q, subject, level, maxPrice, minRating, minExperience, dayOfWeek, sort, page]);

  const handleToggleFavorite = async (teacherId: number) => {
    if (!user) return;
    try {
      const res = await apiFetch<{ favorited: boolean }>(`/api/favorites/${teacherId}`, {
        method: 'POST',
      });
      setFavorites((prev) =>
        res.favorited ? [...prev, teacherId] : prev.filter((id) => id !== teacherId)
      );
    } catch {
      // ignore
    }
  };

  const resetFilters = () => {
    setQ('');
    setSubject('');
    setLevel('');
    setMaxPrice('');
    setMinRating('');
    setMinExperience('');
    setDayOfWeek('');
    setSort('rating_desc');
    setOnlyFavorites(false);
    setPage(1);
    setSearchParams({});
  };

  const displayedTeachers = onlyFavorites
    ? teachers.filter((t) => favorites.includes(t.id))
    : teachers;

  return (
    <div className="bg-slate-50 min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1F2937]">Cari Guru Belajar</h1>
            <p className="text-sm text-slate-600 mt-1">
              Temukan pengajar terverifikasi berdasarkan mata pelajaran, jenjang, jadwal, dan tarif resmi platform.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="sort-select" className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Urutkan:
            </label>
            <select
              id="sort-select"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB]"
            >
              <option value="rating_desc">Rating Tertinggi</option>
              <option value="sessions_desc">Sesi Terbanyak</option>
              <option value="price_asc">Harga Terendah</option>
              <option value="price_desc">Harga Tertinggi</option>
              <option value="experience_desc">Pengalaman Terlama</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sidebar Filters */}
          <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[#1F2937]">
                <Filter className="w-4 h-4 text-[#2563EB]" />
                Filter Pencarian
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-medium text-[#2563EB] hover:underline"
              >
                Reset
              </button>
            </div>

            <div>
              <label htmlFor="filter-q" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kata Kunci
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="filter-q"
                  type="text"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Nama, kampus, materi..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="filter-subject" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mata Pelajaran
              </label>
              <select
                id="filter-subject"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
              >
                <option value="">Semua Mata Pelajaran</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-level" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Jenjang Pendidikan
              </label>
              <select
                id="filter-level"
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
              >
                <option value="">Semua Jenjang</option>
                <option value="SD">SD</option>
                <option value="SMP">SMP</option>
                <option value="SMA/SMK">SMA/SMK</option>
                <option value="Mahasiswa">Mahasiswa</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-price" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Maksimal Tarif (60 mnt)
              </label>
              <select
                id="filter-price"
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
              >
                <option value="">Semua Tarif</option>
                <option value="60000">Maks. Rp60.000</option>
                <option value="75000">Maks. Rp75.000</option>
                <option value="100000">Maks. Rp100.000</option>
                <option value="150000">Maks. Rp150.000</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-day" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Jadwal Hari Tersedia
              </label>
              <select
                id="filter-day"
                value={dayOfWeek}
                onChange={(e) => {
                  setDayOfWeek(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
              >
                <option value="">Semua Hari</option>
                {Object.entries(DAY_NAMES).map(([k, name]) => (
                  <option key={k} value={k}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="filter-rating" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Rating Min.
                </label>
                <select
                  id="filter-rating"
                  value={minRating}
                  onChange={(e) => {
                    setMinRating(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                >
                  <option value="">Semua</option>
                  <option value="4.5">4.5+</option>
                  <option value="4.8">4.8+</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-exp" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pengalaman
                </label>
                <select
                  id="filter-exp"
                  value={minExperience}
                  onChange={(e) => {
                    setMinExperience(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                >
                  <option value="">Semua</option>
                  <option value="3">3+ thn</option>
                  <option value="5">5+ thn</option>
                </select>
              </div>
            </div>

            {user && (
              <label className="flex items-center gap-2 pt-2 border-t border-slate-100 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyFavorites}
                  onChange={(e) => setOnlyFavorites(e.target.checked)}
                  className="rounded border-slate-300 text-[#2563EB]"
                />
                Tampilkan guru favorit saja
              </label>
            )}
          </aside>

          {/* Results Grid */}
          <div className="lg:col-span-9 space-y-5">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>
                Menampilkan <strong className="text-[#1F2937] tabular-nums">{displayedTeachers.length}</strong> dari{' '}
                <strong className="text-[#1F2937] tabular-nums">{total}</strong> guru aktif
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
                ))}
              </div>
            ) : displayedTeachers.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                <h3 className="text-base font-bold text-[#1F2937]">Tidak ada guru yang cocok dengan filter</h3>
                <p className="text-sm text-slate-600">
                  Coba ubah mata pelajaran, jenjang, atau reset filter pencarian Anda.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-xl"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {displayedTeachers.map((t) => (
                  <TeacherCard
                    key={t.id}
                    teacher={t}
                    isFavorite={favorites.includes(t.id)}
                    onToggleFavorite={user ? handleToggleFavorite : undefined}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Sebelumnya
                </button>
                <span className="text-sm text-slate-600 px-3 tabular-nums">
                  Halaman {page} dari {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl disabled:opacity-40 inline-flex items-center gap-1"
                >
                  Berikutnya
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
