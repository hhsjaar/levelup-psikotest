-- =====================================================================
-- LevelUp Psikotest – API Agen AI (levelupaiagent / WhatsApp)
-- Jalankan di Supabase SQL Editor (aman dijalankan ulang).
-- Agen memanggil /api/agent di aplikasi (Vercel) dengan token "lvpt_…";
-- token dibuat admin di menu Integrasi Agen AI dan disimpan sebagai hash.
-- Fungsi internal ada di skema psikotest_agent (tidak diekspos ke API).
-- =====================================================================

create table if not exists public.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null unique,
  token_hint text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table public.agent_tokens enable row level security;
drop policy if exists agent_tokens_admin on public.agent_tokens;
create policy agent_tokens_admin on public.agent_tokens for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.admin_create_agent_token(p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_token text; v_id uuid;
begin
  if not public.is_admin() then raise exception 'Akses ditolak'; end if;
  v_token := 'lvpt_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.agent_tokens (name, token_hash, token_hint)
  values (coalesce(nullif(trim(p_name), ''), 'Agen AI'), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), right(v_token, 4))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token);
end $$;

create or replace function public.admin_revoke_agent_token(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Akses ditolak'; end if;
  update public.agent_tokens set revoked_at = now() where id = p_id and revoked_at is null;
  return found;
end $$;

create schema if not exists psikotest_agent;
revoke all on schema psikotest_agent from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------
create or replace function psikotest_agent.wib(ts timestamptz) returns text
language sql immutable as $$ select to_char(ts at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') $$;

create or replace function psikotest_agent.parse_wib(v text) returns timestamptz
language plpgsql immutable as $$
begin
  if v is null or trim(v) = '' then return null; end if;
  if v ~ '(Z|[+-]\d{2}:?\d{2})$' then return v::timestamptz; end if;
  return (v::timestamp) at time zone 'Asia/Jakarta';
end $$;

create or replace function psikotest_agent.level(pct numeric, d public.dimensions) returns text
language sql immutable as $$
  select case when pct is null then null when pct >= d.high_threshold then 'Tinggi' when pct >= d.low_threshold then 'Sedang' else 'Rendah' end
$$;

create or replace function psikotest_agent.find_test(p_ref text) returns public.tests
language plpgsql stable set search_path = public as $$
declare t public.tests; n int; names text;
begin
  if p_ref is null or trim(p_ref) = '' then raise exception 'Sebutkan id, kode, atau judul paket tes.'; end if;
  if trim(p_ref) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into t from public.tests where id = trim(p_ref)::uuid;
  end if;
  if t.id is null then select * into t from public.tests where upper(access_code) = upper(trim(p_ref)); end if;
  if t.id is null then
    select count(*), string_agg(title || ' (' || access_code || ')', '; ') into n, names from public.tests where title ilike '%' || trim(p_ref) || '%';
    if n > 1 then raise exception 'Lebih dari satu paket cocok dengan "%": %. Sebutkan kodenya.', p_ref, names; end if;
    select * into t from public.tests where title ilike '%' || trim(p_ref) || '%' limit 1;
  end if;
  if t.id is null then raise exception 'Paket tes "%" tidak ditemukan.', p_ref; end if;
  return t;
end $$;

create or replace function psikotest_agent.find_attempt(p_ref text, p_test uuid default null) returns public.attempts
language plpgsql stable set search_path = public as $$
declare r public.attempts; n int; names text;
begin
  if p_ref is null or trim(p_ref) = '' then raise exception 'Sebutkan id hasil atau nama peserta.'; end if;
  if trim(p_ref) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into r from public.attempts where id = trim(p_ref)::uuid;
    if r.id is not null then return r; end if;
  end if;
  select count(*), string_agg(a.candidate_name || ' – ' || t.title || ' – ' || psikotest_agent.wib(a.started_at) || ' [id ' || a.id || ']', '; ')
  into n, names
  from public.attempts a join public.tests t on t.id = a.test_id
  where (p_test is null or a.test_id = p_test)
    and (a.candidate_name ilike '%' || trim(p_ref) || '%' or a.candidate_email ilike '%' || trim(p_ref) || '%' or a.candidate ->> 'phone' ilike '%' || trim(p_ref) || '%');
  if n = 0 then raise exception 'Peserta "%" tidak ditemukan.', p_ref; end if;
  if n > 1 then raise exception 'Ada % peserta cocok dengan "%": %. Sebutkan id-nya.', n, p_ref, names; end if;
  select a.* into r from public.attempts a
  where (p_test is null or a.test_id = p_test)
    and (a.candidate_name ilike '%' || trim(p_ref) || '%' or a.candidate_email ilike '%' || trim(p_ref) || '%' or a.candidate ->> 'phone' ilike '%' || trim(p_ref) || '%');
  return r;
end $$;

create or replace function psikotest_agent.find_question(p_ref text) returns public.questions
language plpgsql stable set search_path = public as $$
declare q public.questions;
begin
  if p_ref is null or trim(p_ref) = '' then raise exception 'Sebutkan id atau kode soal.'; end if;
  if trim(p_ref) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into q from public.questions where id = trim(p_ref)::uuid;
  end if;
  if q.id is null then select * into q from public.questions where upper(code) = upper(trim(p_ref)); end if;
  if q.id is null then raise exception 'Soal "%" tidak ditemukan.', p_ref; end if;
  return q;
end $$;

create or replace function psikotest_agent.find_dimension(p_ref text) returns public.dimensions
language plpgsql stable set search_path = public as $$
declare d public.dimensions;
begin
  select * into d from public.dimensions where key = replace(lower(trim(p_ref)), ' ', '_');
  if d.key is null and lower(trim(p_ref)) in ('kejujuran', 'jujur', 'etika') then select * into d from public.dimensions where key = 'integritas'; end if;
  if d.key is null and lower(trim(p_ref)) in ('stres', 'stress') then select * into d from public.dimensions where key = 'tingkat_stres'; end if;
  if d.key is null and lower(trim(p_ref)) in ('tekanan', 'tahan tekanan', 'ketahanan tekanan') then select * into d from public.dimensions where key = 'toleransi_tekanan'; end if;
  if d.key is null and lower(trim(p_ref)) in ('lie', 'lie scale', 'pencitraan') then select * into d from public.dimensions where key = 'desirabilitas_sosial'; end if;
  if d.key is null then select * into d from public.dimensions where name ilike '%' || replace(trim(p_ref), ' ', '%') || '%' order by sort limit 1; end if;
  if d.key is null then raise exception 'Kategori/aspek "%" tidak dikenal. Lihat daftar dimensi di info.', p_ref; end if;
  return d;
end $$;

create or replace function psikotest_agent.test_summary(t public.tests, app text) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', t.id, 'judul', t.title, 'kode', t.access_code, 'aktif', t.is_active,
    'link', app || '/t/' || t.access_code,
    'link_admin', app || '/admin/tests/' || t.id,
    'dibuka', psikotest_agent.wib(t.starts_at), 'ditutup', psikotest_agent.wib(t.ends_at),
    'subtes', coalesce((select jsonb_agg((s ->> 'title') || ' [' || (s ->> 'type') || ']' order by o) from jsonb_array_elements(t.sections) with ordinality x(s, o)), '[]'::jsonb),
    'estimasi_menit', round(coalesce((select sum(case when s ->> 'type' = 'kraepelin'
        then coalesce((s -> 'kraepelin' ->> 'columns')::numeric, 0) * coalesce((s -> 'kraepelin' ->> 'seconds_per_column')::numeric, 15)
        else coalesce((s ->> 'time_limit_sec')::numeric, 0) end) from jsonb_array_elements(t.sections) s), 0) / 60),
    'peserta', (select jsonb_build_object('total', count(*), 'selesai', count(*) filter (where status = 'submitted'),
        'sedang_mengerjakan', count(*) filter (where status = 'in_progress'),
        'rata_rata_skor', round(avg(overall_score) filter (where status = 'submitted'), 1),
        'direkomendasikan', count(*) filter (where recommendation in ('Sangat Direkomendasikan', 'Direkomendasikan')))
      from public.attempts where test_id = t.id),
    'dibuat', psikotest_agent.wib(t.created_at))
$$;

create or replace function psikotest_agent.default_settings() returns jsonb language sql immutable as $$
  select '{"allow_back":true,"show_result":"none","max_tab_switches":3,"auto_submit_on_violation":false,"max_attempts":1,
    "require_fields":["email","phone","position"],"passing_score":60,"thresholds":{"sangat":80,"rekomendasi":65,"pertimbangan":50},
    "lie_threshold":70,"validity_downgrade":true,"min_seconds_per_item":2,"dimension_weights":{}}'::jsonb
$$;

/** Susun subtes dari daftar komponen sederhana. */
create or replace function psikotest_agent.build_sections(p_komponen jsonb, p_fokus jsonb default null) returns jsonb
language plpgsql volatile set search_path = public as $$
declare
  k text;
  res jsonb := '[]'::jsonb;
  cats jsonb;
  per int := 6;
  sid text;
  pts jsonb := '{"mudah":1,"sedang":2,"sulit":3}'::jsonb;
begin
  if p_komponen is null or jsonb_typeof(p_komponen) <> 'array' or jsonb_array_length(p_komponen) = 0 then
    p_komponen := '["verbal","numerik","logika","figural","kraepelin","kepribadian","sjt"]'::jsonb;
  end if;
  for k in select lower(trim(value)) from jsonb_array_elements_text(p_komponen) loop
    sid := 'sec-' || k || '-' || substr(md5(random()::text), 1, 5);
    if k in ('kognitif', 'tiu') then
      res := res || psikotest_agent.build_sections('["verbal","numerik","logika"]'::jsonb);
    elsif k = 'verbal' then
      res := res || jsonb_build_array(jsonb_build_object('id', sid, 'title', 'Tes Kemampuan Verbal', 'type', 'cognitive', 'selection', 'random',
        'categories', '["verbal"]'::jsonb, 'question_count', 10, 'count_per_category', false, 'difficulty_counts', '{"mudah":3,"sedang":4,"sulit":3}'::jsonb,
        'points', pts, 'negative_marking', 0, 'time_limit_sec', 480, 'shuffle_questions', true, 'shuffle_options', true,
        'instructions', 'Pilih satu jawaban yang paling tepat. Waktu terbatas, kerjakan yang mudah terlebih dahulu.'));
    elsif k = 'numerik' then
      res := res || jsonb_build_array(jsonb_build_object('id', sid, 'title', 'Tes Kemampuan Numerik', 'type', 'cognitive', 'selection', 'random',
        'categories', '["numerik"]'::jsonb, 'question_count', 10, 'count_per_category', false, 'difficulty_counts', '{"mudah":3,"sedang":4,"sulit":3}'::jsonb,
        'points', pts, 'negative_marking', 0, 'time_limit_sec', 600, 'shuffle_questions', true, 'shuffle_options', true,
        'instructions', 'Hitung dengan teliti. Anda boleh memakai kertas buram, tanpa kalkulator.'));
    elsif k in ('logika', 'penalaran') then
      res := res || jsonb_build_array(jsonb_build_object('id', sid, 'title', 'Tes Penalaran Logis', 'type', 'cognitive', 'selection', 'random',
        'categories', '["logika"]'::jsonb, 'question_count', 10, 'count_per_category', false, 'difficulty_counts', '{"mudah":3,"sedang":4,"sulit":3}'::jsonb,
        'points', pts, 'negative_marking', 0, 'time_limit_sec', 600, 'shuffle_questions', true, 'shuffle_options', true,
        'instructions', 'Perhatikan aturan dan hubungan antar informasi sebelum menjawab.'));
    elsif k in ('figural', 'spasial') then
      res := res || jsonb_build_array(jsonb_build_object('id', sid, 'title', 'Tes Penalaran Figural & Spasial', 'type', 'cognitive', 'selection', 'random',
        'categories', '["figural"]'::jsonb, 'question_count', 8, 'count_per_category', false, 'difficulty_counts', '{"mudah":2,"sedang":4,"sulit":2}'::jsonb,
        'points', pts, 'negative_marking', 0, 'time_limit_sec', 480, 'shuffle_questions', true, 'shuffle_options', true,
        'instructions', 'Perhatikan pola, rotasi, dan hubungan bentuk.'));
    elsif k in ('kraepelin', 'pauli') then
      res := res || jsonb_build_array(jsonb_build_object('id', sid, 'title', 'Tes Ketahanan Kerja (Kraepelin)', 'type', 'kraepelin',
        'kraepelin', '{"columns":15,"rows":26,"seconds_per_column":15,"target_per_column":14}'::jsonb,
        'instructions', 'Jumlahkan dua angka yang berdekatan, lalu tuliskan HANYA angka satuannya (contoh: 7 + 8 = 15 → ketik 5). Setiap lajur memiliki batas waktu. Kerjakan secepat dan seteliti mungkin.'));
    elsif k in ('kepribadian', 'likert', 'sikap') then
      if p_fokus is not null and jsonb_typeof(p_fokus) = 'array' and jsonb_array_length(p_fokus) > 0 then
        select jsonb_agg(distinct x) into cats from (
          select (psikotest_agent.find_dimension(value)).key as x from jsonb_array_elements_text(p_fokus)
          union select 'desirabilitas_sosial') z;
        per := 8;
      else
        cats := '["tingkat_stres","toleransi_tekanan","stabilitas_emosi","kerja_tim","integritas","tanggung_jawab","adaptabilitas","komunikasi","kepemimpinan","motivasi_berprestasi","orientasi_pelayanan","desirabilitas_sosial"]'::jsonb;
      end if;
      res := res || jsonb_build_array(jsonb_build_object('id', sid, 'title', 'Inventori Sikap & Kepribadian Kerja', 'type', 'likert', 'selection', 'random',
        'categories', cats, 'question_count', per, 'count_per_category', true, 'time_limit_sec', 1200, 'shuffle_questions', true, 'shuffle_options', false,
        'instructions', 'Tidak ada jawaban benar atau salah. Pilih respons yang paling menggambarkan diri Anda yang sebenarnya.'));
    elsif k in ('sjt', 'situasional') then
      res := res || jsonb_build_array(jsonb_build_object('id', sid, 'title', 'Situational Judgment Test', 'type', 'sjt', 'selection', 'random',
        'categories', '[]'::jsonb, 'question_count', 10, 'count_per_category', false, 'time_limit_sec', 900, 'shuffle_questions', true, 'shuffle_options', true,
        'instructions', 'Bacalah setiap situasi kerja, lalu pilih tindakan yang PALING mungkin Anda lakukan.'));
    else
      raise exception 'Komponen "%" tidak dikenal. Pilihan: verbal, numerik, logika, figural, kognitif, kraepelin, kepribadian, sjt.', k;
    end if;
  end loop;
  return res;
end $$;

create or replace function psikotest_agent.question_json(q public.questions) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', q.id, 'kode', q.code, 'tipe', q.type, 'kategori', q.category,
    'kategori_nama', (select name from public.dimensions where key = q.category),
    'kesulitan', q.difficulty, 'aktif', q.is_active, 'soal', q.prompt, 'stimulus', q.stimulus,
    'pilihan', case when q.type = 'likert' then null else (select jsonb_agg(upper(o ->> 'id') || '. ' || (o ->> 'text')
        || case when q.type = 'sjt' then ' ' || coalesce(o -> 'scores', '{}'::jsonb)::text else '' end order by n)
      from jsonb_array_elements(q.options) with ordinality x(o, n)) end,
    'jawaban_benar', case when q.type = 'cognitive' then (select upper(o ->> 'id') || '. ' || (o ->> 'text') from jsonb_array_elements(q.options) o where coalesce((o ->> 'correct')::boolean, false) limit 1) end,
    'reverse', case when q.type = 'likert' then coalesce((q.meta ->> 'reverse')::boolean, false) end,
    'pasangan', q.meta ->> 'pair', 'pembahasan', q.explanation)
$$;

/** Bangun opsi jawaban dari input sederhana agen. */
create or replace function psikotest_agent.build_options(p_type text, p_cat text, a jsonb) returns jsonb
language plpgsql stable as $$
declare
  res jsonb := '[]'::jsonb;
  letters text[] := array['a','b','c','d','e','f'];
  v_ans int;
  v_rev boolean := coalesce((a ->> 'reverse')::boolean, false);
  n int;
  i int := 0;
  o jsonb;
  sc jsonb;
begin
  if p_type = 'likert' then
    select jsonb_agg(jsonb_build_object('id', (g)::text, 'text', lbl, 'scores', jsonb_build_object(p_cat, case when v_rev then 6 - g else g end)) order by g)
    into res
    from unnest(array['Sangat Tidak Sesuai','Tidak Sesuai','Netral','Sesuai','Sangat Sesuai']) with ordinality u(lbl, g);
    return res;
  end if;
  if a -> 'pilihan' is null or jsonb_typeof(a -> 'pilihan') <> 'array' then raise exception 'Isi "pilihan" (daftar pilihan jawaban).'; end if;
  n := jsonb_array_length(a -> 'pilihan');
  if n < 2 or n > 6 then raise exception 'Jumlah pilihan harus 2–6.'; end if;
  if p_type = 'cognitive' then
    v_ans := case when (a ->> 'jawaban') ~ '^[0-9]+$' then (a ->> 'jawaban')::int
                  when (a ->> 'jawaban') ~* '^[a-f]$' then ascii(lower(a ->> 'jawaban')) - 96 end;
    if v_ans is null or v_ans < 1 or v_ans > n then raise exception 'Isi "jawaban" dengan huruf (A–%) atau nomor pilihan yang benar.', upper(letters[n]); end if;
    for o in select value from jsonb_array_elements(a -> 'pilihan') loop
      i := i + 1;
      res := res || jsonb_build_array(case when i = v_ans
        then jsonb_build_object('id', letters[i], 'text', o #>> '{}', 'correct', true, 'scores', jsonb_build_object(p_cat, 1))
        else jsonb_build_object('id', letters[i], 'text', o #>> '{}') end);
    end loop;
    return res;
  end if;
  -- sjt: [{"teks": "...", "skor": 4 | {"kerja_tim": 4, "komunikasi": 2}}]
  for o in select value from jsonb_array_elements(a -> 'pilihan') loop
    i := i + 1;
    if jsonb_typeof(o) <> 'object' or coalesce(o ->> 'teks', '') = '' then raise exception 'Pilihan SJT harus berupa {"teks": ..., "skor": 0-4 atau {aspek: skor}}.'; end if;
    sc := case when jsonb_typeof(o -> 'skor') = 'object' then o -> 'skor' else jsonb_build_object(p_cat, coalesce((o ->> 'skor')::numeric, 0)) end;
    if not sc ? p_cat then sc := sc || jsonb_build_object(p_cat, 0); end if;
    res := res || jsonb_build_array(jsonb_build_object('id', letters[i], 'text', o ->> 'teks', 'scores', sc));
  end loop;
  return res;
end $$;

-- ---------------------------------------------------------------------
-- DISPATCHER (satu-satunya pintu masuk API agen)
-- ---------------------------------------------------------------------
create or replace function public.agent_api(p_token text, p_action text, p_args jsonb default '{}'::jsonb, p_app_url text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a jsonb := coalesce(p_args, '{}'::jsonb);
  app text := coalesce(nullif(rtrim(trim(coalesce(p_app_url, '')), '/'), ''), 'https://levelup-psikotest.vercel.app');
  v_tok public.agent_tokens;
  t public.tests;
  r public.attempts;
  q public.questions;
  d public.dimensions;
  v_test uuid;
  v_lim int;
  v_off int;
  v_code text;
  v_sections jsonb;
  v_settings jsonb;
  v_type text;
  v_n int;
begin
  select * into v_tok from public.agent_tokens
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') and revoked_at is null;
  if not found then return jsonb_build_object('error', 'Token agen tidak valid atau sudah dicabut.', 'status', 401); end if;
  update public.agent_tokens set last_used_at = now() where id = v_tok.id;

  begin
  case p_action
  -- ============ INFO ============
  when 'info' then
    return jsonb_build_object(
      'aplikasi', 'LevelUp Psikotest', 'url', app, 'panel_admin', app || '/admin',
      'paket_tes', coalesce((select jsonb_agg(psikotest_agent.test_summary(x, app) order by x.is_active desc, x.created_at desc) from public.tests x), '[]'::jsonb),
      'bank_soal', (select jsonb_build_object('total', count(*), 'aktif', count(*) filter (where is_active),
          'per_tipe', (select jsonb_object_agg(type, c) from (select type, count(*) c from public.questions group by type) z),
          'per_kategori', (select jsonb_object_agg(category, c) from (select category, count(*) c from public.questions where is_active group by category) z))
        from public.questions),
      'dimensi', (select jsonb_agg(jsonb_build_object('key', key, 'nama', name, 'kelompok', group_name, 'tinggi_berarti_baik', higher_is_better) order by sort) from public.dimensions),
      'komponen_paket', '["verbal","numerik","logika","figural","kognitif (=verbal+numerik+logika)","kraepelin","kepribadian","sjt"]'::jsonb,
      'peserta', (select jsonb_build_object('total', count(*), 'selesai', count(*) filter (where status = 'submitted'),
          'hari_ini', count(*) filter (where started_at >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')) from public.attempts));

  -- ============ PAKET TES ============
  when 'tests_list' then
    return jsonb_build_object('paket_tes', coalesce((select jsonb_agg(psikotest_agent.test_summary(x, app) order by x.created_at desc)
      from public.tests x where coalesce(a ->> 'filter', 'semua') = 'semua' or (a ->> 'filter' = 'aktif' and x.is_active) or (a ->> 'filter' = 'nonaktif' and not x.is_active)), '[]'::jsonb));

  when 'test_get' then
    t := psikotest_agent.find_test(a ->> 'id');
    return psikotest_agent.test_summary(t, app) || jsonb_build_object(
      'deskripsi', t.description, 'petunjuk', t.instructions, 'pengaturan', t.settings,
      'rincian_subtes', (select jsonb_agg(jsonb_build_object('judul', s ->> 'title', 'tipe', s ->> 'type', 'kategori', s -> 'categories',
          'jumlah_soal', s -> 'question_count', 'per_kategori', s -> 'count_per_category', 'komposisi_kesulitan', s -> 'difficulty_counts',
          'waktu_menit', round(coalesce((s ->> 'time_limit_sec')::numeric, 0) / 60, 1), 'kraepelin', s -> 'kraepelin') order by o)
        from jsonb_array_elements(t.sections) with ordinality x(s, o)));

  when 'test_create' then
    if coalesce(trim(a ->> 'judul'), '') = '' then raise exception 'Judul paket wajib diisi.'; end if;
    if coalesce(a ->> 'salin_dari', '') <> '' then
      t := psikotest_agent.find_test(a ->> 'salin_dari');
      v_sections := t.sections; v_settings := t.settings;
    else
      v_sections := psikotest_agent.build_sections(a -> 'komponen', a -> 'fokus_kepribadian');
      v_settings := psikotest_agent.default_settings();
    end if;
    if jsonb_typeof(a -> 'pengaturan') = 'object' then v_settings := v_settings || (a -> 'pengaturan'); end if;
    v_code := upper(nullif(regexp_replace(coalesce(a ->> 'kode', ''), '[^A-Za-z0-9-]', '', 'g'), ''));
    if v_code is null then
      loop
        v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
        exit when not exists (select 1 from public.tests where access_code = v_code);
      end loop;
    elsif exists (select 1 from public.tests where upper(access_code) = v_code) then
      raise exception 'Kode akses % sudah dipakai paket lain.', v_code;
    end if;
    insert into public.tests (title, description, instructions, access_code, is_active, starts_at, ends_at, sections, settings)
    values (trim(a ->> 'judul'), a ->> 'deskripsi',
      coalesce(a ->> 'petunjuk', 'Kerjakan dengan jujur dan sungguh-sungguh. Pastikan koneksi internet stabil dan Anda berada di tempat yang tenang. Jangan berpindah tab/jendela selama tes berlangsung.'),
      v_code, coalesce((a ->> 'aktif')::boolean, true), psikotest_agent.parse_wib(a ->> 'dibuka'), psikotest_agent.parse_wib(a ->> 'ditutup'), v_sections, v_settings)
    returning * into t;
    return jsonb_build_object('ok', true, 'paket', psikotest_agent.test_summary(t, app));

  when 'test_update' then
    t := psikotest_agent.find_test(a ->> 'id');
    if a ? 'kode' then
      v_code := upper(regexp_replace(coalesce(a ->> 'kode', ''), '[^A-Za-z0-9-]', '', 'g'));
      if v_code = '' then raise exception 'Kode akses tidak boleh kosong.'; end if;
      if exists (select 1 from public.tests where upper(access_code) = v_code and id <> t.id) then raise exception 'Kode akses % sudah dipakai paket lain.', v_code; end if;
    end if;
    update public.tests set
      title = case when a ? 'judul' then trim(a ->> 'judul') else title end,
      description = case when a ? 'deskripsi' then a ->> 'deskripsi' else description end,
      instructions = case when a ? 'petunjuk' then a ->> 'petunjuk' else instructions end,
      is_active = case when a ? 'aktif' then (a ->> 'aktif')::boolean else is_active end,
      access_code = case when a ? 'kode' then v_code else access_code end,
      starts_at = case when a ? 'dibuka' then psikotest_agent.parse_wib(a ->> 'dibuka') else starts_at end,
      ends_at = case when a ? 'ditutup' then psikotest_agent.parse_wib(a ->> 'ditutup') else ends_at end,
      settings = case when jsonb_typeof(a -> 'pengaturan') = 'object' then settings || (a -> 'pengaturan') else settings end,
      sections = case when jsonb_typeof(a -> 'komponen') = 'array' then psikotest_agent.build_sections(a -> 'komponen', a -> 'fokus_kepribadian') else sections end
    where id = t.id returning * into t;
    return jsonb_build_object('ok', true, 'paket', psikotest_agent.test_summary(t, app));

  when 'test_delete' then
    t := psikotest_agent.find_test(a ->> 'id');
    select count(*) into v_n from public.attempts where test_id = t.id;
    delete from public.tests where id = t.id;
    return jsonb_build_object('ok', true, 'dihapus', t.title || ' (' || t.access_code || ')', 'hasil_peserta_ikut_terhapus', v_n);

  when 'invite' then
    t := psikotest_agent.find_test(a ->> 'id');
    if not t.is_active then raise exception 'Paket "%" sedang nonaktif. Aktifkan dulu (test_update aktif=true).', t.title; end if;
    if t.ends_at is not null and t.ends_at < now() then raise exception 'Periode paket "%" sudah berakhir (%). Perpanjang dulu.', t.title, psikotest_agent.wib(t.ends_at); end if;
    return psikotest_agent.test_summary(t, app);

  -- ============ HASIL PESERTA ============
  when 'results_list' then
    if coalesce(a ->> 'paket', '') <> '' then v_test := (psikotest_agent.find_test(a ->> 'paket')).id; end if;
    v_lim := least(greatest(coalesce((a ->> 'limit')::int, 20), 1), 100);
    return jsonb_build_object(
      'total', (select count(*) from public.attempts x where (v_test is null or x.test_id = v_test)
        and (coalesce(a ->> 'status', 'semua') = 'semua' or (a ->> 'status' = 'selesai' and x.status = 'submitted') or (a ->> 'status' = 'mengerjakan' and x.status = 'in_progress'))
        and (coalesce(a ->> 'rekomendasi', '') = '' or x.recommendation ilike '%' || (a ->> 'rekomendasi') || '%')
        and (coalesce(a ->> 'cari', '') = '' or x.candidate_name ilike '%' || (a ->> 'cari') || '%' or x.position ilike '%' || (a ->> 'cari') || '%' or x.candidate_email ilike '%' || (a ->> 'cari') || '%')
        and (coalesce(a ->> 'dari', '') = '' or x.started_at >= psikotest_agent.parse_wib((a ->> 'dari') || ' 00:00'))
        and (coalesce(a ->> 'sampai', '') = '' or x.started_at < psikotest_agent.parse_wib((a ->> 'sampai') || ' 00:00') + interval '1 day')),
      'hasil', coalesce((select jsonb_agg(row_to_json(z)::jsonb - 'ord' order by z.ord desc) from (
        select x.id, x.candidate_name as nama, x.position as posisi, x.candidate_email as email, x.candidate ->> 'phone' as whatsapp,
          tt.title as paket, case when x.status = 'submitted' then 'selesai' else 'sedang mengerjakan' end as status,
          psikotest_agent.wib(x.started_at) as mulai, psikotest_agent.wib(x.submitted_at) as selesai,
          round(x.duration_sec / 60.0, 1) as durasi_menit, x.overall_score as skor_total, x.recommendation as rekomendasi, x.passed as lulus,
          jsonb_build_object('tingkat_stres', x.scores -> 'tingkat_stres' -> 'pct', 'ketahanan_tekanan', x.scores -> 'toleransi_tekanan' -> 'pct',
            'kerja_tim', x.scores -> 'kerja_tim' -> 'pct', 'integritas', x.scores -> 'integritas' -> 'pct',
            'kejujuran_menjawab', case when x.scores ? 'desirabilitas_sosial' then round(100 - (x.scores -> 'desirabilitas_sosial' ->> 'pct')::numeric, 1) end) as indikator,
          (select jsonb_agg(f ->> 'message') from jsonb_array_elements(x.flags) f where f ->> 'level' in ('warning', 'danger')) as peringatan,
          app || '/admin/results/' || x.id as link_admin,
          case when coalesce(a ->> 'urut', 'terbaru') = 'skor' then coalesce(x.overall_score, -1) else extract(epoch from x.started_at) end as ord
        from public.attempts x join public.tests tt on tt.id = x.test_id
        where (v_test is null or x.test_id = v_test)
          and (coalesce(a ->> 'status', 'semua') = 'semua' or (a ->> 'status' = 'selesai' and x.status = 'submitted') or (a ->> 'status' = 'mengerjakan' and x.status = 'in_progress'))
          and (coalesce(a ->> 'rekomendasi', '') = '' or x.recommendation ilike '%' || (a ->> 'rekomendasi') || '%')
          and (coalesce(a ->> 'cari', '') = '' or x.candidate_name ilike '%' || (a ->> 'cari') || '%' or x.position ilike '%' || (a ->> 'cari') || '%' or x.candidate_email ilike '%' || (a ->> 'cari') || '%')
          and (coalesce(a ->> 'dari', '') = '' or x.started_at >= psikotest_agent.parse_wib((a ->> 'dari') || ' 00:00'))
          and (coalesce(a ->> 'sampai', '') = '' or x.started_at < psikotest_agent.parse_wib((a ->> 'sampai') || ' 00:00') + interval '1 day')
        order by ord desc limit v_lim) z), '[]'::jsonb));

  when 'result_get' then
    if coalesce(a ->> 'paket', '') <> '' then v_test := (psikotest_agent.find_test(a ->> 'paket')).id; end if;
    r := psikotest_agent.find_attempt(a ->> 'id', v_test);
    select * into t from public.tests where id = r.test_id;
    return jsonb_build_object(
      'id', r.id, 'nama', r.candidate_name, 'posisi', r.position, 'email', r.candidate_email, 'whatsapp', r.candidate ->> 'phone',
      'data_lain', r.candidate - 'name' - 'email' - 'phone' - 'position',
      'paket', t.title, 'kode_paket', t.access_code,
      'status', case when r.status = 'submitted' then 'selesai' else 'sedang mengerjakan' end,
      'mulai', psikotest_agent.wib(r.started_at), 'selesai', psikotest_agent.wib(r.submitted_at),
      'durasi_menit', round(r.duration_sec / 60.0, 1), 'pindah_tab', r.tab_switches,
      'skor_total', r.overall_score, 'rekomendasi', r.recommendation, 'lulus', r.passed,
      'passing_grade', coalesce((t.settings ->> 'passing_score')::numeric, 60),
      'peringkat_di_paket', case when r.status = 'submitted' then (select count(*) + 1 from public.attempts y where y.test_id = r.test_id and y.status = 'submitted' and y.overall_score > r.overall_score) end,
      'jumlah_peserta_selesai_di_paket', (select count(*) from public.attempts y where y.test_id = r.test_id and y.status = 'submitted'),
      'aspek', coalesce((select jsonb_agg(jsonb_build_object(
          'key', dd.key, 'nama', dd.name, 'kelompok', dd.group_name,
          'skor', (r.scores -> dd.key ->> 'pct')::numeric,
          'kategori', psikotest_agent.level((r.scores -> dd.key ->> 'pct')::numeric, dd),
          'arah', case when dd.higher_is_better then 'tinggi = baik' else 'tinggi = kurang baik' end,
          'benar', r.scores -> dd.key -> 'correct', 'total_soal', r.scores -> dd.key -> 'total',
          'interpretasi', case psikotest_agent.level((r.scores -> dd.key ->> 'pct')::numeric, dd) when 'Tinggi' then dd.interp_high when 'Sedang' then dd.interp_mid else dd.interp_low end
        ) order by dd.sort) from public.dimensions dd where r.scores ? dd.key), '[]'::jsonb),
      'subtes', r.section_scores,
      'kraepelin', (select jsonb_build_object('panker_kecepatan', v -> 'panker', 'tianker_salah', v -> 'tianker', 'janker_rentang', v -> 'janker',
          'hanker_tren', v -> 'hanker', 'akurasi_persen', v -> 'accuracy', 'total_dijawab', v -> 'total_answered')
        from jsonb_each(coalesce(r.kraepelin -> 'results', '{}'::jsonb)) e(k, v) limit 1),
      'peringatan_validitas', coalesce((select jsonb_agg(f ->> 'message') from jsonb_array_elements(r.flags) f), '[]'::jsonb),
      'catatan_rekruter', r.admin_notes,
      'link_admin', app || '/admin/results/' || r.id);

  when 'result_update' then
    r := psikotest_agent.find_attempt(a ->> 'id');
    update public.attempts set admin_notes = case
        when coalesce((a ->> 'tambahkan')::boolean, false) and coalesce(admin_notes, '') <> '' then admin_notes || E'\n' || (a ->> 'catatan')
        else a ->> 'catatan' end
    where id = r.id;
    return jsonb_build_object('ok', true, 'peserta', r.candidate_name);

  when 'result_delete' then
    r := psikotest_agent.find_attempt(a ->> 'id');
    delete from public.attempts where id = r.id;
    return jsonb_build_object('ok', true, 'dihapus', r.candidate_name);

  when 'result_rescore' then
    if coalesce(a ->> 'paket', '') <> '' and coalesce(a ->> 'id', '') = '' then
      t := psikotest_agent.find_test(a ->> 'paket');
      v_n := 0;
      for r in select * from public.attempts where test_id = t.id and status = 'submitted' loop
        perform public.score_attempt(r.id); v_n := v_n + 1;
      end loop;
      return jsonb_build_object('ok', true, 'dihitung_ulang', v_n, 'paket', t.title);
    end if;
    r := psikotest_agent.find_attempt(a ->> 'id');
    if r.status <> 'submitted' then raise exception '% belum mengumpulkan tes.', r.candidate_name; end if;
    perform public.score_attempt(r.id);
    select * into r from public.attempts where id = r.id;
    return jsonb_build_object('ok', true, 'peserta', r.candidate_name, 'skor_total', r.overall_score, 'rekomendasi', r.recommendation);

  -- ============ BANK SOAL ============
  when 'questions_list' then
    v_lim := least(greatest(coalesce((a ->> 'limit')::int, 20), 1), 100);
    v_off := greatest(coalesce((a ->> 'offset')::int, 0), 0);
    v_type := case lower(coalesce(a ->> 'tipe', '')) when 'kognitif' then 'cognitive' when 'kepribadian' then 'likert' else nullif(lower(a ->> 'tipe'), '') end;
    if coalesce(a ->> 'kategori', '') <> '' then d := psikotest_agent.find_dimension(a ->> 'kategori'); end if;
    return jsonb_build_object(
      'total', (select count(*) from public.questions x where (v_type is null or x.type = v_type) and (d.key is null or x.category = d.key)
        and (coalesce(a ->> 'kesulitan', '') = '' or x.difficulty = lower(a ->> 'kesulitan'))
        and (coalesce(a ->> 'aktif', 'semua') = 'semua' or x.is_active = (a ->> 'aktif' = 'ya'))
        and (coalesce(a ->> 'cari', '') = '' or x.prompt ilike '%' || (a ->> 'cari') || '%' or x.code ilike '%' || (a ->> 'cari') || '%' or coalesce(x.stimulus, '') ilike '%' || (a ->> 'cari') || '%')),
      'soal', coalesce((select jsonb_agg(psikotest_agent.question_json(x) order by x.code) from (
        select * from public.questions x where (v_type is null or x.type = v_type) and (d.key is null or x.category = d.key)
          and (coalesce(a ->> 'kesulitan', '') = '' or x.difficulty = lower(a ->> 'kesulitan'))
          and (coalesce(a ->> 'aktif', 'semua') = 'semua' or x.is_active = (a ->> 'aktif' = 'ya'))
          and (coalesce(a ->> 'cari', '') = '' or x.prompt ilike '%' || (a ->> 'cari') || '%' or x.code ilike '%' || (a ->> 'cari') || '%' or coalesce(x.stimulus, '') ilike '%' || (a ->> 'cari') || '%')
        order by x.code limit v_lim offset v_off) x), '[]'::jsonb));

  when 'question_get' then
    q := psikotest_agent.find_question(a ->> 'id');
    return psikotest_agent.question_json(q);

  when 'question_create' then
    v_type := case lower(coalesce(a ->> 'tipe', '')) when 'kognitif' then 'cognitive' when 'cognitive' then 'cognitive'
      when 'likert' then 'likert' when 'kepribadian' then 'likert' when 'sjt' then 'sjt' end;
    if v_type is null then raise exception 'tipe harus kognitif, likert (kepribadian), atau sjt.'; end if;
    d := psikotest_agent.find_dimension(a ->> 'kategori');
    if (v_type = 'cognitive') <> (d.group_name = 'kognitif') or d.group_name = 'kinerja' or d.key = 'konsistensi' then
      raise exception 'Kategori "%" tidak cocok untuk tipe %.', d.name, a ->> 'tipe';
    end if;
    if coalesce(trim(a ->> 'soal'), '') = '' then raise exception 'Teks soal wajib diisi.'; end if;
    v_code := upper(nullif(trim(coalesce(a ->> 'kode', '')), ''));
    if v_code is null then v_code := 'AGT-' || upper(substr(md5(random()::text), 1, 6)); end if;
    if exists (select 1 from public.questions where upper(code) = v_code) then raise exception 'Kode soal % sudah ada.', v_code; end if;
    insert into public.questions (code, type, category, difficulty, prompt, stimulus, options, explanation, meta, is_active)
    values (v_code, v_type, d.key, coalesce(nullif(lower(a ->> 'kesulitan'), ''), 'sedang'), trim(a ->> 'soal'), nullif(a ->> 'stimulus', ''),
      psikotest_agent.build_options(v_type, d.key, a), nullif(a ->> 'pembahasan', ''),
      case when v_type = 'likert' then jsonb_strip_nulls(jsonb_build_object('reverse', coalesce((a ->> 'reverse')::boolean, false), 'pair', nullif(a ->> 'pasangan', ''))) else '{}'::jsonb end,
      coalesce((a ->> 'aktif')::boolean, true))
    returning * into q;
    return jsonb_build_object('ok', true, 'soal', psikotest_agent.question_json(q));

  when 'question_update' then
    q := psikotest_agent.find_question(a ->> 'id');
    if a ? 'kategori' then
      d := psikotest_agent.find_dimension(a ->> 'kategori');
      if q.type = 'sjt' then raise exception 'Kategori soal SJT tidak bisa diubah lewat agen; ubah di panel admin.'; end if;
      if (q.type = 'cognitive') <> (d.group_name = 'kognitif') or d.group_name = 'kinerja' then raise exception 'Kategori "%" tidak cocok untuk soal ini.', d.name; end if;
    else
      select * into d from public.dimensions where key = q.category;
    end if;
    update public.questions set
      prompt = case when a ? 'soal' then trim(a ->> 'soal') else prompt end,
      stimulus = case when a ? 'stimulus' then nullif(a ->> 'stimulus', '') else stimulus end,
      difficulty = case when a ? 'kesulitan' then lower(a ->> 'kesulitan') else difficulty end,
      is_active = case when a ? 'aktif' then (a ->> 'aktif')::boolean else is_active end,
      explanation = case when a ? 'pembahasan' then nullif(a ->> 'pembahasan', '') else explanation end,
      category = d.key,
      meta = case when q.type = 'likert' then jsonb_strip_nulls(meta || jsonb_build_object(
          'reverse', case when a ? 'reverse' then (a ->> 'reverse')::boolean else coalesce((meta ->> 'reverse')::boolean, false) end,
          'pair', case when a ? 'pasangan' then nullif(a ->> 'pasangan', '') else meta ->> 'pair' end)) else meta end,
      options = case
        when q.type = 'likert' and (a ? 'reverse' or a ? 'kategori') then psikotest_agent.build_options('likert', d.key,
          jsonb_build_object('reverse', case when a ? 'reverse' then (a ->> 'reverse')::boolean else coalesce((q.meta ->> 'reverse')::boolean, false) end))
        when q.type = 'cognitive' and a ? 'pilihan' then psikotest_agent.build_options('cognitive', d.key, a)
        when q.type = 'cognitive' and a ? 'jawaban' then psikotest_agent.build_options('cognitive', d.key,
          jsonb_build_object('pilihan', (select jsonb_agg(o ->> 'text' order by n) from jsonb_array_elements(q.options) with ordinality x(o, n)), 'jawaban', a ->> 'jawaban'))
        when q.type = 'cognitive' and a ? 'kategori' then (select jsonb_agg(case when coalesce((o ->> 'correct')::boolean, false)
          then o || jsonb_build_object('scores', jsonb_build_object(d.key, 1)) else o end order by n) from jsonb_array_elements(q.options) with ordinality x(o, n))
        when q.type = 'sjt' and a ? 'pilihan' then psikotest_agent.build_options('sjt', q.category, a)
        else options end
    where id = q.id returning * into q;
    return jsonb_build_object('ok', true, 'soal', psikotest_agent.question_json(q));

  when 'question_delete' then
    q := psikotest_agent.find_question(a ->> 'id');
    delete from public.questions where id = q.id;
    return jsonb_build_object('ok', true, 'dihapus', coalesce(q.code, q.id::text));

  else
    return jsonb_build_object('error', format('Aksi "%s" tidak dikenal.', p_action), 'status', 400);
  end case;
  exception when others then
    return jsonb_build_object('error', sqlerrm, 'status', 400);
  end;
end $$;

revoke execute on function public.agent_api(text, text, jsonb, text) from public;
grant execute on function public.agent_api(text, text, jsonb, text) to anon, authenticated;
grant execute on function public.admin_create_agent_token(text) to authenticated;
grant execute on function public.admin_revoke_agent_token(uuid) to authenticated;
