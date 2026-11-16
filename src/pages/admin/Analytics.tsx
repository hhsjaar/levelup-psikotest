import { AlertTriangle, CheckCircle2, Info, Microscope, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { toast } from 'sonner'
import { Badge, Button, Card, CardHeader, EmptyState, Input, PageLoader, Select, StatCard, Switch } from '../../components/ui'
import { useDimensions } from '../../hooks/useDimensions'
import { errMsg, supabase } from '../../lib/supabase'
import type { Difficulty } from '../../lib/types'
import { DIFF_COLOR, DIFF_LABEL, TYPE_SHORT, cn } from '../../lib/utils'
import { PageHeader } from './AdminLayout'

interface Row {
  question_id: string; code: string; type: string; category: string; difficulty: Difficulty; prompt: string; is_active: boolean
  n: number; p_value: number | null; discrimination: number | null; avg_time_ms: number | null; mean_score: number | null; option_counts: Record<string, number>
}

/** Klasifikasi tingkat kesulitan empiris berdasarkan indeks p (proporsi benar). */
export function empiricalDifficulty(p: number | null): Difficulty | null {
  if (p == null) return null
  if (p > 0.7) return 'mudah'
  if (p >= 0.3) return 'sedang'
  return 'sulit'
}
function discLabel(d: number | null) {
  if (d == null) return { label: 'N/A', cls: 'bg-slate-50 text-slate-500 ring-slate-200' }
  if (d >= 0.4) return { label: 'Sangat baik', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
  if (d >= 0.3) return { label: 'Baik', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
  if (d >= 0.2) return { label: 'Cukup', cls: 'bg-amber-50 text-amber-700 ring-amber-200' }
  if (d >= 0) return { label: 'Lemah – revisi', cls: 'bg-rose-50 text-rose-700 ring-rose-200' }
  return { label: 'Negatif – cek kunci', cls: 'bg-rose-100 text-rose-800 ring-rose-300' }
}

export default function Analytics() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [tests, setTests] = useState<{ id: string; title: string }[]>([])
  const [test, setTest] = useState('')
  const [f, setF] = useState({ type: 'cognitive', category: '', minN: 5, review: false, q: '' })
  const { byKey } = useDimensions()

  const load = () => {
    setRows(null)
    supabase.rpc('item_analysis', { p_test: test || null }).then(({ data, error }) => {
      if (error) toast.error(errMsg(error))
      setRows((data as any) || [])
    })
  }
  useEffect(() => { supabase.from('tests').select('id,title').then(({ data }) => setTests(data || [])) }, [])
  useEffect(load, [test])

  const list = useMemo(() => (rows || []).filter((r) => {
    if (f.type && r.type !== f.type) return false
    if (f.category && r.category !== f.category) return false
    if (f.q && !`${r.code} ${r.prompt}`.toLowerCase().includes(f.q.toLowerCase())) return false
    if (f.review) {
      const emp = empiricalDifficulty(r.p_value)
      const needs = r.n >= f.minN && ((emp && emp !== r.difficulty) || (r.discrimination != null && r.discrimination < 0.2))
      if (!needs) return false
    }
    return true
  }), [rows, f])

  const stats = useMemo(() => {
    const cog = (rows || []).filter((r) => r.type === 'cognitive' && r.n >= f.minN)
    const mismatch = cog.filter((r) => { const e = empiricalDifficulty(r.p_value); return e && e !== r.difficulty })
    const weak = cog.filter((r) => r.discrimination != null && r.discrimination < 0.2)
    const avgP = cog.length ? cog.reduce((s, r) => s + (r.p_value || 0), 0) / cog.length : null
    return { analysed: cog.length, mismatch: mismatch.length, weak: weak.length, avgP }
  }, [rows, f.minN])

  async function applyDifficulty(r: Row) {
    const emp = empiricalDifficulty(r.p_value)
    if (!emp) return
    const { error } = await supabase.from('questions').update({ difficulty: emp }).eq('id', r.question_id)
    if (error) return toast.error(errMsg(error))
    toast.success(`${r.code}: kesulitan diubah menjadi ${DIFF_LABEL[emp]}`)
    setRows((rs) => rs?.map((x) => (x.question_id === r.question_id ? { ...x, difficulty: emp } : x)) || null)
  }
  async function applyAll() {
    const targets = list.filter((r) => r.type === 'cognitive' && r.n >= f.minN && empiricalDifficulty(r.p_value) && empiricalDifficulty(r.p_value) !== r.difficulty)
    for (const r of targets) await supabase.from('questions').update({ difficulty: empiricalDifficulty(r.p_value) }).eq('id', r.question_id)
    toast.success(`${targets.length} soal dikalibrasi ulang`); load()
  }
  async function deactivate(r: Row) {
    await supabase.from('questions').update({ is_active: false }).eq('id', r.question_id)
    toast.success(`${r.code} dinonaktifkan`)
    setRows((rs) => rs?.map((x) => (x.question_id === r.question_id ? { ...x, is_active: false } : x)) || null)
  }

  if (!rows) return <PageLoader label="Menghitung statistik butir soal…" />
  const scatter = list.filter((r) => r.type === 'cognitive' && r.p_value != null && r.discrimination != null && r.n >= f.minN)
    .map((r) => ({ x: Number(r.p_value), y: Number(r.discrimination), z: r.n, code: r.code }))
  const cats = [...new Set(rows.filter((r) => !f.type || r.type === f.type).map((r) => r.category))]

  return (
    <div>
      <PageHeader title="Analisis Tingkat Kesulitan Soal" subtitle="Analisis butir (item analysis) berdasarkan jawaban peserta sungguhan – kalibrasi tingkat kesulitan & kualitas soal."
        actions={<Select value={test} onChange={(e) => setTest(e.target.value)} className="w-64"><option value="">Semua paket tes</option>{tests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Soal kognitif teranalisis" value={stats.analysed} hint={`min. ${f.minN} responden`} icon={<Microscope className="size-5" />} />
        <StatCard label="Rata-rata indeks p" value={stats.avgP == null ? '–' : stats.avgP.toFixed(2)} hint="Ideal 0,30 – 0,70" icon={<Info className="size-5" />} tone="sky" />
        <StatCard label="Label kesulitan tidak sesuai" value={stats.mismatch} hint="Perlu kalibrasi ulang" icon={<Wand2 className="size-5" />} tone="amber" />
        <StatCard label="Daya beda lemah" value={stats.weak} hint="Korelasi < 0,20" icon={<AlertTriangle className="size-5" />} tone="rose" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Peta Kualitas Soal" subtitle="Sumbu X: indeks kesulitan p (proporsi benar). Sumbu Y: daya beda (point-biserial). Area hijau = soal ideal." />
          <div className="px-2 pb-4">
            {scatter.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <ReferenceArea x1={0.3} x2={0.7} y1={0.3} y2={1} fill="#10b981" fillOpacity={0.08} />
                  <XAxis type="number" dataKey="x" domain={[0, 1]} name="p" tick={{ fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" domain={[-0.5, 1]} name="Daya beda" tick={{ fontSize: 11 }} />
                  <ZAxis dataKey="z" range={[40, 200]} />
                  <Tooltip content={({ payload }) => payload?.[0] ? (
                    <div className="rounded-lg bg-white p-2 text-xs shadow ring-1 ring-slate-200"><b>{(payload[0].payload as any).code}</b><br />p = {(payload[0].payload as any).x} · d = {(payload[0].payload as any).y}<br />n = {(payload[0].payload as any).z}</div>) : null} />
                  <Scatter data={scatter} fill="#6366f1" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            ) : <EmptyState title="Data belum cukup" description={`Peta muncul setelah soal kognitif dijawab minimal ${f.minN} peserta.`} />}
          </div>
        </Card>
        <Card className="p-5 text-sm leading-relaxed text-slate-600">
          <h3 className="font-semibold text-slate-900">Cara membaca</h3>
          <ul className="mt-3 space-y-2.5">
            <li><b>Indeks p</b> = proporsi peserta yang menjawab benar. p &gt; 0,70 = <Badge className={DIFF_COLOR.mudah}>Mudah</Badge>, 0,30–0,70 = <Badge className={DIFF_COLOR.sedang}>Sedang</Badge>, &lt; 0,30 = <Badge className={DIFF_COLOR.sulit}>Sulit</Badge>.</li>
            <li><b>Daya beda</b> = korelasi benar/salah dengan skor total kategori. ≥ 0,30 baik; &lt; 0,20 soal kurang membedakan kandidat kuat & lemah; negatif → periksa kunci jawaban.</li>
            <li>Gunakan <b>Kalibrasi</b> untuk menyesuaikan label kesulitan agar komposisi soal pada paket tes lebih akurat.</li>
            <li>Untuk kuesioner Likert/SJT, ditampilkan rata-rata skor & distribusi pilihan.</li>
          </ul>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <div className="grid flex-1 gap-2 sm:grid-cols-4">
            <Input placeholder="Cari soal…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, category: '' })}>
              <option value="">Semua tipe</option><option value="cognitive">Kognitif</option><option value="likert">Likert</option><option value="sjt">SJT</option>
            </Select>
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              <option value="">Semua kategori</option>{cats.map((c) => <option key={c} value={c}>{byKey[c]?.name || c}</option>)}
            </Select>
            <Select value={f.minN} onChange={(e) => setF({ ...f, minN: Number(e.target.value) })}>
              {[1, 5, 10, 20, 30, 50].map((n) => <option key={n} value={n}>Min. {n} responden</option>)}
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-56"><Switch checked={f.review} onChange={(v) => setF({ ...f, review: v })} label="Hanya yang perlu ditinjau" /></div>
            <Button variant="soft" size="sm" icon={<Wand2 className="size-4" />} onClick={applyAll}>Kalibrasi semua</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Soal</th><th className="px-3">n</th><th className="px-3">Label</th>
                <th className="px-3">Indeks p / Rerata</th><th className="px-3">Empiris</th><th className="px-3">Daya beda</th><th className="px-3">Waktu</th><th className="px-3">Distribusi opsi</th><th className="px-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((r) => {
                const emp = r.type === 'cognitive' && r.n >= f.minN ? empiricalDifficulty(r.p_value) : null
                const mism = emp && emp !== r.difficulty
                const dl = discLabel(r.type === 'cognitive' && r.n >= f.minN ? r.discrimination : null)
                const total = Object.values(r.option_counts || {}).reduce((s, v) => s + v, 0)
                return (
                  <tr key={r.question_id} className={cn('align-top hover:bg-slate-50/60', !r.is_active && 'opacity-50')}>
                    <td className="max-w-sm px-4 py-3">
                      <div className="flex items-center gap-1.5"><span className="font-mono text-xs font-semibold text-slate-400">{r.code}</span><Badge>{TYPE_SHORT[r.type as 'cognitive']}</Badge></div>
                      <p className="mt-1 line-clamp-2 text-slate-700">{r.prompt}</p>
                      <p className="text-xs text-slate-400">{byKey[r.category]?.name}</p>
                    </td>
                    <td className="px-3 py-3 font-semibold tabular-nums">{r.n}</td>
                    <td className="px-3 py-3">{r.type !== 'likert' && <Badge className={DIFF_COLOR[r.difficulty]}>{DIFF_LABEL[r.difficulty]}</Badge>}</td>
                    <td className="px-3 py-3">
                      {r.type === 'cognitive' ? (
                        r.p_value == null ? '–' : (
                          <div className="w-28"><span className="font-semibold tabular-nums">{Number(r.p_value).toFixed(2)}</span>
                            <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Number(r.p_value) * 100}%` }} /></div></div>
                        )
                      ) : <span className="font-semibold tabular-nums">{r.mean_score ?? '–'}</span>}
                    </td>
                    <td className="px-3 py-3">{emp ? <span className="flex items-center gap-1">{mism ? <AlertTriangle className="size-3.5 text-amber-500" /> : <CheckCircle2 className="size-3.5 text-emerald-500" />}<Badge className={DIFF_COLOR[emp]}>{DIFF_LABEL[emp]}</Badge></span> : <span className="text-slate-300">–</span>}</td>
                    <td className="px-3 py-3">{r.type === 'cognitive' ? <div><span className="tabular-nums">{r.discrimination == null ? '–' : Number(r.discrimination).toFixed(2)}</span><br /><Badge className={cn('mt-1', dl.cls)}>{dl.label}</Badge></div> : <span className="text-slate-300">–</span>}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-600">{r.avg_time_ms ? `${(r.avg_time_ms / 1000).toFixed(1)}s` : '–'}</td>
                    <td className="px-3 py-3">
                      <div className="flex h-5 w-36 overflow-hidden rounded-md bg-slate-100">
                        {Object.entries(r.option_counts || {}).sort().map(([k, v], i) => (
                          <div key={k} title={`${k.toUpperCase()}: ${v}`} style={{ width: `${(v / (total || 1)) * 100}%`, background: ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'][i % 6] }}
                            className="grid place-items-center text-[9px] font-bold text-white">{v / (total || 1) > 0.12 ? k.toUpperCase() : ''}</div>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-end gap-1">
                        {mism && <Button size="sm" variant="soft" onClick={() => applyDifficulty(r)}>Kalibrasi</Button>}
                        {r.is_active && r.type === 'cognitive' && r.discrimination != null && r.discrimination < 0 && r.n >= f.minN && <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => deactivate(r)}>Nonaktifkan</Button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!list.length && <EmptyState title="Tidak ada soal" description="Ubah filter atau tunggu data peserta bertambah." />}
        </div>
      </Card>
    </div>
  )
}
