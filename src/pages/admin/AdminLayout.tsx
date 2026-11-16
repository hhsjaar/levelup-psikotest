import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, ClipboardList, FileQuestion, LayoutDashboard, LogOut, Menu, Microscope, SlidersHorizontal, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Logo, PageLoader } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/utils'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/tests', label: 'Paket Tes', icon: ClipboardList },
  { to: '/admin/questions', label: 'Bank Soal', icon: FileQuestion },
  { to: '/admin/results', label: 'Hasil Peserta', icon: Users },
  { to: '/admin/analytics', label: 'Analisis Soal', icon: Microscope },
  { to: '/admin/dimensions', label: 'Aspek & Norma', icon: SlidersHorizontal },
]

export default function AdminLayout() {
  const { session, isAdmin, loading, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])

  if (loading) return <PageLoader />
  if (!session || !isAdmin) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5"><Logo /></div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}>
            <n.icon className="size-[18px]" />{n.label}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{session.user.email?.[0]?.toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{session.user.email}</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
          <button onClick={signOut} title="Keluar" className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-600"><LogOut className="size-4" /></button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-full bg-slate-50">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200/70 bg-white lg:block">{sidebar}</aside>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
              <button onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded-lg p-1.5 text-slate-400"><X className="size-5" /></button>
              {sidebar}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Menu className="size-5" /></button>
          <Logo />
          <BarChart3 className="ml-auto size-5 text-slate-300" />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><Outlet /></main>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
