import { Bot, CheckCircle2, Copy, KeyRound, MessageCircle, Plus, ShieldOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge, Button, Card, CardHeader, Confirm, EmptyState, Field, Input, Modal, PageLoader } from '../../components/ui'
import { errMsg, supabase } from '../../lib/supabase'
import { cn, fmtDate } from '../../lib/utils'
import { PageHeader } from './AdminLayout'

interface Tok { id: string; name: string; token_hint: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null }

const EXAMPLES = [
  'Buat psikotes kasir: numerik, kraepelin, kepribadian fokus integritas & kerja tim, tutup 31 Des',
  'Kirim link psikotes KASIR01 ke 0812xxxx atas nama Budi',
  'Siapa saja yang sudah selesai psikotes kasir? Urutkan dari skor tertinggi',
  'Bagaimana hasil psikotes Siti? Tingkat stres dan kejujurannya berapa?',
  'Tambah soal numerik: 15% dari 80 = …, pilihan 10/12/14/16, jawaban B',
  'Nonaktifkan paket DEMO2026',
]

export default function Integrations() {
  const [list, setList] = useState<Tok[] | null>(null)
  const [name, setName] = useState('Levelup AI Agent (WhatsApp)')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  const [revoke, setRevoke] = useState<Tok | null>(null)
  const appUrl = window.location.origin

  const load = () => supabase.from('agent_tokens').select('id,name,token_hint,created_at,last_used_at,revoked_at').order('created_at', { ascending: false })
    .then(({ data, error }) => { if (error) toast.error(errMsg(error)); setList((data as Tok[]) || []) })
  useEffect(() => { load() }, [])

  async function create() {
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_create_agent_token', { p_name: name })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    setCreated(data.token)
    load()
  }
  async function doRevoke() {
    if (!revoke) return
    const { error } = await supabase.rpc('admin_revoke_agent_token', { p_id: revoke.id })
    if (error) return toast.error(errMsg(error))
    toast.success('Token dicabut'); setRevoke(null); load()
  }
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success('Disalin') }
  const envText = (tok: string) => `PSIKOTEST_URL=${appUrl}\nPSIKOTEST_AGENT_TOKEN=${tok}`

  if (!list) return <PageLoader />

  return (
    <div>
      <PageHeader title="Integrasi Agen AI" subtitle="Hubungkan Levelup AI Agent agar Anda bisa mengelola psikotes dan mengirim link tes langsung dari WhatsApp." />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Token Agen" subtitle="Token memberi akses penuh (baca, ubah, hapus) lewat API agen. Simpan hanya di environment agen." icon={<KeyRound className="size-4" />} />
            <div className="flex flex-col gap-2 px-5 pb-4 sm:flex-row sm:items-end">
              <Field label="Nama token" className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Button onClick={create} loading={busy} icon={<Plus className="size-4" />}>Buat Token</Button>
            </div>
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {list.map((t) => (
                <div key={t.id} className={cn('flex items-center gap-3 px-5 py-3.5', t.revoked_at && 'opacity-50')}>
                  <div className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><Bot className="size-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{t.name} <span className="font-mono text-xs text-slate-400">lvpt_…{t.token_hint}</span></p>
                    <p className="text-xs text-slate-500">Dibuat {fmtDate(t.created_at)} · {t.last_used_at ? `terakhir dipakai ${fmtDate(t.last_used_at)}` : 'belum pernah dipakai'}</p>
                  </div>
                  {t.revoked_at ? <Badge>Dicabut</Badge> : (
                    <>
                      {t.last_used_at && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200"><CheckCircle2 className="size-3" />Terhubung</Badge>}
                      <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" icon={<ShieldOff className="size-3.5" />} onClick={() => setRevoke(t)}>Cabut</Button>
                    </>
                  )}
                </div>
              ))}
              {!list.length && <EmptyState icon={<KeyRound className="size-6" />} title="Belum ada token" description="Buat token lalu tempel ke environment Levelup AI Agent." />}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h3 className="font-semibold text-slate-900">Cara menghubungkan</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Klik <b>Buat Token</b>, salin dua baris environment yang muncul (token hanya ditampilkan sekali).</li>
              <li>Buka Vercel → project <b>levelupaiagent</b> → Settings → Environment Variables, tambahkan <code>PSIKOTEST_URL</code> dan <code>PSIKOTEST_AGENT_TOKEN</code>, lalu Redeploy.</li>
              <li>Chat agen di WhatsApp, mis. "info psikotes". Status token berubah menjadi <b>Terhubung</b>.</li>
            </ol>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-600">Endpoint: {appUrl}/api/agent</p>
          </Card>
        </div>

        <Card className="h-fit p-5">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900"><MessageCircle className="size-4 text-emerald-600" />Contoh perintah WhatsApp</h3>
          <ul className="mt-4 space-y-2">
            {EXAMPLES.map((e) => <li key={e} className="rounded-xl bg-emerald-50/60 px-3 py-2 text-sm text-slate-700 ring-1 ring-emerald-100">“{e}”</li>)}
          </ul>
          <p className="mt-4 text-xs text-slate-500">Aksi yang mengirim pesan atau menghapus data akan meminta persetujuan Anda terlebih dahulu di WhatsApp.</p>
        </Card>
      </div>

      <Modal open={!!created} onClose={() => setCreated(null)} title="Token berhasil dibuat" size="md"
        footer={<Button onClick={() => setCreated(null)}>Selesai</Button>}>
        {created && (
          <div className="space-y-4 text-sm">
            <p className="rounded-xl bg-amber-50 p-3 text-amber-800 ring-1 ring-amber-200">Salin sekarang. Demi keamanan token <b>tidak bisa ditampilkan lagi</b>.</p>
            <div>
              <p className="mb-1.5 font-medium text-slate-700">Environment untuk Levelup AI Agent</p>
              <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-emerald-300">{envText(created)}</pre>
              <Button className="mt-2" variant="secondary" size="sm" icon={<Copy className="size-3.5" />} onClick={() => copy(envText(created))}>Salin keduanya</Button>
            </div>
          </div>
        )}
      </Modal>
      <Confirm open={!!revoke} onClose={() => setRevoke(null)} onConfirm={doRevoke} danger confirmText="Cabut token" title="Cabut token?"
        message={<>Agen yang memakai token <b>{revoke?.name}</b> tidak akan bisa mengakses psikotest lagi sampai diberi token baru.</>} />
    </div>
  )
}
