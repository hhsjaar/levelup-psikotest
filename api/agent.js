// API untuk Agen AI (levelupaiagent / WhatsApp).
// POST /api/agent  { "action": "info", "args": { ... } }   Header: Authorization: Bearer lvpt_…
// Token dibuat di Panel Admin → Integrasi Agen AI. Semua otorisasi & logika ada di fungsi
// Postgres public.agent_api (token disimpan sebagai hash; kunci jawaban tetap di server).
export const config = { runtime: 'edge' }

const ACTIONS = [
  'info', 'tests_list', 'test_get', 'test_create', 'test_update', 'test_delete', 'invite',
  'results_list', 'result_get', 'result_update', 'result_delete', 'result_rescore',
  'questions_list', 'question_get', 'question_create', 'question_update', 'question_delete',
]

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

export default async function handler(req) {
  if (req.method === 'GET') {
    return json({ ok: true, aplikasi: 'LevelUp Psikotest', cara_pakai: 'POST {"action","args"} dengan header Authorization: Bearer <token agen>', actions: ACTIONS })
  }
  if (req.method !== 'POST') return json({ error: 'Gunakan POST.' }, 405)

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Token agen wajib dikirim di header Authorization.' }, 401)

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body harus JSON: {"action": "...", "args": {...}}' }, 400)
  }
  const action = String(body?.action || '')
  if (!ACTIONS.includes(action)) return json({ error: `Aksi "${action}" tidak dikenal.`, actions: ACTIONS }, 400)

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
  if (!url || !key) return json({ error: 'Server belum dikonfigurasi (SUPABASE_URL / PUBLISHABLE_KEY).' }, 500)
  const appUrl = (process.env.PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, '')

  try {
    const res = await fetch(`${url}/rest/v1/rpc/agent_api`, {
      method: 'POST',
      headers: { apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_action: action, p_args: body?.args ?? {}, p_app_url: appUrl }),
    })
    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return json({ error: `Database membalas ${res.status} (bukan JSON).` }, 502)
    }
    if (!res.ok) {
      const msg = data?.message || `Database membalas ${res.status}.`
      return json({ error: /agent_api/.test(msg) ? 'Fungsi agent_api belum ada. Jalankan supabase/agent.sql di SQL Editor Supabase.' : msg }, 502)
    }
    if (data && typeof data === 'object' && data.error) return json(data, Number(data.status) || 400)
    return json(data)
  } catch (e) {
    return json({ error: `Database tidak terjangkau: ${e?.message || e}` }, 502)
  }
}
