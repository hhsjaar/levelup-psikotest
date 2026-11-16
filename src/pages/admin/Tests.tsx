import { motion } from 'framer-motion'
import { ClipboardList, Clock, Copy, ExternalLink, Layers, Link2, MoreHorizontal, Pencil, Plus, Power, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { sampleTest } from '../../data/bank/index.js'
import { Badge, Button, Card, Confirm, EmptyState, PageLoader } from '../../components/ui'
import { errMsg, supabase } from '../../lib/supabase'
import type { Test } from '../../lib/types'
import { TYPE_SHORT, cn, fmtDate, fmtDuration, genCode, testLink } from '../../lib/utils'
import { PageHeader } from './AdminLayout'

export function sectionTime(s: any) {
  if (s.type === 'kraepelin') return (s.kraepelin?.columns || 0) * (s.kraepelin?.seconds_per_column || 15)
  return s.time_limit_sec || 0
}

export default function Tests() {
  const [tests, setTests] = useState<(Test & { attempts?: { count: number }[] })[] | null>(null)
  const [del, setDel] = useState<Test | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const nav = useNavigate()

  const load = () => supabase.from('tests').select('*, attempts(count)').order('created_at', { ascending: false })
    .then(({ data, error }) => { if (error) toast.error(errMsg(error)); setTests((data as any) || []) })
  useEffect(() => { load() }, [])

  async function duplicate(t: Test) {
    const { id, created_at, updated_at, attempts, ...rest } = t as any
    const { data, error } = await supabase.from('tests').insert({ ...rest, title: `${t.title} (Salinan)`, access_code: genCode() }).select().single()
    if (error) return toast.error(errMsg(error))
    toast.success('Paket tes diduplikasi')
    nav(`/admin/tests/${data.id}`)
  }
  async function toggle(t: Test) {
    const { error } = await supabase.from('tests').update({ is_active: !t.is_active }).eq('id', t.id)
    if (error) return toast.error(errMsg(error))
    load()
  }
  async function remove() {
    if (!del) return
    const { error } = await supabase.from('tests').delete().eq('id', del.id)
    if (error) return toast.error(errMsg(error))
    toast.success('Paket tes dihapus')
    setDel(null); load()
  }
  async function createSample() {
    const { error } = await supabase.from('tests').insert({ ...sampleTest, access_code: tests?.some((t) => t.access_code === sampleTest.access_code) ? genCode() : sampleTest.access_code })
    if (error) return toast.error(errMsg(error))
    toast.success('Paket tes standar dibuat'); load()
  }
  const copy = (t: Test) => { navigator.clipboard.writeText(testLink(t.access_code)); toast.success('Link tes disalin') }

  if (!tests) return <PageLoader />

  return (
    <div onClick={() => setMenu(null)}>
      <PageHeader title="Paket Tes" subtitle="Susun kombinasi subtes, jumlah soal, waktu, dan aturan penilaian untuk setiap posisi."
        actions={<>
          <Button variant="secondary" onClick={createSample} icon={<Layers className="size-4" />}>Template Standar</Button>
          <Link to="/admin/tests/new"><Button icon={<Plus className="size-4" />}>Paket Baru</Button></Link>
        </>} />

      {!tests.length ? (
        <Card><EmptyState icon={<ClipboardList className="size-6" />} title="Belum ada paket tes"
          description="Buat paket tes dari nol atau gunakan template standar rekrutmen (verbal, numerik, logika, Kraepelin, kepribadian, SJT)."
          action={<div className="flex gap-2"><Button variant="secondary" onClick={createSample}>Gunakan Template</Button><Link to="/admin/tests/new"><Button>Buat Paket</Button></Link></div>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tests.map((t, i) => {
            const total = t.sections.reduce((s, x) => s + sectionTime(x), 0)
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className="flex h-full flex-col p-5 transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('size-2 rounded-full', t.is_active ? 'bg-emerald-500' : 'bg-slate-300')} />
                        <span className="text-xs font-semibold text-slate-500">{t.is_active ? 'Aktif' : 'Nonaktif'}</span>
                      </div>
                      <Link to={`/admin/tests/${t.id}`} className="mt-1 block font-bold text-slate-900 hover:text-brand-700">{t.title}</Link>
                    </div>
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setMenu(menu === t.id ? null : t.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><MoreHorizontal className="size-5" /></button>
                      {menu === t.id && (
                        <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-xl bg-white py-1 text-sm shadow-lg ring-1 ring-slate-200">
                          <MenuItem icon={<Pencil />} onClick={() => nav(`/admin/tests/${t.id}`)}>Edit</MenuItem>
                          <MenuItem icon={<Copy />} onClick={() => duplicate(t)}>Duplikat</MenuItem>
                          <MenuItem icon={<Power />} onClick={() => toggle(t)}>{t.is_active ? 'Nonaktifkan' : 'Aktifkan'}</MenuItem>
                          <MenuItem icon={<ExternalLink />} onClick={() => window.open(`/t/${t.access_code}`, '_blank')}>Pratinjau</MenuItem>
                          <MenuItem icon={<Trash2 />} danger onClick={() => setDel(t)}>Hapus</MenuItem>
                        </div>
                      )}
                    </div>
                  </div>
                  {t.description && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{t.description}</p>}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {t.sections.map((s, j) => <Badge key={j}>{TYPE_SHORT[s.type]}</Badge>)}
                  </div>
                  <div className="mt-auto pt-5">
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs">
                      <div><Layers className="mx-auto mb-1 size-4 text-slate-400" /><b className="text-slate-800">{t.sections.length}</b> subtes</div>
                      <div><Clock className="mx-auto mb-1 size-4 text-slate-400" /><b className="text-slate-800">{fmtDuration(total)}</b></div>
                      <div><Users className="mx-auto mb-1 size-4 text-slate-400" /><b className="text-slate-800">{t.attempts?.[0]?.count ?? 0}</b> peserta</div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button onClick={() => copy(t)} className="flex flex-1 items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-left text-sm font-bold tracking-wider text-brand-700 hover:bg-brand-100">
                        <Link2 className="size-4" />{t.access_code}<span className="ml-auto text-xs font-medium tracking-normal text-brand-500">Salin link</span>
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">Diperbarui {fmtDate(t.updated_at)}</p>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger confirmText="Hapus"
        title="Hapus paket tes?" message={<>Paket <b>{del?.title}</b> beserta <b>seluruh data hasil peserta</b>-nya akan dihapus permanen dan tidak dapat dikembalikan.</>} />
    </div>
  )
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactElement<any>; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 [&>svg]:size-4', danger ? 'text-rose-600' : 'text-slate-700')}>
      {icon}{children}
    </button>
  )
}
