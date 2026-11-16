import { CheckCircle2, Copy, Database, Download, FileQuestion, Pencil, Plus, Power, Search, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { dimensions as bankDims, questionBank } from '../../data/bank/index.js'
import { likertOptions } from '../../data/bank/helpers.js'
import { Badge, Button, Card, Confirm, EmptyState, Field, Input, Modal, PageLoader, Select, Switch, Textarea } from '../../components/ui'
import { useDimensions } from '../../hooks/useDimensions'
import { errMsg, supabase } from '../../lib/supabase'
import type { Difficulty, QOption, Question, QuestionType } from '../../lib/types'
import { DIFF_COLOR, DIFF_LABEL, TYPE_LABEL, TYPE_SHORT, cn, downloadFile, groupsForType } from '../../lib/utils'
import { PageHeader } from './AdminLayout'

const LETTERS = 'abcdef'
const PAGE = 30

export default function Questions() {
  const [items, setItems] = useState<Question[] | null>(null)
  const [f, setF] = useState({ q: '', type: '', category: '', difficulty: '', status: 'all' })
  const [edit, setEdit] = useState<Partial<Question> | null>(null)
  const [del, setDel] = useState<Question | null>(null)
  const [importing, setImporting] = useState(false)
  const [page, setPage] = useState(1)
  const fileRef = useRef<HTMLInputElement>(null)
  const { dims, byKey } = useDimensions()

  const load = () => supabase.from('questions').select('*').order('code').limit(5000)
    .then(({ data, error }) => { if (error) toast.error(errMsg(error)); setItems((data as any) || []) })
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => (items || []).filter((x) =>
    (!f.type || x.type === f.type) && (!f.category || x.category === f.category) && (!f.difficulty || x.difficulty === f.difficulty) &&
    (f.status === 'all' || (f.status === 'active' ? x.is_active : !x.is_active)) &&
    (!f.q || `${x.code} ${x.prompt} ${x.stimulus || ''}`.toLowerCase().includes(f.q.toLowerCase()))), [items, f])
  useEffect(() => setPage(1), [f])

  const summary = useMemo(() => {
    const s: Record<string, number> = {}
    for (const x of items || []) s[x.type] = (s[x.type] || 0) + 1
    return s
  }, [items])

  async function upsert(list: any[]) {
    const rows = list.map(({ id, created_at, updated_at, ...r }) => ({ ...r, is_active: r.is_active ?? true }))
    const withCode = rows.filter((r) => r.code)
    const noCode = rows.filter((r) => !r.code)
    for (let i = 0; i < withCode.length; i += 200) {
      const { error } = await supabase.from('questions').upsert(withCode.slice(i, i + 200), { onConflict: 'code' })
      if (error) throw error
    }
    if (noCode.length) {
      const { error } = await supabase.from('questions').insert(noCode)
      if (error) throw error
    }
    return rows.length
  }

  async function importDefault() {
    setImporting(true)
    try {
      // pastikan dimensi tersedia (tidak menimpa dimensi yang sudah diubah admin)
      const { error: dErr } = await supabase.from('dimensions').upsert(bankDims, { onConflict: 'key', ignoreDuplicates: true })
      if (dErr) throw dErr
      const n = await upsert(questionBank)
      toast.success(`${n} soal bawaan berhasil diimpor/diperbarui`)
      load()
    } catch (e) { toast.error(errMsg(e)) } finally { setImporting(false) }
  }

  async function importFile(file: File) {
    try {
      const json = JSON.parse(await file.text())
      const list = Array.isArray(json) ? json : json.questions
      if (!Array.isArray(list)) throw new Error('Format JSON harus berupa array soal')
      const n = await upsert(list)
      toast.success(`${n} soal diimpor`)
      load()
    } catch (e) { toast.error(errMsg(e)) }
  }

  async function toggle(q: Question) {
    await supabase.from('questions').update({ is_active: !q.is_active }).eq('id', q.id)
    setItems((it) => it?.map((x) => (x.id === q.id ? { ...x, is_active: !q.is_active } : x)) || null)
  }
  async function remove() {
    if (!del) return
    const { error } = await supabase.from('questions').delete().eq('id', del.id)
    if (error) return toast.error(errMsg(error))
    toast.success('Soal dihapus'); setDel(null); load()
  }

  if (!items) return <PageLoader />
  const pageItems = filtered.slice((page - 1) * PAGE, page * PAGE)
  const pages = Math.ceil(filtered.length / PAGE)
  const catOptions = dims.filter((d) => !f.type || groupsForType(f.type as QuestionType).includes(d.group_name))

  return (
    <div>
      <PageHeader title="Bank Soal" subtitle={`${items.length} soal · ${summary.cognitive || 0} kognitif · ${summary.likert || 0} likert · ${summary.sjt || 0} SJT`}
        actions={<>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>Impor JSON</Button>
          <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => downloadFile('bank-soal.json', JSON.stringify(filtered.map(({ id, created_at, updated_at, ...r }) => r), null, 2), 'application/json')}>Ekspor</Button>
          <Button variant="secondary" icon={<Database className="size-4" />} loading={importing} onClick={importDefault}>Impor Bawaan ({questionBank.length})</Button>
          <Button icon={<Plus className="size-4" />} onClick={() => setEdit({ type: 'cognitive', category: 'verbal', difficulty: 'sedang', prompt: '', options: blankOptions('cognitive', 'verbal'), meta: {}, is_active: true })}>Soal Baru</Button>
        </>} />

      <Card className="mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Cari kode atau teks soal…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          </div>
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, category: '' })}>
            <option value="">Semua tipe</option>
            {(['cognitive', 'likert', 'sjt'] as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_SHORT[t]}</option>)}
          </Select>
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option value="">Semua kategori</option>
            {catOptions.filter((d) => d.group_name !== 'kinerja' && d.key !== 'konsistensi').map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
          </Select>
          <Select value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>
            <option value="">Semua kesulitan</option>
            {(['mudah', 'sedang', 'sulit'] as Difficulty[]).map((d) => <option key={d} value={d}>{DIFF_LABEL[d]}</option>)}
          </Select>
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option>
          </Select>
        </div>
      </Card>

      {!items.length ? (
        <Card><EmptyState icon={<FileQuestion className="size-6" />} title="Bank soal kosong"
          description="Impor 255 soal bawaan hasil riset (TIU verbal/numerik/logika/figural, inventori kepribadian kerja berbasis Big Five & HEXACO, lie scale, dan SJT) atau buat soal sendiri."
          action={<Button loading={importing} onClick={importDefault} icon={<Database className="size-4" />}>Impor Bank Soal Bawaan</Button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-slate-100">
            {pageItems.map((q) => (
              <div key={q.id} className={cn('flex items-start gap-4 p-4 transition hover:bg-slate-50/60', !q.is_active && 'opacity-50')}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-slate-400">{q.code || '—'}</span>
                    <Badge>{TYPE_SHORT[q.type]}</Badge>
                    <Badge className="bg-white" >{byKey[q.category]?.name || q.category}</Badge>
                    {q.type !== 'likert' && <Badge className={DIFF_COLOR[q.difficulty]}>{DIFF_LABEL[q.difficulty]}</Badge>}
                    {q.meta?.reverse && <Badge className="bg-violet-50 text-violet-700 ring-violet-200">Reverse</Badge>}
                    {q.meta?.pair && <Badge className="bg-sky-50 text-sky-700 ring-sky-200">Pasangan {q.meta.pair}</Badge>}
                  </div>
                  {q.stimulus && <p className="mt-2 line-clamp-1 whitespace-pre font-mono text-xs text-slate-400">{q.stimulus}</p>}
                  <p className="mt-1.5 text-sm font-medium text-slate-800">{q.prompt}</p>
                  {q.type === 'cognitive' && (
                    <p className="mt-1 text-xs text-emerald-600"><CheckCircle2 className="mr-1 inline size-3.5" />{q.options.find((o) => o.correct)?.text}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <IconBtn title="Edit" onClick={() => setEdit(q)}><Pencil /></IconBtn>
                  <IconBtn title="Duplikat" onClick={() => setEdit({ ...q, id: undefined, code: q.code ? `${q.code}-COPY` : null })}><Copy /></IconBtn>
                  <IconBtn title={q.is_active ? 'Nonaktifkan' : 'Aktifkan'} onClick={() => toggle(q)}><Power /></IconBtn>
                  <IconBtn title="Hapus" danger onClick={() => setDel(q)}><Trash2 /></IconBtn>
                </div>
              </div>
            ))}
            {!pageItems.length && <p className="p-10 text-center text-sm text-slate-500">Tidak ada soal yang cocok dengan filter.</p>}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
              <span className="text-slate-500">{filtered.length} soal · hal. {page}/{pages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
                <Button size="sm" variant="secondary" disabled={page === pages} onClick={() => setPage(page + 1)}>Berikutnya</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {edit && <QuestionEditor value={edit} dims={dims} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger confirmText="Hapus" title="Hapus soal?"
        message={<>Soal <b>{del?.code}</b> akan dihapus permanen beserta data jawabannya pada hasil peserta. Sebagai alternatif, Anda dapat <b>menonaktifkan</b> soal.</>} />
    </div>
  )
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return <button title={title} onClick={onClick} className={cn('rounded-lg p-2 text-slate-400 transition [&>svg]:size-4', danger ? 'hover:bg-rose-50 hover:text-rose-600' : 'hover:bg-slate-100 hover:text-slate-700')}>{children}</button>
}

function blankOptions(type: QuestionType, category: string, reverse = false): QOption[] {
  if (type === 'likert') return likertOptions(category, reverse) as QOption[]
  if (type === 'sjt') return [0, 1, 2, 3].map((i) => ({ id: LETTERS[i], text: '', scores: { [category]: 3 - i } }))
  return [0, 1, 2, 3, 4].map((i) => ({ id: LETTERS[i], text: '', ...(i === 0 ? { correct: true, scores: { [category]: 1 } } : {}) }))
}

function QuestionEditor({ value, dims, onClose, onSaved }: { value: Partial<Question>; dims: any[]; onClose: () => void; onSaved: () => void }) {
  const [q, setQ] = useState<Partial<Question>>(() => JSON.parse(JSON.stringify(value)))
  const [saving, setSaving] = useState(false)
  const type = q.type as QuestionType
  const catDims = dims.filter((d) => groupsForType(type).includes(d.group_name) && d.key !== 'konsistensi')
  const sjtDims = dims.filter((d) => d.group_name === 'kepribadian')
  const opts = q.options || []
  const set = (p: Partial<Question>) => setQ((x) => ({ ...x, ...p }))
  const setOpt = (i: number, p: Partial<QOption>) => set({ options: opts.map((o, j) => (j === i ? { ...o, ...p } : o)) })

  const changeType = (t: QuestionType) => {
    const cat = dims.find((d) => groupsForType(t).includes(d.group_name))?.key || 'verbal'
    set({ type: t, category: cat, options: blankOptions(t, cat), meta: {} })
  }
  const changeCat = (c: string) => {
    if (type === 'likert') set({ category: c, options: blankOptions('likert', c, !!q.meta?.reverse) })
    else if (type === 'cognitive') set({ category: c, options: opts.map((o) => (o.correct ? { ...o, scores: { [c]: 1 } } : { id: o.id, text: o.text })) })
    else set({ category: c, options: opts.map((o) => ({ ...o, scores: { [c]: o.scores?.[q.category!] ?? 0, ...Object.fromEntries(Object.entries(o.scores || {}).filter(([k]) => k !== q.category)) } })) })
  }
  const setCorrect = (i: number) => set({ options: opts.map((o, j) => (j === i ? { ...o, correct: true, scores: { [q.category!]: 1 } } : { id: o.id, text: o.text, image_url: o.image_url })) })

  // dimensi tambahan untuk SJT
  const sjtExtra = type === 'sjt' ? [...new Set(opts.flatMap((o) => Object.keys(o.scores || {})))].filter((k) => k !== q.category) : []

  async function save() {
    if (!q.prompt?.trim()) return toast.error('Teks soal wajib diisi')
    if (type !== 'likert' && opts.some((o) => !o.text?.trim())) return toast.error('Semua pilihan jawaban wajib diisi')
    if (type === 'cognitive' && opts.filter((o) => o.correct).length !== 1) return toast.error('Pilih satu kunci jawaban')
    setSaving(true)
    const { id, created_at, updated_at, ...row } = q as any
    row.code = row.code?.trim() || null
    const res = id ? await supabase.from('questions').update(row).eq('id', id) : await supabase.from('questions').insert(row)
    setSaving(false)
    if (res.error) return toast.error(/duplicate/.test(res.error.message) ? 'Kode soal sudah digunakan' : errMsg(res.error))
    toast.success('Soal tersimpan')
    onSaved()
  }

  return (
    <Modal open onClose={onClose} size="lg" title={q.id ? 'Edit Soal' : 'Soal Baru'}
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving}>Simpan Soal</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Tipe soal" className="sm:col-span-2">
            <Select value={type} onChange={(e) => changeType(e.target.value as QuestionType)} disabled={!!q.id}>
              {(['cognitive', 'likert', 'sjt'] as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </Select>
          </Field>
          <Field label="Kode (unik)"><Input value={q.code || ''} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="mis. VRB-SIN-10" /></Field>
          <Field label="Kesulitan">
            <Select value={q.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>
              {(['mudah', 'sedang', 'sulit'] as Difficulty[]).map((d) => <option key={d} value={d}>{DIFF_LABEL[d]}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={type === 'cognitive' ? 'Kategori kemampuan' : 'Aspek utama yang diukur'}>
          <Select value={q.category} onChange={(e) => changeCat(e.target.value)}>
            {catDims.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
          </Select>
        </Field>
        {type !== 'likert' && (
          <Field label="Stimulus / bacaan / pola (opsional)" hint="Untuk pola figural gunakan simbol seperti ▲ ■ ● ○ □ ◆ ★ ☆ ↑ → ↓ ←. Baris baru dipertahankan.">
            <Textarea rows={3} value={q.stimulus || ''} onChange={(e) => set({ stimulus: e.target.value || null })} className="font-mono" />
          </Field>
        )}
        <Field label={type === 'likert' ? 'Pernyataan' : 'Pertanyaan'} required><Textarea rows={2} value={q.prompt || ''} onChange={(e) => set({ prompt: e.target.value })} /></Field>
        <Field label="URL gambar (opsional)"><Input value={q.image_url || ''} onChange={(e) => set({ image_url: e.target.value || null })} placeholder="https://…" /></Field>

        {type === 'likert' && (
          <div className="space-y-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <Switch checked={!!q.meta?.reverse} onChange={(v) => set({ meta: { ...q.meta, reverse: v }, options: blankOptions('likert', q.category!, v) })}
              label="Item unfavorable (reverse scored)" description="Aktifkan jika setuju dengan pernyataan menunjukkan aspek yang RENDAH." />
            <Field label="Kode pasangan konsistensi (opsional)" hint="Isi kode yang sama pada 2 item yang mengukur hal serupa (satu biasa, satu reverse) untuk mendeteksi jawaban tidak konsisten.">
              <Input value={q.meta?.pair || ''} onChange={(e) => set({ meta: { ...q.meta, pair: e.target.value || undefined } })} placeholder="mis. str1" />
            </Field>
            <div className="flex flex-wrap gap-2">
              {opts.map((o) => <span key={o.id} className="rounded-lg bg-white px-2.5 py-1 text-xs ring-1 ring-slate-200">{o.text}: <b>{o.scores?.[q.category!]}</b></span>)}
            </div>
          </div>
        )}

        {type !== 'likert' && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Pilihan jawaban {type === 'cognitive' ? '(klik lingkaran untuk kunci)' : '& skor per aspek (0–4)'}</p>
              <div className="flex gap-1">
                {opts.length < 6 && <Button size="sm" variant="ghost" onClick={() => set({ options: [...opts, { id: LETTERS[opts.length], text: '', ...(type === 'sjt' ? { scores: { [q.category!]: 0 } } : {}) }] })}>+ Opsi</Button>}
                {opts.length > 2 && <Button size="sm" variant="ghost" onClick={() => set({ options: opts.slice(0, -1).map((o, i) => ({ ...o, id: LETTERS[i] })) })}>− Opsi</Button>}
              </div>
            </div>
            {type === 'sjt' && (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">Aspek tambahan:</span>
                {sjtExtra.map((k) => <Badge key={k}>{dims.find((d) => d.key === k)?.name || k}</Badge>)}
                <Select className="h-8 w-48 text-xs" value="" onChange={(e) => e.target.value && set({ options: opts.map((o) => ({ ...o, scores: { ...o.scores, [e.target.value]: 0 } })) })}>
                  <option value="">+ Tambah aspek</option>
                  {sjtDims.filter((d) => d.key !== q.category && !sjtExtra.includes(d.key)).map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
                </Select>
              </div>
            )}
            <div className="space-y-2">
              {opts.map((o, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
                  {type === 'cognitive' ? (
                    <button onClick={() => setCorrect(i)} className={cn('mt-1.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-2 transition',
                      o.correct ? 'bg-emerald-500 text-white ring-emerald-500' : 'bg-white text-slate-400 ring-slate-200 hover:ring-emerald-300')}>
                      {o.correct ? <CheckCircle2 className="size-4" /> : LETTERS[i].toUpperCase()}
                    </button>
                  ) : <span className="mt-1.5 grid size-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">{LETTERS[i].toUpperCase()}</span>}
                  <div className="flex-1 space-y-2">
                    <Input value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} placeholder={`Pilihan ${LETTERS[i].toUpperCase()}`} />
                    {type === 'sjt' && (
                      <div className="flex flex-wrap gap-2">
                        {[q.category!, ...sjtExtra].map((k) => (
                          <label key={k} className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">
                            {(dims.find((d) => d.key === k)?.name || k).split(' ')[0]}
                            <input type="number" min={0} max={4} className="w-10 rounded bg-slate-50 px-1 text-center font-bold focus:outline-none"
                              value={o.scores?.[k] ?? 0} onChange={(e) => setOpt(i, { scores: { ...o.scores, [k]: Number(e.target.value) } })} />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {type === 'cognitive' && <Field label="Pembahasan (opsional)"><Textarea rows={2} value={q.explanation || ''} onChange={(e) => set({ explanation: e.target.value })} /></Field>}
        <Switch checked={q.is_active !== false} onChange={(v) => set({ is_active: v })} label="Soal aktif" description="Soal nonaktif tidak akan dipilih ke dalam tes." />
      </div>
    </Modal>
  )
}
