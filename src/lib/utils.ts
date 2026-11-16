import clsx, { type ClassValue } from 'clsx'
import type { Dimension, Difficulty, QuestionType, SectionType } from './types'

export const cn = (...c: ClassValue[]) => clsx(c)

export const TYPE_LABEL: Record<SectionType, string> = {
  cognitive: 'Kognitif (Pilihan Ganda)',
  likert: 'Kepribadian (Skala Likert)',
  sjt: 'Situational Judgment',
  kraepelin: 'Kraepelin / Pauli',
}
export const TYPE_SHORT: Record<SectionType, string> = {
  cognitive: 'Kognitif',
  likert: 'Likert',
  sjt: 'SJT',
  kraepelin: 'Kraepelin',
}
export const DIFF_LABEL: Record<Difficulty, string> = { mudah: 'Mudah', sedang: 'Sedang', sulit: 'Sulit' }
export const DIFF_COLOR: Record<Difficulty, string> = {
  mudah: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  sedang: 'bg-amber-50 text-amber-700 ring-amber-200',
  sulit: 'bg-rose-50 text-rose-700 ring-rose-200',
}
export const GROUP_LABEL: Record<string, string> = {
  kognitif: 'Kemampuan Kognitif',
  kinerja: 'Sikap Kerja (Kraepelin)',
  kepribadian: 'Kepribadian & Sikap Kerja',
  validitas: 'Validitas Jawaban',
}

/** Grup dimensi yang relevan untuk tipe soal tertentu. */
export function groupsForType(t: QuestionType | SectionType): string[] {
  if (t === 'cognitive') return ['kognitif']
  if (t === 'kraepelin') return ['kinerja']
  return ['kepribadian', 'validitas']
}

export type Level = 'rendah' | 'sedang' | 'tinggi'
export function levelOf(pct: number | null | undefined, d?: Pick<Dimension, 'low_threshold' | 'high_threshold'>): Level {
  const p = pct ?? 0
  const lo = d?.low_threshold ?? 40
  const hi = d?.high_threshold ?? 70
  return p >= hi ? 'tinggi' : p >= lo ? 'sedang' : 'rendah'
}
export const LEVEL_LABEL: Record<Level, string> = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi' }

/** Warna "baik/buruk" mempertimbangkan arah dimensi. */
export function goodness(pct: number | null | undefined, d?: Partial<Dimension>): 'good' | 'mid' | 'bad' {
  const lvl = levelOf(pct, d as any)
  const better = d?.higher_is_better !== false
  if (lvl === 'sedang') return 'mid'
  return (lvl === 'tinggi') === better ? 'good' : 'bad'
}
export const GOOD_TEXT = { good: 'text-emerald-600', mid: 'text-amber-600', bad: 'text-rose-600' }
export const GOOD_BG = { good: 'bg-emerald-500', mid: 'bg-amber-500', bad: 'bg-rose-500' }
export const GOOD_SOFT = {
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  mid: 'bg-amber-50 text-amber-700 ring-amber-200',
  bad: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export function interpret(pct: number | null | undefined, d?: Partial<Dimension>) {
  const lvl = levelOf(pct, d as any)
  return lvl === 'tinggi' ? d?.interp_high : lvl === 'sedang' ? d?.interp_mid : d?.interp_low
}

export const REC_STYLE: Record<string, string> = {
  'Sangat Direkomendasikan': 'bg-emerald-600 text-white',
  Direkomendasikan: 'bg-emerald-100 text-emerald-800',
  Dipertimbangkan: 'bg-amber-100 text-amber-800',
  'Tidak Direkomendasikan': 'bg-rose-100 text-rose-800',
  'Perlu Verifikasi': 'bg-violet-100 text-violet-800',
  'Belum Dapat Dinilai': 'bg-slate-100 text-slate-700',
}

export function fmtDate(d?: string | null, withTime = true) {
  if (!d) return '-'
  return new Date(d).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}
export function fmtDuration(sec?: number | null) {
  if (sec == null) return '-'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h) return `${h}j ${m}m`
  if (m) return `${m}m ${s}d`
  return `${s}d`
}
export function fmtClock(sec: number) {
  const s = Math.max(0, Math.ceil(sec))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
export const round1 = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? '-' : (Math.round(n * 10) / 10).toString())

export function genCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
export const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 9)}`

export function downloadFile(name: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
export function toCSV(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((r) => r.map((v) => {
      const s = v == null ? '' : String(v)
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(','))
    .join('\n')
}

export const testLink = (code: string) => `${window.location.origin}/t/${code}`
