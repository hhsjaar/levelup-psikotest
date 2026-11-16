import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isConfigured = Boolean(url && key)

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** Ambil pesan error yang ramah dari error Supabase/Postgres. */
export function errMsg(e: any): string {
  if (!e) return 'Terjadi kesalahan'
  const m = e.message || e.error_description || String(e)
  if (/Could not find the (table|function)/i.test(m)) return 'Database belum disiapkan. Jalankan supabase/setup.sql di SQL Editor Supabase.'
  if (/Failed to fetch/i.test(m)) return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.'
  return m
}
