import { AlertTriangle, ChevronRight, Download, Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge, Button, Card, EmptyState, Input, PageLoader, Select } from '../../components/ui'
import { useDimensions } from '../../hooks/useDimensions'
import { errMsg, supabase } from '../../lib/supabase'
import type { Attempt, Test } from '../../lib/types'
import { REC_STYLE, cn, downloadFile, fmtDate, fmtDuration, round1, toCSV } from '../../lib/utils'
import { PageHeader } from './AdminLayout'

const RECS = ['Sangat Direkomendasikan', 'Direkomendasikan', 'Dipertimbangkan', 'Tidak Direkomendasikan', 'Perlu Verifikasi']

export default function Results() {
  const [rows, setRows] = useState<Attempt[] | null>(null)
  const [tests, setTests] = useState<Pick<Test, 'id' | 'title'>[]>([])
  const [f, setF] = useState({ q: '', test: '', status: '', rec: '', sort: 'newest' })
  const { dims, byKey } = useDimensions()

  useEffect(() => {
    supabase.from('attempts')
      .select('id,test_id,candidate,candidate_name,candidate_email,position,status,started_at,submitted_at,duration_sec,overall_score,recommendation,passed,flags,scores,tab_switches,tests(title)')
      .order('started_at', { ascending: false }).limit(2000)
      .then(({ data, error }) => { if (error) toast.error(errMsg(error)); setRows((data as any) || []) })
    supabase.from('tests').select('id,title').order('created_at', { ascending: false }).then(({ data }) => setTests(data || []))
  }, [])

  const list = useMemo(() => {
    let l = (rows || []).filter((r) =>
      (!f.test || r.test_id === f.test) && (!f.status || r.status === f.status) && (!f.rec || r.recommendation === f.rec) &&
      (!f.q || `${r.candidate_name} ${r.candidate_email} ${r.position}`.toLowerCase().includes(f.q.toLowerCase())))
    if (f.sort === 'score') l = [...l].sort((a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1))
    if (f.sort === 'name') l = [...l].sort((a, b) => (a.candidate_name || '').localeCompare(b.candidate_name || ''))
    return l
  }, [rows, f])

  function exportCSV() {
    const dimKeys = dims.map((d) => d.key)
    const head = ['Nama', 'Email', 'No. HP', 'Posisi', 'Paket Tes', 'Status', 'Mulai', 'Selesai', 'Durasi (detik)', 'Skor Total', 'Rekomendasi', 'Lulus', 'Pindah Tab', 'Catatan Validitas', ...dims.map((d) => d.name)]
    const body = list.map((r) => [
      r.candidate_name, r.candidate_email, r.candidate?.phone, r.position, r.tests?.title, r.status, fmtDate(r.started_at), fmtDate(r.submitted_at),
      r.duration_sec, r.overall_score, r.recommendation, r.passed == null ? '' : r.passed ? 'Ya' : 'Tidak', r.tab_switches,
      (r.flags || []).map((x) => x.message).join(' | '), ...dimKeys.map((k) => r.scores?.[k]?.pct ?? ''),
    ])
    downloadFile(`hasil-psikotes-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + toCSV([head, ...body]), 'text/csv;charset=utf-8')
  }

  if (!rows) return <PageLoader />
  const key = ['tingkat_stres', 'toleransi_tekanan', 'kerja_tim', 'integritas']

  return (
    <div>
      <PageHeader title="Hasil Peserta" subtitle={`${list.length} dari ${rows.length} peserta`}
        actions={<Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCSV} disabled={!list.length}>Ekspor CSV / Excel</Button>} />
      <Card className="mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Cari nama, email, posisi…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          </div>
          <Select value={f.test} onChange={(e) => setF({ ...f, test: e.target.value })}>
            <option value="">Semua paket tes</option>
            {tests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
          <Select value={f.rec} onChange={(e) => setF({ ...f, rec: e.target.value })}>
            <option value="">Semua rekomendasi</option>
            {RECS.map((r) => <option key={r}>{r}</option>)}
          </Select>
          <div className="flex gap-2">
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="">Semua status</option><option value="submitted">Selesai</option><option value="in_progress">Mengerjakan</option>
            </Select>
            <Select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}>
              <option value="newest">Terbaru</option><option value="score">Skor tertinggi</option><option value="name">Nama A–Z</option>
            </Select>
          </div>
        </div>
      </Card>

      {!list.length ? <Card><EmptyState icon={<Users className="size-6" />} title="Belum ada hasil" description="Hasil akan muncul setelah peserta mengerjakan tes." /></Card> : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[2fr_1.2fr_repeat(4,0.8fr)_1fr_1.3fr_24px] gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 lg:grid">
            <span>Peserta</span><span>Paket / Tanggal</span>
            {key.map((k) => <span key={k} className="text-center">{byKey[k]?.name?.split(' ')[0] || k}</span>)}
            <span className="text-center">Skor</span><span>Rekomendasi</span><span />
          </div>
          <div className="divide-y divide-slate-100">
            {list.map((r) => {
              const danger = (r.flags || []).some((x) => x.level === 'danger')
              return (
                <Link key={r.id} to={`/admin/results/${r.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 lg:grid-cols-[2fr_1.2fr_repeat(4,0.8fr)_1fr_1.3fr_24px]">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-violet-100 text-sm font-bold text-brand-700">{r.candidate_name?.[0]?.toUpperCase()}</div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-semibold text-slate-800">{r.candidate_name}{danger && <AlertTriangle className="size-3.5 shrink-0 text-rose-500" />}</p>
                      <p className="truncate text-xs text-slate-500">{r.position || r.candidate_email || '-'}</p>
                    </div>
                  </div>
                  <div className="hidden min-w-0 lg:block">
                    <p className="truncate text-sm text-slate-700">{r.tests?.title}</p>
                    <p className="text-xs text-slate-400">{fmtDate(r.submitted_at || r.started_at)} · {fmtDuration(r.duration_sec)}</p>
                  </div>
                  {key.map((k) => {
                    const v = r.scores?.[k]?.pct
                    const bad = byKey[k]?.higher_is_better === false
                    const good = v == null ? null : bad ? v < 40 : v >= 70
                    const poor = v == null ? null : bad ? v >= 70 : v < 40
                    return <span key={k} className={cn('hidden text-center text-sm font-semibold tabular-nums lg:block', good ? 'text-emerald-600' : poor ? 'text-rose-600' : 'text-slate-600')}>{v == null ? '–' : Math.round(v)}</span>
                  })}
                  <span className="hidden text-center text-lg font-extrabold tabular-nums text-slate-900 lg:block">{r.status === 'submitted' ? round1(r.overall_score) : '–'}</span>
                  <div className="flex items-center justify-end gap-2 lg:justify-start">
                    <span className="text-base font-extrabold tabular-nums text-slate-900 lg:hidden">{r.status === 'submitted' ? round1(r.overall_score) : ''}</span>
                    {r.status === 'submitted'
                      ? <Badge className={cn('ring-0', REC_STYLE[r.recommendation || ''])}>{r.recommendation}</Badge>
                      : <Badge className="bg-sky-50 text-sky-700 ring-sky-200">Sedang mengerjakan</Badge>}
                  </div>
                  <ChevronRight className="hidden size-4 text-slate-300 lg:block" />
                </Link>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
