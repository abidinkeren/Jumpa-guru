import { Link } from 'react-router-dom';

export function CaraKerjaPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[#1F2937]">Cara Kerja JUMPA GURU</h1>
        <p className="text-slate-600">
          Alur pembelajaran privat online 1-on-1 yang terstruktur, aman, dan transparan bagi siswa, guru, maupun orang tua.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            no: '01',
            title: 'Registrasi & Penentuan Jenjang',
            body: 'Siswa atau orang tua mendaftarkan akun secara gratis. Guru mendaftar melalui 6 tahap verifikasi dokumen pendidikan dan rekening bank.',
          },
          {
            no: '02',
            title: 'Pencarian & Pemilihan Jadwal',
            body: 'Siswa memfilter guru berdasarkan mata pelajaran, jenjang (SD, SMP, SMA/SMK, Mahasiswa), hari tersedia, serta rating ulasan.',
          },
          {
            no: '03',
            title: 'Persetujuan Guru & Pembayaran Resmi',
            body: 'Guru menerima permintaan jadwal. Sistem menerbitkan tagihan sesuai tarif resmi platform dan mengunci slot saat pembayaran terverifikasi.',
          },
          {
            no: '04',
            title: 'Sesi Online & Penyelesaian',
            body: 'Belajar di Ruang Kelas Online JUMPA GURU (60 atau 90 menit). Setelah sesi selesai, pendapatan otomatis masuk ke Wallet Guru.',
          },
        ].map((s) => (
          <div key={s.no} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2">
            <span className="text-sm font-bold text-[#2563EB] font-mono-tabular">{s.no}</span>
            <h2 className="text-lg font-bold text-[#1F2937]">{s.title}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/cari-guru" className="px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-xl">
          Cari Guru Sekarang
        </Link>
        <Link to="/daftar-guru" className="px-5 py-2.5 bg-white border border-slate-200 text-sm font-semibold rounded-xl">
          Daftar Menjadi Guru
        </Link>
      </div>
    </div>
  );
}

export function TentangKamiPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <h1 className="text-3xl font-bold text-[#1F2937]">Tentang JUMPA GURU</h1>
      <p className="text-base text-slate-600 leading-relaxed">
        <strong>JUMPA GURU — Website Mencari Guru Belajar Kamu</strong> hadir sebagai jembatan pendidikan digital yang menghubungkan siswa SD, SMP, SMA/SMK, hingga Mahasiswa dengan para pendidik profesional, guru sekolah, dan tutor akademik terverifikasi di seluruh Indonesia.
      </p>
      <p className="text-base text-slate-600 leading-relaxed">
        Platform kami menetapkan standar tarif yang adil dan transparan, menyediakan sistem anti-bentrok jadwal berbasis transaksi database, ruang kelas virtual terintegrasi, serta pengelolaan dompet dan pencairan dana yang dapat diaudit sepenuhnya bagi pengajar.
      </p>
    </div>
  );
}

export function BantuanPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#1F2937]">Pusat Bantuan JUMPA GURU</h1>
        <p className="text-slate-600 mt-1">Pertanyaan umum seputar pemesanan kelas, pembayaran, dan verifikasi guru.</p>
      </div>
      <div className="space-y-4">
        {[
          {
            q: 'Bagaimana sistem menentukan tarif belajar?',
            a: 'Tarif belajar ditentukan secara resmi oleh Administrator JUMPA GURU per jenjang dan durasi (60 menit atau 90 menit). Snapshot harga dikunci pada saat pemesanan dibuat.',
          },
          {
            q: 'Apa yang terjadi jika guru menolak permintaan jadwal?',
            a: 'Tidak ada tagihan yang diterbitkan dan siswa dapat langsung memilih jadwal atau guru lain yang tersedia.',
          },
          {
            q: 'Kapan pendapatan masuk ke Wallet Guru?',
            a: 'Pendapatan bersih guru dicatat ke saldo tersedia secara otomatis dan aman setelah sesi pembelajaran ditandai selesai.',
          },
        ].map((faq) => (
          <div key={faq.q} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1.5">
            <h2 className="text-base font-bold text-[#1F2937]">{faq.q}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LegalPage({ type }: { type: 'privacy' | 'terms' }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-5">
      <h1 className="text-3xl font-bold text-[#1F2937]">
        {type === 'privacy' ? 'Kebijakan Privasi JUMPA GURU' : 'Syarat dan Ketentuan JUMPA GURU'}
      </h1>
      <p className="text-sm text-slate-600 leading-relaxed">
        JUMPA GURU melindungi seluruh data pribadi siswa, orang tua/wali, serta dokumen verifikasi guru (KTP, ijazah, rekening pencairan) dalam penyimpanan privat yang tidak pernah dipublikasikan. Akses ruang kelas online dibatasi secara ketat hanya kepada siswa dan guru yang terdaftar pada sesi terkait.
      </p>
      <p className="text-sm text-slate-600 leading-relaxed">
        Pembayaran dan pencairan dana dicatat menggunakan buku besar (ledger) yang dapat diaudit serta dikonfirmasi melalui webhook server yang terverifikasi.
      </p>
    </div>
  );
}

export function UnauthorizedPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
      <h1 className="text-2xl font-bold text-[#1F2937]">Akses Dibatasi (403)</h1>
      <p className="text-sm text-slate-600">
        Anda tidak diizinkan mengakses dashboard peran lain. Sistem otorisasi berbasis peran melindungi setiap rute dashboard.
      </p>
      <Link to="/" className="inline-block px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-xl">
        Kembali ke Beranda
      </Link>
    </div>
  );
}
