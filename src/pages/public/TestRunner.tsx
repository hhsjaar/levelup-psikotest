import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Clock, Flag, LayoutGrid, Loader2, Lock, PlayCircle, Send } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, Logo, Modal, PageLoader } from '../../components/ui'
import { errMsg, supabase } from '../../lib/supabase'
import type { AttemptPayload, CandidateQuestion, CandidateSection, RunnerProgress } from '../../lib/types'
import { TYPE_SHORT, cn, fmtClock, fmtDuration } from '../../lib/utils'
import Kraepelin from './Kraepelin'

type Phase = 'intro' | 'work' | 'finish'
const LETTERS = 'ABCDEF'
const LIKERT_STYLE = [
  'hover:ring-rose-300 data-[on=true]:bg-rose-500 data-[on=true]:ring-rose-500',
  'hover:ring-orange-300 data-[on=true]:bg-orange-400 data-[on=true]:ring-orange-400',
  'hover:ring-slate-300 data-[on=true]:bg-slate-500 data-[on=true]:ring-slate-500',
  'hover:ring-emerald-300 data-[on=true]:bg-emerald-500 data-[on=true]:ring-emerald-500',
  'hover:ring-emerald-400 data-[on=true]:bg-emerald-600 data-[on=true]:ring-emerald-600',
]

function useNow(ms = 500) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function sectionLimit(s: CandidateSection) {
  if (s.type === 'kraepelin') return null // timer per lajur di komponen Kraepelin
  return s.time_limit_sec && s.time_limit_sec > 0 ? s.time_limit_sec : null
}

export default function TestRunner() {
  const { token = '' } = useParams()
  const nav = useNavigate()
  const [data, setData] = useState<AttemptPayload | null>(null)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timings, setTimings] = useState<Record<string, number>>({})
  const [progress, setProgress] = useState<RunnerProgress>({})
  const [kAnswers, setKAnswers] = useState<Record<string, (number | null)[][]>>({})
  const [tabSwitches, setTabSwitches] = useState(0)
  const [phase, setPhase] = useState<Phase>('intro')
  const [navOpen, setNavOpen] = useState(false)
  const [warnOpen, setWarnOpen] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const now = useNow(500)

  // refs untuk akses state terbaru dari interval/event
  const st = useRef({ answers, timings, progress, kAnswers, tabSwitches })
  st.current = { answers, timings, progress, kAnswers, tabSwitches }
  const dirty = useRef(false)
  const qStart = useRef<number>(Date.now())

  // ---------- load ----------
  useEffect(() => {
    supabase.rpc('get_attempt', { p_token: token }).then(({ data, error }) => {
      if (error) return setError(errMsg(error))
      const d = data as AttemptPayload
      if (d.status !== 'in_progress') return nav(`/hasil/${token}`, { replace: true })
      setData(d)
      setAnswers(d.answers || {})
      setTimings(d.timings || {})
      setKAnswers(d.kraepelin_answers || {})
      setTabSwitches(d.tab_switches || 0)
      const p: RunnerProgress = { section: 0, question: 0, started: {}, done: {}, flagged: [], kcol: {}, ...(d.progress || {}) }
      // lompati subtes yang sudah selesai
      let s = p.section || 0
      while (s < d.sections.length && p.done?.[s]) s++
      p.section = s
      setProgress(p)
      if (s >= d.sections.length) setPhase('finish')
      else setPhase(p.started?.[s] ? 'work' : 'intro')
    })
  }, [token])

  // ---------- autosave ----------
  const save = useCallback(async () => {
    if (!dirty.current) return
    dirty.current = false
    setSaveState('saving')
    const c = st.current
    const { error } = await supabase.rpc('save_progress', {
      p_token: token, p_answers: c.answers, p_timings: c.timings, p_progress: c.progress,
      p_tab_switches: c.tabSwitches, p_kraepelin_answers: c.kAnswers,
    })
    if (error) { dirty.current = true; setSaveState('error') } else setSaveState('saved')
  }, [token])

  useEffect(() => {
    dirty.current = true
    const t = setTimeout(save, 1200)
    return () => clearTimeout(t)
  }, [answers, progress, kAnswers, tabSwitches])

  useEffect(() => {
    const t = setInterval(save, 15000)
    return () => clearInterval(t)
  }, [save])

  // ---------- derived ----------
  const sIdx = progress.section ?? 0
  const section = data?.sections[sIdx]
  const qIdx = Math.min(progress.question ?? 0, Math.max(0, (section?.questions.length || 1) - 1))
  const question = section?.questions[qIdx]
  const allowBack = data?.test.settings.allow_back !== false
  const maxTab = Number(data?.test.settings.max_tab_switches || 0)
  const limit = section ? sectionLimit(section) : null
  const startedAt = progress.started?.[sIdx]
  const remaining = limit && startedAt ? limit - (now - startedAt) / 1000 : null
  const answeredInSection = section ? section.questions.filter((q) => answers[q.id]).length : 0

  const totalItems = useMemo(() => (data?.sections || []).reduce((s, x) => s + (x.type === 'kraepelin' ? 1 : x.questions.length), 0), [data])
  const doneItems = useMemo(() => {
    if (!data) return 0
    return data.sections.reduce((s, x, i) => {
      if (x.type === 'kraepelin') return s + (progress.done?.[i] ? 1 : 0)
      return s + x.questions.filter((q) => answers[q.id]).length
    }, 0)
  }, [data, answers, progress])

  // ---------- pencatatan waktu per soal ----------
  useEffect(() => {
    if (phase !== 'work' || !question) return
    qStart.current = Date.now()
    const qid = question.id
    return () => {
      const el = Date.now() - qStart.current
      setTimings((t) => ({ ...t, [qid]: (t[qid] || 0) + el }))
    }
  }, [phase, question?.id])

  // ---------- navigasi ----------
  const finishSection = useCallback((auto = false) => {
    if (!data) return
    setProgress((p) => {
      const next = (p.section ?? 0) + 1
      return { ...p, done: { ...p.done, [p.section ?? 0]: true }, section: next, question: 0 }
    })
    setConfirmEnd(false)
    setNavOpen(false)
    const next = sIdx + 1
    if (auto) toast.info('Waktu subtes habis. Jawaban Anda telah disimpan.')
    setPhase(next >= data.sections.length ? 'finish' : 'intro')
    window.scrollTo({ top: 0 })
  }, [data, sIdx])

  useEffect(() => {
    if (phase === 'work' && remaining != null && remaining <= 0) finishSection(true)
  }, [remaining, phase, finishSection])

  const startSection = () => {
    setProgress((p) => ({ ...p, started: { ...p.started, [sIdx]: p.started?.[sIdx] || Date.now() }, question: 0 }))
    setPhase('work')
    window.scrollTo({ top: 0 })
  }

  const goQ = (i: number) => {
    if (!section) return
    const n = Math.max(0, Math.min(section.questions.length - 1, i))
    if (n < qIdx && !allowBack) return
    setProgress((p) => ({ ...p, question: n }))
    setNavOpen(false)
  }

  const choose = (q: CandidateQuestion, optId: string) => {
    setAnswers((a) => ({ ...a, [q.id]: optId }))
    if (q.type === 'likert' && section && qIdx < section.questions.length - 1) {
      setTimeout(() => setProgress((p) => (p.question === qIdx ? { ...p, question: qIdx + 1 } : p)), 280)
    }
  }

  const toggleFlag = (qid: string) =>
    setProgress((p) => {
      const f = new Set(p.flagged || [])
      f.has(qid) ? f.delete(qid) : f.add(qid)
      return { ...p, flagged: [...f] }
    })

  // ---------- submit ----------
  const submit = useCallback(async () => {
    setSubmitting(true)
    const c = st.current
    const { error } = await supabase.rpc('submit_attempt', {
      p_token: token, p_answers: c.answers, p_timings: c.timings, p_progress: c.progress,
      p_tab_switches: c.tabSwitches, p_kraepelin_answers: c.kAnswers,
    })
    if (error) { setSubmitting(false); return toast.error(errMsg(error)) }
    dirty.current = false
    nav(`/hasil/${token}`, { replace: true })
  }, [token])

  // ---------- anti-cheat: pindah tab ----------
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && phase === 'work') {
        setTabSwitches((n) => n + 1)
        save()
      } else if (document.visibilityState === 'visible' && phase === 'work') {
        setWarnOpen(true)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [phase, save])

  useEffect(() => {
    if (!data) return
    if (data.test.settings.auto_submit_on_violation && maxTab > 0 && tabSwitches > maxTab && !submitting) {
      toast.error('Batas meninggalkan halaman terlampaui. Tes dikumpulkan otomatis.')
      submit()
    }
  }, [tabSwitches])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (phase === 'work') { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [phase])

  // ---------- keyboard ----------
  useEffect(() => {
    if (phase !== 'work' || !question || section?.type === 'kraepelin') return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const k = e.key.toUpperCase()
      const idx = question.type === 'likert' ? Number(k) - 1 : LETTERS.indexOf(k)
      if (idx >= 0 && idx < question.options.length) choose(question, question.options[idx].id)
      else if (e.key === 'ArrowRight' || e.key === 'Enter') qIdx < section!.questions.length - 1 ? goQ(qIdx + 1) : setConfirmEnd(true)
      else if (e.key === 'ArrowLeft') goQ(qIdx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, question, qIdx, section])

  if (error) {
    return (
      <div className="grid min-h-full place-items-center p-4">
        <Card className="max-w-md p-8 text-center">
          <AlertTriangle className="mx-auto size-10 text-rose-500" />
          <h1 className="mt-3 font-bold">Sesi tes tidak ditemukan</h1>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
        </Card>
      </div>
    )
  }
  if (!data) return <PageLoader label="Menyiapkan soal…" />

  const overallPct = totalItems ? (doneItems / totalItems) * 100 : 0
  const flagged = new Set(progress.flagged || [])
  const lowTime = remaining != null && remaining < 60

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      {/* ---------- top bar ---------- */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Logo className="hidden sm:flex" />
          <div className="min-w-0 flex-1 sm:border-l sm:border-slate-200 sm:pl-4">
            <p className="truncate text-sm font-bold text-slate-900">{phase === 'finish' ? data.test.title : section?.title}</p>
            <p className="truncate text-xs text-slate-500">
              {phase === 'finish' ? 'Semua subtes selesai' : `Subtes ${sIdx + 1} dari ${data.sections.length}`}
              <span className="mx-1.5">·</span>
              <span className={cn(saveState === 'error' && 'text-rose-500')}>
                {saveState === 'saving' ? 'Menyimpan…' : saveState === 'error' ? 'Gagal menyimpan, mencoba lagi' : 'Tersimpan otomatis'}
              </span>
            </p>
          </div>
          {phase === 'work' && remaining != null && (
            <div className={cn('flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums ring-1',
              lowTime ? 'animate-pulse bg-rose-50 text-rose-600 ring-rose-200' : 'bg-slate-50 text-slate-700 ring-slate-200')}>
              <Clock className="size-4" />{fmtClock(remaining)}
            </div>
          )}
          {phase === 'work' && section?.type !== 'kraepelin' && (
            <button onClick={() => setNavOpen(true)} className="grid size-9 place-items-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200 lg:hidden"><LayoutGrid className="size-4" /></button>
          )}
        </div>
        <div className="h-1 bg-slate-100"><motion.div className="h-full bg-gradient-to-r from-brand-500 to-violet-500" animate={{ width: `${overallPct}%` }} /></div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <AnimatePresence mode="wait">
          {phase === 'intro' && section && (
            <motion.div key={`intro-${sIdx}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="mx-auto max-w-2xl">
              <SectionIntro section={section} index={sIdx} total={data.sections.length} onStart={startSection} />
            </motion.div>
          )}

          {phase === 'work' && section?.type === 'kraepelin' && section.kraepelin && (
            <motion.div key={`k-${sIdx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Kraepelin
                config={section.kraepelin.config}
                columns={section.kraepelin.columns}
                initialAnswers={kAnswers[sIdx]}
                initialColumn={progress.kcol?.[sIdx] || 0}
                onChange={(a, col) => {
                  setKAnswers((k) => ({ ...k, [sIdx]: a }))
                  setProgress((p) => ({ ...p, kcol: { ...p.kcol, [sIdx]: col } }))
                }}
                onDone={(a) => {
                  setKAnswers((k) => ({ ...k, [sIdx]: a }))
                  finishSection()
                }}
              />
            </motion.div>
          )}

          {phase === 'work' && section && section.type !== 'kraepelin' && question && (
            <motion.div key={`w-${sIdx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-6 lg:grid-cols-[1fr_280px]">
              <div className="min-w-0">
                <AnimatePresence mode="wait">
                  <motion.div key={question.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
                    <QuestionCard
                      q={question} n={qIdx + 1} total={section.questions.length}
                      selected={answers[question.id]} flagged={flagged.has(question.id)}
                      onChoose={(o) => choose(question, o)} onFlag={() => toggleFlag(question.id)}
                    />
                  </motion.div>
                </AnimatePresence>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <Button variant="secondary" onClick={() => goQ(qIdx - 1)} disabled={qIdx === 0 || !allowBack} icon={allowBack ? <ArrowLeft className="size-4" /> : <Lock className="size-4" />}>
                    <span className="hidden sm:inline">Sebelumnya</span>
                  </Button>
                  <span className="text-xs text-slate-400 hidden sm:block">Pintasan: {question.type === 'likert' ? '1–5' : 'A–E'} pilih · ←/→ pindah</span>
                  {qIdx < section.questions.length - 1 ? (
                    <Button onClick={() => goQ(qIdx + 1)}>Berikutnya <ArrowRight className="size-4" /></Button>
                  ) : (
                    <Button variant="success" onClick={() => setConfirmEnd(true)} icon={<CheckCircle2 className="size-4" />}>Selesai Subtes</Button>
                  )}
                </div>
              </div>
              <aside className="hidden lg:block">
                <Navigator section={section} current={qIdx} answers={answers} flagged={flagged} onGo={goQ} allowBack={allowBack} onEnd={() => setConfirmEnd(true)} />
              </aside>
            </motion.div>
          )}

          {phase === 'finish' && (
            <motion.div key="finish" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg">
              <Card className="p-8 text-center">
                <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-8" /></div>
                <h2 className="mt-5 text-xl font-bold text-slate-900">Semua subtes telah selesai</h2>
                <p className="mt-2 text-sm text-slate-500">Terima kasih telah mengerjakan dengan sungguh-sungguh. Klik tombol di bawah untuk mengumpulkan jawaban Anda.</p>
                <Button size="lg" className="mt-6 w-full" loading={submitting} onClick={submit} icon={<Send className="size-4" />}>Kumpulkan Jawaban</Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ---------- navigator mobile ---------- */}
      <Modal open={navOpen} onClose={() => setNavOpen(false)} title="Navigasi Soal">
        {section && section.type !== 'kraepelin' && (
          <Navigator section={section} current={qIdx} answers={answers} flagged={flagged} onGo={goQ} allowBack={allowBack} onEnd={() => { setNavOpen(false); setConfirmEnd(true) }} bare />
        )}
      </Modal>

      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="Akhiri subtes ini?" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmEnd(false)}>Periksa lagi</Button>
          <Button variant="success" onClick={() => finishSection()}>Ya, lanjutkan</Button>
        </>}>
        <div className="space-y-3 text-sm text-slate-600">
          <p>Anda telah menjawab <b className="text-slate-900">{answeredInSection}</b> dari <b className="text-slate-900">{section?.questions.length}</b> soal.</p>
          {section && answeredInSection < section.questions.length && (
            <p className="rounded-xl bg-amber-50 p-3 text-amber-800 ring-1 ring-amber-200">Masih ada {section.questions.length - answeredInSection} soal yang belum dijawab.</p>
          )}
          <p>Setelah melanjutkan, Anda <b>tidak dapat kembali</b> ke subtes ini.</p>
        </div>
      </Modal>

      <Modal open={warnOpen} onClose={() => setWarnOpen(false)} size="sm"
        footer={<Button onClick={() => setWarnOpen(false)}>Saya mengerti</Button>}>
        <div className="flex flex-col items-center py-2 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600"><AlertTriangle className="size-7" /></div>
          <h3 className="mt-4 font-bold text-slate-900">Anda meninggalkan halaman tes</h3>
          <p className="mt-1 text-sm text-slate-500">
            Aktivitas ini tercatat ({tabSwitches}{maxTab ? `/${maxTab}` : ''} kali).
            {data.test.settings.auto_submit_on_violation && maxTab ? ' Jika melebihi batas, tes akan dikumpulkan otomatis.' : ' Mohon tetap berada di halaman tes.'}
          </p>
        </div>
      </Modal>

      {submitting && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-white/80 backdrop-blur">
          <div className="flex flex-col items-center gap-3"><Loader2 className="size-8 animate-spin text-brand-600" /><p className="text-sm font-medium text-slate-600">Mengumpulkan & menghitung hasil…</p></div>
        </div>
      )}
    </div>
  )
}

function SectionIntro({ section, index, total, onStart }: { section: CandidateSection; index: number; total: number; onStart: () => void }) {
  const isK = section.type === 'kraepelin'
  const cfg = section.kraepelin?.config
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-brand-600 to-violet-600 p-6 text-white sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-100">Subtes {index + 1} / {total} · {TYPE_SHORT[section.type]}</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">{section.title}</h2>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {isK ? (
            <>
              <span className="rounded-lg bg-white/15 px-3 py-1">{cfg?.columns} lajur</span>
              <span className="rounded-lg bg-white/15 px-3 py-1">{cfg?.seconds_per_column} detik / lajur</span>
              <span className="rounded-lg bg-white/15 px-3 py-1">± {fmtDuration((cfg?.columns || 0) * (cfg?.seconds_per_column || 15))}</span>
            </>
          ) : (
            <>
              <span className="rounded-lg bg-white/15 px-3 py-1">{section.questions.length} soal</span>
              <span className="rounded-lg bg-white/15 px-3 py-1">{section.time_limit_sec ? `Waktu ${fmtDuration(section.time_limit_sec)}` : 'Tanpa batas waktu'}</span>
            </>
          )}
        </div>
      </div>
      <div className="space-y-5 p-6 sm:p-8">
        {section.instructions && <p className="leading-relaxed text-slate-600 whitespace-pre-line">{section.instructions}</p>}
        {isK && (
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <p className="text-sm font-semibold text-slate-700">Contoh</p>
            <div className="mt-3 flex items-center gap-6">
              <div className="space-y-1 text-center text-2xl font-bold tabular-nums">
                <div className="grid h-10 w-12 place-items-center rounded-lg bg-brand-600 text-white">7</div>
                <div className="grid h-10 w-12 place-items-center rounded-lg bg-brand-600 text-white">8</div>
              </div>
              <div className="text-sm text-slate-600">7 + 8 = 1<b className="text-brand-600">5</b> → ketik <b className="text-brand-600">5</b>.<br />Gunakan tombol angka di layar atau keyboard.</div>
            </div>
          </div>
        )}
        {section.type === 'likert' && (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-100">
            Pilih salah satu dari 5 pilihan: <b>Sangat Tidak Sesuai</b> hingga <b>Sangat Sesuai</b>. Setelah memilih, soal berikutnya muncul otomatis.
          </div>
        )}
        <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
          <Clock className="size-5 shrink-0" />Waktu mulai berjalan setelah Anda menekan tombol mulai.
        </div>
        <Button size="lg" className="w-full" onClick={onStart} icon={<PlayCircle className="size-5" />}>Mulai Subtes</Button>
      </div>
    </Card>
  )
}

function Stimulus({ text }: { text: string }) {
  const isPattern = text.length < 140 || /[▲■●○□◆◇★☆↑→↓←↗↘↙↖△]/.test(text)
  if (isPattern) {
    return (
      <div className="mb-5 overflow-x-auto rounded-2xl bg-slate-50 px-5 py-6 text-center ring-1 ring-slate-100">
        <pre className="inline-block text-left font-sans text-2xl font-semibold leading-relaxed tracking-wider text-slate-800 sm:text-3xl whitespace-pre">{text}</pre>
      </div>
    )
  }
  return (
    <div className="mb-5 rounded-2xl bg-slate-50 p-5 text-[15px] leading-relaxed text-slate-700 ring-1 ring-slate-100">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Bacaan</p>{text}
    </div>
  )
}

function QuestionCard({ q, n, total, selected, flagged, onChoose, onFlag }: {
  q: CandidateQuestion; n: number; total: number; selected?: string; flagged: boolean; onChoose: (id: string) => void; onFlag: () => void
}) {
  return (
    <Card className="p-5 sm:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">Soal {n} / {total}</span>
        <button onClick={onFlag} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition',
          flagged ? 'bg-amber-100 text-amber-800 ring-amber-200' : 'text-slate-500 ring-slate-200 hover:bg-slate-50')}>
          <Flag className="size-3.5" />{flagged ? 'Ditandai ragu' : 'Tandai ragu-ragu'}
        </button>
      </div>
      {q.stimulus && <Stimulus text={q.stimulus} />}
      {q.image_url && <img src={q.image_url} alt="" className="mb-5 max-h-72 rounded-xl ring-1 ring-slate-200" />}
      <h2 className={cn('font-semibold leading-relaxed text-slate-900', q.type === 'likert' ? 'text-xl sm:text-2xl text-center py-4' : 'text-lg sm:text-xl')}>{q.prompt}</h2>

      {q.type === 'likert' ? (
        <div className="mt-6 grid gap-2 sm:grid-cols-5">
          {q.options.map((o, i) => (
            <button key={o.id} data-on={selected === o.id} onClick={() => onChoose(o.id)}
              className={cn('group flex items-center gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-slate-200 transition active:scale-[0.98] sm:flex-col sm:gap-2 sm:p-4 sm:text-center data-[on=true]:text-white data-[on=true]:shadow-lg', LIKERT_STYLE[i])}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 group-data-[on=true]:bg-white/25 group-data-[on=true]:text-white">{i + 1}</span>
              <span className="text-sm font-semibold leading-tight">{o.text}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-2.5">
          {q.options.map((o, i) => {
            const on = selected === o.id
            return (
              <button key={o.id} onClick={() => onChoose(o.id)}
                className={cn('flex w-full items-start gap-4 rounded-2xl p-4 text-left ring-1 transition active:scale-[0.99]',
                  on ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-slate-200 hover:bg-slate-50 hover:ring-slate-300')}>
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold transition',
                  on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500')}>{LETTERS[i]}</span>
                <span className={cn('pt-1 text-[15px] leading-relaxed', on ? 'font-semibold text-brand-900' : 'text-slate-700', /^[▲■●○□◆◇★☆↑→↓←↗↘↙↖△ ]+$/.test(o.text) && 'text-2xl tracking-wider pt-0')}>{o.text}</span>
                {on && <CheckCircle2 className="ml-auto mt-1 size-5 shrink-0 text-brand-600" />}
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function Navigator({ section, current, answers, flagged, onGo, allowBack, onEnd, bare }: {
  section: CandidateSection; current: number; answers: Record<string, string>; flagged: Set<string>; onGo: (i: number) => void; allowBack: boolean; onEnd: () => void; bare?: boolean
}) {
  const answered = section.questions.filter((q) => answers[q.id]).length
  const body = (
    <>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">Daftar Soal</span>
        <span className="text-slate-500">{answered}/{section.questions.length}</span>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
        {section.questions.map((q, i) => {
          const isCur = i === current
          const ans = Boolean(answers[q.id])
          const fl = flagged.has(q.id)
          const locked = !allowBack && i < current
          return (
            <button key={q.id} disabled={locked} onClick={() => onGo(i)}
              className={cn('relative grid aspect-square place-items-center rounded-lg text-xs font-bold transition',
                isCur ? 'bg-brand-600 text-white ring-2 ring-brand-300' : ans ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                locked && 'opacity-40')}>
              {i + 1}
              {fl && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-amber-500 ring-2 ring-white" />}
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-brand-100" />Dijawab</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-slate-100 ring-1 ring-slate-200" />Belum</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-amber-500" />Ragu</span>
      </div>
      <Button variant="soft" className="mt-4 w-full" onClick={onEnd} icon={<CheckCircle2 className="size-4" />}>Selesai Subtes</Button>
    </>
  )
  if (bare) return body
  return <Card className="sticky top-24 p-4">{body}</Card>
}

