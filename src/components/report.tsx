import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Dimension, KraepelinResult } from '../lib/types'
import { GOOD_BG, GOOD_SOFT, GOOD_TEXT, LEVEL_LABEL, cn, goodness, interpret, levelOf, round1 } from '../lib/utils'

export function ScoreRing({ value, size = 140, stroke = 12, label, color }: { value: number | null; size?: number; stroke?: number; label?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const col = color || (v >= 70 ? '#10b981' : v >= 50 ? '#f59e0b' : '#f43f5e')
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#eef2f7" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (v / 100) * c }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-extrabold tracking-tight text-slate-900" style={{ fontSize: size * 0.24 }}>{value == null ? '–' : round1(value)}</div>
          {label && <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</div>}
        </div>
      </div>
    </div>
  )
}

/** Kartu indikator utama (stres, tekanan, tim, kejujuran). */
export function IndicatorCard({ dim, pct, icon, invertLabel }: { dim?: Partial<Dimension>; pct: number | null | undefined; icon?: React.ReactNode; invertLabel?: string }) {
  const g = goodness(pct, dim)
  const lvl = levelOf(pct, dim as any)
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">{icon}{invertLabel || dim?.name}</div>
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset', GOOD_SOFT[g])}>{LEVEL_LABEL[lvl]}</span>
      </div>
      <div className={cn('mt-2 text-3xl font-extrabold tracking-tight', GOOD_TEXT[g])}>{pct == null ? '–' : round1(pct)}<span className="text-base font-semibold text-slate-400">/100</span></div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div className={cn('h-full rounded-full', GOOD_BG[g])} initial={{ width: 0 }} animate={{ width: `${pct ?? 0}%` }} transition={{ duration: 0.8 }} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{interpret(pct, dim)}</p>
    </div>
  )
}

export function DimensionBars({ items, showInterp = true }: { items: { dim: Partial<Dimension>; pct: number | null; extra?: string }[]; showInterp?: boolean }) {
  return (
    <div className="divide-y divide-slate-100">
      {items.map(({ dim, pct, extra }) => {
        const g = goodness(pct, dim)
        return (
          <div key={dim.key} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-slate-800">{dim.name}</span>
                {dim.higher_is_better === false && <span className="ml-2 text-[10px] font-semibold uppercase text-slate-400">tinggi = kurang baik</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {extra && <span className="text-xs text-slate-400">{extra}</span>}
                <span className={cn('text-sm font-bold tabular-nums', GOOD_TEXT[g])}>{round1(pct)}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset', GOOD_SOFT[g])}>{LEVEL_LABEL[levelOf(pct, dim as any)]}</span>
              </div>
            </div>
            <div className="relative mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ background: dim.color || '#6366f1' }} initial={{ width: 0 }} animate={{ width: `${pct ?? 0}%` }} transition={{ duration: 0.8 }} />
              <span className="absolute top-0 h-full w-px bg-white/80" style={{ left: `${dim.low_threshold ?? 40}%` }} />
              <span className="absolute top-0 h-full w-px bg-white/80" style={{ left: `${dim.high_threshold ?? 70}%` }} />
            </div>
            {showInterp && <p className="mt-1.5 text-xs text-slate-500">{interpret(pct, dim)}</p>}
          </div>
        )
      })}
    </div>
  )
}

export function ProfileRadar({ items, height = 320 }: { items: { name: string; pct: number }[]; height?: number }) {
  if (items.length < 3) return null
  const data = items.map((i) => ({ subject: i.name.replace(/ &.*$/, '').replace('Kemampuan ', ''), value: Math.round(i.pct) }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#475569' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
        <Tooltip formatter={(v: any) => [`${v}`, 'Skor']} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

export function KraepelinChart({ result, height = 240 }: { result: KraepelinResult; height?: number }) {
  const data = (result.per_column || []).map((c, i) => ({ lajur: i + 1, Dijawab: c.answered, Benar: c.correct }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
        <XAxis dataKey="lajur" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip labelFormatter={(l) => `Lajur ${l}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="Dijawab" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Benar" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function SectionBars({ items, height = 220 }: { items: { name: string; pct: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={items} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: any) => [`${v}`, 'Skor']} />
        <Bar dataKey="pct" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}
