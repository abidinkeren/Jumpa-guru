import { Link } from 'react-router-dom';
import { BrandLogo } from './Navbar.tsx';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 text-slate-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1 space-y-3">
            <BrandLogo />
            <p className="text-sm font-medium text-[#1F2937]">Website Mencari Guru Belajar Kamu.</p>
            <p className="text-xs leading-relaxed text-slate-500">
              Platform Education Marketplace terintegrasi untuk bimbingan belajar privat online satu guru satu siswa di seluruh Indonesia.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#1F2937] mb-3">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/cari-guru" className="hover:text-[#2563EB] transition-colors">Cari Guru</Link></li>
              <li><Link to="/cara-kerja" className="hover:text-[#2563EB] transition-colors">Cara Kerja</Link></li>
              <li><Link to="/daftar-guru" className="hover:text-[#2563EB] transition-colors">Daftar Menjadi Guru</Link></li>
              <li><Link to="/tentang" className="hover:text-[#2563EB] transition-colors">Tentang JUMPA GURU</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#1F2937] mb-3">Bantuan & Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/bantuan" className="hover:text-[#2563EB] transition-colors">Pusat Bantuan</Link></li>
              <li><Link to="/kebijakan-privasi" className="hover:text-[#2563EB] transition-colors">Kebijakan Privasi</Link></li>
              <li><Link to="/syarat-ketentuan" className="hover:text-[#2563EB] transition-colors">Syarat dan Ketentuan</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#1F2937] mb-3">Kontak & Media Sosial</h3>
            <ul className="space-y-2 text-sm">
              <li>Email: bantuan@jumpaguru.id</li>
              <li>WhatsApp: +62 811-2233-4455</li>
              <li>Instagram: @jumpaguru.id</li>
              <li>YouTube: JUMPA GURU Official</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} JUMPA GURU. Seluruh hak cipta dilindungi.</p>
          <p>Pembelajaran privat online terverifikasi untuk SD, SMP, SMA/SMK, dan Mahasiswa.</p>
        </div>
      </div>
    </footer>
  );
}
