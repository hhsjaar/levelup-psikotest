# LevelUp Psikotest

Platform psikotes online untuk rekrutmen karyawan: responsif, interaktif, dan dapat dikonfigurasi penuh oleh admin.
Dibangun dengan **React + Vite + TypeScript + Tailwind CSS v4** dan **Supabase** (Postgres, Auth, RLS, RPC).

## Fitur

**Untuk peserta**
- Masuk dengan kode akses / link (`/t/KODE`), isi data diri, persetujuan.
- Subtes berurutan dengan instruksi, timer per subtes, navigasi soal, tandai ragu-ragu, pintasan keyboard (A–E, 1–5, ←/→).
- Skala Likert dengan auto-lanjut, tampilan pola figural, bacaan, gambar.
- **Tes Kraepelin/Pauli** dengan keypad layar sentuh dan timer per lajur.
- Simpan otomatis + lanjutkan bila halaman tertutup/refresh.
- Anti-curang: deteksi pindah tab, batas pelanggaran + kumpul otomatis (opsional), batas percobaan per email.

**Untuk admin** (`/admin`)
- **Paket Tes**: kombinasi subtes (kognitif, Likert, SJT, Kraepelin), drag & drop urutan, jumlah soal, kategori, komposisi tingkat kesulitan (mudah/sedang/sulit), bobot poin per kesulitan, pengurangan nilai salah, acak soal/opsi, pilih soal manual, batas waktu, jadwal buka/tutup, data wajib peserta.
- **Penilaian**: bobot tiap aspek untuk skor total, ambang rekomendasi, passing grade, ambang lie scale, mode hasil untuk peserta (tidak/ringkas/lengkap), hitung ulang skor.
- **Bank Soal**: 255 soal bawaan, CRUD soal, editor kunci jawaban, item reverse & pasangan konsistensi, skor multi-aspek SJT, impor/ekspor JSON.
- **Hasil Peserta**: daftar, filter, urutkan, ekspor CSV; laporan individu (indeks kesesuaian, rekomendasi, indikator stres/tekanan/tim/integritas/kejujuran menjawab, radar kepribadian, grafik Kraepelin, rincian jawaban, catatan rekruter, cetak PDF).
- **Analisis Soal**: indeks kesulitan empiris (p-value), daya beda (point-biserial), waktu rata-rata, distribusi opsi, peta kualitas soal, **kalibrasi otomatis** label kesulitan.
- **Aspek & Norma**: ubah nama aspek, ambang Rendah/Sedang/Tinggi, arah skor, dan teks interpretasi.

## Aspek yang diukur

| Kelompok | Aspek |
|---|---|
| Kognitif | Verbal, Numerik, Penalaran Logis, Figural & Spasial |
| Sikap kerja (Kraepelin) | Kecepatan (Panker), Ketelitian (Tianker), Stabilitas (Janker), Ketahanan (Hanker) |
| Kepribadian & sikap kerja | **Tingkat Stres**, **Ketahanan terhadap Tekanan**, Stabilitas Emosi, **Kerja Sama Tim**, **Integritas & Kejujuran**, Tanggung Jawab & Disiplin, Adaptabilitas, Komunikasi, Kepemimpinan & Inisiatif, Motivasi Berprestasi, Orientasi Pelayanan |
| Validitas | Kecenderungan Pencitraan (lie scale → "Kejujuran Menjawab"), Konsistensi Jawaban |

Dasar penyusunan soal: format Tes Intelegensi Umum (sinonim, antonim, analogi, deret, aritmetika, silogisme, pola figural), kerangka **Big Five / IPIP** (domain publik) dan **HEXACO Honesty-Humility** untuk kepribadian & integritas, konsep **Perceived Stress** untuk tingkat stres, **skala desirabilitas sosial** untuk deteksi faking, **Situational Judgment Test** untuk perilaku kerja, dan metode **Kraepelin/Pauli** untuk ketahanan kerja. Semua butir ditulis ulang dalam Bahasa Indonesia untuk konteks kerja.

> Hasil bersifat indikatif dan bukan diagnosis klinis. Norma bawaan (ambang 40/70) sebaiknya dikalibrasi ulang dengan data peserta Anda sendiri melalui menu Analisis Soal dan Aspek & Norma.

## Skoring (server-side, di Postgres)

- Kunci jawaban & bobot **tidak pernah dikirim ke browser**; peserta hanya mengakses RPC `security definer`.
- Kognitif: poin = bobot kesulitan bila benar (opsional minus untuk salah); skor aspek = poin / poin maksimal × 100.
- Likert/SJT: setiap opsi menyimpan skor per aspek; skor = (nilai − minimum) / (maksimum − minimum) × 100.
- Kraepelin: dihitung dari jawaban per lajur terhadap angka yang dibangkitkan server.
- Skor total = rata-rata tertimbang aspek (aspek "↓" seperti tingkat stres dibalik).
- Flag validitas: lie scale tinggi, konsistensi rendah, pindah tab, menjawab terlalu cepat, soal kognitif banyak kosong.

## Menjalankan

1. **Siapkan database**: buka Supabase Dashboard → SQL Editor → tempel isi `supabase/setup.sql` → Run.
   (Berisi skema, RLS, fungsi, 21 aspek, 255 soal, dan paket contoh dengan kode `DEMO2026`.)
2. **Auth**: Authentication → Providers → Email aktif. Untuk pengujian cepat, matikan *Confirm email* atau konfirmasi email admin.
3. **Env**: salin `.env.example` ke `.env` lalu isi:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
   ```
4. `npm install` lalu `npm run dev`.
5. Buka `/admin` → buat akun admin pertama (akun pertama otomatis menjadi admin). Admin tambahan: `insert into admins(user_id, email) select id, email from auth.users where email = '...';`

Peserta: buka `/t/DEMO2026`.

### Mengubah bank soal bawaan
Edit `src/data/bank/*.js` lalu jalankan `npm run build:sql` untuk membuat ulang `supabase/seed.sql` & `supabase/setup.sql`. Atau gunakan tombol **Impor Bawaan** di menu Bank Soal.

### Deploy
Vercel / Netlify: build `npm run build`, output `dist`, set dua env di atas. Rewrite SPA sudah disediakan (`vercel.json`, `public/_redirects`).

## Struktur

```
src/
  data/bank/        bank soal, aspek, paket contoh
  pages/public/     Landing, TestEntry, TestRunner, Kraepelin, ResultPage
  pages/admin/      Dashboard, Tests, TestEditor, Questions, Results, ResultDetail, Analytics, Dimensions
  components/       ui.tsx, report.tsx (grafik & laporan)
supabase/
  schema.sql        tabel, RLS, RPC, mesin skoring
  seed.sql          data awal (generated)
  setup.sql         schema + seed (jalankan ini)
```
