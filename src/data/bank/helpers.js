// Helper pembuat soal. Dipakai oleh aplikasi (import bank soal) dan oleh scripts/build-sql.mjs.
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f']

/**
 * Soal kognitif pilihan ganda. Tandai jawaban benar dengan awalan "*".
 * mc('VRB-001', 'verbal', 'mudah', 'Sinonim ...', ['*Teliti', 'Cepat', ...], 'penjelasan')
 */
export function mc(code, category, difficulty, prompt, choices, explanation = '', stimulus = null) {
  const options = choices.map((raw, i) => {
    const correct = raw.startsWith('*')
    const text = correct ? raw.slice(1) : raw
    return correct
      ? { id: LETTERS[i], text, correct: true, scores: { [category]: 1 } }
      : { id: LETTERS[i], text }
  })
  if (options.filter((o) => o.correct).length !== 1) {
    throw new Error(`Soal ${code} harus memiliki tepat satu jawaban benar`)
  }
  return { code, type: 'cognitive', category, difficulty, prompt, stimulus, explanation, options, meta: {} }
}

export const LIKERT_LABELS = ['Sangat Tidak Sesuai', 'Tidak Sesuai', 'Netral', 'Sesuai', 'Sangat Sesuai']

/** Opsi skala Likert 1-5. reverse = item unfavorable (skor dibalik). */
export function likertOptions(category, reverse = false) {
  return LIKERT_LABELS.map((text, i) => ({
    id: String(i + 1),
    text,
    scores: { [category]: reverse ? 5 - i : i + 1 },
  }))
}

/** Item kepribadian/sikap kerja skala Likert. pair = kode pasangan untuk cek konsistensi. */
export function lk(code, category, prompt, opts = {}) {
  const { reverse = false, pair = null } = opts
  return {
    code,
    type: 'likert',
    category,
    difficulty: 'sedang',
    prompt,
    stimulus: null,
    explanation: '',
    options: likertOptions(category, reverse),
    meta: { reverse, ...(pair ? { pair } : {}) },
  }
}

/** Situational Judgment Test. opts: [[teks, {dimensi: skor 0-4}], ...] */
export function sjt(code, category, difficulty, prompt, opts) {
  return {
    code,
    type: 'sjt',
    category,
    difficulty,
    prompt,
    stimulus: null,
    explanation: '',
    options: opts.map(([text, scores], i) => ({ id: LETTERS[i], text, scores: { [category]: 0, ...scores } })),
    meta: {},
  }
}
