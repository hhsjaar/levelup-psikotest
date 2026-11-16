import { Activity, ArrowRight, CheckCircle2, ClipboardList, Database, FileQuestion, Timer, TrendingUp, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Card, CardHeader, EmptyState, PageLoader, StatCard } from '../../components/ui'
import { useDimensions } from '../../hooks/useDimensions'
import { supabase } from '../../lib/supabase'
import type { Attempt } from '../../lib/types'
import { REC_STYLE, cn, fmtDate, fmtDuration, round1 } from '../../lib/utils'
import { PageHeader } from './AdminLayout'

const REC_COLORS: Record<string, string> = {
  'Sangat Direkomendasikan': '#059669', Direkomendasikan: '#34d399', Dipertimbangkan: '#f59e0b',
  'Tidak Direkomendasikan': '#f43f5e', 'Perlu Verifikasi': '#8b5cf6', 'Belum Dapat Dinilai': '#94a3b8',
}

export default function Dashboard() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null)
  const [counts, setCounts] = useState({ questions: 0, tests: 0 })
  const { dims } = useDimensions()

  useEffect(() => {
    supabase.from('attempts')
      .select('id,candidate_name,position,status,started_at,submitted_at,duration_sec,overall_score,recommendation,scores,flags,tests(title)')
      .order('started_at', { ascending: false }).limit(1000)
      .then(({ data }) => setAttempts((data as any) || []))
    Promise.all([
      supabase.from('questions').select('id', { count: 'exact', head: true }),
      supabase.from('tests').select('id', { count: 'exact', head: true }),
    ]).then(([q, t]) => setCounts({ questions: q.count || 0, tests: t.count || 0 }))
  }, [])

  const stats = useMemo(() => {
    const a = attempts || []
    const done = a.filter((x) => x.status === 'submitted')
    const avg = done.length ? done.reduce((s, x) => s + (x.overall_score || 0), 0) / done.length : null
    const rec = done.filter((x) => ['Sangat Direkomendasikan', 'Direkomendasikan'].includes(x.recommendation || '')).length
    const avgDur = done.length ? done.reduce((s, x) => s + (x.duration_sec || 0), 0) / done.length : null
    // 14 hari terakhir
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i))
      return d
    })
    const trend = days.map((d) => {
      const n = new Date(d); n.setDate(n.getDate() + 1)
      return {
        hari: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
        Mulai: a.filter((x) => new Date(x.started_at) >= d && new Date(x.started_at) < n).length,
        Selesai: done.filter((x) => x.submitted_at && new Date(x.submitted_at) >= d && new Date(x.submitted_at) < n).length,
      }
    })
    const recDist = Object.entries(done.reduce((m: Record<string, number>, x) => {
      const k = x.recommendation || 'Belum Dapat Dinilai'
      m[k] = (m[k] || 0) + 1
      return m
    }, {})).map(([name, value]) => ({ name, value }))
    const dimAvg = dims.filter((d) => d.group_name !== 'validitas').map((d) => {
      const vals = done.map((x) => x.scores?.[d.key]?.pct).filter((v): v is number => v != null)
      return { name: d.name.replace('Kemampuan ', ''), key: d.key, color: d.color, pct: vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null }
    }).filter((x) => x.pct != null)
    return { total: a.length, done: done.length, avg, rec, avgDur, trend, recDist, dimAvg, inProgress: a.length - done.length }
  }, [attempts, dims])

  if (!attempts) return <PageLoader />

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Ringkasan aktivitas psikotes dan performa kandidat." actions={
        <Link to="/admin/tests"><Button icon={<ClipboardList className="size-4" />}>Kelola Paket Tes</Button></Link>
      } />

      {counts.questions === 0 && (
        <Card className="mb-6 flex flex-col gap-4 bg-gradient-to-r from-brand-50 to-violet-50 p-5 ring-brand-100 sm:flex-row sm:items-center">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-sm"><Database className="size-5" /></div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Bank soal masih kosong</p>
            <p className="text-sm text-slate-600">Impor 255 soal bawaan (kognitif, kepribadian, SJT) dengan satu klik di halaman Bank Soal.</p>
          </div>
          <Link to="/admin/questions"><Button>Impor Bank Soal</Button></Link>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Peserta" value={stats.total} hint={`${stats.inProgress} sedang mengerjakan`} icon={<Users className="size-5" />} />
        <StatCard label="Tes Selesai" value={stats.done} hint={`${counts.tests} paket tes · ${counts.questions} soal`} icon={<CheckCircle2 className="size-5" />} tone="emerald" />
        <StatCard label="Rata-rata Skor" value={round1(stats.avg)} hint="Indeks kesesuaian keseluruhan" icon={<TrendingUp className="size-5" />} tone="amber" />
        <StatCard label="Direkomendasikan" value={stats.done ? `${Math.round((stats.rec / stats.done) * 100)}%` : '–'} hint={`Rata-rata durasi ${fmtDuration(stats.avgDur ? Math.round(stats.avgDur) : null)}`} icon={<Timer className="size-5" />} tone="sky" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Aktivitas 14 Hari Terakhir" icon={<Activity className="size-4" />} />
          <div className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.trend} margin={{ left: -20, right: 10 }}>
                <defs>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="1" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity={0.3} /><stop offset="1" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="hari" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="Mulai" stroke="#6366f1" fill="url(#gA)" strokeWidth={2} />
                <Area type="monotone" dataKey="Selesai" stroke="#10b981" fill="url(#gB)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Distribusi Rekomendasi" />
          {stats.recDist.length ? (
            <div className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={stats.recDist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {stats.recDist.map((e) => <Cell key={e.name} fill={REC_COLORS[e.name] || '#94a3b8'} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {stats.recDist.map((e) => (
                  <div key={e.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600"><span className="size-2.5 rounded-full" style={{ background: REC_COLORS[e.name] }} />{e.name}</span>
                    <span className="font-semibold text-slate-800">{e.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyState title="Belum ada data" description="Distribusi muncul setelah ada peserta yang menyelesaikan tes." />}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Rata-rata Skor per Aspek" subtitle="Seluruh peserta yang telah selesai" />
          {stats.dimAvg.length ? (
            <div className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={Math.max(220, stats.dimAvg.length * 26)}>
                <BarChart data={stats.dimAvg} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="pct" name="Skor" radius={[0, 6, 6, 0]} barSize={14}>
                    {stats.dimAvg.map((d) => <Cell key={d.key} fill={d.color || '#6366f1'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="Belum ada data" />}
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Peserta Terbaru" action={<Link to="/admin/results" className="text-sm font-semibold text-brand-600">Semua <ArrowRight className="inline size-3.5" /></Link>} />
          <div className="divide-y divide-slate-100 px-5 pb-3">
            {attempts.slice(0, 8).map((a) => (
              <Link key={a.id} to={`/admin/results/${a.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">{a.candidate_name?.[0]?.toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{a.candidate_name}</p>
                  <p className="truncate text-xs text-slate-500">{a.position || a.tests?.title} · {fmtDate(a.started_at)}</p>
                </div>
                {a.status === 'submitted'
                  ? <Badge className={cn('ring-0', REC_STYLE[a.recommendation || ''] || '')}>{round1(a.overall_score)}</Badge>
                  : <Badge className="bg-sky-50 text-sky-700 ring-sky-200">Proses</Badge>}
              </Link>
            ))}
            {!attempts.length && <EmptyState icon={<FileQuestion className="size-6" />} title="Belum ada peserta" description="Bagikan link tes kepada kandidat untuk mulai." />}
          </div>
        </Card>
      </div>
    </div>
  )
}
