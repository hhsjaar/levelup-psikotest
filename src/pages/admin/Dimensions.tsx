import { ChevronDown, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, Field, Input, PageLoader, Switch, Textarea } from '../../components/ui'
import { useDimensions } from '../../hooks/useDimensions'
import { errMsg, supabase } from '../../lib/supabase'
import type { Dimension } from '../../lib/types'
import { GROUP_LABEL, cn } from '../../lib/utils'
import { PageHeader } from './AdminLayout'

export default function DimensionsPage() {
  const { dims, loading, reload } = useDimensions()
  const [list, setList] = useState<Dimension[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  useEffect(() => setList(dims), [dims])

  const upd = (key: string, p: Partial<Dimension>) => {
    setList((l) => l.map((d) => (d.key === key ? { ...d, ...p } : d)))
    setDirty((s) => new Set(s).add(key))
  }
  async function save() {
    setSaving(true)
    const rows = list.filter((d) => dirty.has(d.key))
    const { error } = await supabase.from('dimensions').upsert(rows)
    setSaving(false)
    if (error) return toast.error(errMsg(error))
    toast.success(`${rows.length} aspek tersimpan. Gunakan "Hitung Ulang" di paket tes agar ambang baru diterapkan pada hasil lama.`)
    setDirty(new Set()); reload()
  }

  if (loading) return <PageLoader />
  const groups = ['kognitif', 'kinerja', 'kepribadian', 'validitas']

  return (
    <div>
      <PageHeader title="Aspek & Norma Penilaian" subtitle="Atur nama aspek, ambang kategori Rendah/Sedang/Tinggi, arah skor, dan teks interpretasi laporan."
        actions={<Button onClick={save} loading={saving} disabled={!dirty.size} icon={<Save className="size-4" />}>Simpan {dirty.size ? `(${dirty.size})` : ''}</Button>} />
      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">{GROUP_LABEL[g]}</h2>
            <Card className="divide-y divide-slate-100 overflow-hidden">
              {list.filter((d) => d.group_name === g).map((d) => (
                <div key={d.key}>
                  <button onClick={() => setOpen(open === d.key ? null : d.key)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50">
                    <span className="size-3 shrink-0 rounded-full" style={{ background: d.color || '#6366f1' }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800">{d.name}{dirty.has(d.key) && <span className="ml-2 text-xs text-amber-600">• belum disimpan</span>}</p>
                      <p className="truncate text-xs text-slate-500">{d.description}</p>
                    </div>
                    <div className="hidden w-48 sm:block">
                      <div className="flex h-2 overflow-hidden rounded-full">
                        <div className="bg-rose-300" style={{ width: `${d.low_threshold}%` }} />
                        <div className="bg-amber-300" style={{ width: `${d.high_threshold - d.low_threshold}%` }} />
                        <div className="flex-1 bg-emerald-300" />
                      </div>
                      <p className="mt-1 flex justify-between text-[10px] text-slate-400"><span>0</span><span>{d.low_threshold}</span><span>{d.high_threshold}</span><span>100</span></p>
                    </div>
                    <ChevronDown className={cn('size-4 text-slate-400 transition', open === d.key && 'rotate-180')} />
                  </button>
                  {open === d.key && (
                    <div className="grid gap-4 bg-slate-50/50 px-5 pb-5 sm:grid-cols-2">
                      <Field label="Nama aspek"><Input value={d.name} onChange={(e) => upd(d.key, { name: e.target.value })} /></Field>
                      <Field label="Warna"><Input type="color" className="p-1" value={d.color || '#6366f1'} onChange={(e) => upd(d.key, { color: e.target.value })} /></Field>
                      <Field label="Deskripsi" className="sm:col-span-2"><Input value={d.description || ''} onChange={(e) => upd(d.key, { description: e.target.value })} /></Field>
                      <Field label="Batas Rendah → Sedang"><Input type="number" min={0} max={100} value={d.low_threshold} onChange={(e) => upd(d.key, { low_threshold: Number(e.target.value) })} /></Field>
                      <Field label="Batas Sedang → Tinggi"><Input type="number" min={0} max={100} value={d.high_threshold} onChange={(e) => upd(d.key, { high_threshold: Number(e.target.value) })} /></Field>
                      <div className="sm:col-span-2"><Switch checked={d.higher_is_better} onChange={(v) => upd(d.key, { higher_is_better: v })} label="Skor tinggi = baik" description="Matikan untuk aspek seperti Tingkat Stres atau Kecenderungan Pencitraan." /></div>
                      <Field label="Interpretasi skor rendah"><Textarea value={d.interp_low || ''} onChange={(e) => upd(d.key, { interp_low: e.target.value })} /></Field>
                      <Field label="Interpretasi skor sedang"><Textarea value={d.interp_mid || ''} onChange={(e) => upd(d.key, { interp_mid: e.target.value })} /></Field>
                      <Field label="Interpretasi skor tinggi" className="sm:col-span-2"><Textarea value={d.interp_high || ''} onChange={(e) => upd(d.key, { interp_high: e.target.value })} /></Field>
                      <p className="text-xs text-slate-400 sm:col-span-2">Kunci internal: <code>{d.key}</code></p>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}
