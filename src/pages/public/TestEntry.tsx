import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight, CheckCircle2, Clock, ListChecks, PlayCircle, ShieldAlert, Wifi } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, Field, Input, Logo, PageLoader, Select } from '../../components/ui'
import { errMsg, supabase } from '../../lib/supabase'
import { TYPE_SHORT, cn, fmtDuration } from '../../lib/utils'

const FIELD_META: Record<string, { label: string; type?: string; placeholder?: string }> = {
  email: { label: 'Email', type: 'email', placeholder: 'nama@email.com' },
  phone: { label: 'No. HP / WhatsApp', type: 'tel', placeholder: '08xxxxxxxxxx' },
  position: { label: 'Posisi yang dilamar', placeholder: 'mis. Staff Admin' },
  education: { label: 'Pendidikan terakhir' },
  age: { label: 'Usia', type: 'number', placeholder: 'Tahun' },
  gender: { label: 'Jenis kelamin' },
}
const OPTIONAL_FIELDS = ['email', 'phone', 'position', 'education', 'age', 'gender']

export default function TestEntry() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const [test, setTest] = useState<any>(null)
  const [error, setError] = useState('')
  const [sp] = useSearchParams()
  // Prefill dari link undangan (mis. dikirim agen WhatsApp): ?nama=&wa=&email=&posisi=
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(
    ([['name', 'nama'], ['phone', 'wa'], ['email', 'email'], ['position', 'posisi']] as const)
      .map(([k, q]) => [k, (sp.get(q) || '').slice(0, 120)]).filter(([, v]) => v)))
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const storeKey = `psikotest:${code.toUpperCase()}`
  const [resumeToken, setResumeToken] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('get_public_test', { p_code: code }).then(({ data, error }) => {
      if (error) setError(errMsg(error))
      else setTest(data)
    })
    const t = localStorage.getItem(storeKey)
    if (t) {
      supabase.rpc('get_attempt', { p_token: t }).then(({ data }) => {
        if (data?.status === 'in_progress') setResumeToken(t)
        else localStorage.removeItem(storeKey)
      })
    }
  }, [code])

  const required: string[] = test?.settings?.require_fields || ['email']
  const totalTime = useMemo(() => (test?.sections || []).reduce((s: number, x: any) => {
    if (x.type === 'kraepelin') return s + (x.kraepelin?.columns || 0) * (x.kraepelin?.seconds_per_column || 15)
    return s + (x.time_limit_sec || 0)
  }, 0), [test])

  async function start(e: React.FormEvent) {
    e.preventDefault()
    if (!agree) return toast.error('Mohon centang persetujuan terlebih dahulu')
    setBusy(true)
    const { data, error } = await supabase.rpc('start_attempt', { p_code: code, p_candidate: form })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    localStorage.setItem(storeKey, data.token)
    nav(`/tes/${data.token}`)
  }

  if (error) {
    return (
      <div className="grid min-h-full place-items-center bg-slate-50 p-4">
        <Card className="max-w-md p-8 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600"><AlertCircle className="size-7" /></div>
          <h1 className="mt-4 text-lg font-bold">Tes tidak dapat dibuka</h1>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
          <Link to="/"><Button variant="secondary" className="mt-6">Kembali</Button></Link>
        </Card>
      </div>
    )
  }
  if (!test) return <PageLoader label="Memuat informasi tes…" />

  return (
    <div className="min-h-full bg-slate-50">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 pb-28 text-white">
        <div className="absolute inset-0 opacity-20 bg-grid" />
        <div className="relative mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <Link to="/"><Logo light /></Link>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-10 max-w-2xl">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wider">KODE: {test.access_code}</span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{test.title}</h1>
            {test.description && <p className="mt-3 text-brand-100">{test.description}</p>}
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <span className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2"><ListChecks className="size-4" />{test.sections.length} subtes</span>
              {totalTime > 0 && <span className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2"><Clock className="size-4" />± {fmtDuration(totalTime)}</span>}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="relative mx-auto -mt-20 grid max-w-5xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card className="p-5 sm:p-6">
            <h2 className="font-bold text-slate-900">Susunan Tes</h2>
            <ol className="mt-4 space-y-3">
              {test.sections.map((s: any, i: number) => (
                <li key={i} className="flex items-center gap-4 rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-sm font-bold text-brand-600 ring-1 ring-slate-200">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{s.title}</p>
                    <p className="text-xs text-slate-500">
                      {TYPE_SHORT[s.type as keyof typeof TYPE_SHORT]} · {s.type === 'kraepelin' ? `${s.kraepelin?.columns} lajur × ${s.kraepelin?.seconds_per_column} dtk` : `${s.question_count} soal`}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                    <Clock className="size-3.5" />
                    {s.type === 'kraepelin' ? fmtDuration((s.kraepelin?.columns || 0) * (s.kraepelin?.seconds_per_column || 15)) : s.time_limit_sec ? fmtDuration(s.time_limit_sec) : 'Bebas'}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="p-5 sm:p-6">
            <h2 className="font-bold text-slate-900">Petunjuk Umum</h2>
            {test.instructions && <p className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-line">{test.instructions}</p>}
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                [Wifi, 'Pastikan koneksi internet stabil. Jawaban tersimpan otomatis.'],
                [Clock, 'Setiap subtes memiliki batas waktu dan berpindah otomatis saat habis.'],
                [ShieldAlert, 'Jangan berpindah tab/aplikasi. Aktivitas ini tercatat oleh sistem.'],
                [CheckCircle2, 'Jawab dengan jujur – tidak ada jawaban benar/salah pada tes kepribadian.'],
              ].map(([Icon, t]: any, i) => (
                <li key={i} className="flex gap-3 rounded-xl bg-brand-50/50 p-3 text-sm text-slate-600"><Icon className="mt-0.5 size-4 shrink-0 text-brand-600" />{t}</li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="p-5 sm:p-6 lg:sticky lg:top-6">
            {resumeToken && (
              <div className="mb-5 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <p className="text-sm font-semibold text-amber-800">Anda memiliki tes yang belum selesai</p>
                <p className="mt-0.5 text-xs text-amber-700">Lanjutkan pengerjaan dari posisi terakhir.</p>
                <Button className="mt-3 w-full" variant="primary" icon={<PlayCircle className="size-4" />} onClick={() => nav(`/tes/${resumeToken}`)}>Lanjutkan Tes</Button>
              </div>
            )}
            <h2 className="font-bold text-slate-900">Data Peserta</h2>
            <p className="mt-1 text-sm text-slate-500">Isi data diri dengan benar sebelum memulai.</p>
            {!test.is_open ? (
              <div className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">Tes sedang tidak dalam periode pengerjaan.</div>
            ) : (
              <form onSubmit={start} className="mt-5 space-y-4">
                <Field label="Nama lengkap" required>
                  <Input required value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sesuai KTP" />
                </Field>
                {OPTIONAL_FIELDS.filter((f) => required.includes(f)).map((f) => (
                  <Field key={f} label={FIELD_META[f]?.label || f} required>
                    {f === 'education' ? (
                      <Select required value={form[f] || ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })}>
                        <option value="">Pilih…</option>
                        {['SMA/SMK', 'D3', 'S1/D4', 'S2', 'S3'].map((o) => <option key={o}>{o}</option>)}
                      </Select>
                    ) : f === 'gender' ? (
                      <Select required value={form[f] || ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })}>
                        <option value="">Pilih…</option><option>Laki-laki</option><option>Perempuan</option>
                      </Select>
                    ) : (
                      <Input required type={FIELD_META[f]?.type || 'text'} placeholder={FIELD_META[f]?.placeholder} value={form[f] || ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
                    )}
                  </Field>
                ))}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-100">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
                  <span>{test.settings?.consent_text || 'Saya menyatakan data yang saya isi benar, akan mengerjakan tes secara mandiri dan jujur, serta menyetujui data hasil tes digunakan untuk keperluan seleksi.'}</span>
                </label>
                <Button type="submit" size="lg" className={cn('w-full')} loading={busy}>Mulai Tes <ArrowRight className="size-4" /></Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
