// Menghasilkan supabase/seed.sql (dimensi + bank soal + paket tes contoh)
// dan supabase/setup.sql (schema + seed dalam satu file untuk SQL Editor).
// Jalankan: npm run build:sql
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dimensions, questionBank, sampleTest } from '../src/data/bank/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const j = (v) => `${q(JSON.stringify(v))}::jsonb`

const codes = new Set()
for (const item of questionBank) {
  if (codes.has(item.code)) throw new Error(`Kode soal duplikat: ${item.code}`)
  codes.add(item.code)
  if (!dimensions.find((d) => d.key === item.category)) throw new Error(`Kategori tidak dikenal: ${item.category}`)
}

let out = `-- =====================================================================
-- LevelUp Psikotest – Seed data (dihasilkan otomatis oleh scripts/build-sql.mjs)
-- ${dimensions.length} dimensi, ${questionBank.length} soal, 1 paket tes contoh
-- =====================================================================\n\n`

out += `insert into public.dimensions (key, name, group_name, description, higher_is_better, interp_low, interp_mid, interp_high, color, sort) values\n`
out += dimensions
  .map((d) => `  (${q(d.key)}, ${q(d.name)}, ${q(d.group_name)}, ${q(d.description)}, ${d.higher_is_better === false ? 'false' : 'true'}, ${q(d.interp_low)}, ${q(d.interp_mid)}, ${q(d.interp_high)}, ${q(d.color)}, ${d.sort})`)
  .join(',\n')
out += `\non conflict (key) do update set name = excluded.name, group_name = excluded.group_name, description = excluded.description,
  higher_is_better = excluded.higher_is_better, interp_low = excluded.interp_low, interp_mid = excluded.interp_mid,
  interp_high = excluded.interp_high, color = excluded.color, sort = excluded.sort;\n\n`

out += `insert into public.questions (code, type, category, difficulty, prompt, stimulus, options, explanation, meta) values\n`
out += questionBank
  .map((x) => `  (${q(x.code)}, ${q(x.type)}, ${q(x.category)}, ${q(x.difficulty)}, ${q(x.prompt)}, ${q(x.stimulus)}, ${j(x.options)}, ${q(x.explanation || null)}, ${j(x.meta || {})})`)
  .join(',\n')
out += `\non conflict (code) do update set type = excluded.type, category = excluded.category, difficulty = excluded.difficulty,
  prompt = excluded.prompt, stimulus = excluded.stimulus, options = excluded.options, explanation = excluded.explanation, meta = excluded.meta;\n\n`

const t = sampleTest
out += `insert into public.tests (title, description, instructions, access_code, is_active, sections, settings) values
  (${q(t.title)}, ${q(t.description)}, ${q(t.instructions)}, ${q(t.access_code)}, true, ${j(t.sections)}, ${j(t.settings)})
on conflict (access_code) do nothing;\n`

writeFileSync(join(root, 'supabase/seed.sql'), out)
const schema = readFileSync(join(root, 'supabase/schema.sql'), 'utf8')
const agent = readFileSync(join(root, 'supabase/agent.sql'), 'utf8')
writeFileSync(join(root, 'supabase/setup.sql'), `${schema}\n\n${agent}\n\n${out}`)
console.log(`OK: ${dimensions.length} dimensi, ${questionBank.length} soal → supabase/seed.sql & supabase/setup.sql`)
