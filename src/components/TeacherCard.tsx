import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Heart, Star } from 'lucide-react';
import { formatRp, type TeacherDirectoryItem } from '../types/index.ts';

interface TeacherCardProps {
  teacher: TeacherDirectoryItem;
  isFavorite?: boolean;
  onToggleFavorite?: (teacherId: number) => void;
}

export function TeacherCard({ teacher, isFavorite = false, onToggleFavorite }: TeacherCardProps) {
  const [imgError, setImgError] = useState(false);

  const subjectSummary = teacher.subjects.map((s) => s.subjectName).join(' · ') || 'Umum';
  const levelSummary = teacher.educationLevels.join(' · ') || 'Semua Jenjang';

  return (
    <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between transition-colors hover:border-blue-300">
      <div className="p-5 space-y-4">
        {/* Top Row: Portrait + Name + Favorite */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#DBEAFE] shrink-0 flex items-center justify-center border border-slate-200">
            {teacher.avatarUrl && !imgError ? (
              <img
                src={teacher.avatarUrl}
                alt={`Foto profil ${teacher.fullName}`}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <GraduationCap className="w-7 h-7 text-[#2563EB]" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-bold text-[#1F2937] truncate">{teacher.fullName}</h3>
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={() => onToggleFavorite(teacher.id)}
                  aria-label={isFavorite ? `Hapus ${teacher.fullName} dari favorit` : `Simpan ${teacher.fullName} ke favorit`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-50 transition-colors shrink-0"
                >
                  <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {teacher.lastEducation} · {teacher.institution}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-600 mt-1.5 tabular-nums">
              <span className="inline-flex items-center gap-1 font-semibold text-[#1F2937]">
                <Star className="w-3.5 h-3.5 fill-[#FBBF24] text-[#FBBF24]" />
                {teacher.ratingAvg.toFixed(1)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{teacher.totalSessions} sesi</span>
              <span aria-hidden="true">·</span>
              <span>{teacher.experienceYears} thn pengalaman</span>
            </div>
          </div>
        </div>

        {/* Clean Unboxed Metadata */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <p className="text-sm font-semibold text-[#2563EB] truncate">{subjectSummary}</p>
          <p className="text-xs text-slate-500 truncate">Jenjang: {levelSummary}</p>
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{teacher.bio}</p>
        </div>
      </div>

      {/* Footer: Official Price + CTA */}
      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
        <div>
          <span className="block text-[11px] text-slate-500">Mulai dari</span>
          <span className="text-sm font-bold text-[#1F2937] font-mono-tabular">
            {formatRp(teacher.startingPrice)}
          </span>
          <span className="text-xs text-slate-500"> / 60 mnt</span>
        </div>
        <Link
          to={`/guru/${teacher.id}`}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
        >
          Lihat Profil
        </Link>
      </div>
    </article>
  );
}
