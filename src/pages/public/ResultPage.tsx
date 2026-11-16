import { motion } from 'framer-motion'
import { CheckCircle2, Home } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Card, Logo, PageLoader } from '../../components/ui'
import { DimensionBars, ProfileRadar, ScoreRing } from '../../components/report'
import { errMsg, supabase } from '../../lib/supabase'
import { GROUP_LABEL, fmtDate, fmtDuration } from '../../lib/utils'

export default function ResultPage() {
  const { token = '' } = useParams()
  const [r, setR] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('get_candidate_result', { p_token: token }).then(({ data, error }) => {
      if (error) setError(errMsg(error))
      else setR(data)
    })
  }, [token])

  if (error) return <div className="grid min-h-full place-items-center p-6 text-sm text-slate-500">{error}</div>
  if (!r) return <PageLoader label="Memuat hasil…" />

  const dims: any[] = r.dimensions || []
  const groups = ['kognitif', 'kinerja', 'kepribadian'].map((g) => ({ g, items: dims.filter((d) => d.group_name === g) })).filter((x) => x.items.length)
  const personality = dims.filter((d) => d.group_name === 'kepribadian')

  return (
    <div className="min-h-full bg-slate-50">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 pb-16 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden">
            <div className="flex flex-col items-center gap-6 bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-center text-white sm:flex-row sm:text-left">
              <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/20"><CheckCircle2 className="size-9" /></div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Terima kasih, {r.candidate_name}!</h1>
                <p className="mt-1 text-emerald-50">
                  {r.status === 'submitted'
                    ? `Jawaban untuk "${r.test_title}" telah berhasil dikumpulkan pada ${fmtDate(r.submitted_at)}.`
                    : 'Tes Anda belum dikumpulkan.'}
                </p>
              </div>
            </div>
            {r.show_result === 'none' && (
              <div className="p-6 text-sm leading-relaxed text-slate-600 sm:p-8">
                Hasil psikotes akan dianalisis oleh tim rekrutmen. Anda akan dihubungi untuk informasi tahap selanjutnya. Halaman ini boleh ditutup.
              </div>
            )}
          </Card>
        </motion.div>

        {r.show_result !== 'none' && r.status === 'submitted' && (
          <>
            <div className="grid gap-6 md:grid-cols-5">
              {r.show_result === 'full' && (
                <Card className="flex flex-col items-center justify-center p-6 md:col-span-2">
                  <ScoreRing value={r.overall_score} size={160} label="Skor Total" />
                  <p className="mt-3 text-sm text-slate-500">Durasi pengerjaan {fmtDuration(r.duration_sec)}</p>
                </Card>
              )}
              {personality.length >= 3 && (
                <Card className={r.show_result === 'full' ? 'p-4 md:col-span-3' : 'p-4 md:col-span-5'}>
                  <h2 className="px-2 pt-2 font-semibold text-slate-900">Profil Kepribadian Kerja</h2>
                  <ProfileRadar items={personality.map((d) => ({ name: d.name, pct: d.higher_is_better ? d.pct : 100 - d.pct }))} height={300} />
                  <p className="px-2 text-xs text-slate-400">* Tingkat stres ditampilkan terbalik (semakin luar = semakin rendah stres).</p>
                </Card>
              )}
            </div>
            {groups.map(({ g, items }) => (
              <Card key={g} className="p-5 sm:p-6">
                <h2 className="mb-4 font-semibold text-slate-900">{GROUP_LABEL[g]}</h2>
                <DimensionBars items={items.map((d) => ({ dim: d, pct: d.pct }))} />
              </Card>
            ))}
            <p className="text-center text-xs text-slate-400">Hasil ini bersifat indikatif dan bukan diagnosis psikologis. Keputusan akhir ditentukan oleh tim rekrutmen.</p>
          </>
        )}
        <div className="text-center"><Link to="/"><Button variant="secondary" icon={<Home className="size-4" />}>Kembali ke beranda</Button></Link></div>
      </main>
    </div>
  )
}
