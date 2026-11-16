import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'success'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
}
const SIZES = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' }

export function Button({
  variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        VARIANTS[variant], SIZES[size], className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function Card({ className, children, ...p }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn('rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm', className)}>{children}</div>
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

const fieldBase = 'w-full rounded-xl border-0 bg-white ring-1 ring-slate-200 px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-none transition disabled:bg-slate-50'

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn(fieldBase, 'h-10', className)} />
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cn(fieldBase, 'py-2.5 min-h-[80px]', className)} />
}
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cn(fieldBase, 'h-10 pr-8', className)}>{children}</select>
}

export function Field({ label, hint, children, className, required }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-sm font-medium text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 text-left group">
      <span className={cn('relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-slate-300')}>
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-medium text-slate-800">{label}</span>}
          {description && <span className="block text-xs text-slate-500 mt-0.5">{description}</span>}
        </span>
      )}
    </button>
  )
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-slate-200 bg-slate-50 text-slate-700', className)}>{children}</span>
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-brand-600', className)} />
}

export function PageLoader({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Spinner className="size-7" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>}
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size]
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={cn('relative w-full bg-white shadow-2xl rounded-t-3xl sm:rounded-2xl flex flex-col max-h-[92vh]', w)}
          >
            {title && (
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <h3 className="font-semibold text-slate-900">{title}</h3>
                <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="size-5" /></button>
              </div>
            )}
            <div className="overflow-y-auto scrollbar-thin px-5 py-4 flex-1">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; icon?: ReactNode }[]; className?: string }) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto scrollbar-thin rounded-xl bg-slate-100 p-1', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn('relative flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition',
            value === t.value ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800')}
        >
          {value === t.value && <motion.span layoutId={`tab-${tabs.map((x) => x.value).join('')}`} className="absolute inset-0 rounded-lg bg-white shadow-sm" />}
          <span className="relative flex items-center gap-2">{t.icon}{t.label}</span>
        </button>
      ))}
    </div>
  )
}

export function StatCard({ label, value, hint, icon, tone = 'brand' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'brand' | 'emerald' | 'amber' | 'rose' | 'sky' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600', sky: 'bg-sky-50 text-sky-600',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && <div className={cn('grid size-10 place-items-center rounded-xl', tones[tone])}>{icon}</div>}
      </div>
    </Card>
  )
}

export function ProgressBar({ value, className, barClass }: { value: number; className?: string; barClass?: string }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <motion.div className={cn('h-full rounded-full bg-brand-600', barClass)} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
    </div>
  )
}

export function Confirm({ open, onClose, onConfirm, title, message, confirmText = 'Ya, lanjutkan', danger, loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: ReactNode; confirmText?: string; danger?: boolean; loading?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Batal</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmText}</Button>
      </>}>
      <div className="text-sm text-slate-600">{message}</div>
    </Modal>
  )
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src="/favicon.svg" alt="" className="size-8" />
      <div className="leading-tight">
        <div className={cn('font-extrabold tracking-tight', light ? 'text-white' : 'text-slate-900')}>LevelUp</div>
        <div className={cn('text-[10px] font-semibold uppercase tracking-[0.2em]', light ? 'text-brand-200' : 'text-brand-600')}>Psikotest</div>
      </div>
    </div>
  )
}
