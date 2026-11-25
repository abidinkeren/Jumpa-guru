import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDashboardPathForRole, useAuth } from '../context/AuthContext.tsx';

export function LoginPage() {
  const navigate = useNavigate();
  const { loginWithPassword, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const user = await loginWithPassword(email, password);
      navigate(getDashboardPathForRole(user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal masuk.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setSubmitting(true);
    setError('');
    try {
      const user = await loginWithPassword(demoEmail, 'JumpaGuru2026!');
      navigate(getDashboardPathForRole(user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal masuk ke akun demo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setError('');
    try {
      const user = await loginWithGoogle();
      navigate(getDashboardPathForRole(user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google Sign-In gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-4rem)] py-12 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-[#1F2937]">Masuk ke JUMPA GURU</h1>
            <p className="text-sm text-slate-600 mt-1">
              Masuk sesuai peran Anda: Siswa, Guru, Orang Tua/Wali, atau Administrator.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="nama@email.com"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
                  Kata Sandi
                </label>
                <Link to="/lupa-password" className="text-xs font-medium text-[#2563EB] hover:underline">
                  Lupa password?
                </Link>
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-slate-500">atau</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-[#1F2937] rounded-xl transition-colors"
          >
            Masuk dengan Google
          </button>

          <p className="text-center text-xs text-slate-600">
            Belum memiliki akun?{' '}
            <Link to="/daftar" className="font-semibold text-[#2563EB] hover:underline">
              Daftar Sekarang
            </Link>
          </p>
        </div>

        {/* Demo Accounts Box for Local Testing */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-[#1F2937]">Akun Demo Pengujian 4 Peran</h2>
            <p className="text-xs text-slate-500">Klik salah satu tombol untuk langsung menguji dashboard terkait.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Demo Siswa', email: 'siswa@jumpaguru.id' },
              { label: 'Demo Guru', email: 'guru@jumpaguru.id' },
              { label: 'Demo Orang Tua', email: 'orangtua@jumpaguru.id' },
              { label: 'Demo Admin', email: 'admin@jumpaguru.id' },
            ].map((demo) => (
              <button
                key={demo.email}
                type="button"
                disabled={submitting}
                onClick={() => handleDemoLogin(demo.email)}
                className="px-3 py-2 text-xs font-semibold text-[#2563EB] bg-[#DBEAFE]/50 hover:bg-[#DBEAFE] rounded-xl transition-colors text-left"
              >
                <span className="block">{demo.label}</span>
                <span className="block text-[11px] font-normal text-slate-600 truncate">{demo.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { registerAccount } = useAuth();

  const [role, setRole] = useState<'student' | 'parent'>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [educationLevel, setEducationLevel] = useState('SMA/SMK');
  const [schoolName, setSchoolName] = useState('');
  const [childEmail, setChildEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const user = await registerAccount({
        role,
        fullName,
        email,
        phone,
        password,
        educationLevel,
        schoolName,
        childEmail,
      });
      navigate(getDashboardPathForRole(user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registrasi gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-4rem)] py-12 px-4">
      <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1F2937]">Daftar Akun Baru</h1>
            <p className="text-sm text-slate-600 mt-1">Pilih peran akun belajar Anda di JUMPA GURU.</p>
          </div>
          <Link to="/daftar-guru" className="text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap">
            Daftar Guru →
          </Link>
        </div>

        <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setRole('student')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              role === 'student' ? 'bg-white text-[#1F2937] shadow-sm' : 'text-slate-600'
            }`}
          >
            Daftar sebagai Siswa
          </button>
          <button
            type="button"
            onClick={() => setRole('parent')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              role === 'parent' ? 'bg-white text-[#1F2937] shadow-sm' : 'text-slate-600'
            }`}
          >
            Daftar sebagai Orang Tua/Wali
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Lengkap</label>
            <input id="reg-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
              <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl" />
            </div>
            <div>
              <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">Nomor WhatsApp</label>
              <input id="reg-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl" />
            </div>
          </div>

          {role === 'student' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-level" className="block text-xs font-semibold text-slate-700 mb-1.5">Jenjang Pendidikan</label>
                <select id="reg-level" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white">
                  <option value="SD">SD</option>
                  <option value="SMP">SMP</option>
                  <option value="SMA/SMK">SMA/SMK</option>
                  <option value="Mahasiswa">Mahasiswa</option>
                </select>
              </div>
              <div>
                <label htmlFor="reg-school" className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Sekolah / Kampus</label>
                <input id="reg-school" type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl" />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="reg-child" className="block text-xs font-semibold text-slate-700 mb-1.5">Email Akun Anak (Opsional untuk Tautan)</label>
              <input id="reg-child" type="email" value={childEmail} onChange={(e) => setChildEmail(e.target.value)} placeholder="siswa@jumpaguru.id" className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl" />
            </div>
          )}

          <div>
            <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 mb-1.5">Kata Sandi (min. 8 karakter)</label>
            <input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl" />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {submitting ? 'Mendaftarkan...' : 'Buat Akun Sekarang'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  const requestReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInfo(data.message);
      if (data.sandboxResetToken) setToken(data.sandboxResetToken);
      setStep('reset');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim permintaan.');
    }
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInfo(data.message);
      setStep('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mereset kata sandi.');
    }
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-4rem)] py-12 px-4">
      <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
        <h1 className="text-2xl font-bold text-[#1F2937]">Lupa & Reset Kata Sandi</h1>
        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
        {info && <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">{info}</div>}

        {step === 'request' && (
          <form onSubmit={requestReset} className="space-y-4">
            <div>
              <label htmlFor="fp-email" className="block text-xs font-semibold text-slate-700 mb-1.5">Email Akun Terdaftar</label>
              <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl" />
            </div>
            <button type="submit" className="w-full py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-xl">
              Kirim Token Reset Password
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={submitReset} className="space-y-4">
            <div>
              <label htmlFor="rp-token" className="block text-xs font-semibold text-slate-700 mb-1.5">Token Reset</label>
              <input id="rp-token" type="text" value={token} onChange={(e) => setToken(e.target.value)} required className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl font-mono-tabular" />
            </div>
            <div>
              <label htmlFor="rp-pass" className="block text-xs font-semibold text-slate-700 mb-1.5">Kata Sandi Baru (min. 8 karakter)</label>
              <input id="rp-pass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl" />
            </div>
            <button type="submit" className="w-full py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-xl">
              Simpan Kata Sandi Baru
            </button>
          </form>
        )}

        {step === 'done' && (
          <Link to="/login" className="block w-full text-center py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-xl">
            Lanjut ke Halaman Login
          </Link>
        )}
      </div>
    </div>
  );
}
