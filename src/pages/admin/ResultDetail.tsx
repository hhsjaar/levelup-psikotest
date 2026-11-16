import { AlertOctagon, AlertTriangle, ArrowLeft, Brain, CheckCircle2, ChevronDown, Clock, Eye, HeartPulse, Info, Mail, Phone, Printer, RefreshCw, Shield, ShieldCheck, Sparkles, Trash2, TrendingDown, TrendingUp, Users, XCircle, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { DimensionBars, IndicatorCard, KraepelinChart, ProfileRadar, ScoreRing, SectionBars } from '../../components/report'
import { Badge, Button, Card, CardHeader, Confirm, PageLoader, Textarea } from '../../components/ui'
import { useDimensions } from '../../hooks/useDimensions'
import { errMsg, supabase } from '../../lib/supabase'
import type { Attempt, Dimension } from '../../lib/types'
import { DIFF_LABEL, REC_STYLE, TYPE_SHORT, cn, fmtDate, fmtDuration, goodness, round1 } from '../../lib/utils'

export default function ResultDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [a, setA] = useState<(Attempt & { tests: any }) | null>(null)
  const [answers, setAnswers] = useState<any[]>([])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [del, setDel] = useState(false)
  const [openSec, setOpenSec] = useState<number | null>(null)
  const { dims, byKey } = useDimensions()

  const load = async () => {
    const { data, error } = await supabase.from('attempts').select('*, tests(title, access_code, settings)').eq('id', id).single()
    if (error) { toast.error(errMsg(error)); return nav('/admin/results') }
    setA(data as any); setNotes(data.admin_notes || '')
    const { data: ans } = await supabase.from('attempt_answers')
      .select('*, questions(code,type,category,difficulty,prompt,stimulus,options)').eq('attempt_id', id)
    setAnswers(ans || [])
  }
  useEffect(() => { load() }, [id])

  const scored = useMemo(() => {
    if (!a?.scores) return [] as { dim: Dimension; pct: number; s: any }[]
    return dims.filter((d) => a.scores![d.key]).map((d) => ({ dim: d, pct: a.scores![d.key].pct, s: a.scores![d.key] }))
  }, [a, dims])

  if (!a) return <PageLoader />
  const S = (k: string) => a.scores?.[k]?.pct ?? null
  const group = (g: string) => scored.filter((x) => x.dim.group_name === g)
  const kres = Object.values(a.kraepelin?.results || {})[0]
  const personality = group('kepribadian')
  const ranked = [...personality, ...group('kognitif'), ...group('kinerja')]
    .map((x) => ({ ...x, eff: x.dim.higher_is_better ? x.pct : 100 - x.pct }))
    .sort((p, q) => q.eff - p.eff)
  const strengths = ranked.filter((x) => x.eff >= 60).slice(0, 4)
  const weaknesses = [...ranked].reverse().filter((x) => x.eff < 50).slice(0, 4)
  const lie = S('desirabilitas_sosial')

  async function rescore() {
    setBusy(true)
    const { error } = await supabase.rpc('rescore_attempt', { p_id: id })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success('Skor dihitung ulang'); load()
  }
  async function saveNotes() {
    const { error } = await supabase.from('attempts').update({ admin_notes: notes }).eq('id', id)
    error ? toast.error(errMsg(error)) : toast.success('Catatan tersimpan')
  }
  async function remove() {
    const { error } = await supabase.from('attempts').delete().eq('id', id)
    if (error) return toast.error(errMsg(error))
    toast.success('Hasil peserta dihapus'); nav('/admin/results')
  }

  const plan: any[] = a.plan || []
  const ansBySec = (i: number) => answers.filter((x) => x.section_index === i)

  return (
    <div className="space-y-6">
      {/* ---------- header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/results" className="no-print grid size-10 place-items-center rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-50"><ArrowLeft className="size-4" /></Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Laporan Hasil Psikotes</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{a.candidate_name}</h1>
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>Cetak / PDF</Button>
          {a.status === 'submitted' && <Button variant="secondary" loading={busy} icon={<RefreshCw className="size-4" />} onClick={rescore}>Hitung Ulang</Button>}
          <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" icon={<Trash2 className="size-4" />} onClick={() => setDel(true)}>Hapus</Button>
        </div>
      </div>

      <Card className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Info2 label="Paket tes" value={a.tests?.title} />
        <Info2 label="Posisi dilamar" value={a.position || '-'} />
        <Info2 label="Kontak" value={<span className="flex flex-col text-sm"><span className="flex items-center gap-1.5"><Mail className="size-3.5 text-slate-400" />{a.candidate_email || '-'}</span><span className="flex items-center gap-1.5"><Phone className="size-3.5 text-slate-400" />{a.candidate?.phone || '-'}</span></span>} />
        <Info2 label="Waktu" value={<span className="text-sm">{fmtDate(a.started_at)}<br /><span className="text-slate-500">Durasi {fmtDuration(a.duration_sec)} · {a.tab_switches}× pindah tab</span></span>} />
        {['education', 'age', 'gender'].filter((k) => a.candidate?.[k]).map((k) => (
          <Info2 key={k} label={{ education: 'Pendidikan', age: 'Usia', gender: 'Jenis kelamin' }[k]!} value={a.candidate[k]} />
        ))}
      </Card>

      {a.status !== 'submitted' ? (
        <Card className="p-8 text-center"><Clock className="mx-auto size-8 text-sky-500" /><p className="mt-3 font-semibold">Peserta masih mengerjakan tes</p><p className="text-sm text-slate-500">Terakhir tersimpan {fmtDate(a.updated_at)}</p></Card>
      ) : (
        <>
          {/* ---------- ringkasan ---------- */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="flex flex-col items-center p-6 text-center">
              <ScoreRing value={a.overall_score} size={170} label="Indeks Kesesuaian" />
              <span className={cn('mt-4 rounded-full px-4 py-1.5 text-sm font-bold', REC_STYLE[a.recommendation || ''])}>{a.recommendation}</span>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                {a.passed ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-rose-500" />}
                {a.passed ? 'Memenuhi' : 'Belum memenuhi'} passing grade ({a.tests?.settings?.passing_score ?? 60})
              </p>
            </Card>
            <Card className="p-6 lg:col-span-2">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900"><Sparkles className="size-4 text-brand-600" />Ringkasan Profil</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-100">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800"><TrendingUp className="size-4" />Kekuatan</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-emerald-900">
                    {strengths.length ? strengths.map((x) => <li key={x.dim.key} className="flex justify-between gap-2"><span>{x.dim.name}</span><b>{round1(x.pct)}</b></li>) : <li className="text-emerald-700/70">Belum ada aspek menonjol</li>}
                  </ul>
                </div>
                <div className="rounded-2xl bg-rose-50/60 p-4 ring-1 ring-rose-100">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-800"><TrendingDown className="size-4" />Area Pengembangan</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-rose-900">
                    {weaknesses.length ? weaknesses.map((x) => <li key={x.dim.key} className="flex justify-between gap-2"><span>{x.dim.name}</span><b>{round1(x.pct)}</b></li>) : <li className="text-rose-700/70">Tidak ada aspek di bawah rata-rata</li>}
                  </ul>
                </div>
              </div>
              {(a.flags || []).length > 0 && (
                <div className="mt-4 space-y-2">
                  {a.flags.map((fl, i) => (
                    <div key={i} className={cn('flex items-start gap-2.5 rounded-xl p-3 text-sm ring-1',
                      fl.level === 'danger' ? 'bg-rose-50 text-rose-800 ring-rose-200' : fl.level === 'warning' ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-sky-50 text-sky-800 ring-sky-200')}>
                      {fl.level === 'danger' ? <AlertOctagon className="mt-0.5 size-4 shrink-0" /> : fl.level === 'warning' ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <Info className="mt-0.5 size-4 shrink-0" />}
                      {fl.message}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ---------- indikator utama ---------- */}
          <div>
            <h2 className="mb-3 font-bold text-slate-900">Indikator Utama Kesiapan Kerja</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {S('tingkat_stres') != null && <IndicatorCard dim={byKey.tingkat_stres} pct={S('tingkat_stres')} icon={<HeartPulse className="size-4 text-rose-500" />} />}
              {S('toleransi_tekanan') != null && <IndicatorCard dim={byKey.toleransi_tekanan} pct={S('toleransi_tekanan')} icon={<Zap className="size-4 text-orange-500" />} />}
              {S('kerja_tim') != null && <IndicatorCard dim={byKey.kerja_tim} pct={S('kerja_tim')} icon={<Users className="size-4 text-emerald-500" />} />}
              {S('integritas') != null && <IndicatorCard dim={byKey.integritas} pct={S('integritas')} icon={<Shield className="size-4 text-teal-600" />} />}
              {lie != null && <IndicatorCard invertLabel="Kejujuran Menjawab Tes" pct={Math.round((100 - lie) * 10) / 10}
                dim={{ ...byKey.desirabilitas_sosial, higher_is_better: true, interp_low: byKey.desirabilitas_sosial?.interp_high, interp_high: byKey.desirabilitas_sosial?.interp_low, low_threshold: 100 - (a.tests?.settings?.lie_threshold ?? 70), high_threshold: 60 }}
                icon={<ShieldCheck className="size-4 text-slate-500" />} />}
              {S('konsistensi') != null && <IndicatorCard dim={byKey.konsistensi} pct={S('konsistensi')} icon={<Eye className="size-4 text-slate-500" />} />}
            </div>
          </div>

          {/* ---------- kognitif ---------- */}
          {group('kognitif').length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title="Kemampuan Kognitif" subtitle="Skor tertimbang tingkat kesulitan" icon={<Brain className="size-4" />} />
                <div className="px-5 pb-5"><DimensionBars items={group('kognitif').map((x) => ({ dim: x.dim, pct: x.pct, extra: x.s.total ? `${x.s.correct}/${x.s.total} benar` : undefined }))} /></div>
              </Card>
              <Card>
                <CardHeader title="Skor per Subtes" />
                <div className="px-3 pb-4"><SectionBars items={(a.section_scores || []).filter((s) => s.pct != null).map((s) => ({ name: s.title, pct: Number(s.pct) }))} height={Math.max(200, (a.section_scores?.length || 0) * 42)} /></div>
              </Card>
            </div>
          )}

          {/* ---------- kraepelin ---------- */}
          {kres && (
            <Card>
              <CardHeader title="Tes Kraepelin – Sikap & Ketahanan Kerja" subtitle="Grafik jumlah penjumlahan per lajur" icon={<Zap className="size-4" />} />
              <div className="grid gap-6 px-5 pb-5 lg:grid-cols-[1fr_320px]">
                <KraepelinChart result={kres} />
                <div className="grid grid-cols-2 gap-3 self-start">
                  <Metric label="Panker (kecepatan)" value={round1(kres.panker)} hint="rata-rata/lajur" dim={byKey.kecepatan_kerja} pct={S('kecepatan_kerja')} />
                  <Metric label="Tianker (salah)" value={kres.tianker} hint={`akurasi ${round1(kres.accuracy)}%`} dim={byKey.ketelitian_kerja} pct={S('ketelitian_kerja')} />
                  <Metric label="Janker (rentang)" value={kres.janker} hint="naik-turun" dim={byKey.stabilitas_kerja} pct={S('stabilitas_kerja')} />
                  <Metric label="Hanker (tren)" value={kres.hanker > 0 ? `+${kres.hanker}` : kres.hanker} hint="kemiringan" dim={byKey.ketahanan_kerja} pct={S('ketahanan_kerja')} />
                </div>
              </div>
              <div className="border-t border-slate-100 px-5 py-4"><DimensionBars items={group('kinerja').map((x) => ({ dim: x.dim, pct: x.pct }))} /></div>
            </Card>
          )}

          {/* ---------- kepribadian ---------- */}
          {personality.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-5">
              <Card className="lg:col-span-2">
                <CardHeader title="Profil Kepribadian" subtitle="Tingkat stres ditampilkan terbalik" />
                <div className="px-2 pb-4"><ProfileRadar items={personality.map((x) => ({ name: x.dim.name, pct: x.dim.higher_is_better ? x.pct : 100 - x.pct }))} /></div>
              </Card>
              <Card className="lg:col-span-3">
                <CardHeader title="Kepribadian & Sikap Kerja" subtitle="Interpretasi per aspek" icon={<HeartPulse className="size-4" />} />
                <div className="px-5 pb-5"><DimensionBars items={personality.map((x) => ({ dim: x.dim, pct: x.pct }))} /></div>
              </Card>
            </div>
          )}

          {/* ---------- review jawaban ---------- */}
          <Card className="print-break">
            <CardHeader title="Rincian Jawaban" subtitle="Jawaban, kunci, skor, dan waktu per soal" />
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {plan.map((sec, i) => {
                const ss = a.section_scores?.find((x) => x.index === i)
                const items = ansBySec(i)
                const order = (sec.items || []).map((it: any) => it.q)
                items.sort((p, q) => order.indexOf(p.question_id) - order.indexOf(q.question_id))
                return (
                  <div key={i}>
                    <button onClick={() => setOpenSec(openSec === i ? null : i)} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50">
                      <Badge>{TYPE_SHORT[sec.type as keyof typeof TYPE_SHORT]}</Badge>
                      <span className="flex-1 font-semibold text-slate-800">{sec.title}</span>
                      {ss && sec.type !== 'kraepelin' && <span className="text-sm text-slate-500">{ss.answered}/{ss.total} dijawab{sec.type === 'cognitive' ? ` · ${ss.correct} benar` : ''}</span>}
                      <span className="text-sm font-bold text-slate-900">{ss?.pct != null ? round1(ss.pct) : '–'}</span>
                      <ChevronDown className={cn('size-4 text-slate-400 transition', openSec === i && 'rotate-180')} />
                    </button>
                    {openSec === i && sec.type !== 'kraepelin' && (
                      <div className="space-y-2 bg-slate-50/50 px-5 pb-5">
                        {items.map((x, n) => {
                          const qq = x.questions
                          const chosen = qq?.options?.find((o: any) => o.id === x.option_id)
                          const key = qq?.options?.find((o: any) => o.correct)
                          return (
                            <div key={x.question_id} className="rounded-xl bg-white p-3.5 text-sm ring-1 ring-slate-200">
                              <div className="flex items-start gap-3">
                                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-bold text-slate-500">{n + 1}</span>
                                <div className="min-w-0 flex-1">
                                  {qq?.stimulus && qq.stimulus.length < 140 && <pre className="mb-1 whitespace-pre-wrap font-sans text-xs text-slate-400">{qq.stimulus}</pre>}
                                  <p className="text-slate-800">{qq?.prompt}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                    <span className={cn('rounded-md px-2 py-0.5 font-medium',
                                      !x.answered ? 'bg-slate-100 text-slate-500' : qq?.type === 'cognitive' ? (x.is_correct ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700') : 'bg-brand-50 text-brand-700')}>
                                      {x.answered ? `Jawaban: ${chosen?.text ?? x.option_id}` : 'Tidak dijawab'}
                                    </span>
                                    {qq?.type === 'cognitive' && !x.is_correct && key && <span className="text-emerald-700">Kunci: {key.text}</span>}
                                    {qq?.type !== 'likert' && <span className="text-slate-400">{DIFF_LABEL[qq?.difficulty as keyof typeof DIFF_LABEL]}</span>}
                                    <span className="text-slate-400">· {byKey[qq?.category]?.name}</span>
                                    {x.answered && <span className="text-slate-400">· skor {round1(x.points)}/{round1(x.max_points)}</span>}
                                    {x.time_ms != null && <span className="text-slate-400">· {(x.time_ms / 1000).toFixed(1)} dtk</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {!items.length && <p className="py-4 text-center text-sm text-slate-500">Tidak ada data jawaban.</p>}
                      </div>
                    )}
                    {openSec === i && sec.type === 'kraepelin' && kres && (
                      <div className="grid grid-cols-5 gap-2 bg-slate-50/50 px-5 pb-5 sm:grid-cols-10">
                        {kres.per_column.map((c, j) => (
                          <div key={j} className="rounded-lg bg-white p-2 text-center text-xs ring-1 ring-slate-200">
                            <p className="text-slate-400">L{j + 1}</p><p className="font-bold text-slate-800">{c.correct}/{c.answered}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}

      <Card className="no-print p-5">
        <h3 className="font-semibold text-slate-900">Catatan Rekruter</h3>
        <Textarea className="mt-3" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan wawancara, tindak lanjut, keputusan…" />
        <div className="mt-3 flex justify-end"><Button variant="secondary" onClick={saveNotes}>Simpan Catatan</Button></div>
      </Card>
      <p className="text-center text-xs text-slate-400">Hasil psikotes bersifat indikatif dan sebaiknya dikombinasikan dengan wawancara serta penilaian lain dalam pengambilan keputusan.</p>
      <Confirm open={del} onClose={() => setDel(false)} onConfirm={remove} danger confirmText="Hapus permanen" title="Hapus hasil peserta?"
        message={<>Seluruh data tes <b>{a.candidate_name}</b> akan dihapus permanen dan tidak dapat dikembalikan.</>} />
    </div>
  )
}

function Info2({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p><div className="mt-1 font-medium text-slate-800">{value}</div></div>
}

function Metric({ label, value, hint, dim, pct }: { label: string; value: React.ReactNode; hint: string; dim?: Dimension; pct: number | null }) {
  const g = goodness(pct, dim)
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="text-xl font-extrabold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-400">{hint} · <span className={cn('font-semibold', g === 'good' ? 'text-emerald-600' : g === 'bad' ? 'text-rose-600' : 'text-amber-600')}>{round1(pct)}</span></p>
    </div>
  )
}
