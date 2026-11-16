import { mc } from './helpers.js'

// ============================================================
// TES KEMAMPUAN VERBAL (sinonim, antonim, analogi, klasifikasi, pemahaman bacaan)
// ============================================================
const SIN = 'Pilih kata yang paling SAMA artinya (sinonim) dengan:'
const ANT = 'Pilih kata yang paling BERLAWANAN artinya (antonim) dengan:'
const ANA = 'Lengkapi analogi berikut:'
const ODD = 'Manakah yang TIDAK termasuk dalam kelompoknya?'

const BACAAN =
  'Sebuah perusahaan logistik menerapkan sistem kerja hibrida sejak awal tahun. Dalam enam bulan, tingkat kehadiran rapat meningkat 15%, sementara biaya operasional kantor turun 20%. Namun, survei internal menunjukkan 30% karyawan merasa koordinasi antartim menjadi lebih lambat. Manajemen kemudian menetapkan dua hari kerja tatap muka wajib setiap minggu untuk memperbaiki koordinasi tanpa menghilangkan fleksibilitas.'

const BACAAN2 =
  'Data layanan pelanggan menunjukkan bahwa 70% keluhan diselesaikan pada kontak pertama. Keluhan yang tidak selesai pada kontak pertama rata-rata membutuhkan tiga hari untuk tuntas dan menurunkan skor kepuasan hingga 40%. Karena itu, perusahaan melatih petugas garis depan agar memiliki wewenang menyelesaikan masalah umum tanpa harus menunggu persetujuan supervisor.'

export const verbal = [
  mc('VRB-SIN-01', 'verbal', 'mudah', `${SIN} CERMAT`, ['*Teliti', 'Cepat', 'Ceroboh', 'Cerdas', 'Rajin']),
  mc('VRB-SIN-02', 'verbal', 'mudah', `${SIN} AKURAT`, ['*Tepat', 'Cepat', 'Kira-kira', 'Baru', 'Lengkap']),
  mc('VRB-SIN-03', 'verbal', 'sedang', `${SIN} KONKRET`, ['*Nyata', 'Abstrak', 'Kuat', 'Padat', 'Keras']),
  mc('VRB-SIN-04', 'verbal', 'sedang', `${SIN} KOMPETEN`, ['*Cakap', 'Bersaing', 'Lengkap', 'Patuh', 'Kompak']),
  mc('VRB-SIN-05', 'verbal', 'sedang', `${SIN} ELABORASI`, ['*Penggarapan secara tekun dan cermat', 'Pengurangan', 'Penyederhanaan', 'Peringkasan', 'Pembatalan']),
  mc('VRB-SIN-06', 'verbal', 'sulit', `${SIN} KONKLUSI`, ['*Simpulan', 'Pendahuluan', 'Pertimbangan', 'Dugaan', 'Pengantar']),
  mc('VRB-SIN-07', 'verbal', 'sulit', `${SIN} INSINUASI`, ['*Sindiran', 'Pujian', 'Ajakan', 'Penegasan', 'Penolakan']),
  mc('VRB-SIN-08', 'verbal', 'sulit', `${SIN} PROMINEN`, ['*Terkemuka', 'Menjanjikan', 'Sementara', 'Berpotensi', 'Terbelakang']),
  mc('VRB-SIN-09', 'verbal', 'sulit', `${SIN} NIRLABA`, ['*Tidak mencari keuntungan', 'Tanpa modal', 'Merugi', 'Bebas pajak', 'Bebas biaya']),

  mc('VRB-ANT-01', 'verbal', 'mudah', `${ANT} OPTIMIS`, ['*Pesimis', 'Realistis', 'Idealis', 'Egois', 'Apatis']),
  mc('VRB-ANT-02', 'verbal', 'mudah', `${ANT} SEMENTARA`, ['*Permanen', 'Sebentar', 'Sekarang', 'Sesaat', 'Sejenak']),
  mc('VRB-ANT-03', 'verbal', 'sedang', `${ANT} PROGRESIF`, ['*Regresif', 'Agresif', 'Represif', 'Pasif', 'Impresif']),
  mc('VRB-ANT-04', 'verbal', 'sedang', `${ANT} EFISIEN`, ['*Boros', 'Hemat', 'Lambat', 'Efektif', 'Tepat']),
  mc('VRB-ANT-05', 'verbal', 'sedang', `${ANT} AMATIR`, ['*Profesional', 'Pemula', 'Awam', 'Pelajar', 'Penggemar']),
  mc('VRB-ANT-06', 'verbal', 'sedang', `${ANT} HETEROGEN`, ['*Homogen', 'Beragam', 'Majemuk', 'Campuran', 'Heterodoks']),
  mc('VRB-ANT-07', 'verbal', 'sulit', `${ANT} SPORADIS`, ['*Kontinu', 'Jarang', 'Acak', 'Tersebar', 'Sesekali']),
  mc('VRB-ANT-08', 'verbal', 'sulit', `${ANT} SKEPTIS`, ['*Percaya', 'Ragu', 'Kritis', 'Sinis', 'Curiga']),
  mc('VRB-ANT-09', 'verbal', 'sulit', `${ANT} KONVERGEN`, ['*Divergen', 'Konvensional', 'Terpusat', 'Sejajar', 'Menyatu']),

  mc('VRB-ANA-01', 'verbal', 'mudah', `${ANA} DOKTER : RUMAH SAKIT = GURU : …`, ['*Sekolah', 'Murid', 'Buku', 'Kapur', 'Pelajaran']),
  mc('VRB-ANA-02', 'verbal', 'mudah', `${ANA} AIR : HAUS = MAKANAN : …`, ['*Lapar', 'Kenyang', 'Piring', 'Nasi', 'Restoran']),
  mc('VRB-ANA-03', 'verbal', 'sedang', `${ANA} PENA : PENULIS = KUAS : …`, ['*Pelukis', 'Kanvas', 'Cat', 'Gambar', 'Warna']),
  mc('VRB-ANA-04', 'verbal', 'sedang', `${ANA} PANAS : API = DINGIN : …`, ['*Es', 'Air', 'Angin', 'Hujan', 'Awan']),
  mc('VRB-ANA-05', 'verbal', 'sedang', `${ANA} BENIH : POHON = TELUR : …`, ['*Ayam', 'Cangkang', 'Sarang', 'Kuning telur', 'Induk']),
  mc('VRB-ANA-06', 'verbal', 'sedang', `${ANA} KAKI : SEPATU = KEPALA : …`, ['*Topi', 'Rambut', 'Bantal', 'Otak', 'Leher']),
  mc('VRB-ANA-07', 'verbal', 'sedang', `${ANA} KEMARAU : KEKERINGAN = HUJAN DERAS : …`, ['*Banjir', 'Musim', 'Payung', 'Petir', 'Awan']),
  mc('VRB-ANA-08', 'verbal', 'sulit', `${ANA} LAPAR : MAKAN = LELAH : …`, ['*Istirahat', 'Mengantuk', 'Bekerja', 'Lesu', 'Sakit']),
  mc('VRB-ANA-09', 'verbal', 'sulit', `${ANA} AUDITOR : LAPORAN KEUANGAN = EDITOR : …`, ['*Naskah', 'Penerbit', 'Penulis', 'Percetakan', 'Pembaca']),
  mc('VRB-ANA-10', 'verbal', 'sulit', `${ANA} PROLOG : EPILOG = PEMBUKAAN : …`, ['*Penutup', 'Isi', 'Bab', 'Kata pengantar', 'Daftar isi']),

  mc('VRB-KLS-01', 'verbal', 'mudah', ODD, ['Apel', 'Mangga', 'Jeruk', '*Wortel', 'Pisang']),
  mc('VRB-KLS-02', 'verbal', 'sedang', ODD, ['Merkurius', 'Venus', 'Mars', '*Bulan', 'Jupiter'], 'Bulan adalah satelit, bukan planet.'),
  mc('VRB-KLS-03', 'verbal', 'sedang', ODD, ['Kilogram', 'Gram', 'Ons', '*Liter', 'Ton'], 'Liter adalah satuan volume, lainnya satuan massa.'),
  mc('VRB-KLS-04', 'verbal', 'sedang', ODD, ['Biologi', 'Kimia', 'Fisika', '*Sosiologi', 'Astronomi'], 'Sosiologi termasuk ilmu sosial.'),
  mc('VRB-KLS-05', 'verbal', 'sulit', ODD, ['Rupiah', 'Ringgit', 'Baht', 'Dong', '*Yen'], 'Yen bukan mata uang negara ASEAN.'),

  mc('VRB-BCA-01', 'verbal', 'sedang', 'Apa alasan utama manajemen menetapkan dua hari kerja tatap muka?', ['*Memperbaiki koordinasi antartim', 'Menaikkan biaya operasional', 'Meningkatkan kehadiran rapat', 'Menghapus sistem hibrida', 'Mengurangi jumlah karyawan'], '', BACAAN),
  mc('VRB-BCA-02', 'verbal', 'sulit', 'Pernyataan yang PALING sesuai dengan bacaan adalah …', ['*Sistem hibrida memberi manfaat biaya tetapi menimbulkan tantangan koordinasi', 'Seluruh karyawan menolak sistem hibrida', 'Biaya operasional naik 20% setelah sistem hibrida', 'Kehadiran rapat menurun 15%', 'Manajemen menghentikan fleksibilitas kerja'], '', BACAAN),
  mc('VRB-BCA-03', 'verbal', 'sulit', 'Kesimpulan yang TIDAK dapat ditarik dari bacaan adalah …', ['*Penjualan perusahaan meningkat setelah sistem hibrida', 'Biaya kantor berkurang', 'Sebagian karyawan merasa koordinasi melambat', 'Kehadiran rapat meningkat', 'Kebijakan tatap muka tetap mempertahankan fleksibilitas'], '', BACAAN),
  mc('VRB-BCA-04', 'verbal', 'sedang', 'Mengapa perusahaan memberi wewenang lebih kepada petugas garis depan?', ['*Agar lebih banyak keluhan tuntas pada kontak pertama', 'Agar supervisor tidak perlu bekerja', 'Untuk mengurangi jumlah petugas', 'Karena keluhan pelanggan meningkat 70%', 'Agar pelanggan menunggu tiga hari'], '', BACAAN2),
  mc('VRB-BCA-05', 'verbal', 'sulit', 'Berdasarkan bacaan, keluhan yang tidak selesai pada kontak pertama …', ['*Berdampak signifikan pada penurunan kepuasan pelanggan', 'Jumlahnya 70% dari seluruh keluhan', 'Selalu selesai dalam satu hari', 'Tidak memengaruhi kepuasan pelanggan', 'Harus ditangani langsung oleh direktur'], '', BACAAN2),
]

// ============================================================
// TES KEMAMPUAN NUMERIK (deret, aritmetika, soal cerita kerja)
// ============================================================
const DERET = 'Tentukan bilangan berikutnya dari deret:'

export const numerik = [
  mc('NUM-DRT-01', 'numerik', 'mudah', `${DERET} 2, 4, 6, 8, …`, ['*10', '9', '12', '11', '14']),
  mc('NUM-DRT-02', 'numerik', 'mudah', `${DERET} 3, 6, 12, 24, …`, ['*48', '36', '30', '42', '50']),
  mc('NUM-DRT-03', 'numerik', 'mudah', `${DERET} 50, 45, 40, 35, …`, ['*30', '25', '32', '33', '28']),
  mc('NUM-DRT-04', 'numerik', 'sedang', `${DERET} 1, 4, 9, 16, 25, …`, ['*36', '30', '34', '49', '32'], 'Bilangan kuadrat: 6² = 36.'),
  mc('NUM-DRT-05', 'numerik', 'sedang', `${DERET} 2, 3, 5, 8, 12, …`, ['*17', '15', '16', '18', '20'], 'Selisih bertambah 1: +1, +2, +3, +4, +5.'),
  mc('NUM-DRT-06', 'numerik', 'sedang', `${DERET} 1, 1, 2, 3, 5, 8, …`, ['*13', '11', '12', '14', '16'], 'Fibonacci: 5 + 8 = 13.'),
  mc('NUM-DRT-07', 'numerik', 'sedang', `${DERET} 5, 7, 10, 14, 19, …`, ['*25', '24', '23', '26', '28'], 'Selisih +2, +3, +4, +5, +6.'),
  mc('NUM-DRT-08', 'numerik', 'sulit', `${DERET} 2, 6, 12, 20, 30, …`, ['*42', '40', '36', '38', '44'], 'n × (n+1): 6 × 7 = 42.'),
  mc('NUM-DRT-09', 'numerik', 'sulit', `${DERET} 3, 5, 9, 17, 33, …`, ['*65', '64', '66', '49', '57'], 'Selisih berlipat: +2, +4, +8, +16, +32.'),
  mc('NUM-DRT-10', 'numerik', 'sulit', `${DERET} 4, 8, 7, 14, 13, 26, …`, ['*25', '52', '27', '24', '28'], 'Pola ×2, −1 berulang.'),
  mc('NUM-DRT-11', 'numerik', 'sulit', `${DERET} 1, 2, 6, 24, 120, …`, ['*720', '600', '240', '840', '144'], 'Dikali 2, 3, 4, 5, 6.'),
  mc('NUM-DRT-12', 'numerik', 'sulit', `${DERET} 10, 8, 11, 9, 12, 10, …`, ['*13', '11', '14', '12', '9'], 'Pola −2, +3 berulang.'),

  mc('NUM-ART-01', 'numerik', 'mudah', '25% dari 240 adalah …', ['*60', '48', '50', '64', '80']),
  mc('NUM-ART-02', 'numerik', 'mudah', '125 + 378 − 203 = …', ['*300', '310', '290', '303', '320']),
  mc('NUM-ART-03', 'numerik', 'mudah', '18 × 15 = …', ['*270', '260', '280', '255', '285']),
  mc('NUM-ART-04', 'numerik', 'mudah', 'Nilai dari 2³ + 4² = …', ['*24', '20', '16', '32', '28']),
  mc('NUM-ART-05', 'numerik', 'sedang', '0,75 × 480 = …', ['*360', '340', '320', '380', '375']),
  mc('NUM-ART-06', 'numerik', 'sedang', '3/8 dari 640 = …', ['*240', '220', '260', '200', '280']),
  mc('NUM-ART-07', 'numerik', 'sedang', '√784 = …', ['*28', '26', '27', '24', '32']),
  mc('NUM-ART-08', 'numerik', 'sedang', 'Jika 3x + 7 = 31, maka x = …', ['*8', '7', '9', '6', '10']),

  mc('NUM-CRT-01', 'numerik', 'mudah', 'Rapat dimulai pukul 09.45 dan berlangsung 2 jam 30 menit. Rapat selesai pukul …', ['*12.15', '12.45', '11.45', '12.00', '12.30']),
  mc('NUM-CRT-02', 'numerik', 'sedang', 'Harga printer Rp2.400.000 mendapat diskon 15%. Harga yang dibayar adalah …', ['*Rp2.040.000', 'Rp2.160.000', 'Rp2.000.000', 'Rp1.960.000', 'Rp2.100.000']),
  mc('NUM-CRT-03', 'numerik', 'sedang', 'Seorang staf mengetik 45 kata per menit. Waktu untuk mengetik dokumen 1.800 kata adalah …', ['*40 menit', '36 menit', '45 menit', '42 menit', '38 menit']),
  mc('NUM-CRT-04', 'numerik', 'sedang', 'Gaji pokok Rp4.500.000, tunjangan 20% dari gaji pokok, dan potongan Rp350.000. Gaji bersih adalah …', ['*Rp5.050.000', 'Rp5.400.000', 'Rp4.950.000', 'Rp5.150.000', 'Rp4.850.000']),
  mc('NUM-CRT-05', 'numerik', 'sedang', 'Persediaan kertas 12 rim. Setiap hari terpakai 3/4 rim. Persediaan habis dalam … hari.', ['*16', '9', '12', '15', '18']),
  mc('NUM-CRT-06', 'numerik', 'sulit', 'Penjualan Januari Rp80 juta dan Februari Rp92 juta. Persentase kenaikannya adalah …', ['*15%', '12%', '13%', '18%', '20%']),
  mc('NUM-CRT-07', 'numerik', 'sulit', 'Tim A menyelesaikan pekerjaan dalam 6 hari, Tim B dalam 12 hari. Jika bekerja bersama, pekerjaan selesai dalam …', ['*4 hari', '9 hari', '3 hari', '5 hari', '6 hari'], '1/6 + 1/12 = 1/4 → 4 hari.'),
  mc('NUM-CRT-08', 'numerik', 'sulit', 'Rata-rata nilai 5 karyawan adalah 76. Setelah 1 karyawan baru bergabung, rata-rata menjadi 78. Nilai karyawan baru adalah …', ['*88', '80', '86', '90', '84'], '6 × 78 − 5 × 76 = 468 − 380 = 88.'),
  mc('NUM-CRT-09', 'numerik', 'sulit', 'Sebuah mobil menempuh 180 km dalam 2 jam 15 menit. Kecepatan rata-ratanya adalah …', ['*80 km/jam', '90 km/jam', '75 km/jam', '85 km/jam', '72 km/jam']),
  mc('NUM-CRT-10', 'numerik', 'sulit', 'Perbandingan karyawan pria dan wanita 5 : 3. Jika karyawan wanita 45 orang, total karyawan adalah …', ['*120', '75', '105', '135', '96']),
  mc('NUM-CRT-11', 'numerik', 'sulit', 'Modal Rp50 juta dengan bunga sederhana 8% per tahun. Total uang setelah 3 tahun adalah …', ['*Rp62 juta', 'Rp58 juta', 'Rp62,9 juta', 'Rp54 juta', 'Rp66 juta']),
]

// ============================================================
// PENALARAN LOGIS (silogisme, logika proposisi, analitis, deret huruf)
// ============================================================
export const logika = [
  mc('LOG-SIL-01', 'logika', 'mudah', 'Semua karyawan wajib mengikuti pelatihan K3. Budi adalah karyawan. Kesimpulannya …', ['*Budi wajib mengikuti pelatihan K3', 'Budi tidak wajib mengikuti pelatihan K3', 'Budi sudah mengikuti pelatihan K3', 'Sebagian karyawan tidak mengikuti pelatihan K3', 'Tidak dapat disimpulkan']),
  mc('LOG-SIL-02', 'logika', 'mudah', 'Tidak ada ikan yang hidup di darat. Lele adalah ikan. Kesimpulannya …', ['*Lele tidak hidup di darat', 'Lele hidup di darat', 'Sebagian lele hidup di darat', 'Lele bukan ikan', 'Tidak dapat disimpulkan']),
  mc('LOG-SIL-03', 'logika', 'sedang', 'Jika hujan, maka jalan basah. Jalan tidak basah. Kesimpulannya …', ['*Tidak hujan', 'Hujan', 'Jalan kering karena panas', 'Mungkin hujan', 'Tidak dapat disimpulkan'], 'Modus tollens.'),
  mc('LOG-SIL-04', 'logika', 'sedang', 'Semua peserta yang lulus tes tertulis mengikuti wawancara. Sinta tidak mengikuti wawancara. Kesimpulannya …', ['*Sinta tidak lulus tes tertulis', 'Sinta lulus tes tertulis', 'Sinta akan mengikuti wawancara', 'Semua peserta mengikuti wawancara', 'Tidak dapat disimpulkan']),
  mc('LOG-SIL-05', 'logika', 'sedang', 'Semua A adalah B. Tidak ada B yang C. Kesimpulannya …', ['*Tidak ada A yang C', 'Semua C adalah A', 'Sebagian A adalah C', 'Semua B adalah A', 'Sebagian C adalah B']),
  mc('LOG-SIL-06', 'logika', 'sedang', 'Semua staf IT bisa coding. Sebagian staf IT bisa desain. Pernyataan yang PASTI benar …', ['*Sebagian orang yang bisa coding juga bisa desain', 'Semua yang bisa desain adalah staf IT', 'Semua staf IT bisa desain', 'Tidak ada staf IT yang bisa desain', 'Semua yang bisa coding adalah staf IT']),
  mc('LOG-SIL-07', 'logika', 'sulit', 'Semua manajer adalah pemimpin. Sebagian pemimpin adalah pembicara yang baik. Kesimpulan yang PASTI benar …', ['*Belum dapat dipastikan ada manajer yang merupakan pembicara yang baik', 'Semua manajer adalah pembicara yang baik', 'Sebagian manajer adalah pembicara yang baik', 'Tidak ada manajer yang pembicara yang baik', 'Semua pembicara yang baik adalah manajer']),
  mc('LOG-SIL-08', 'logika', 'sulit', 'Jika target tercapai, karyawan mendapat bonus. Andi mendapat bonus. Kesimpulannya …', ['*Belum tentu target Andi tercapai', 'Target Andi pasti tercapai', 'Target Andi tidak tercapai', 'Andi adalah karyawan terbaik', 'Semua karyawan mendapat bonus'], 'Menegaskan konsekuen bukan penalaran yang sah.'),
  mc('LOG-NEG-01', 'logika', 'sulit', "Negasi dari pernyataan 'Semua karyawan datang tepat waktu' adalah …", ['*Ada karyawan yang tidak datang tepat waktu', 'Semua karyawan tidak datang tepat waktu', 'Tidak ada karyawan yang datang tepat waktu', 'Sebagian karyawan datang tepat waktu', 'Semua karyawan datang terlambat']),
  mc('LOG-NEG-02', 'logika', 'sulit', "Negasi dari 'Jika lembur, maka mendapat uang makan' adalah …", ['*Lembur dan tidak mendapat uang makan', 'Tidak lembur dan mendapat uang makan', 'Jika tidak lembur maka tidak mendapat uang makan', 'Lembur atau mendapat uang makan', 'Tidak lembur atau tidak mendapat uang makan']),
  mc('LOG-ANL-01', 'logika', 'mudah', 'Pukul 03.00, berapa derajat sudut terkecil antara jarum jam dan jarum menit?', ['*90°', '60°', '120°', '45°', '180°']),
  mc('LOG-ANL-02', 'logika', 'sedang', 'Rina lebih tinggi dari Dewi. Dewi lebih tinggi dari Sari. Tari lebih pendek dari Sari. Siapa yang paling pendek?', ['*Tari', 'Sari', 'Dewi', 'Rina', 'Tidak dapat ditentukan']),
  mc('LOG-ANL-03', 'logika', 'sedang', 'Dalam antrean, Ali di depan Beni, Citra di belakang Beni, dan Dodi di depan Ali. Urutan dari depan adalah …', ['*Dodi – Ali – Beni – Citra', 'Ali – Dodi – Beni – Citra', 'Dodi – Beni – Ali – Citra', 'Ali – Beni – Citra – Dodi', 'Citra – Beni – Ali – Dodi']),
  mc('LOG-ANL-04', 'logika', 'sulit', 'Lima karyawan (P, Q, R, S, T) duduk berjajar. P di ujung kiri, R tepat di kanan P, T tidak di ujung, S tepat di kanan T, dan Q tidak bersebelahan dengan R. Siapa yang duduk di ujung kanan?', ['*Q', 'S', 'T', 'R', 'Tidak dapat ditentukan'], 'Urutan: P – R – T – S – Q.'),
  mc('LOG-ANL-05', 'logika', 'sulit', 'Jika hari ini Rabu, maka 100 hari lagi adalah hari …', ['*Jumat', 'Kamis', 'Sabtu', 'Rabu', 'Senin'], '100 mod 7 = 2 → Rabu + 2 = Jumat.'),
  mc('LOG-ANL-06', 'logika', 'sulit', 'Berapa derajat sudut terkecil antara jarum jam dan jarum menit pada pukul 04.30?', ['*45°', '30°', '60°', '75°', '90°']),
  mc('LOG-ANL-07', 'logika', 'sulit', 'Jika A > B, B > C, dan D > A, pernyataan yang PASTI benar adalah …', ['*D > C', 'C > A', 'B > D', 'A = D', 'C > D']),
  mc('LOG-ANL-08', 'logika', 'sulit', 'Jika 5 mesin membuat 5 barang dalam 5 menit, berapa menit yang diperlukan 100 mesin untuk membuat 100 barang?', ['*5 menit', '100 menit', '20 menit', '1 menit', '25 menit']),
  mc('LOG-ANL-09', 'logika', 'sulit', "Tiga kotak berlabel 'Pena', 'Pensil', dan 'Campuran'. Semua label SALAH. Anda mengambil satu barang dari kotak berlabel 'Campuran' dan mendapat pena. Isi kotak berlabel 'Pensil' adalah …", ['*Campuran', 'Pensil', 'Pena', 'Kosong', 'Tidak dapat ditentukan']),
  mc('LOG-HRF-01', 'logika', 'mudah', 'Lanjutkan deret huruf: Z, X, V, T, …', ['*R', 'S', 'Q', 'P', 'U']),
  mc('LOG-HRF-02', 'logika', 'sedang', 'Lanjutkan deret huruf: A, C, F, J, O, …', ['*U', 'T', 'V', 'S', 'W'], 'Loncatan +2, +3, +4, +5, +6.'),
  mc('LOG-HRF-03', 'logika', 'sedang', 'Lanjutkan deret huruf: B, D, G, K, …', ['*P', 'O', 'Q', 'N', 'R']),
  mc('LOG-HRF-04', 'logika', 'sulit', 'Lanjutkan deret: 2A, 4C, 8E, 16G, …', ['*32I', '32H', '24I', '30I', '32J']),
  mc('LOG-KOD-01', 'logika', 'sulit', 'Jika KANTOR ditulis LBOUPS, maka PEGAWAI ditulis …', ['*QFHBXBJ', 'QFHBWBJ', 'OFHBXBJ', 'QEHBXBJ', 'QFHCXBJ'], 'Setiap huruf bergeser +1.'),
]

// ============================================================
// PENALARAN FIGURAL / ABSTRAK & SPASIAL
// ============================================================
export const figural = [
  mc('FIG-POL-01', 'figural', 'mudah', 'Lanjutkan pola berikut:', ['*●', '▲', '■', '◆', '★'], '', '▲  ■  ●  ▲  ■  ●  ▲  ■  ?'),
  mc('FIG-POL-02', 'figural', 'mudah', 'Lanjutkan pola berikut:', ['*□', '■', '▲', '●', '◆'], '', '■  □  □  ■  □  □  ■  □  ?'),
  mc('FIG-POL-03', 'figural', 'mudah', 'Jika panah ↑ diputar 90° searah jarum jam sebanyak dua kali, hasilnya …', ['*↓', '→', '←', '↑', '↘']),
  mc('FIG-POL-04', 'figural', 'sedang', 'Lanjutkan pola berikut:', ['*○', '●', '◐', '◇', '□'], '', '○ ●   ○ ● ●   ○ ● ● ●   ?'),
  mc('FIG-POL-05', 'figural', 'sedang', 'Lanjutkan pola berikut:', ['*↓', '←', '↑', '→', '↗'], '', '↑  →  ↓  ←  ↑  →  ?'),
  mc('FIG-POL-06', 'figural', 'sedang', 'Lanjutkan pola berikut (setiap langkah berputar 45° searah jarum jam):', ['*↓', '←', '↙', '↑', '↖'], '', '↑  ↗  →  ↘  ?'),
  mc('FIG-POL-07', 'figural', 'sedang', 'Lanjutkan pola berikut:', ['*▲▲▲▲', '▲▲▲', '▲▲▲▲▲', '△△△△', '▲▲'], '', '▲     ▲▲     ▲▲▲     ?'),
  mc('FIG-POL-08', 'figural', 'sedang', 'Manakah susunan yang BERBEDA polanya?', ['△ ▲ △', '□ ■ □', '○ ● ○', '◇ ◆ ◇', '*☆ ★ ★']),
  mc('FIG-POL-09', 'figural', 'sedang', 'Lengkapi pola berikut:', ['*☆', '★', '◆', '●', '▲'], '', '★ ☆ ☆  |  ★ ★ ☆ ☆ ☆  |  ★ ★ ★ ?'),
  mc('FIG-MTX-01', 'figural', 'sedang', 'Tentukan angka yang hilang pada matriks:', ['*12', '11', '13', '14', '10'], 'Kolom ke-3 = kolom 1 + kolom 2.', '3   5   8\n4   6   10\n5   7   ?'),
  mc('FIG-MTX-02', 'figural', 'sulit', 'Tentukan angka yang hilang pada matriks:', ['*64', '48', '32', '60', '56'], 'Baris: n, n², n³.', '2   4    8\n3   9    27\n4   16   ?'),
  mc('FIG-MTX-03', 'figural', 'sulit', 'Tentukan angka yang hilang pada matriks:', ['*5', '4', '6', '36', '7'], 'Kolom 1 × kolom 2 = kolom 3.', '7   3   21\n6   4   24\n9   ?   45'),
  mc('FIG-MTX-04', 'figural', 'sedang', 'Lengkapi matriks berikut:', ['*▲▲▲', '▲▲', '■■■', '●●●', '▲▲▲▲'], '', '●     ●●     ●●●\n■     ■■     ■■■\n▲     ▲▲     ?'),
  mc('FIG-POL-10', 'figural', 'sulit', 'Pola simbol berulang: ▲ ■ ● ▲ ■ ● … Simbol ke-20 adalah …', ['*■', '▲', '●', '◆', '★'], '20 mod 3 = 2 → simbol ke-2.'),
  mc('FIG-ROT-01', 'figural', 'sulit', 'Jika panah ↗ diputar 135° berlawanan arah jarum jam, hasilnya …', ['*←', '↑', '↖', '↙', '↓']),
  mc('FIG-SPA-01', 'figural', 'sedang', 'Sebuah segitiga dibagi oleh satu garis lurus dari puncak ke alasnya. Berapa total segitiga yang terbentuk (termasuk segitiga besar)?', ['*3', '2', '4', '5', '6']),
  mc('FIG-SPA-02', 'figural', 'sulit', 'Sebuah kubus dicat seluruh permukaannya lalu dipotong menjadi 27 kubus kecil sama besar. Berapa kubus kecil yang memiliki tepat 2 sisi bercat?', ['*12', '8', '6', '4', '1']),
  mc('FIG-SPA-03', 'figural', 'sulit', 'Sebuah kubus dicat seluruh permukaannya lalu dipotong menjadi 27 kubus kecil sama besar. Berapa kubus kecil yang TIDAK bercat sama sekali?', ['*1', '0', '6', '8', '12']),
]
