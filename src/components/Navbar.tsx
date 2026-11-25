import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { getDashboardPathForRole, useAuth } from '../context/AuthContext.tsx';

export function BrandLogo() {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="8" fill="#2563EB" />
        <path
          d="M16 7L6 12L16 17L26 12L16 7Z"
          fill="#FFFFFF"
        />
        <path
          d="M9.5 15V21C9.5 22.8 12.4 24.5 16 24.5C19.6 24.5 22.5 22.8 22.5 21V15L16 18.2L9.5 15Z"
          fill="#DBEAFE"
        />
        <circle cx="24.5" cy="18.5" r="2" fill="#FBBF24" />
      </svg>
      <span className="text-lg font-extrabold tracking-tight text-[#1F2937]">
        JUMPA <span className="text-[#2563EB]">GURU</span>
      </span>
    </span>
  );
}

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'Beranda', to: '/' },
    { label: 'Cari Guru', to: '/cari-guru' },
    { label: 'Cara Kerja', to: '/cara-kerja' },
    { label: 'Tentang Kami', to: '/tentang' },
    { label: 'Bantuan', to: '/bantuan' },
  ];

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Logo */}
        <Link to="/" className="focus-visible:outline-2 focus-visible:outline-[#2563EB] rounded-lg">
          <BrandLogo />
        </Link>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600" aria-label="Navigasi Utama">
          {navLinks.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                  isActive
                    ? 'text-[#2563EB] border-[#2563EB] font-semibold'
                    : 'border-transparent hover:text-[#1F2937] hover:border-slate-300'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action zone */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {user ? (
            <>
              <Link
                to={getDashboardPathForRole(user.role)}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-[#1F2937] transition-colors whitespace-nowrap shrink-0"
              >
                Keluar
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-[#2563EB] transition-colors whitespace-nowrap shrink-0"
              >
                Login
              </Link>
              <Link
                to="/daftar"
                className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                Daftar
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
          aria-expanded={mobileOpen}
          className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-slate-700 hover:bg-slate-100"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {user ? (
              <>
                <Link
                  to={getDashboardPathForRole(user.role)}
                  onClick={() => setMobileOpen(false)}
                  className="w-full text-center px-4 py-2.5 text-sm font-semibold text-white bg-[#2563EB] rounded-lg"
                >
                  Buka Dashboard ({user.fullName})
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg"
                >
                  Keluar
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="w-full text-center px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg"
                >
                  Login
                </Link>
                <Link
                  to="/daftar"
                  onClick={() => setMobileOpen(false)}
                  className="w-full text-center px-4 py-2.5 text-sm font-semibold text-white bg-[#2563EB] rounded-lg"
                >
                  Daftar Akun
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
