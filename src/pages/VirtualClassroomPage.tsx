import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  FileText,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Send,
  Video,
  VideoOff,
} from 'lucide-react';
import { getDashboardPathForRole, useAuth } from '../context/AuthContext.tsx';
import { getStatusLabel } from '../types/index.ts';

interface ClassroomData {
  booking: {
    id: number;
    bookingCode: string;
    educationLevel: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    status: string;
  };
  teacherName: string;
  studentName: string;
  subjectName: string;
  session: {
    id: number;
    roomCode: string;
    meetingProvider: string;
    teacherAttendedAt: string | null;
    studentAttendedAt: string | null;
    startedAt: string | null;
    endedAt: string | null;
    status: string;
    materials: Array<{ id: string; title: string; type: string; urlOrNote: string; addedBy: string }>;
    chatMessages: Array<{ id: string; senderName: string; senderRole: string; message: string; sentAt: string }>;
    summaryNotes: string | null;
  } | null;
}

export function VirtualClassroomPage() {
  const { bookingId } = useParams();
  const { user, apiFetch } = useAuth();
  const [data, setData] = useState<ClassroomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [mediaNotice, setMediaNotice] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [matTitle, setMatTitle] = useState('');
  const [matNote, setMatNote] = useState('');
  const [summaryNotes, setSummaryNotes] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const loadRoom = useCallback(async () => {
    try {
      const res = await apiFetch<ClassroomData>(`/api/classroom/${bookingId}`);
      setData(res);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengakses ruang kelas.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, bookingId]);

  useEffect(() => {
    loadRoom();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [loadRoom]);

  const toggleCamera = async () => {
    if (camOn && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCamOn(false);
      return;
    }
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: micOn });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCamOn(true);
        setMediaNotice('');
      } else {
        setCamOn(true);
        setMediaNotice('Perangkat kamera virtual aktif dalam mode ruang simulasi.');
      }
    } catch {
      setCamOn(true);
      setMediaNotice('Izin kamera browser tidak tersedia; menampilkan mode pratinjau ruang kelas.');
    }
  };

  const toggleMic = () => setMicOn((prev) => !prev);

  const toggleScreenShare = async () => {
    if (screenSharing) {
      setScreenSharing(false);
      return;
    }
    try {
      if (navigator.mediaDevices?.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      }
      setScreenSharing(true);
      setMediaNotice('');
    } catch {
      setScreenSharing(true);
      setMediaNotice('Berbagi layar aktif dalam mode papan tulis materi.');
    }
  };

  const markAttendance = async () => {
    try {
      await apiFetch(`/api/classroom/${bookingId}/attendance`, { method: 'POST' });
      setActionMessage('Kehadiran Anda tercatat dan status kelas diperbarui.');
      await loadRoom();
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : 'Gagal mencatat absensi.');
    }
  };

  const sendChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      await apiFetch(`/api/classroom/${bookingId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: chatInput }),
      });
      setChatInput('');
      await loadRoom();
    } catch {
      // ignore
    }
  };

  const addMaterial = async (e: FormEvent) => {
    e.preventDefault();
    if (!matTitle.trim() || !matNote.trim()) return;
    try {
      await apiFetch(`/api/classroom/${bookingId}/materials`, {
        method: 'POST',
        body: JSON.stringify({ title: matTitle, type: 'Materi Kelas', urlOrNote: matNote }),
      });
      setMatTitle('');
      setMatNote('');
      await loadRoom();
    } catch {
      // ignore
    }
  };

  const completeSession = async () => {
    try {
      await apiFetch(`/api/classroom/${bookingId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ summaryNotes }),
      });
      setActionMessage('Sesi pembelajaran dinyatakan selesai. Pendapatan guru telah dicatat ke Wallet.');
      await loadRoom();
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : 'Gagal menyelesaikan sesi.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="h-96 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-[#1F2937]">Akses Ruang Kelas Ditolak</h1>
        <p className="text-sm text-red-600">{error || 'Ruang kelas tidak ditemukan.'}</p>
        <Link
          to={user ? getDashboardPathForRole(user.role) : '/login'}
          className="inline-block px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-xl"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const statusMeta = getStatusLabel(data.booking.status);

  return (
    <div className="bg-slate-50 min-h-screen py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        {/* Top Classroom Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono-tabular">
              <span>{data.booking.bookingCode}</span>
              <span aria-hidden="true">·</span>
              <span>Room: {data.session?.roomCode}</span>
              <span aria-hidden="true">·</span>
              <span>{data.session?.meetingProvider}</span>
            </div>
            <h1 className="text-xl font-bold text-[#1F2937] mt-1">
              {data.subjectName} ({data.booking.educationLevel}) — {data.teacherName} & {data.studentName}
            </h1>
            <p className="text-xs text-slate-600 font-mono-tabular mt-0.5">
              Jadwal: {data.booking.sessionDate} · {data.booking.startTime}–{data.booking.endTime} ({data.booking.durationMinutes} menit)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`px-3 py-1 text-xs font-semibold rounded-lg border ${statusMeta.colorClass}`}>
              {statusMeta.label}
            </span>
            <button
              type="button"
              onClick={markAttendance}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-xl inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Catat Kehadiran
            </button>
            {(user?.role === 'teacher' || user?.role === 'admin') &&
              data.booking.status !== 'completed' && (
                <button
                  type="button"
                  onClick={completeSession}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                >
                  Selesaikan Sesi
                </button>
              )}
          </div>
        </div>

        {actionMessage && (
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
            {actionMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Video Stage + Controls */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 aspect-video relative flex flex-col items-center justify-center text-white">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${camOn || screenSharing ? 'block' : 'hidden'}`}
              />
              {!camOn && !screenSharing && (
                <div className="text-center space-y-2 p-6">
                  <div className="w-16 h-16 rounded-full bg-slate-800 mx-auto flex items-center justify-center">
                    <Video className="w-7 h-7 text-blue-400" />
                  </div>
                  <p className="text-base font-semibold">Ruang Belajar Privat 1-on-1 JUMPA GURU</p>
                  <p className="text-xs text-slate-400 max-w-md">
                    Aktifkan kamera, mikrofon, atau berbagi layar menggunakan tombol kendali di bawah.
                  </p>
                </div>
              )}
              {mediaNotice && (
                <div className="absolute top-3 left-3 bg-slate-950/80 text-xs text-slate-200 px-3 py-1.5 rounded-lg">
                  {mediaNotice}
                </div>
              )}
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 backdrop-blur px-4 py-2.5 rounded-xl">
                <div className="text-xs text-slate-300 space-x-3">
                  <span>
                    Absen Guru:{' '}
                    <strong className="text-white">
                      {data.session?.teacherAttendedAt ? 'Hadir' : 'Belum'}
                    </strong>
                  </span>
                  <span>
                    Absen Siswa:{' '}
                    <strong className="text-white">
                      {data.session?.studentAttendedAt ? 'Hadir' : 'Belum'}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMic}
                    aria-label={micOn ? 'Matikan mikrofon' : 'Aktifkan mikrofon'}
                    className={`p-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                      micOn ? 'bg-[#2563EB] text-white' : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    <span>{micOn ? 'Mikrofon Aktif' : 'Mikrofon Mati'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleCamera}
                    aria-label={camOn ? 'Matikan kamera' : 'Aktifkan kamera'}
                    className={`p-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                      camOn ? 'bg-[#2563EB] text-white' : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    <span>{camOn ? 'Kamera Aktif' : 'Kamera Mati'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleScreenShare}
                    className={`p-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                      screenSharing ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    <MonitorUp className="w-4 h-4" />
                    <span>{screenSharing ? 'Berhenti Berbagi' : 'Bagikan Layar'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Materials & Session Summary */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-bold text-[#1F2937] inline-flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2563EB]" />
                Materi Pembelajaran
              </h2>
              <div className="space-y-2">
                {(data.session?.materials || []).length === 0 ? (
                  <p className="text-xs text-slate-500">Belum ada materi yang dibagikan pada sesi ini.</p>
                ) : (
                  data.session?.materials.map((m) => (
                    <div key={m.id} className="border border-slate-200 rounded-xl p-3">
                      <p className="text-sm font-semibold text-[#1F2937]">{m.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{m.urlOrNote}</p>
                      <p className="text-[11px] text-slate-400 mt-1">Ditambahkan oleh {m.addedBy}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={addMaterial} className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                <input
                  type="text"
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  placeholder="Judul materi / catatan"
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  value={matNote}
                  onChange={(e) => setMatNote(e.target.value)}
                  placeholder="Tautan atau ringkasan soal"
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
                <button type="submit" className="px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-xl">
                  Tambah Materi
                </button>
              </form>

              {(user?.role === 'teacher' || user?.role === 'admin') && data.booking.status !== 'completed' && (
                <div className="pt-3 border-t border-slate-100">
                  <label htmlFor="session-summary" className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Evaluasi Sebelum Menyelesaikan Sesi
                  </label>
                  <input
                    id="session-summary"
                    type="text"
                    value={summaryNotes}
                    onChange={(e) => setSummaryNotes(e.target.value)}
                    placeholder="Contoh: Siswa memahami konsep turunan fungsi dengan baik..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Chat Panel */}
          <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col h-[540px]">
            <h2 className="text-base font-bold text-[#1F2937] pb-3 border-b border-slate-100 inline-flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#2563EB]" />
              Diskusi Kelas
            </h2>
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {(data.session?.chatMessages || []).length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada pesan. Mulai diskusi di bawah.</p>
              ) : (
                data.session?.chatMessages.map((msg) => (
                  <div key={msg.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span className="font-semibold text-[#1F2937]">{msg.senderName}</span>
                      <span>{msg.senderRole}</span>
                    </div>
                    <p className="text-xs text-slate-700">{msg.message}</p>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={sendChat} className="pt-3 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Tulis pesan kelas..."
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
              <button
                type="submit"
                aria-label="Kirim pesan"
                className="px-3.5 py-2 bg-[#2563EB] text-white rounded-xl inline-flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}
