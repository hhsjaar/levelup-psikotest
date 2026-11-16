import { verbal, numerik, logika, figural } from './kognitif.js'
import { likert, situasional } from './kepribadian.js'
export { dimensions } from './dimensions.js'

export const questionBank = [...verbal, ...numerik, ...logika, ...figural, ...likert, ...situasional]

/** Paket tes contoh yang langsung bisa dipakai (kode akses: DEMO2026). */
export const sampleTest = {
  title: 'Psikotes Rekrutmen Karyawan – Standar',
  description:
    'Paket psikotes lengkap untuk seleksi karyawan: kemampuan kognitif, tes ketahanan kerja (Kraepelin), inventori kepribadian kerja, dan situational judgment.',
  instructions:
    'Kerjakan dengan jujur dan sungguh-sungguh. Pastikan koneksi internet stabil dan Anda berada di tempat yang tenang. Jangan berpindah tab/jendela selama tes berlangsung.',
  access_code: 'DEMO2026',
  is_active: true,
  settings: {
    allow_back: true,
    show_result: 'summary',
    max_tab_switches: 3,
    auto_submit_on_violation: false,
    max_attempts: 0,
    require_fields: ['email', 'phone', 'position'],
    passing_score: 60,
    thresholds: { sangat: 80, rekomendasi: 65, pertimbangan: 50 },
    lie_threshold: 70,
    min_seconds_per_item: 2,
    dimension_weights: {},
  },
  sections: [
    {
      id: 'sec-verbal', title: 'Tes Kemampuan Verbal', type: 'cognitive', selection: 'random',
      categories: ['verbal'], question_count: 10, count_per_category: false,
      difficulty_counts: { mudah: 3, sedang: 4, sulit: 3 }, points: { mudah: 1, sedang: 2, sulit: 3 },
      negative_marking: 0, time_limit_sec: 480, shuffle_questions: true, shuffle_options: true,
      instructions: 'Pilih satu jawaban yang paling tepat. Waktu terbatas, kerjakan yang mudah terlebih dahulu.',
    },
    {
      id: 'sec-numerik', title: 'Tes Kemampuan Numerik', type: 'cognitive', selection: 'random',
      categories: ['numerik'], question_count: 10, count_per_category: false,
      difficulty_counts: { mudah: 3, sedang: 4, sulit: 3 }, points: { mudah: 1, sedang: 2, sulit: 3 },
      negative_marking: 0, time_limit_sec: 600, shuffle_questions: true, shuffle_options: true,
      instructions: 'Hitung dengan teliti. Anda boleh menggunakan kertas buram, tetapi tidak menggunakan kalkulator.',
    },
    {
      id: 'sec-logika', title: 'Penalaran Logis & Figural', type: 'cognitive', selection: 'random',
      categories: ['logika', 'figural'], question_count: 6, count_per_category: true,
      difficulty_counts: { mudah: 1, sedang: 3, sulit: 2 }, points: { mudah: 1, sedang: 2, sulit: 3 },
      negative_marking: 0, time_limit_sec: 720, shuffle_questions: true, shuffle_options: true,
      instructions: 'Perhatikan pola, aturan, dan hubungan antar informasi sebelum menjawab.',
    },
    {
      id: 'sec-kraepelin', title: 'Tes Ketahanan Kerja (Kraepelin)', type: 'kraepelin',
      kraepelin: { columns: 15, rows: 26, seconds_per_column: 15, target_per_column: 14 },
      instructions:
        'Jumlahkan dua angka yang berdekatan, lalu tuliskan HANYA angka satuannya (contoh: 7 + 8 = 15 → ketik 5). Setiap lajur memiliki batas waktu; saat waktu habis Anda otomatis pindah ke lajur berikutnya. Kerjakan secepat dan seteliti mungkin.',
    },
    {
      id: 'sec-kepribadian', title: 'Inventori Sikap & Kepribadian Kerja', type: 'likert', selection: 'random',
      categories: ['tingkat_stres', 'toleransi_tekanan', 'stabilitas_emosi', 'kerja_tim', 'integritas', 'tanggung_jawab', 'adaptabilitas', 'komunikasi', 'kepemimpinan', 'motivasi_berprestasi', 'orientasi_pelayanan', 'desirabilitas_sosial'],
      question_count: 6, count_per_category: true, time_limit_sec: 1200, shuffle_questions: true, shuffle_options: false,
      instructions: 'Tidak ada jawaban benar atau salah. Pilih respons yang paling menggambarkan diri Anda yang sebenarnya, bukan yang Anda anggap ideal.',
    },
    {
      id: 'sec-sjt', title: 'Situational Judgment Test', type: 'sjt', selection: 'random',
      categories: [], question_count: 10, count_per_category: false, time_limit_sec: 900,
      shuffle_questions: true, shuffle_options: true,
      instructions: 'Bacalah setiap situasi kerja, lalu pilih tindakan yang PALING mungkin Anda lakukan.',
    },
  ],
}
