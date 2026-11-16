import { Reorder } from 'framer-motion'
import { AlertTriangle, ArrowLeft, Brain, ChevronDown, Clock, Copy, GripVertical, Layers, ListChecks, Plus, RefreshCw, Save, Scale, Settings2, ShieldCheck, Shuffle, Timer, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge, Button, Card, CardHeader, Field, Input, Modal, PageLoader, Select, Switch, Tabs, Textarea } from '../../components/ui'
import { useDimensions } from '../../hooks/useDimensions'
import { errMsg, supabase } from '../../lib/supabase'
import type { Difficulty, Question, Section, SectionType, Test } from '../../lib/types'
import { DIFF_LABEL, TYPE_LABEL, TYPE_SHORT, cn, fmtDuration, genCode, groupsForType, testLink, uid } from '../../lib/utils'
import { sectionTime } from './Tests'

const DIFFS: Difficulty[] = ['mudah', 'sedang', 'sulit']
const TYPE_ICON: Record<SectionType, any> = { cognitive: Brain, likert: ListChecks, sjt: Scale, kraepelin: Timer }
const REQ_FIELDS = [
  ['email', 'Email'], ['phone', 'No. HP'], ['position', 'Posisi dilamar'], ['education', 'Pendidikan'], ['age', 'Usia'], ['gender', 'Jenis kelamin'],
]

function newSection(type: SectionType): Section {
  const base = { id: uid('sec'), type, shuffle_questions: true, shuffle_options: type !== 'likert', selection: 'random' as const }
  if (type === 'kraepelin') return { ...base, title: 'Tes Ketahanan Kerja (Kraepelin)', kraepelin: { columns: 15, rows: 26, seconds_per_column: 15, target_per_column: 14 }, instructions: 'Jumlahkan dua angka berdekatan dan ketik angka satuannya. Kerjakan secepat dan seteliti mungkin.' }
  if (type === 'cognitive') return { ...base, title: 'Tes Kemampuan Kognitif', categories: ['verbal'], question_count: 10, difficulty_counts: { mudah: 3, sedang: 4, sulit: 3 }, points: { mudah: 1, sedang: 2, sulit: 3 }, negative_marking: 0, time_limit_sec: 600, instructions: 'Pilih satu jawaban yang paling tepat.' }
  if (type === 'likert') return { ...base, title: 'Inventori Kepribadian Kerja', categories: ['tingkat_stres', 'toleransi_tekanan', 'kerja_tim', 'integritas', 'desirabilitas_sosial'], question_count: 6, count_per_category: true, time_limit_sec: 900, instructions: 'Tidak ada jawaban benar atau salah. Jawablah sesuai diri Anda yang sebenarnya.' }
  return { ...base, title: 'Situational Judgment Test', categories: [], question_count: 10, time_limit_sec: 900, instructions: 'Pilih tindakan yang paling mungkin Anda lakukan.' }
}

const DEFAULT_TEST: Omit<Test, 'id'> = {
  title: 'Paket Tes Baru', description: '', instructions: 'Kerjakan dengan jujur dan sungguh-sungguh. Pastikan koneksi internet stabil.',
  access_code: genCode(), is_active: true, starts_at: null, ends_at: null, sections: [],
  settings: {
    allow_back: true, show_result: 'none', max_tab_switches: 3, auto_submit_on_violation: false, max_attempts: 1,
    require_fields: ['email', 'phone', 'position'], passing_score: 60, thresholds: { sangat: 80, rekomendasi: 65, pertimbangan: 50 },
    lie_threshold: 70, validity_downgrade: true, min_seconds_per_item: 2, dimension_weights: {},
  },
}

type Bank = Pick<Question, 'id' | 'code' | 'type' | 'category' | 'difficulty' | 'prompt' | 'is_active'>

export default function TestEditor() {
  const { id = 'new' } = useParams()
  const nav = useNavigate()
  const isNew = id === 'new'
  const [test, setTest] = useState<any>(isNew ? { ...DEFAULT_TEST, sections: [newSection('cognitive')] } : null)
  const [bank, setBank] = useState<Bank[]>([])
  const [tab, setTab] = useState<'umum' | 'subtes' | 'penilaian' | 'keamanan'>('subtes')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const { dims } = useDimensions()

  useEffect(() => {
    if (!isNew) supabase.from('tests').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) { toast.error(errMsg(error)); nav('/admin/tests') } else setTest(data)
    })
    supabase.from('questions').select('id,code,type,category,difficulty,prompt,is_active').eq('is_active', true).limit(5000)
      .then(({ data }) => setBank((data as any) || []))
  }, [id])

  const avail = useMemo(() => {
    const m: Record<string, number> = {}
    for (const q of bank) {
      for (const k of [`${q.type}`, `${q.type}|${q.category}`, `${q.type}|${q.category}|${q.difficulty}`, `${q.type}||${q.difficulty}`]) m[k] = (m[k] || 0) + 1
    }
    return m
  }, [bank])

  if (!test) return <PageLoader />
  const set = (patch: any) => setTest((t: any) => ({ ...t, ...patch }))
  const setS = (patch: any) => setTest((t: any) => ({ ...t, settings: { ...t.settings, ...patch } }))
  const sections: Section[] = test.sections
  const setSections = (s: Section[]) => set({ sections: s })
  const updSection = (sid: string, patch: Partial<Section>) => setSections(sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)))

  const countOf = (s: Section) => {
    if (s.type === 'kraepelin') return 0
    if (s.selection === 'manual') return s.question_ids?.length || 0
    const per = DIFFS.reduce((a, d) => a + (Number(s.difficulty_counts?.[d]) || 0), 0)
    const n = s.type === 'cognitive' && per > 0 ? per : Number(s.question_count) || 0
    return n * (s.count_per_category && s.categories?.length ? s.categories.length : 1)
  }
  const totalQ = sections.reduce((a, s) => a + countOf(s), 0)
  const totalT = sections.reduce((a, s) => a + sectionTime(s), 0)

  const measuredDims = (() => {
    const keys = new Set<string>()
    for (const s of sections) {
      if (s.type === 'kraepelin') ['kecepatan_kerja', 'ketelitian_kerja', 'stabilitas_kerja', 'ketahanan_kerja'].forEach((k) => keys.add(k))
      else if (s.type === 'sjt' && !s.categories?.length) dims.filter((d) => d.group_name === 'kepribadian').forEach((d) => keys.add(d.key))
      else if (s.selection === 'manual') bank.filter((q) => s.question_ids?.includes(q.id)).forEach((q) => keys.add(q.category))
      else s.categories?.forEach((c) => keys.add(c))
      if (s.type === 'likert') keys.add('konsistensi')
    }
    return dims.filter((d) => keys.has(d.key))
  })()

  async function save() {
    if (!test.title?.trim()) return toast.error('Judul paket wajib diisi')
    if (!test.access_code?.trim()) return toast.error('Kode akses wajib diisi')
    if (!sections.length) return toast.error('Tambahkan minimal satu subtes')
    setSaving(true)
    const payload = { ...test, access_code: test.access_code.trim().toUpperCase() }
    delete payload.id; delete payload.created_at; delete payload.updated_at
    const q = isNew ? supabase.from('tests').insert(payload).select().single() : supabase.from('tests').update(payload).eq('id', id).select().single()
    const { data, error } = await q
    setSaving(false)
    if (error) return toast.error(/duplicate key/.test(error.message) ? 'Kode akses sudah dipakai paket lain' : errMsg(error))
    toast.success('Paket tes tersimpan')
    if (isNew) nav(`/admin/tests/${data.id}`, { replace: true })
    else setTest(data)
  }

  async function rescore() {
    const { data, error } = await supabase.rpc('rescore_test', { p_test: id })
    if (error) return toast.error(errMsg(error))
    toast.success(`${data} hasil peserta dihitung ulang dengan pengaturan terbaru`)
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/tests" className="grid size-10 place-items-center rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-50"><ArrowLeft className="size-4" /></Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{isNew ? 'Paket Tes Baru' : test.title}</h1>
            <p className="text-sm text-slate-500">{sections.length} subtes · {totalQ} soal{sections.some((s) => s.type === 'kraepelin') ? ' + Kraepelin' : ''} · ± {fmtDuration(totalT)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && <Button variant="secondary" onClick={rescore} icon={<RefreshCw className="size-4" />} title="Hitung ulang skor semua peserta">Hitung Ulang</Button>}
          <Button onClick={save} loading={saving} icon={<Save className="size-4" />}>Simpan</Button>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} className="mb-6" tabs={[
        { value: 'subtes', label: 'Subtes & Soal', icon: <Layers className="size-4" /> },
        { value: 'umum', label: 'Informasi Umum', icon: <Settings2 className="size-4" /> },
        { value: 'penilaian', label: 'Penilaian', icon: <Scale className="size-4" /> },
        { value: 'keamanan', label: 'Aturan & Keamanan', icon: <ShieldCheck className="size-4" /> },
      ]} />

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          {tab === 'umum' && (
            <Card className="space-y-5 p-5 sm:p-6">
              <Field label="Judul paket tes" required><Input value={test.title} onChange={(e) => set({ title: e.target.value })} /></Field>
              <Field label="Deskripsi"><Textarea value={test.description || ''} onChange={(e) => set({ description: e.target.value })} placeholder="Ditampilkan di halaman awal peserta" /></Field>
              <Field label="Petunjuk umum"><Textarea rows={4} value={test.instructions || ''} onChange={(e) => set({ instructions: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Kode akses" hint="Peserta memasukkan kode ini atau membuka link tes.">
                  <div className="flex gap-2">
                    <Input value={test.access_code} onChange={(e) => set({ access_code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} className="font-bold tracking-wider" />
                    <Button variant="secondary" type="button" onClick={() => set({ access_code: genCode() })} title="Buat kode acak"><Shuffle className="size-4" /></Button>
                  </div>
                </Field>
                <Field label="Status"><div className="pt-2"><Switch checked={test.is_active} onChange={(v) => set({ is_active: v })} label={test.is_active ? 'Aktif – dapat dikerjakan' : 'Nonaktif'} /></div></Field>
                <Field label="Dibuka mulai" hint="Kosongkan jika tanpa batas"><Input type="datetime-local" value={toLocal(test.starts_at)} onChange={(e) => set({ starts_at: fromLocal(e.target.value) })} /></Field>
                <Field label="Ditutup pada" hint="Kosongkan jika tanpa batas"><Input type="datetime-local" value={toLocal(test.ends_at)} onChange={(e) => set({ ends_at: fromLocal(e.target.value) })} /></Field>
              </div>
            </Card>
          )}

          {tab === 'subtes' && (
            <>
              <Reorder.Group axis="y" values={sections} onReorder={setSections} className="space-y-3">
                {sections.map((s, i) => (
                  <Reorder.Item key={s.id} value={s} className="list-none">
                    <SectionCard
                      s={s} index={i} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)}
                      onChange={(p) => updSection(s.id, p)} onRemove={() => setSections(sections.filter((x) => x.id !== s.id))}
                      onDuplicate={() => setSections([...sections.slice(0, i + 1), { ...s, id: uid('sec'), title: `${s.title} (2)` }, ...sections.slice(i + 1)])}
                      dims={dims} avail={avail} bank={bank} count={countOf(s)}
                    />
                  </Reorder.Item>
                ))}
              </Reorder.Group>
              <button onClick={() => setAddOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-5 text-sm font-semibold text-slate-500 transition hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-600">
                <Plus className="size-5" />Tambah Subtes
              </button>
            </>
          )}

          {tab === 'penilaian' && (
            <>
              <Card>
                <CardHeader title="Bobot Aspek untuk Skor Total" subtitle="Skor total (indeks kesesuaian 0–100) = rata-rata tertimbang aspek. Bobot 0 = tidak dihitung. Aspek bertanda ↓ dibalik otomatis (mis. tingkat stres tinggi menurunkan skor)." icon={<Scale className="size-4" />} />
                <div className="divide-y divide-slate-100 px-5 pb-3">
                  {measuredDims.length === 0 && <p className="py-4 text-sm text-slate-500">Tambahkan subtes terlebih dahulu.</p>}
                  {measuredDims.map((d) => {
                    const w = test.settings.dimension_weights?.[d.key] ?? (d.group_name === 'validitas' ? 0 : 1)
                    return (
                      <div key={d.key} className="flex items-center gap-4 py-3">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color || '#6366f1' }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800">{d.name} {d.higher_is_better === false && <span className="text-rose-500">↓</span>}</p>
                          <p className="text-xs text-slate-400">{d.group_name}</p>
                        </div>
                        <input type="range" min={0} max={5} step={0.5} value={w} className="w-28 accent-brand-600 sm:w-44"
                          onChange={(e) => setS({ dimension_weights: { ...test.settings.dimension_weights, [d.key]: Number(e.target.value) } })} />
                        <span className={cn('w-10 text-right text-sm font-bold tabular-nums', w ? 'text-brand-700' : 'text-slate-300')}>{w}×</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
              <Card className="p-5 sm:p-6">
                <h3 className="font-semibold text-slate-900">Ambang Rekomendasi</h3>
                <p className="mt-1 text-sm text-slate-500">Kategori hasil berdasarkan skor total.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-4">
                  <Field label="Sangat direkomendasikan ≥"><Input type="number" min={0} max={100} value={test.settings.thresholds?.sangat ?? 80} onChange={(e) => setS({ thresholds: { ...test.settings.thresholds, sangat: Number(e.target.value) } })} /></Field>
                  <Field label="Direkomendasikan ≥"><Input type="number" min={0} max={100} value={test.settings.thresholds?.rekomendasi ?? 65} onChange={(e) => setS({ thresholds: { ...test.settings.thresholds, rekomendasi: Number(e.target.value) } })} /></Field>
                  <Field label="Dipertimbangkan ≥"><Input type="number" min={0} max={100} value={test.settings.thresholds?.pertimbangan ?? 50} onChange={(e) => setS({ thresholds: { ...test.settings.thresholds, pertimbangan: Number(e.target.value) } })} /></Field>
                  <Field label="Nilai lulus (passing grade)"><Input type="number" min={0} max={100} value={test.settings.passing_score ?? 60} onChange={(e) => setS({ passing_score: Number(e.target.value) })} /></Field>
                </div>
              </Card>
              <Card className="space-y-5 p-5 sm:p-6">
                <h3 className="font-semibold text-slate-900">Validitas & Kejujuran Menjawab</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Batas skor pencitraan (lie scale)" hint="Jika skor ≥ batas ini, hasil ditandai 'faking good'."><Input type="number" min={0} max={100} value={test.settings.lie_threshold ?? 70} onChange={(e) => setS({ lie_threshold: Number(e.target.value) })} /></Field>
                  <Field label="Minimal detik per butir kuesioner" hint="Rata-rata di bawah ini ditandai 'terlalu cepat'."><Input type="number" min={0} step={0.5} value={test.settings.min_seconds_per_item ?? 2} onChange={(e) => setS({ min_seconds_per_item: Number(e.target.value) })} /></Field>
                </div>
                <Switch checked={test.settings.validity_downgrade !== false} onChange={(v) => setS({ validity_downgrade: v })} label="Ubah rekomendasi menjadi 'Perlu Verifikasi' jika terindikasi faking good" />
              </Card>
              <Card className="p-5 sm:p-6">
                <Field label="Hasil yang ditampilkan ke peserta">
                  <Select value={test.settings.show_result || 'none'} onChange={(e) => setS({ show_result: e.target.value })}>
                    <option value="none">Tidak ditampilkan (hanya ucapan terima kasih)</option>
                    <option value="summary">Ringkasan profil aspek (tanpa skor total)</option>
                    <option value="full">Lengkap (profil aspek + skor total)</option>
                  </Select>
                </Field>
              </Card>
            </>
          )}

          {tab === 'keamanan' && (
            <Card className="space-y-6 p-5 sm:p-6">
              <Switch checked={test.settings.allow_back !== false} onChange={(v) => setS({ allow_back: v })} label="Izinkan kembali ke soal sebelumnya" description="Hanya dalam subtes yang sama. Antar subtes tidak dapat kembali." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Batas meninggalkan halaman/tab" hint="0 = tidak dibatasi (tetap dicatat)."><Input type="number" min={0} value={test.settings.max_tab_switches ?? 3} onChange={(e) => setS({ max_tab_switches: Number(e.target.value) })} /></Field>
                <Field label="Maks. percobaan per email" hint="0 = tidak dibatasi."><Input type="number" min={0} value={test.settings.max_attempts ?? 1} onChange={(e) => setS({ max_attempts: Number(e.target.value) })} /></Field>
              </div>
              <Switch checked={!!test.settings.auto_submit_on_violation} onChange={(v) => setS({ auto_submit_on_violation: v })} label="Kumpulkan otomatis jika batas pindah tab terlampaui" />
              <div>
                <p className="text-sm font-medium text-slate-700">Data wajib peserta</p>
                <p className="text-xs text-slate-500">Nama lengkap selalu wajib.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {REQ_FIELDS.map(([k, l]) => {
                    const on = test.settings.require_fields?.includes(k)
                    return (
                      <button key={k} onClick={() => setS({ require_fields: on ? test.settings.require_fields.filter((x: string) => x !== k) : [...(test.settings.require_fields || []), k] })}
                        className={cn('rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition', on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300')}>{l}</button>
                    )
                  })}
                </div>
              </div>
              <Field label="Teks persetujuan peserta"><Textarea value={test.settings.consent_text || ''} onChange={(e) => setS({ consent_text: e.target.value })} placeholder="Kosongkan untuk teks default" /></Field>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5 xl:sticky xl:top-6">
            <h3 className="font-semibold text-slate-900">Ringkasan</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Total soal</p><p className="text-xl font-bold text-slate-900">{totalQ}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Estimasi waktu</p><p className="text-xl font-bold text-slate-900">{fmtDuration(totalT)}</p></div>
            </div>
            <div className="mt-4 space-y-2">
              {sections.map((s, i) => {
                const Icon = TYPE_ICON[s.type]
                return (
                  <div key={s.id} className="flex items-center gap-2.5 text-sm">
                    <span className="grid size-7 place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon className="size-3.5" /></span>
                    <span className="min-w-0 flex-1 truncate text-slate-700">{i + 1}. {s.title}</span>
                    <span className="text-xs text-slate-400">{s.type === 'kraepelin' ? `${s.kraepelin?.columns} lajur` : countOf(s)}</span>
                  </div>
                )
              })}
            </div>
            {!isNew && (
              <button onClick={() => { navigator.clipboard.writeText(testLink(test.access_code)); toast.success('Link disalin') }}
                className="mt-5 flex w-full items-center gap-2 rounded-xl bg-brand-50 p-3 text-left text-sm text-brand-700 hover:bg-brand-100">
                <Copy className="size-4 shrink-0" /><span className="truncate">{testLink(test.access_code)}</span>
              </button>
            )}
            <Button className="mt-4 w-full" onClick={save} loading={saving} icon={<Save className="size-4" />}>Simpan Paket</Button>
          </Card>
        </aside>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Pilih jenis subtes">
        <div className="grid gap-3 sm:grid-cols-2">
          {(['cognitive', 'likert', 'sjt', 'kraepelin'] as SectionType[]).map((t) => {
            const Icon = TYPE_ICON[t]
            const desc = {
              cognitive: 'Verbal, numerik, logika, figural. Ada kunci jawaban & bobot kesulitan.',
              likert: 'Kepribadian & sikap kerja: stres, tekanan, tim, integritas, dll.',
              sjt: 'Studi kasus situasi kerja dengan skor multi-aspek.',
              kraepelin: 'Tes penjumlahan cepat: kecepatan, ketelitian, stabilitas, ketahanan.',
            }[t]
            return (
              <button key={t} onClick={() => { const s = newSection(t); setSections([...sections, s]); setOpen(s.id); setAddOpen(false) }}
                className="rounded-2xl p-4 text-left ring-1 ring-slate-200 transition hover:bg-brand-50/50 hover:ring-brand-300">
                <div className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-5" /></div>
                <p className="mt-3 font-semibold text-slate-900">{TYPE_LABEL[t]}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
              </button>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}

function toLocal(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null)

function SectionCard({ s, index, open, onToggle, onChange, onRemove, onDuplicate, dims, avail, bank, count }: {
  s: Section; index: number; open: boolean; onToggle: () => void; onChange: (p: Partial<Section>) => void; onRemove: () => void; onDuplicate: () => void
  dims: any[]; avail: Record<string, number>; bank: Bank[]; count: number
}) {
  const Icon = TYPE_ICON[s.type]
  const [pick, setPick] = useState(false)
  const catDims = dims.filter((d) => groupsForType(s.type).includes(d.group_name) && d.key !== 'konsistensi')
  const cats = s.categories || []
  const useDiff = s.type === 'cognitive' && DIFFS.some((d) => Number(s.difficulty_counts?.[d]) > 0)

  // validasi ketersediaan soal
  const warnings: string[] = []
  if (s.type !== 'kraepelin' && s.selection !== 'manual') {
    const groups = s.count_per_category && cats.length ? cats.map((c) => [c]) : [cats]
    for (const g of groups) {
      const label = g.length ? g.map((c) => dims.find((d) => d.key === c)?.name || c).join(', ') : 'semua kategori'
      const sum = (diff?: string) => (g.length ? g : ['']).reduce((a, c) => a + (avail[c ? `${s.type}|${c}${diff ? `|${diff}` : ''}` : diff ? `${s.type}||${diff}` : s.type] || 0), 0)
      if (useDiff) {
        for (const d of DIFFS) {
          const need = Number(s.difficulty_counts?.[d]) || 0
          if (need > sum(d)) warnings.push(`${label}: soal ${DIFF_LABEL[d].toLowerCase()} tersedia ${sum(d)}, diminta ${need}`)
        }
      } else if ((Number(s.question_count) || 0) > sum()) warnings.push(`${label}: tersedia ${sum()} soal, diminta ${s.question_count}`)
    }
  }

  return (
    <Card className={cn('overflow-hidden transition', open && 'ring-2 ring-brand-200')}>
      <div className="flex items-center gap-3 p-4">
        <GripVertical className="size-5 shrink-0 cursor-grab text-slate-300 active:cursor-grabbing" />
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-5" /></div>
        <button onClick={onToggle} className="min-w-0 flex-1 text-left">
          <p className="truncate font-semibold text-slate-900">{index + 1}. {s.title}</p>
          <p className="truncate text-xs text-slate-500">
            {TYPE_SHORT[s.type]} · {s.type === 'kraepelin' ? `${s.kraepelin?.columns} lajur × ${s.kraepelin?.seconds_per_column} dtk` : `${count} soal`} · {s.type === 'kraepelin' ? fmtDuration(sectionTime(s)) : s.time_limit_sec ? fmtDuration(s.time_limit_sec) : 'tanpa batas waktu'}
          </p>
        </button>
        {warnings.length > 0 && <AlertTriangle className="size-5 shrink-0 text-amber-500" />}
        <button onClick={onDuplicate} title="Duplikat" className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-100 sm:block"><Copy className="size-4" /></button>
        <button onClick={onRemove} title="Hapus" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-4" /></button>
        <button onClick={onToggle} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><ChevronDown className={cn('size-4 transition', open && 'rotate-180')} /></button>
      </div>

      {open && (
        <div className="space-y-5 border-t border-slate-100 bg-slate-50/40 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Judul subtes" className="sm:col-span-2"><Input value={s.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
            {s.type !== 'kraepelin' && (
              <Field label="Batas waktu (menit)" hint="0 = tanpa batas">
                <Input type="number" min={0} step={0.5} value={s.time_limit_sec ? s.time_limit_sec / 60 : 0} onChange={(e) => onChange({ time_limit_sec: Math.round(Number(e.target.value) * 60) || null })} />
              </Field>
            )}
          </div>
          <Field label="Instruksi subtes"><Textarea value={s.instructions || ''} onChange={(e) => onChange({ instructions: e.target.value })} /></Field>

          {s.type === 'kraepelin' ? (
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Jumlah lajur"><Input type="number" min={1} max={60} value={s.kraepelin?.columns} onChange={(e) => onChange({ kraepelin: { ...s.kraepelin!, columns: Number(e.target.value) } })} /></Field>
              <Field label="Angka per lajur"><Input type="number" min={5} max={80} value={s.kraepelin?.rows} onChange={(e) => onChange({ kraepelin: { ...s.kraepelin!, rows: Number(e.target.value) } })} /></Field>
              <Field label="Detik per lajur"><Input type="number" min={5} max={120} value={s.kraepelin?.seconds_per_column} onChange={(e) => onChange({ kraepelin: { ...s.kraepelin!, seconds_per_column: Number(e.target.value) } })} /></Field>
              <Field label="Target jawaban/lajur" hint="Untuk normalisasi kecepatan"><Input type="number" min={1} value={s.kraepelin?.target_per_column ?? 14} onChange={(e) => onChange({ kraepelin: { ...s.kraepelin!, target_per_column: Number(e.target.value) } })} /></Field>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(['random', 'manual'] as const).map((m) => (
                  <button key={m} onClick={() => onChange({ selection: m })}
                    className={cn('rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition', (s.selection || 'random') === m ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200')}>
                    {m === 'random' ? 'Acak dari bank soal' : 'Pilih soal manual'}
                  </button>
                ))}
              </div>

              {(s.selection || 'random') === 'random' ? (
                <>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Kategori / aspek {s.type === 'sjt' && <span className="font-normal text-slate-400">(kosong = semua)</span>}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {catDims.map((d) => {
                        const on = cats.includes(d.key)
                        const n = avail[`${s.type}|${d.key}`] || 0
                        return (
                          <button key={d.key} onClick={() => onChange({ categories: on ? cats.filter((c) => c !== d.key) : [...cats, d.key] })}
                            className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition',
                              on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300', !n && 'opacity-50')}>
                            {d.name}<span className={cn('rounded-full px-1.5 text-[10px]', on ? 'bg-white/20' : 'bg-slate-100')}>{n}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {!useDiff && <Field label={s.count_per_category ? 'Jumlah soal per kategori' : 'Jumlah soal'}><Input type="number" min={1} value={s.question_count ?? 10} onChange={(e) => onChange({ question_count: Number(e.target.value) })} /></Field>}
                    <div className={cn('pt-1', useDiff && 'sm:col-span-2')}>
                      <Switch checked={!!s.count_per_category} onChange={(v) => onChange({ count_per_category: v })} label="Hitung jumlah per kategori" description="Setiap kategori terpilih mendapat jumlah soal yang sama (seimbang)." />
                    </div>
                  </div>
                  {s.type === 'cognitive' && (
                    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                      <p className="text-sm font-semibold text-slate-800">Komposisi tingkat kesulitan & bobot skor</p>
                      <p className="text-xs text-slate-500">Isi jumlah per tingkat untuk komposisi spesifik (kosongkan semua = acak bebas). Bobot = poin jika benar.</p>
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        {DIFFS.map((d) => (
                          <div key={d} className="space-y-2 rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-bold uppercase text-slate-500">{DIFF_LABEL[d]}</p>
                            <label className="block text-[11px] text-slate-500">Jumlah
                              <Input type="number" min={0} className="mt-1 h-9" value={s.difficulty_counts?.[d] ?? 0} onChange={(e) => onChange({ difficulty_counts: { ...s.difficulty_counts, [d]: Number(e.target.value) } })} />
                            </label>
                            <label className="block text-[11px] text-slate-500">Bobot poin
                              <Input type="number" min={0} step={0.5} className="mt-1 h-9" value={s.points?.[d] ?? { mudah: 1, sedang: 2, sulit: 3 }[d]} onChange={(e) => onChange({ points: { ...s.points, [d]: Number(e.target.value) } })} />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{s.question_ids?.length || 0} soal dipilih</p>
                    <p className="text-xs text-slate-500">Urutan mengikuti pilihan (kecuali diacak).</p>
                  </div>
                  <Button variant="soft" onClick={() => setPick(true)}>Pilih Soal</Button>
                </div>
              )}

              {s.type === 'cognitive' && (
                <Field label="Pengurangan nilai untuk jawaban salah" hint="Proporsi dari bobot soal. 0 = tidak ada (direkomendasikan); 0,25 = minus ¼ bobot.">
                  <Input type="number" min={0} max={1} step={0.05} value={s.negative_marking ?? 0} onChange={(e) => onChange({ negative_marking: Number(e.target.value) })} />
                </Field>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Switch checked={s.shuffle_questions !== false} onChange={(v) => onChange({ shuffle_questions: v })} label="Acak urutan soal" />
                {s.type !== 'likert' && <Switch checked={!!s.shuffle_options} onChange={(v) => onChange({ shuffle_options: v })} label="Acak urutan pilihan jawaban" />}
              </div>
            </>
          )}

          {warnings.length > 0 && (
            <div className="space-y-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
              <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-3.5" />Stok soal tidak mencukupi – peserta akan mendapat soal lebih sedikit</p>
              {warnings.map((w) => <p key={w}>• {w}</p>)}
            </div>
          )}
        </div>
      )}
      <ManualPicker open={pick} onClose={() => setPick(false)} bank={bank.filter((q) => q.type === s.type)} dims={dims}
        value={s.question_ids || []} onChange={(ids) => onChange({ question_ids: ids })} />
    </Card>
  )
}

function ManualPicker({ open, onClose, bank, value, onChange, dims }: { open: boolean; onClose: () => void; bank: Bank[]; value: string[]; onChange: (v: string[]) => void; dims: any[] }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const sel = new Set(value)
  const list = bank.filter((b) => (!cat || b.category === cat) && (!q || `${b.code} ${b.prompt}`.toLowerCase().includes(q.toLowerCase())))
  const cats = [...new Set(bank.map((b) => b.category))]
  return (
    <Modal open={open} onClose={onClose} title={`Pilih soal (${value.length} dipilih)`} size="lg" footer={<Button onClick={onClose}>Selesai</Button>}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Cari kode / teks soal…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-56">
          <option value="">Semua kategori</option>
          {cats.map((c) => <option key={c} value={c}>{dims.find((d) => d.key === c)?.name || c}</option>)}
        </Select>
        <Button variant="secondary" onClick={() => onChange([...new Set([...value, ...list.map((b) => b.id)])])}>Pilih semua</Button>
      </div>
      <div className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
        {list.map((b) => (
          <label key={b.id} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-50">
            <input type="checkbox" className="mt-1 size-4 accent-brand-600" checked={sel.has(b.id)}
              onChange={() => onChange(sel.has(b.id) ? value.filter((x) => x !== b.id) : [...value, b.id])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-800">{b.prompt}</p>
              <div className="mt-1 flex flex-wrap gap-1.5"><Badge>{b.code}</Badge><Badge>{dims.find((d) => d.key === b.category)?.name || b.category}</Badge><Badge>{DIFF_LABEL[b.difficulty]}</Badge></div>
            </div>
          </label>
        ))}
        {!list.length && <p className="p-6 text-center text-sm text-slate-500">Tidak ada soal.</p>}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400"><Clock className="size-3.5" />Soal nonaktif tidak ditampilkan.</p>
    </Modal>
  )
}
