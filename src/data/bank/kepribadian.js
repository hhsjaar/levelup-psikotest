import { lk, sjt } from './helpers.js'

// ============================================================
// INVENTORI SIKAP & KEPRIBADIAN KERJA (Likert 1-5)
// Diadaptasi dari kerangka Big Five / IPIP (domain publik), HEXACO Honesty-Humility,
// konsep Perceived Stress, serta skala desirabilitas sosial (lie scale).
// R = item unfavorable (skor dibalik). pair = pasangan item untuk cek konsistensi jawaban.
// ============================================================
const R = { reverse: true }

export const likert = [
  // ---- Tingkat Stres (semakin tinggi = semakin stres) ----
  lk('STR-01', 'tingkat_stres', 'Saya sering merasa tegang ketika pekerjaan menumpuk.'),
  lk('STR-02', 'tingkat_stres', 'Saya mudah merasa cemas memikirkan pekerjaan yang belum selesai.', { pair: 'str1' }),
  lk('STR-03', 'tingkat_stres', 'Saya jarang merasa cemas tentang pekerjaan yang belum selesai.', { reverse: true, pair: 'str1' }),
  lk('STR-04', 'tingkat_stres', 'Saya sulit tidur karena memikirkan masalah pekerjaan.'),
  lk('STR-05', 'tingkat_stres', 'Saya merasa kewalahan dengan tanggung jawab sehari-hari.'),
  lk('STR-06', 'tingkat_stres', 'Saya mudah tersinggung ketika sedang lelah bekerja.'),
  lk('STR-07', 'tingkat_stres', 'Akhir-akhir ini saya merasa mampu mengendalikan hal-hal penting dalam hidup saya.', R),
  lk('STR-08', 'tingkat_stres', 'Saya sering merasa lelah secara mental bahkan sebelum hari kerja dimulai.'),
  lk('STR-09', 'tingkat_stres', 'Saya dapat bersantai dengan mudah setelah jam kerja selesai.', { reverse: true, pair: 'str2' }),
  lk('STR-10', 'tingkat_stres', 'Setelah jam kerja, pikiran saya masih terus terbebani urusan kantor.', { pair: 'str2' }),
  lk('STR-11', 'tingkat_stres', 'Hal-hal kecil pun dapat membuat saya gelisah.'),

  // ---- Ketahanan terhadap Tekanan ----
  lk('TKN-01', 'toleransi_tekanan', 'Saya tetap dapat berpikir jernih saat dikejar tenggat waktu.', { pair: 'tkn1' }),
  lk('TKN-02', 'toleransi_tekanan', 'Tenggat waktu yang ketat membuat saya sulit berkonsentrasi.', { reverse: true, pair: 'tkn1' }),
  lk('TKN-03', 'toleransi_tekanan', 'Saya mampu menyelesaikan beberapa tugas mendesak sekaligus dengan baik.'),
  lk('TKN-04', 'toleransi_tekanan', 'Kritik keras dari atasan membuat saya kehilangan semangat berhari-hari.', R),
  lk('TKN-05', 'toleransi_tekanan', 'Saya melihat target yang tinggi sebagai tantangan, bukan beban.'),
  lk('TKN-06', 'toleransi_tekanan', 'Ketika rencana gagal, saya segera mencari cara lain.'),
  lk('TKN-07', 'toleransi_tekanan', 'Saya cenderung panik jika terjadi masalah mendadak di tempat kerja.', { reverse: true, pair: 'tkn2' }),
  lk('TKN-08', 'toleransi_tekanan', 'Saya tetap tenang saat menghadapi masalah mendadak di pekerjaan.', { pair: 'tkn2' }),
  lk('TKN-09', 'toleransi_tekanan', 'Saya tetap bekerja dengan baik di lingkungan yang ramai dan sibuk.'),
  lk('TKN-10', 'toleransi_tekanan', 'Saya mudah menyerah ketika pekerjaan terasa terlalu berat.', R),

  // ---- Stabilitas Emosi ----
  lk('EMO-01', 'stabilitas_emosi', 'Suasana hati saya relatif stabil sepanjang hari.', { pair: 'emo1' }),
  lk('EMO-02', 'stabilitas_emosi', 'Suasana hati saya mudah berubah-ubah tanpa alasan yang jelas.', { reverse: true, pair: 'emo1' }),
  lk('EMO-03', 'stabilitas_emosi', 'Saya dapat mengendalikan amarah ketika berbeda pendapat dengan rekan kerja.'),
  lk('EMO-04', 'stabilitas_emosi', 'Saya mudah meluapkan emosi di depan orang lain saat kesal.', R),
  lk('EMO-05', 'stabilitas_emosi', 'Saya dapat menerima kegagalan dengan lapang dada.'),
  lk('EMO-06', 'stabilitas_emosi', 'Saya sering merasa rendah diri dibandingkan rekan kerja.', R),
  lk('EMO-07', 'stabilitas_emosi', 'Saya tidak mudah terbawa perasaan saat menerima masukan.'),
  lk('EMO-08', 'stabilitas_emosi', 'Masalah pribadi sering memengaruhi kinerja saya di kantor.', { reverse: true, pair: 'emo2' }),
  lk('EMO-09', 'stabilitas_emosi', 'Saya mampu memisahkan masalah pribadi dari urusan pekerjaan.', { pair: 'emo2' }),
  lk('EMO-10', 'stabilitas_emosi', 'Saya merasa nyaman dan menerima diri saya apa adanya.'),

  // ---- Kerja Sama Tim ----
  lk('TIM-01', 'kerja_tim', 'Saya senang berbagi informasi yang dapat membantu pekerjaan rekan tim.'),
  lk('TIM-02', 'kerja_tim', 'Saya lebih suka mengerjakan semuanya sendiri daripada bekerja sama.', { reverse: true, pair: 'tim1' }),
  lk('TIM-03', 'kerja_tim', 'Saya menikmati bekerja sama dengan orang lain untuk mencapai tujuan bersama.', { pair: 'tim1' }),
  lk('TIM-04', 'kerja_tim', 'Saya bersedia membantu rekan yang kesulitan meskipun bukan tugas saya.'),
  lk('TIM-05', 'kerja_tim', 'Saya menghargai pendapat anggota tim walaupun berbeda dengan pendapat saya.'),
  lk('TIM-06', 'kerja_tim', 'Keberhasilan tim lebih penting daripada pengakuan pribadi bagi saya.'),
  lk('TIM-07', 'kerja_tim', 'Saya merasa terganggu jika harus menyesuaikan diri dengan cara kerja orang lain.', R),
  lk('TIM-08', 'kerja_tim', 'Saya jarang menawarkan bantuan kepada rekan kerja.', { reverse: true, pair: 'tim2' }),
  lk('TIM-09', 'kerja_tim', 'Saya sering menawarkan bantuan kepada rekan kerja tanpa diminta.', { pair: 'tim2' }),
  lk('TIM-10', 'kerja_tim', 'Saya berusaha menjaga suasana tim tetap kondusif ketika terjadi perbedaan pendapat.'),

  // ---- Integritas & Kejujuran ----
  lk('INT-01', 'integritas', 'Saya melaporkan kesalahan yang saya buat, meskipun tidak ada yang mengetahuinya.', { pair: 'int1' }),
  lk('INT-02', 'integritas', 'Jika tidak ada yang tahu, saya tidak perlu mengakui kesalahan saya.', { reverse: true, pair: 'int1' }),
  lk('INT-03', 'integritas', 'Menggunakan fasilitas kantor untuk keperluan pribadi adalah hal yang wajar.', R),
  lk('INT-04', 'integritas', 'Saya menolak hadiah yang dapat memengaruhi keputusan pekerjaan saya.'),
  lk('INT-05', 'integritas', 'Sedikit melebihkan laporan lembur adalah hal yang biasa.', R),
  lk('INT-06', 'integritas', 'Saya menepati janji walaupun itu merugikan saya.'),
  lk('INT-07', 'integritas', 'Saya akan menegur rekan yang melakukan kecurangan, meskipun ia teman dekat.'),
  lk('INT-08', 'integritas', 'Aturan boleh dilanggar selama hasil kerjanya baik.', { reverse: true, pair: 'int2' }),
  lk('INT-09', 'integritas', 'Saya tetap mengikuti prosedur meskipun ada jalan pintas yang lebih cepat.', { pair: 'int2' }),
  lk('INT-10', 'integritas', 'Saya menjaga kerahasiaan data perusahaan dengan sungguh-sungguh.'),

  // ---- Tanggung Jawab & Disiplin ----
  lk('TGJ-01', 'tanggung_jawab', 'Saya selalu menyelesaikan pekerjaan sesuai tenggat waktu.', { pair: 'tgj1' }),
  lk('TGJ-02', 'tanggung_jawab', 'Saya sering menunda pekerjaan hingga mendekati batas waktu.', { reverse: true, pair: 'tgj1' }),
  lk('TGJ-03', 'tanggung_jawab', 'Saya datang tepat waktu ke kantor maupun rapat.'),
  lk('TGJ-04', 'tanggung_jawab', 'Saya memeriksa kembali hasil pekerjaan sebelum menyerahkannya.'),
  lk('TGJ-05', 'tanggung_jawab', 'Saya membuat rencana kerja sebelum memulai tugas.'),
  lk('TGJ-06', 'tanggung_jawab', 'Saya mudah lupa terhadap tugas yang diberikan kepada saya.', R),
  lk('TGJ-07', 'tanggung_jawab', 'Saya bertanggung jawab penuh atas hasil kerja saya, baik atau buruk.'),
  lk('TGJ-08', 'tanggung_jawab', 'Jika pekerjaan gagal, saya cenderung mencari pihak lain untuk disalahkan.', { reverse: true, pair: 'tgj2' }),
  lk('TGJ-09', 'tanggung_jawab', 'Saya mengakui bagian saya ketika pekerjaan tim tidak berhasil.', { pair: 'tgj2' }),
  lk('TGJ-10', 'tanggung_jawab', 'Saya menjaga meja dan berkas kerja saya tetap teratur.'),

  // ---- Adaptabilitas ----
  lk('ADP-01', 'adaptabilitas', 'Saya cepat menyesuaikan diri dengan lingkungan kerja yang baru.', { pair: 'adp1' }),
  lk('ADP-02', 'adaptabilitas', 'Saya butuh waktu sangat lama untuk terbiasa dengan lingkungan baru.', { reverse: true, pair: 'adp1' }),
  lk('ADP-03', 'adaptabilitas', 'Saya terbuka mempelajari sistem atau teknologi baru.'),
  lk('ADP-04', 'adaptabilitas', 'Perubahan prosedur kerja yang mendadak membuat saya kesal.', R),
  lk('ADP-05', 'adaptabilitas', 'Saya dapat bekerja dengan atasan yang memiliki gaya kepemimpinan berbeda-beda.'),
  lk('ADP-06', 'adaptabilitas', 'Saya lebih nyaman dengan rutinitas yang tidak pernah berubah.', R),
  lk('ADP-07', 'adaptabilitas', 'Saya melihat perubahan sebagai kesempatan untuk berkembang.'),
  lk('ADP-08', 'adaptabilitas', 'Saya bersedia dipindahkan ke tugas atau divisi lain jika dibutuhkan.'),
  lk('ADP-09', 'adaptabilitas', 'Saya enggan mencoba cara kerja baru jika cara lama masih berjalan.', { reverse: true, pair: 'adp2' }),
  lk('ADP-10', 'adaptabilitas', 'Saya senang mencoba cara kerja baru yang lebih efektif.', { pair: 'adp2' }),

  // ---- Komunikasi Interpersonal ----
  lk('KOM-01', 'komunikasi', 'Saya mampu menyampaikan ide dengan jelas kepada orang lain.', { pair: 'kom1' }),
  lk('KOM-02', 'komunikasi', 'Orang lain sering salah paham dengan maksud yang saya sampaikan.', { reverse: true, pair: 'kom1' }),
  lk('KOM-03', 'komunikasi', 'Saya mendengarkan lawan bicara sampai selesai sebelum menanggapi.'),
  lk('KOM-04', 'komunikasi', 'Saya merasa sangat canggung berbicara di depan banyak orang.', R),
  lk('KOM-05', 'komunikasi', 'Saya menyampaikan ketidaksetujuan dengan cara yang sopan.'),
  lk('KOM-06', 'komunikasi', 'Saya terbiasa memberikan kabar perkembangan pekerjaan kepada atasan.'),
  lk('KOM-07', 'komunikasi', 'Saya mudah memulai percakapan dengan orang yang baru dikenal.'),
  lk('KOM-08', 'komunikasi', 'Saya cenderung diam walaupun ada informasi penting yang perlu disampaikan.', { reverse: true, pair: 'kom2' }),
  lk('KOM-09', 'komunikasi', 'Saya segera menyampaikan informasi penting kepada pihak terkait.', { pair: 'kom2' }),
  lk('KOM-10', 'komunikasi', 'Saya menyesuaikan cara bicara dengan lawan bicara yang berbeda latar belakang.'),

  // ---- Kepemimpinan & Inisiatif ----
  lk('LDR-01', 'kepemimpinan', 'Saya berani mengambil keputusan ketika situasi menuntut.', { pair: 'ldr1' }),
  lk('LDR-02', 'kepemimpinan', 'Saya lebih suka menunggu orang lain mengambil keputusan.', { reverse: true, pair: 'ldr1' }),
  lk('LDR-03', 'kepemimpinan', 'Saya sering mengusulkan ide perbaikan di tempat kerja.'),
  lk('LDR-04', 'kepemimpinan', 'Saya mampu memotivasi orang lain untuk mencapai target.'),
  lk('LDR-05', 'kepemimpinan', 'Saya mengambil inisiatif tanpa harus selalu diperintah.'),
  lk('LDR-06', 'kepemimpinan', 'Saya enggan diminta memimpin kelompok.', R),
  lk('LDR-07', 'kepemimpinan', 'Saya mampu membagi tugas secara adil kepada anggota tim.'),
  lk('LDR-08', 'kepemimpinan', 'Saya bersedia menanggung risiko atas keputusan yang saya ambil.'),
  lk('LDR-09', 'kepemimpinan', 'Saya hanya mengerjakan apa yang diminta, tidak lebih.', { reverse: true, pair: 'ldr2' }),
  lk('LDR-10', 'kepemimpinan', 'Saya sering mengerjakan lebih dari yang diminta demi hasil yang lebih baik.', { pair: 'ldr2' }),

  // ---- Motivasi Berprestasi ----
  lk('MOT-01', 'motivasi_berprestasi', 'Saya menetapkan target pribadi yang lebih tinggi dari standar.'),
  lk('MOT-02', 'motivasi_berprestasi', 'Saya puas dengan hasil kerja yang sekadar cukup.', { reverse: true, pair: 'mot1' }),
  lk('MOT-03', 'motivasi_berprestasi', 'Saya selalu berusaha memberikan hasil kerja terbaik.', { pair: 'mot1' }),
  lk('MOT-04', 'motivasi_berprestasi', 'Saya aktif mencari kesempatan untuk mempelajari keterampilan baru.'),
  lk('MOT-05', 'motivasi_berprestasi', 'Saya tetap bersemangat walaupun pekerjaan terasa monoton.'),
  lk('MOT-06', 'motivasi_berprestasi', 'Saya mudah kehilangan motivasi ketika tidak ada pengawasan.', R),
  lk('MOT-07', 'motivasi_berprestasi', 'Saya ingin terus berkembang dan meningkatkan karier saya.'),
  lk('MOT-08', 'motivasi_berprestasi', 'Saya bekerja keras untuk mencapai tujuan jangka panjang.'),
  lk('MOT-09', 'motivasi_berprestasi', 'Saya jarang memikirkan cara meningkatkan kualitas kerja saya.', { reverse: true, pair: 'mot2' }),
  lk('MOT-10', 'motivasi_berprestasi', 'Saya rutin mengevaluasi cara kerja saya agar lebih baik.', { pair: 'mot2' }),

  // ---- Orientasi Pelayanan ----
  lk('PLY-01', 'orientasi_pelayanan', 'Saya merasa puas ketika dapat membantu menyelesaikan masalah pelanggan.'),
  lk('PLY-02', 'orientasi_pelayanan', 'Saya tetap sopan meskipun menghadapi pelanggan yang marah.', { pair: 'ply1' }),
  lk('PLY-03', 'orientasi_pelayanan', 'Saya mudah terpancing emosi ketika pelanggan mengeluh.', { reverse: true, pair: 'ply1' }),
  lk('PLY-04', 'orientasi_pelayanan', 'Saya berusaha memahami kebutuhan orang lain sebelum menawarkan solusi.'),
  lk('PLY-05', 'orientasi_pelayanan', 'Saya menindaklanjuti permintaan orang lain sampai tuntas.'),
  lk('PLY-06', 'orientasi_pelayanan', 'Keluhan pelanggan bukan urusan saya jika bukan bagian tugas saya.', R),
  lk('PLY-07', 'orientasi_pelayanan', 'Saya berusaha memberikan pelayanan melebihi harapan.'),
  lk('PLY-08', 'orientasi_pelayanan', 'Saya menganggap kepuasan pelanggan sebagai ukuran keberhasilan kerja.'),

  // ---- Skala Validitas: Desirabilitas Sosial / Lie Scale (semakin tinggi = cenderung pencitraan) ----
  lk('LIE-01', 'desirabilitas_sosial', 'Saya tidak pernah sekali pun berbohong seumur hidup saya.'),
  lk('LIE-02', 'desirabilitas_sosial', 'Saya tidak pernah merasa kesal kepada siapa pun.'),
  lk('LIE-03', 'desirabilitas_sosial', 'Saya selalu menyukai semua orang yang saya temui.'),
  lk('LIE-04', 'desirabilitas_sosial', 'Saya tidak pernah terlambat sekali pun dalam hidup saya.'),
  lk('LIE-05', 'desirabilitas_sosial', 'Saya tidak pernah membicarakan orang lain di belakangnya.'),
  lk('LIE-06', 'desirabilitas_sosial', 'Saya tidak pernah menunda pekerjaan sama sekali.'),
  lk('LIE-07', 'desirabilitas_sosial', 'Saya selalu menepati setiap janji tanpa kecuali.'),
  lk('LIE-08', 'desirabilitas_sosial', 'Saya tidak pernah merasa iri terhadap keberhasilan orang lain.'),
  lk('LIE-09', 'desirabilitas_sosial', 'Saya selalu bersikap sabar dalam situasi apa pun.'),
  lk('LIE-10', 'desirabilitas_sosial', 'Saya tidak pernah melanggar aturan sekecil apa pun.'),
]

// ============================================================
// SITUATIONAL JUDGMENT TEST (SJT) – skor 0-4 per dimensi
// ============================================================
const Q = 'Apa yang paling mungkin Anda lakukan?'

export const situasional = [
  sjt('SJT-01', 'kerja_tim', 'sedang', `Rekan satu tim tidak menyelesaikan bagiannya sehingga proyek tim terancam terlambat. ${Q}`, [
    ['Mengajaknya bicara untuk memahami kendalanya, lalu bersama-sama mencari solusi dan membagi ulang tugas bila perlu.', { kerja_tim: 4, komunikasi: 3 }],
    ['Langsung melaporkannya ke atasan agar ia mendapat teguran.', { kerja_tim: 1, komunikasi: 1 }],
    ['Mengerjakan bagiannya diam-diam tanpa memberi tahu siapa pun.', { kerja_tim: 2, komunikasi: 0 }],
    ['Membiarkannya karena itu tanggung jawab dia.', { kerja_tim: 0, komunikasi: 0 }],
  ]),
  sjt('SJT-02', 'integritas', 'sedang', `Anda mengetahui rekan kerja memalsukan nota perjalanan dinas dengan nominal kecil. ${Q}`, [
    ['Menyampaikan kepadanya bahwa tindakan itu salah dan memintanya memperbaiki; bila berulang, melaporkan sesuai prosedur.', { integritas: 4, komunikasi: 3 }],
    ['Langsung melaporkannya ke atasan tanpa berbicara terlebih dahulu.', { integritas: 3, komunikasi: 1 }],
    ['Diam saja karena nominalnya kecil.', { integritas: 1, komunikasi: 0 }],
    ['Ikut melakukan hal yang sama karena dianggap kebiasaan.', { integritas: 0, komunikasi: 0 }],
  ]),
  sjt('SJT-03', 'toleransi_tekanan', 'sulit', `Menjelang tenggat, atasan memberi tambahan tugas mendesak, sementara pekerjaan Anda belum selesai. ${Q}`, [
    ['Menyusun prioritas, mengonfirmasi urutannya ke atasan, lalu mengerjakan secara fokus.', { toleransi_tekanan: 4, komunikasi: 3, tanggung_jawab: 3 }],
    ['Menerima semua tugas dan lembur tanpa bertanya, walau hasilnya mungkin kurang maksimal.', { toleransi_tekanan: 2, komunikasi: 1, tanggung_jawab: 2 }],
    ['Menolak tugas tambahan karena pekerjaan sudah banyak.', { toleransi_tekanan: 1, komunikasi: 1, tanggung_jawab: 1 }],
    ['Mengerjakan seadanya agar semuanya cepat selesai.', { toleransi_tekanan: 0, komunikasi: 0, tanggung_jawab: 0 }],
  ]),
  sjt('SJT-04', 'orientasi_pelayanan', 'sedang', `Pelanggan marah karena pesanannya terlambat, padahal penyebabnya adalah pihak ekspedisi. ${Q}`, [
    ['Mendengarkan keluhannya, meminta maaf atas ketidaknyamanan, menjelaskan solusi, dan memantau pengirimannya.', { orientasi_pelayanan: 4, stabilitas_emosi: 4 }],
    ['Menjelaskan bahwa itu kesalahan ekspedisi, bukan perusahaan.', { orientasi_pelayanan: 1, stabilitas_emosi: 2 }],
    ['Memberikan nomor kontak ekspedisi agar ia menghubungi sendiri.', { orientasi_pelayanan: 1, stabilitas_emosi: 2 }],
    ['Membalas dengan nada tinggi agar ia berhenti marah.', { orientasi_pelayanan: 0, stabilitas_emosi: 0 }],
  ]),
  sjt('SJT-05', 'kepemimpinan', 'sulit', `Anda ditunjuk memimpin tim baru yang anggotanya lebih senior dan tampak meragukan Anda. ${Q}`, [
    ['Mengajak diskusi, mendengarkan pengalaman mereka, menyepakati tujuan bersama, dan menunjukkan hasil kerja.', { kepemimpinan: 4, komunikasi: 4, kerja_tim: 3 }],
    ['Menegaskan bahwa Anda adalah pemimpin dan semua harus patuh.', { kepemimpinan: 1, komunikasi: 1, kerja_tim: 0 }],
    ['Menyerahkan pengambilan keputusan sepenuhnya kepada anggota senior.', { kepemimpinan: 1, komunikasi: 2, kerja_tim: 2 }],
    ['Meminta atasan mengganti anggota tim.', { kepemimpinan: 0, komunikasi: 0, kerja_tim: 0 }],
  ]),
  sjt('SJT-06', 'komunikasi', 'sedang', `Anda belum memahami instruksi atasan tentang tugas penting, sementara atasan terlihat sangat sibuk. ${Q}`, [
    ['Mencatat poin yang belum jelas lalu meminta waktu singkat untuk konfirmasi.', { komunikasi: 4, tanggung_jawab: 4 }],
    ['Mengerjakan sesuai tebakan sendiri.', { komunikasi: 1, tanggung_jawab: 1 }],
    ['Bertanya kepada rekan yang belum tentu tahu.', { komunikasi: 2, tanggung_jawab: 2 }],
    ['Menunggu sampai atasan menanyakan perkembangan.', { komunikasi: 0, tanggung_jawab: 0 }],
  ]),
  sjt('SJT-07', 'tanggung_jawab', 'sedang', `Anda menyadari ada kesalahan data pada laporan yang sudah dikirim ke klien. ${Q}`, [
    ['Segera memberi tahu atasan, mengirim koreksi kepada klien, dan mencegah kesalahan serupa.', { tanggung_jawab: 4, integritas: 4 }],
    ['Memperbaiki diam-diam di versi berikutnya tanpa memberi tahu.', { tanggung_jawab: 2, integritas: 1 }],
    ['Menunggu apakah klien menyadarinya.', { tanggung_jawab: 1, integritas: 1 }],
    ['Menyalahkan tim lain yang memberi data.', { tanggung_jawab: 0, integritas: 0 }],
  ]),
  sjt('SJT-08', 'adaptabilitas', 'sedang', `Perusahaan mengganti aplikasi kerja yang sudah Anda kuasai dengan sistem baru. ${Q}`, [
    ['Mempelajari sistem baru secara aktif dan membantu rekan yang kesulitan.', { adaptabilitas: 4, kerja_tim: 4 }],
    ['Mempelajarinya hanya ketika diwajibkan.', { adaptabilitas: 2, kerja_tim: 2 }],
    ['Tetap menggunakan cara lama selama masih bisa.', { adaptabilitas: 1, kerja_tim: 1 }],
    ['Mengeluh dan mengajak rekan menolak perubahan.', { adaptabilitas: 0, kerja_tim: 0 }],
  ]),
  sjt('SJT-09', 'stabilitas_emosi', 'sedang', `Ide Anda dikritik keras dalam rapat di depan banyak orang. ${Q}`, [
    ['Mendengarkan dengan tenang, mengambil poin yang berguna, dan menanggapi secara objektif.', { stabilitas_emosi: 4, komunikasi: 4 }],
    ['Membela ide dengan nada tinggi.', { stabilitas_emosi: 1, komunikasi: 1 }],
    ['Diam saja lalu mengurangi kontribusi di rapat berikutnya.', { stabilitas_emosi: 1, komunikasi: 0 }],
    ['Membalas dengan mengkritik ide orang tersebut.', { stabilitas_emosi: 0, komunikasi: 0 }],
  ]),
  sjt('SJT-10', 'integritas', 'sulit', `Seorang vendor menawarkan voucher liburan jika Anda memenangkan tendernya. ${Q}`, [
    ['Menolak dengan sopan dan melaporkan tawaran tersebut sesuai kebijakan perusahaan.', { integritas: 4 }],
    ['Menolak tanpa melaporkan.', { integritas: 3 }],
    ['Menerima namun tetap berusaha menilai secara objektif.', { integritas: 1 }],
    ['Menerima dan memenangkan vendor tersebut.', { integritas: 0 }],
  ]),
  sjt('SJT-11', 'kerja_tim', 'sedang', `Dua rekan di tim Anda berselisih sehingga suasana kerja menjadi tidak nyaman. ${Q}`, [
    ['Mengajak keduanya berbicara untuk mencari titik temu demi tujuan tim.', { kerja_tim: 4, komunikasi: 3, kepemimpinan: 3 }],
    ['Membiarkan karena bukan urusan Anda.', { kerja_tim: 1, komunikasi: 0, kepemimpinan: 0 }],
    ['Memihak rekan yang lebih dekat dengan Anda.', { kerja_tim: 0, komunikasi: 1, kepemimpinan: 0 }],
    ['Melaporkan ke atasan tanpa mencoba membantu.', { kerja_tim: 2, komunikasi: 2, kepemimpinan: 1 }],
  ]),
  sjt('SJT-12', 'toleransi_tekanan', 'sedang', `Target penjualan bulan ini dinaikkan 30% secara mendadak. ${Q}`, [
    ['Menganalisis peluang, menyusun strategi baru, dan memantau kemajuan secara rutin.', { toleransi_tekanan: 4, motivasi_berprestasi: 4 }],
    ['Bekerja seperti biasa dan berharap target tercapai.', { toleransi_tekanan: 2, motivasi_berprestasi: 1 }],
    ['Memprotes kebijakan kepada manajemen.', { toleransi_tekanan: 1, motivasi_berprestasi: 1 }],
    ['Mulai mencari pekerjaan lain.', { toleransi_tekanan: 0, motivasi_berprestasi: 0 }],
  ]),
  sjt('SJT-13', 'orientasi_pelayanan', 'sulit', `Pelanggan meminta layanan di luar prosedur standar yang dapat merugikan perusahaan. ${Q}`, [
    ['Menolak dengan sopan, menjelaskan alasannya, dan menawarkan alternatif sesuai prosedur.', { orientasi_pelayanan: 4, integritas: 4 }],
    ['Menuruti permintaannya agar pelanggan puas.', { orientasi_pelayanan: 2, integritas: 0 }],
    ['Menolak tanpa penjelasan.', { orientasi_pelayanan: 0, integritas: 3 }],
    ['Melempar permintaan itu ke rekan lain.', { orientasi_pelayanan: 1, integritas: 2 }],
  ]),
  sjt('SJT-14', 'motivasi_berprestasi', 'sedang', `Anda mencapai target bulan ini seminggu lebih cepat. ${Q}`, [
    ['Menggunakan waktu tersisa untuk meningkatkan kualitas atau membantu target tim.', { motivasi_berprestasi: 4, kerja_tim: 4 }],
    ['Bersantai karena target sudah tercapai.', { motivasi_berprestasi: 1, kerja_tim: 1 }],
    ['Mengerjakan tugas rutin seperti biasa.', { motivasi_berprestasi: 2, kerja_tim: 2 }],
    ['Menahan sebagian hasil untuk dilaporkan bulan depan.', { motivasi_berprestasi: 1, kerja_tim: 0 }],
  ]),
  sjt('SJT-15', 'kepemimpinan', 'sedang', `Anda melihat proses kerja di divisi tidak efisien dan memakan banyak waktu. ${Q}`, [
    ['Menyusun usulan perbaikan berbasis data dan mendiskusikannya dengan atasan.', { kepemimpinan: 4, komunikasi: 3, kerja_tim: 3 }],
    ['Mengeluhkannya kepada rekan kerja.', { kepemimpinan: 0, komunikasi: 1, kerja_tim: 1 }],
    ['Mengubah prosesnya sendiri tanpa koordinasi.', { kepemimpinan: 2, komunikasi: 0, kerja_tim: 0 }],
    ['Mengikuti saja karena sudah menjadi aturan.', { kepemimpinan: 1, komunikasi: 1, kerja_tim: 2 }],
  ]),
  sjt('SJT-16', 'tanggung_jawab', 'sulit', `Anda sakit di hari presentasi penting yang sudah Anda siapkan. ${Q}`, [
    ['Segera memberi kabar, menyerahkan materi dan catatan kepada rekan yang dapat menggantikan.', { tanggung_jawab: 4, komunikasi: 4 }],
    ['Memaksakan diri datang walau kondisi buruk.', { tanggung_jawab: 2, komunikasi: 1 }],
    ['Tidak memberi kabar dan berharap acara ditunda.', { tanggung_jawab: 0, komunikasi: 0 }],
    ['Meminta presentasi ditunda tanpa menyiapkan pengganti.', { tanggung_jawab: 1, komunikasi: 2 }],
  ]),
  sjt('SJT-17', 'integritas', 'sedang', `Atasan meminta Anda mengubah data laporan agar kinerja divisi terlihat lebih baik. ${Q}`, [
    ['Menolak dengan sopan, menjelaskan risikonya, dan menawarkan penyajian data apa adanya disertai rencana perbaikan.', { integritas: 4, komunikasi: 4 }],
    ['Menurutinya karena itu perintah atasan.', { integritas: 0, komunikasi: 1 }],
    ['Menurutinya sebagian saja.', { integritas: 1, komunikasi: 1 }],
    ['Menolak lalu langsung mengundurkan diri.', { integritas: 3, komunikasi: 0 }],
  ]),
  sjt('SJT-18', 'toleransi_tekanan', 'sulit', `Sistem mengalami error tepat saat banyak pelanggan menunggu layanan Anda. ${Q}`, [
    ['Tetap tenang, menginformasikan pelanggan, menjalankan prosedur darurat, dan melapor ke tim IT.', { toleransi_tekanan: 4, orientasi_pelayanan: 4 }],
    ['Meminta semua pelanggan kembali besok.', { toleransi_tekanan: 1, orientasi_pelayanan: 0 }],
    ['Panik dan menunggu sampai sistem pulih sendiri.', { toleransi_tekanan: 0, orientasi_pelayanan: 1 }],
    ['Melayani secara manual tanpa mencatat transaksi.', { toleransi_tekanan: 2, orientasi_pelayanan: 2 }],
  ]),
  sjt('SJT-19', 'kerja_tim', 'sulit', `Hasil kerja Anda diakui atasan sebagai hasil kerja rekan lain. ${Q}`, [
    ['Membicarakannya baik-baik dengan rekan tersebut, lalu mengklarifikasi kepada atasan secara profesional dengan bukti.', { kerja_tim: 3, komunikasi: 4, stabilitas_emosi: 4 }],
    ['Membiarkannya demi menjaga hubungan.', { kerja_tim: 2, komunikasi: 1, stabilitas_emosi: 2 }],
    ['Menceritakannya kepada rekan-rekan lain.', { kerja_tim: 0, komunikasi: 0, stabilitas_emosi: 1 }],
    ['Menolak bekerja sama dengan rekan itu di proyek berikutnya.', { kerja_tim: 0, komunikasi: 1, stabilitas_emosi: 0 }],
  ]),
  sjt('SJT-20', 'adaptabilitas', 'sulit', `Anda dipindahkan ke divisi baru dengan tugas yang sama sekali berbeda. ${Q}`, [
    ['Mempelajari tugas baru, meminta bimbingan, dan menetapkan target belajar.', { adaptabilitas: 4, motivasi_berprestasi: 4 }],
    ['Menerima namun bekerja dengan setengah hati.', { adaptabilitas: 1, motivasi_berprestasi: 0 }],
    ['Meminta dikembalikan ke divisi lama.', { adaptabilitas: 0, motivasi_berprestasi: 1 }],
    ['Menunggu pelatihan formal sebelum mulai bekerja.', { adaptabilitas: 2, motivasi_berprestasi: 2 }],
  ]),
  sjt('SJT-21', 'komunikasi', 'sulit', `Anda harus menyampaikan kepada klien bahwa proyek akan terlambat. ${Q}`, [
    ['Menghubungi klien lebih awal, menjelaskan penyebab, rencana pemulihan, dan jadwal baru.', { komunikasi: 4, integritas: 4, orientasi_pelayanan: 4 }],
    ['Menyampaikan mendekati tenggat agar keluhan tidak muncul lebih awal.', { komunikasi: 1, integritas: 1, orientasi_pelayanan: 1 }],
    ['Meminta rekan lain yang menyampaikan.', { komunikasi: 1, integritas: 2, orientasi_pelayanan: 1 }],
    ['Tidak memberi kabar dan berusaha mengejar ketertinggalan.', { komunikasi: 0, integritas: 0, orientasi_pelayanan: 0 }],
  ]),
  sjt('SJT-22', 'orientasi_pelayanan', 'mudah', `Pelanggan bertanya tentang produk yang bukan bidang Anda. ${Q}`, [
    ['Menghubungkannya dengan petugas yang tepat dan memastikan ia terlayani.', { orientasi_pelayanan: 4 }],
    ['Menjawab sebisanya walau tidak yakin.', { orientasi_pelayanan: 1 }],
    ['Mengatakan bahwa itu bukan bagian Anda.', { orientasi_pelayanan: 0 }],
    ['Menyarankan ia mencari informasi di situs web.', { orientasi_pelayanan: 2 }],
  ]),
  sjt('SJT-23', 'kepemimpinan', 'sulit', `Tim yang Anda pimpin gagal mencapai target kuartal ini. ${Q}`, [
    ['Mengevaluasi bersama tim, mengakui kekurangan, dan menyusun rencana perbaikan yang jelas.', { kepemimpinan: 4, tanggung_jawab: 4 }],
    ['Menyalahkan anggota tim yang kinerjanya rendah.', { kepemimpinan: 0, tanggung_jawab: 0 }],
    ['Menunggu arahan dari atasan.', { kepemimpinan: 1, tanggung_jawab: 2 }],
    ['Mengambil alih semua pekerjaan sendiri.', { kepemimpinan: 1, tanggung_jawab: 3 }],
  ]),
  sjt('SJT-24', 'integritas', 'mudah', `Anda menemukan dompet berisi uang di area kantor. ${Q}`, [
    ['Menyerahkannya ke bagian keamanan/HR atau langsung kepada pemiliknya.', { integritas: 4 }],
    ['Mengambil uangnya lalu mengembalikan dompetnya.', { integritas: 0 }],
    ['Membiarkannya di tempat.', { integritas: 2 }],
    ['Menyimpannya dulu sambil menunggu ada yang mencari.', { integritas: 3 }],
  ]),
  sjt('SJT-25', 'tanggung_jawab', 'mudah', `Anda diberi tugas yang belum pernah dikerjakan dengan tenggat dua hari. ${Q}`, [
    ['Menerima, mempelajari kebutuhan tugas, dan bertanya jika ada hal yang belum jelas.', { tanggung_jawab: 4, adaptabilitas: 4 }],
    ['Menolak karena belum berpengalaman.', { tanggung_jawab: 1, adaptabilitas: 0 }],
    ['Menerima lalu menunda hingga hari terakhir.', { tanggung_jawab: 0, adaptabilitas: 1 }],
    ['Meminta rekan mengerjakannya.', { tanggung_jawab: 1, adaptabilitas: 1 }],
  ]),
]
