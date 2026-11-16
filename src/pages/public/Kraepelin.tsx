import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KraepelinConfig } from '../../lib/types'
import { cn } from '../../lib/utils'

interface Props {
  config: KraepelinConfig
  columns: number[][]
  initialAnswers?: (number | null)[][]
  initialColumn?: number
  onChange: (answers: (number | null)[][], col: number) => void
  onDone: (answers: (number | null)[][]) => void
}

/** Tes Kraepelin/Pauli: jumlahkan dua angka berdekatan, ketik angka satuannya. */
export default function Kraepelin({ config, columns, initialAnswers, initialColumn = 0, onChange, onDone }: Props) {
  const secPerCol = config.seconds_per_column || 15
  const [answers, setAnswers] = useState<(number | null)[][]>(() =>
    columns.map((c, i) => {
      const prev = initialAnswers?.[i] || []
      return Array.from({ length: c.length - 1 }, (_, r) => (typeof prev[r] === 'number' ? (prev[r] as number) : null))
    }),
  )
  const [col, setCol] = useState(Math.min(initialColumn, columns.length - 1))
  const [row, setRow] = useState(() => {
    const a = initialAnswers?.[initialColumn] || []
    return a.filter((x) => typeof x === 'number').length
  })
  const [colStart, setColStart] = useState(() => Date.now())
  const [now, setNow] = useState(Date.now())
  const [flash, setFlash] = useState<number | null>(null)
  const doneRef = useRef(false)
  const answersRef = useRef(answers)
  answersRef.current = answers

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [])

  const nextColumn = useCallback(() => {
    if (doneRef.current) return
    if (col >= columns.length - 1) {
      doneRef.current = true
      onDone(answersRef.current)
      return
    }
    const n = col + 1
    setCol(n)
    setRow(0)
    setColStart(Date.now())
    onChange(answersRef.current, n)
  }, [col, columns.length, onChange, onDone])

  const remaining = secPerCol - (now - colStart) / 1000
  useEffect(() => {
    if (remaining <= 0) nextColumn()
  }, [remaining, nextColumn])

  const input = useCallback((d: number) => {
    if (doneRef.current) return
    const pairs = columns[col].length - 1
    if (row >= pairs) return
    const next = answersRef.current.map((a) => [...a])
    next[col][row] = d
    setAnswers(next)
    setFlash(d)
    setTimeout(() => setFlash(null), 120)
    const nr = row + 1
    setRow(nr)
    onChange(next, col)
    if (nr >= pairs) setTimeout(() => nextColumn(), 150)
  }, [col, row, columns, onChange, nextColumn])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); input(Number(e.key)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [input])

  const digits = columns[col]
  const pairs = digits.length - 1
  const pct = Math.max(0, remaining / secPerCol) * 100
  // jendela tampilan: 2 pasangan sebelumnya s/d 4 angka berikutnya
  const from = Math.max(0, row - 2)
  const to = Math.min(digits.length - 1, row + 4)
  const view = []
  for (let i = from; i <= to; i++) view.push(i)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center lg:gap-10">
      <div className="w-full max-w-xs">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">Lajur {col + 1}<span className="text-slate-400">/{columns.length}</span></span>
          <span className={cn('font-bold tabular-nums', remaining < 4 ? 'text-rose-600' : 'text-slate-600')}>{Math.max(0, Math.ceil(remaining))} dtk</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className={cn('h-full rounded-full transition-[width] duration-100', remaining < 4 ? 'bg-rose-500' : 'bg-brand-600')} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex gap-1">
          {columns.map((_, i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < col ? 'bg-brand-300' : i === col ? 'bg-brand-600' : 'bg-slate-200')} />
          ))}
        </div>

        <div className="relative mt-5 overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <AnimatePresence initial={false} mode="popLayout">
            {view.map((i) => {
              const isTop = i === row
              const isBottom = i === row + 1
              const active = isTop || isBottom
              const ans = i < row ? answers[col][i] : null
              return (
                <motion.div key={`${col}-${i}`} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                  className="relative flex items-center justify-center">
                  <div className={cn('my-0.5 grid h-12 w-16 place-items-center rounded-xl text-3xl font-bold tabular-nums transition',
                    active ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30' : i < row ? 'text-slate-300' : 'text-slate-500')}>
                    {digits[i]}
                  </div>
                  {i < row && i < pairs && (
                    <span className="absolute right-3 top-full z-10 -translate-y-1/2 rounded-md bg-emerald-50 px-2 text-sm font-bold text-emerald-700">{ans}</span>
                  )}
                  {isTop && row < pairs && (
                    <span className="absolute right-2 top-full z-10 -translate-y-1/2 grid size-9 place-items-center rounded-lg border-2 border-dashed border-brand-400 bg-white text-lg font-bold text-brand-600">
                      {flash ?? '?'}
                    </span>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">Pasangan {Math.min(row + 1, pairs)} dari {pairs} · jumlahkan dua angka yang disorot</p>
      </div>

      <div className="grid w-full max-w-xs grid-cols-3 gap-2.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} onClick={() => input(d)}
            className="h-16 rounded-2xl bg-white text-2xl font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 transition active:scale-95 active:bg-brand-50 hover:ring-brand-300">
            {d}
          </button>
        ))}
        <div />
        <button onClick={() => input(0)} className="h-16 rounded-2xl bg-white text-2xl font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 transition active:scale-95 active:bg-brand-50 hover:ring-brand-300">0</button>
        <div className="grid h-16 place-items-center text-[10px] leading-tight text-center text-slate-400">tidak bisa<br />dikoreksi</div>
      </div>
    </div>
  )
}
