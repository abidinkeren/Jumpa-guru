# JUMPA GURU — Website Mencari Guru Belajar Kamu

Platform Education Marketplace berbasis web untuk menghubungkan guru terverifikasi dan siswa dalam bimbingan belajar privat online 1-on-1 (durasi 60 menit dan 90 menit), lengkap dengan kontrol tarif platform, pencegahan bentrok jadwal, gateway pembayaran sandbox dengan verifikasi webhook server, ruang kelas online, dompet & pencairan dana guru, portal pengawasan orang tua, serta konsol administrator 20 menu.

## Arsitektur & Teknologi

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router
- **Backend**: Express (`server.ts`, port `3000`) dengan REST API (`/api/*`)
- **Database**: Cloud SQL PostgreSQL + Drizzle ORM (`src/db/schema.ts`, 22 tabel relasional)
- **Autentikasi**: Email & Password (`scrypt` + HMAC-SHA256 Bearer token di memori klien) serta Google Sign-In (`firebase` & `firebase-admin`)
- **Otorisasi**: Role-Based Access Control (RBAC) untuk 4 peran (`admin`, `teacher`, `student`, `parent`)

## Instalasi & Konfigurasi Lokal / Cloud

1. **Instal dependensi**:
   ```bash
   npm install
   ```

2. **Konfigurasi Environment Variables** (lihat `.env.example`):
   - `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` (disediakan oleh Cloud SQL PostgreSQL)
   - `APP_URL`: URL aplikasi aktif
   - `PAYMENT_GATEWAY_WEBHOOK_SECRET` *(opsional)*: secret header `x-webhook-secret` untuk validasi webhook pembayaran
   - `VIDEO_PROVIDER_MODE`: `sandbox` (default JumpaMeet WebRTC Room)

3. **Sinkronisasi Skema Database**:
   ```bash
   npx drizzle-kit push --config=src/db/drizzle.config.ts
   ```

4. **Jalankan Mode Pengembangan**:
   ```bash
   npm run dev
   ```

5. **Build & Produksi**:
   ```bash
   npm run build
   npm start
   ```

6. **Pengujian Unit Logika Domain**:
   ```bash
   npx tsx --test src/utils/domainLogic.test.ts
   ```

## Akun Demo (4 Peran)

Data awal (10 mata pelajaran, 8 paket harga resmi, profil guru aktif & menunggu verifikasi, jadwal, dompet, booking contoh) otomatis di-seed secara idempoten saat server pertama kali menerima permintaan.

| Peran | Email | Kata Sandi |
| :--- | :--- | :--- |
| Administrator | `admin@jumpaguru.id` | `JumpaGuru2026!` |
| Guru | `guru@jumpaguru.id` | `JumpaGuru2026!` |
| Siswa | `siswa@jumpaguru.id` | `JumpaGuru2026!` |
| Orang Tua/Wali | `orangtua@jumpaguru.id` | `JumpaGuru2026!` |
