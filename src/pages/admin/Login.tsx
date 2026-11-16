import { motion } from 'framer-motion'
import { AlertTriangle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, Field, Input, Logo } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { errMsg, isConfigured, supabase } from '../../lib/supabase'

export default function Login() {
  const { session, isAdmin, loading, refreshAdmin, signOut } = useAuth()
  const loc = useLocation() as any
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null)
  const [dbError, setDbError] = useState('')

  useEffect(() => {
    supabase.rpc('admin_exists').then(({ data, error }) => {
      if (error) setDbError(errMsg(error))
      else setHasAdmin(Boolean(data))
    })
  }, [])

  if (!loading && session && isAdmin) return <Navigate to={loc.state?.from || '/admin'} replace />

  const setup = hasAdmin === false

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (setup) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          toast.success('Akun dibuat. Silakan cek email untuk konfirmasi, lalu login kembali.')
          return
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
      const { data: claimed, error: cErr } = await supabase.rpc('claim_first_admin')
      if (cErr) throw cErr
      const ok = await refreshAdmin()
      if (!claimed || !ok) toast.error('Akun ini bukan administrator.')
      else toast.success('Selamat datang!')
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-violet-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <Link to="/" className="relative"><Logo light /></Link>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">Seleksi kandidat lebih objektif & terukur.</h2>
          <p className="mt-4 text-brand-100">Kelola paket tes, bank soal, skoring, serta analisis tingkat kesulitan soal dan profil psikologis kandidat dalam satu dashboard.</p>
        </div>
        <p className="relative text-xs text-brand-200">© {new Date().getFullYear()} LevelUp Psikotest</p>
      </div>
      <div className="grid place-items-center bg-slate-50 p-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <div className="mb-6">
            <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">{setup ? <ShieldCheck className="size-6" /> : <LockKeyhole className="size-6" />}</div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{setup ? 'Buat Akun Admin Pertama' : 'Masuk Panel Admin'}</h1>
            <p className="mt-1 text-sm text-slate-500">{setup ? 'Belum ada admin terdaftar. Akun yang Anda buat akan menjadi administrator utama.' : 'Gunakan email dan kata sandi administrator.'}</p>
          </div>
          {(!isConfigured || dbError) && (
            <Card className="mb-5 flex gap-3 bg-amber-50 p-4 text-sm text-amber-800 ring-amber-200">
              <AlertTriangle className="size-5 shrink-0" />
              <span>{!isConfigured ? 'Variabel VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY belum diatur.' : dbError}</span>
            </Card>
          )}
          {session && !isAdmin && !loading && (
            <Card className="mb-5 p-4 text-sm text-slate-600">
              Anda masuk sebagai <b>{session.user.email}</b> namun akun ini bukan admin.
              <button onClick={signOut} className="ml-1 font-semibold text-brand-600">Keluar</button>
            </Card>
          )}
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@perusahaan.com" /></Field>
            <Field label="Kata sandi" hint={setup ? 'Minimal 6 karakter.' : undefined}>
              <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>{setup ? 'Buat Akun & Masuk' : 'Masuk'}</Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500"><Link to="/" className="font-semibold text-brand-600">← Kembali ke beranda</Link></p>
        </motion.div>
      </div>
    </div>
  )
}
