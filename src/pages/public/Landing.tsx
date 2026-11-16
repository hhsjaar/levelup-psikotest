import { motion } from 'framer-motion'
import { ArrowRight, Brain, Gauge, HeartHandshake, KeyRound, ShieldCheck, Timer, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Logo } from '../../components/ui'

const FEATURES = [
  { icon: Brain, title: 'Kemampuan Kognitif', desc: 'Verbal, numerik, penalaran logis, dan figural dengan tingkat kesulitan berjenjang.' },
  { icon: Timer, title: 'Tes Kraepelin', desc: 'Mengukur kecepatan, ketelitian, stabilitas, dan ketahanan kerja di bawah tekanan waktu.' },
  { icon: HeartHandshake, title: 'Kepribadian Kerja', desc: 'Stres, ketahanan tekanan, kerja tim, integritas, tanggung jawab, dan lainnya.' },
  { icon: ShieldCheck, title: 'Validitas Jawaban', desc: 'Lie scale, cek konsistensi, deteksi pindah tab, dan respons terlalu cepat.' },
]

export default function Landing() {
  const [code, setCode] = useState('')
  const nav = useNavigate()
  const go = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim()) nav(`/t/${code.trim().toUpperCase()}`)
  }
  return (
    <div className="min-h-full bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Link to="/admin" className="text-sm font-semibold text-slate-600 hover:text-brand-600">Masuk Admin →</Link>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="absolute -top-40 left-1/2 h-[480px] w-[880px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-200/60 via-violet-200/40 to-sky-100/40 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 pt-14 pb-20 text-center sm:px-6 sm:pt-20">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
              <Gauge className="size-3.5" /> Psikotes rekrutmen karyawan berbasis web
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
              Kenali potensi kandidat <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">secara utuh</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-slate-600 sm:text-lg">
              Kerjakan psikotes dengan nyaman di perangkat apa pun. Masukkan kode akses yang diberikan oleh tim rekrutmen untuk memulai.
            </p>
          </motion.div>

          <motion.form onSubmit={go} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mx-auto mt-9 flex max-w-md flex-col gap-2 rounded-2xl bg-white p-2 shadow-xl shadow-brand-900/5 ring-1 ring-slate-200 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 px-3">
              <KeyRound className="size-5 text-slate-400" />
              <input
                value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Masukkan kode tes, mis. DEMO2026"
                className="h-12 w-full bg-transparent text-base font-semibold tracking-wider text-slate-800 uppercase placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <Button size="lg" type="submit" disabled={!code.trim()}>Mulai <ArrowRight className="size-4" /></Button>
          </motion.form>
          <p className="mt-3 text-xs text-slate-400">Belum punya kode? Hubungi HR / tim rekrutmen perusahaan Anda.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
              className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100">
              <div className="grid size-10 place-items-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-slate-100"><f.icon className="size-5" /></div>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{f.desc}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-brand-600 to-violet-600 p-8 text-center text-white sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-4">
            <div className="hidden size-12 place-items-center rounded-2xl bg-white/15 sm:grid"><Users className="size-6" /></div>
            <div>
              <h3 className="text-lg font-bold">Tim HR / Rekruter?</h3>
              <p className="text-sm text-brand-100">Atur paket tes, bank soal, skoring, dan analisis hasil kandidat dari panel admin.</p>
            </div>
          </div>
          <Link to="/admin"><Button variant="secondary" size="lg">Buka Panel Admin</Button></Link>
        </div>
      </section>
      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} LevelUp Psikotest</footer>
    </div>
  )
}
