-- =====================================================================
-- LevelUp Psikotest – Skema Database Supabase
-- Jalankan di Supabase Dashboard → SQL Editor (aman dijalankan ulang).
-- =====================================================================

-- ---------------------------------------------------------------------
-- TABEL
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.dimensions (
  key text primary key,
  name text not null,
  group_name text not null check (group_name in ('kognitif','kinerja','kepribadian','validitas')),
  description text,
  higher_is_better boolean not null default true,
  low_threshold int not null default 40,
  high_threshold int not null default 70,
  interp_low text,
  interp_mid text,
  interp_high text,
  color text default '#6366f1',
  sort int not null default 0
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  type text not null check (type in ('cognitive','likert','sjt')),
  category text not null references public.dimensions(key) on update cascade,
  difficulty text not null default 'sedang' check (difficulty in ('mudah','sedang','sulit')),
  prompt text not null,
  stimulus text,
  image_url text,
  options jsonb not null default '[]'::jsonb,
  explanation text,
  meta jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists questions_pick_idx on public.questions (type, category, difficulty) where is_active;

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  instructions text,
  access_code text not null unique,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  sections jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  candidate jsonb not null default '{}'::jsonb,
  candidate_name text,
  candidate_email text,
  position text,
  status text not null default 'in_progress' check (status in ('in_progress','submitted')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  duration_sec int,
  plan jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  timings jsonb not null default '{}'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  kraepelin jsonb not null default '{}'::jsonb,
  tab_switches int not null default 0,
  scores jsonb,
  section_scores jsonb,
  overall_score numeric,
  recommendation text,
  passed boolean,
  flags jsonb not null default '[]'::jsonb,
  admin_notes text
);
create index if not exists attempts_test_idx on public.attempts (test_id, status);
create index if not exists attempts_email_idx on public.attempts (test_id, candidate_email);

create table if not exists public.attempt_answers (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  section_index int,
  option_id text,
  answered boolean not null default false,
  is_correct boolean,
  points numeric,
  max_points numeric,
  time_ms int,
  contrib jsonb not null default '{}'::jsonb,
  primary key (attempt_id, question_id)
);
create index if not exists attempt_answers_q_idx on public.attempt_answers (question_id);

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_questions_touch on public.questions;
create trigger trg_questions_touch before update on public.questions for each row execute function public.touch_updated_at();
drop trigger if exists trg_tests_touch on public.tests;
create trigger trg_tests_touch before update on public.tests for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- ADMIN HELPERS
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.admin_exists() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins);
$$;

-- Admin pertama: user login pertama yang memanggil fungsi ini saat belum ada admin.
create or replace function public.claim_first_admin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if not exists (select 1 from public.admins) then
    insert into public.admins(user_id, email) values (auth.uid(), auth.jwt() ->> 'email');
    return true;
  end if;
  return public.is_admin();
end $$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.admins enable row level security;
alter table public.dimensions enable row level security;
alter table public.questions enable row level security;
alter table public.tests enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;

drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists admins_write on public.admins;
create policy admins_write on public.admins for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists dimensions_read on public.dimensions;
create policy dimensions_read on public.dimensions for select using (true);
drop policy if exists dimensions_write on public.dimensions;
create policy dimensions_write on public.dimensions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists questions_admin on public.questions;
create policy questions_admin on public.questions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists tests_admin on public.tests;
create policy tests_admin on public.tests for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists attempts_admin on public.attempts;
create policy attempts_admin on public.attempts for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists attempt_answers_admin on public.attempt_answers;
create policy attempt_answers_admin on public.attempt_answers for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- PEMILIHAN SOAL (internal)
-- ---------------------------------------------------------------------
create or replace function public.pick_questions(p_type text, p_cats text[], p_count int, p_dcounts jsonb)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  res uuid[] := '{}';
  part uuid[];
  lvl text;
  n int;
  total int := 0;
begin
  if p_dcounts is not null and jsonb_typeof(p_dcounts) = 'object' then
    select coalesce(sum(nullif(value, '')::int), 0) into total from jsonb_each_text(p_dcounts);
  end if;
  if total > 0 then
    foreach lvl in array array['mudah','sedang','sulit'] loop
      n := coalesce(nullif(p_dcounts ->> lvl, '')::int, 0);
      if n > 0 then
        select coalesce(array_agg(id), '{}') into part from (
          select id from public.questions
          where is_active and type = p_type
            and (coalesce(cardinality(p_cats), 0) = 0 or category = any(p_cats))
            and difficulty = lvl
          order by random() limit n) s;
        res := res || part;
      end if;
    end loop;
  else
    select coalesce(array_agg(id), '{}') into res from (
      select id from public.questions
      where is_active and type = p_type
        and (coalesce(cardinality(p_cats), 0) = 0 or category = any(p_cats))
      order by random() limit greatest(coalesce(p_count, 10), 0)) s;
  end if;
  return res;
end $$;

-- ---------------------------------------------------------------------
-- API PUBLIK (PESERTA)
-- ---------------------------------------------------------------------
create or replace function public.get_public_test(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t public.tests;
begin
  select * into t from public.tests where upper(access_code) = upper(trim(p_code));
  if not found or not t.is_active then raise exception 'Kode tes tidak ditemukan atau tidak aktif'; end if;
  return jsonb_build_object(
    'id', t.id, 'title', t.title, 'description', t.description, 'instructions', t.instructions,
    'access_code', t.access_code, 'starts_at', t.starts_at, 'ends_at', t.ends_at,
    'is_open', (t.starts_at is null or now() >= t.starts_at) and (t.ends_at is null or now() <= t.ends_at),
    'settings', jsonb_build_object(
      'require_fields', coalesce(t.settings -> 'require_fields', '["email"]'::jsonb),
      'consent_text', t.settings -> 'consent_text',
      'max_tab_switches', coalesce(t.settings -> 'max_tab_switches', '0'::jsonb),
      'allow_back', coalesce(t.settings -> 'allow_back', 'true'::jsonb)),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', s ->> 'title', 'type', s ->> 'type', 'time_limit_sec', s -> 'time_limit_sec',
        'question_count', case when s ->> 'type' = 'kraepelin' then (s -> 'kraepelin' ->> 'columns')::int
          when coalesce((s ->> 'difficulty_counts') is not null and (select coalesce(sum(nullif(value,'')::int),0) from jsonb_each_text(s -> 'difficulty_counts')) > 0, false)
            then (select coalesce(sum(nullif(value,'')::int),0) from jsonb_each_text(s -> 'difficulty_counts')) * case when coalesce((s ->> 'count_per_category')::boolean, false) then greatest(jsonb_array_length(coalesce(s -> 'categories', '[]')), 1) else 1 end
          when s ->> 'selection' = 'manual' then jsonb_array_length(coalesce(s -> 'question_ids', '[]'))
          else coalesce((s ->> 'question_count')::int, 0) * case when coalesce((s ->> 'count_per_category')::boolean, false) then greatest(jsonb_array_length(coalesce(s -> 'categories', '[]')), 1) else 1 end end,
        'kraepelin', s -> 'kraepelin') order by ord)
      from jsonb_array_elements(t.sections) with ordinality x(s, ord)), '[]'::jsonb)
  );
end $$;

create or replace function public.get_attempt(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.attempts; t public.tests;
begin
  select * into a from public.attempts where token = p_token;
  if not found then raise exception 'Sesi tes tidak ditemukan'; end if;
  select * into t from public.tests where id = a.test_id;
  return jsonb_build_object(
    'attempt_id', a.id, 'token', a.token, 'status', a.status,
    'started_at', a.started_at, 'submitted_at', a.submitted_at, 'server_now', now(),
    'candidate', a.candidate,
    'test', jsonb_build_object(
      'title', t.title, 'description', t.description,
      'settings', jsonb_build_object(
        'allow_back', coalesce(t.settings -> 'allow_back', 'true'::jsonb),
        'max_tab_switches', coalesce(t.settings -> 'max_tab_switches', '0'::jsonb),
        'auto_submit_on_violation', coalesce(t.settings -> 'auto_submit_on_violation', 'false'::jsonb),
        'show_result', coalesce(t.settings -> 'show_result', '"none"'::jsonb))),
    'answers', a.answers, 'timings', a.timings, 'progress', a.progress,
    'kraepelin_answers', coalesce(a.kraepelin -> 'answers', '{}'::jsonb),
    'tab_switches', a.tab_switches,
    'sections', case when a.status <> 'in_progress' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'index', ord - 1, 'title', s ->> 'title', 'type', s ->> 'type',
        'instructions', s ->> 'instructions', 'time_limit_sec', s -> 'time_limit_sec',
        'kraepelin', s -> 'kraepelin',
        'questions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', q.id, 'type', q.type, 'prompt', q.prompt, 'stimulus', q.stimulus, 'image_url', q.image_url,
            'options', coalesce((
              select jsonb_agg(jsonb_build_object('id', o ->> 'id', 'text', o ->> 'text', 'image_url', o ->> 'image_url') order by oo.n)
              from jsonb_array_elements_text(it -> 'o') with ordinality oo(oid, n)
              join jsonb_array_elements(q.options) o on o ->> 'id' = oo.oid), '[]'::jsonb)
          ) order by itn)
          from jsonb_array_elements(coalesce(s -> 'items', '[]'::jsonb)) with ordinality its(it, itn)
          join public.questions q on q.id = (it ->> 'q')::uuid), '[]'::jsonb)
      ) order by ord)
      from jsonb_array_elements(a.plan) with ordinality x(s, ord)), '[]'::jsonb) end
  );
end $$;

create or replace function public.start_attempt(p_code text, p_candidate jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t public.tests;
  sec jsonb;
  v_plan jsonb := '[]'::jsonb;
  v_items jsonb;
  v_ids uuid[];
  v_part uuid[];
  v_cat text;
  v_cats text[];
  v_cols jsonb;
  v_email text;
  v_count int;
  v_token uuid;
  v_ncols int;
  v_nrows int;
  v_req jsonb;
  f text;
begin
  select * into t from public.tests where upper(access_code) = upper(trim(p_code)) and is_active;
  if not found then raise exception 'Kode tes tidak ditemukan atau tidak aktif'; end if;
  if t.starts_at is not null and now() < t.starts_at then raise exception 'Tes belum dibuka'; end if;
  if t.ends_at is not null and now() > t.ends_at then raise exception 'Periode tes sudah berakhir'; end if;
  if coalesce(trim(p_candidate ->> 'name'), '') = '' then raise exception 'Nama lengkap wajib diisi'; end if;

  v_req := coalesce(t.settings -> 'require_fields', '["email"]'::jsonb);
  for f in select jsonb_array_elements_text(v_req) loop
    if coalesce(trim(p_candidate ->> f), '') = '' then raise exception 'Data % wajib diisi', f; end if;
  end loop;

  v_email := lower(trim(coalesce(p_candidate ->> 'email', '')));
  if v_email <> '' and coalesce((t.settings ->> 'max_attempts')::int, 0) > 0 then
    select count(*) into v_count from public.attempts where test_id = t.id and candidate_email = v_email;
    if v_count >= (t.settings ->> 'max_attempts')::int then
      raise exception 'Email ini sudah mencapai batas pengerjaan tes';
    end if;
  end if;

  for sec in select value from jsonb_array_elements(t.sections) loop
    v_cols := null; v_ids := '{}'; v_items := '[]'::jsonb;
    if sec ->> 'type' = 'kraepelin' then
      v_ncols := least(greatest(coalesce((sec -> 'kraepelin' ->> 'columns')::int, 15), 1), 60);
      v_nrows := least(greatest(coalesce((sec -> 'kraepelin' ->> 'rows')::int, 26), 5), 80);
      select jsonb_agg(col order by c) into v_cols from (
        select c, jsonb_agg(1 + floor(random() * 9)::int order by r) as col
        from generate_series(1, v_ncols) c cross join generate_series(1, v_nrows) r
        group by c) z;
    else
      if coalesce(sec ->> 'selection', 'random') = 'manual' then
        select coalesce(array_agg(q.id order by j.ord), '{}') into v_ids
        from jsonb_array_elements_text(coalesce(sec -> 'question_ids', '[]'::jsonb)) with ordinality j(qid, ord)
        join public.questions q on q.id::text = j.qid and q.is_active;
      else
        v_cats := array(select jsonb_array_elements_text(coalesce(sec -> 'categories', '[]'::jsonb)));
        if coalesce((sec ->> 'count_per_category')::boolean, false) and cardinality(v_cats) > 0 then
          foreach v_cat in array v_cats loop
            v_part := public.pick_questions(sec ->> 'type', array[v_cat], (sec ->> 'question_count')::int, sec -> 'difficulty_counts');
            v_ids := v_ids || v_part;
          end loop;
        else
          v_ids := public.pick_questions(sec ->> 'type', v_cats, (sec ->> 'question_count')::int, sec -> 'difficulty_counts');
        end if;
      end if;
      if coalesce((sec ->> 'shuffle_questions')::boolean, true) and cardinality(v_ids) > 1 then
        select array_agg(x order by random()) into v_ids from unnest(v_ids) x;
      end if;
      select coalesce(jsonb_agg(jsonb_build_object('q', q.id, 'o',
          case when q.type <> 'likert' and coalesce((sec ->> 'shuffle_options')::boolean, false)
            then (select jsonb_agg(o ->> 'id' order by random()) from jsonb_array_elements(q.options) o)
            else (select jsonb_agg(o ->> 'id' order by n) from jsonb_array_elements(q.options) with ordinality oo(o, n)) end
        ) order by u.ord), '[]'::jsonb)
      into v_items
      from unnest(v_ids) with ordinality u(id, ord) join public.questions q on q.id = u.id;
    end if;

    v_plan := v_plan || jsonb_build_array(jsonb_build_object(
      'id', sec ->> 'id', 'title', sec ->> 'title', 'type', sec ->> 'type',
      'instructions', sec ->> 'instructions', 'time_limit_sec', sec -> 'time_limit_sec',
      'points', coalesce(sec -> 'points', '{"mudah":1,"sedang":2,"sulit":3}'::jsonb),
      'negative_marking', coalesce(sec -> 'negative_marking', '0'::jsonb),
      'items', v_items,
      'kraepelin', case when v_cols is null then null else
        jsonb_build_object('config', sec -> 'kraepelin', 'columns', v_cols) end));
  end loop;

  insert into public.attempts (test_id, candidate, candidate_name, candidate_email, position, plan)
  values (t.id, p_candidate, trim(p_candidate ->> 'name'), nullif(v_email, ''), nullif(trim(coalesce(p_candidate ->> 'position', '')), ''), v_plan)
  returning token into v_token;

  return jsonb_build_object('token', v_token);
end $$;

create or replace function public.save_progress(
  p_token uuid, p_answers jsonb default null, p_timings jsonb default null, p_progress jsonb default null,
  p_tab_switches int default null, p_kraepelin_answers jsonb default null
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.attempts set
    answers = coalesce(p_answers, answers),
    timings = coalesce(p_timings, timings),
    progress = coalesce(p_progress, progress),
    tab_switches = greatest(tab_switches, coalesce(p_tab_switches, 0)),
    kraepelin = case when p_kraepelin_answers is null then kraepelin
                     else jsonb_set(coalesce(kraepelin, '{}'::jsonb), '{answers}', p_kraepelin_answers) end,
    updated_at = now()
  where token = p_token and status = 'in_progress';
  return found;
end $$;

-- ---------------------------------------------------------------------
-- MESIN SKORING (internal)
-- ---------------------------------------------------------------------
create or replace function public.score_attempt(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.attempts;
  t public.tests;
  st jsonb;
  v_scores jsonb := '{}'::jsonb;
  v_sections jsonb;
  v_flags jsonb := '[]'::jsonb;
  v_kres jsonb := '{}'::jsonb;
  r record;
  s jsonb;
  sidx int;
  v_cols jsonb;
  v_ans jsonb;
  v_cfg jsonb;
  v_target numeric;
  k record;
  v_percol jsonb;
  v_incons numeric;
  v_pairs int;
  w_total numeric := 0;
  w_sum numeric := 0;
  wt numeric;
  v_overall numeric;
  v_rec text;
  v_th jsonb;
  v_avg_ms numeric;
  v_min_sec numeric;
  v_lie numeric;
  v_kog_total int;
  v_kog_answered int;
begin
  select * into a from public.attempts where id = p_id;
  if not found then return; end if;
  select * into t from public.tests where id = a.test_id;
  st := coalesce(t.settings, '{}'::jsonb);

  delete from public.attempt_answers where attempt_id = p_id;

  -- 1) Skor per butir soal
  insert into public.attempt_answers (attempt_id, question_id, section_index, option_id, answered, is_correct, points, max_points, time_ms, contrib)
  select p_id, q.id, i.sidx, x.ans, x.ans is not null,
    case when q.type = 'cognitive' then c.is_correct end,
    case when q.type = 'cognitive' then c.pts else nd.pts end,
    case when q.type = 'cognitive' then c.w else nd.maxp end,
    case when a.timings ? q.id::text and jsonb_typeof(a.timings -> q.id::text) = 'number' then (a.timings ->> q.id::text)::numeric::int end,
    case when q.type = 'cognitive' then jsonb_build_object(q.category, jsonb_build_array(c.pts, 0, c.w)) else nd.contrib end
  from (
    select (ss.ord - 1)::int as sidx, ss.sec, (it ->> 'q')::uuid as qid
    from jsonb_array_elements(a.plan) with ordinality ss(sec, ord),
         jsonb_array_elements(coalesce(ss.sec -> 'items', '[]'::jsonb)) it
  ) i
  join public.questions q on q.id = i.qid
  cross join lateral (select nullif(a.answers ->> q.id::text, '') as ans) x
  cross join lateral (
    select cc.w, cc.neg, cc.is_correct,
      case when cc.is_correct then cc.w when x.ans is not null then -cc.neg * cc.w else 0 end as pts
    from (select coalesce((i.sec -> 'points' ->> q.difficulty)::numeric, 1) as w,
                 coalesce((i.sec ->> 'negative_marking')::numeric, 0) as neg,
                 (x.ans is not null and exists (select 1 from jsonb_array_elements(q.options) o
                    where o ->> 'id' = x.ans and coalesce((o ->> 'correct')::boolean, false))) as is_correct) cc
  ) c
  cross join lateral (
    select coalesce(jsonb_object_agg(z.k, jsonb_build_array(z.vc, z.vmn, z.vmx)), '{}'::jsonb) as contrib,
           coalesce(sum(z.vc) filter (where z.k = q.category), 0) as pts,
           coalesce(sum(z.vmx) filter (where z.k = q.category), 0) as maxp
    from (
      select e.key as k,
        case when count(*) < jsonb_array_length(q.options) then greatest(max(e.value::numeric), 0) else max(e.value::numeric) end as vmx,
        case when count(*) < jsonb_array_length(q.options) then least(min(e.value::numeric), 0) else min(e.value::numeric) end as vmn,
        coalesce(max(case when o ->> 'id' = x.ans then e.value::numeric end), 0) as vc
      from jsonb_array_elements(q.options) o,
           jsonb_each_text(coalesce(o -> 'scores', '{}'::jsonb)) e
      where x.ans is not null and q.type <> 'cognitive'
      group by e.key
    ) z
  ) nd;

  -- 2) Agregasi per dimensi
  select coalesce(jsonb_object_agg(z.k, jsonb_build_object(
      'raw', round(z.raw, 2), 'min', z.mn, 'max', z.mx, 'n', z.n,
      'pct', round(least(100, greatest(0, case when z.mx > z.mn then (z.raw - z.mn) / (z.mx - z.mn) * 100 else 0 end)), 1))), '{}'::jsonb)
  into v_scores
  from (
    select e.key as k, sum((e.value ->> 0)::numeric) as raw, sum((e.value ->> 1)::numeric) as mn,
           sum((e.value ->> 2)::numeric) as mx, count(*) as n
    from public.attempt_answers aa, jsonb_each(aa.contrib) e
    where aa.attempt_id = p_id
    group by e.key
  ) z;

  for r in
    select q.category, count(*) as total, count(*) filter (where aa.is_correct) as correct, count(*) filter (where aa.answered) as answered
    from public.attempt_answers aa join public.questions q on q.id = aa.question_id
    where aa.attempt_id = p_id and q.type = 'cognitive' group by q.category
  loop
    if v_scores ? r.category then
      v_scores := jsonb_set(v_scores, array[r.category], (v_scores -> r.category) ||
        jsonb_build_object('correct', r.correct, 'total', r.total, 'answered', r.answered));
    end if;
  end loop;

  -- 3) Kraepelin / Pauli
  for s, sidx in select ss.sec, (ss.ord - 1)::int from jsonb_array_elements(a.plan) with ordinality ss(sec, ord) where ss.sec ->> 'type' = 'kraepelin' loop
    v_cols := s -> 'kraepelin' -> 'columns';
    v_cfg := coalesce(s -> 'kraepelin' -> 'config', '{}'::jsonb);
    v_ans := coalesce(a.kraepelin -> 'answers' -> sidx::text, '[]'::jsonb);
    v_target := coalesce(nullif(v_cfg ->> 'target_per_column', '')::numeric, 14);

    select jsonb_agg(jsonb_build_object('answered', pc.an, 'correct', pc.co) order by pc.c) into v_percol
    from (
      select cc.n as c,
        count(*) filter (where jsonb_typeof(v_ans -> (cc.n::int - 1) -> (rr.n - 1)) = 'number') as an,
        count(*) filter (where jsonb_typeof(v_ans -> (cc.n::int - 1) -> (rr.n - 1)) = 'number'
          and (v_ans -> (cc.n::int - 1) ->> (rr.n - 1))::int = ((cc.col ->> (rr.n - 1))::int + (cc.col ->> rr.n)::int) % 10) as co
      from jsonb_array_elements(v_cols) with ordinality cc(col, n)
      cross join lateral generate_series(1, jsonb_array_length(cc.col) - 1) rr(n)
      group by cc.n
    ) pc;

    select avg((e ->> 'answered')::numeric) as panker,
           max((e ->> 'answered')::numeric) - min((e ->> 'answered')::numeric) as janker,
           sum((e ->> 'answered')::numeric) as total_ans,
           sum((e ->> 'correct')::numeric) as total_cor,
           regr_slope((e ->> 'answered')::numeric, n::numeric)::numeric as slope,
           count(*) as ncol
    into k
    from jsonb_array_elements(coalesce(v_percol, '[]'::jsonb)) with ordinality pp(e, n);

    v_kres := v_kres || jsonb_build_object(sidx::text, jsonb_build_object(
      'per_column', coalesce(v_percol, '[]'::jsonb),
      'panker', round(coalesce(k.panker, 0), 2),
      'janker', coalesce(k.janker, 0),
      'tianker', coalesce(k.total_ans - k.total_cor, 0),
      'hanker', round(coalesce(k.slope, 0), 3),
      'total_answered', coalesce(k.total_ans, 0),
      'total_correct', coalesce(k.total_cor, 0),
      'accuracy', round(coalesce(k.total_cor / nullif(k.total_ans, 0) * 100, 0), 1)));

    v_scores := v_scores || jsonb_build_object(
      'kecepatan_kerja', jsonb_build_object('pct', round(least(100, coalesce(k.panker, 0) / v_target * 100), 1), 'raw', round(coalesce(k.panker, 0), 2)),
      'ketelitian_kerja', jsonb_build_object('pct', round(coalesce(k.total_cor / nullif(k.total_ans, 0) * 100, 0), 1), 'raw', coalesce(k.total_ans - k.total_cor, 0)),
      'stabilitas_kerja', jsonb_build_object('pct', round(case when coalesce(k.panker, 0) = 0 then 0 else greatest(0, least(100, 100 - (k.janker / k.panker) * 80)) end, 1), 'raw', coalesce(k.janker, 0)),
      'ketahanan_kerja', jsonb_build_object('pct', round(case when coalesce(k.panker, 0) = 0 then 0 else greatest(0, least(100, 75 + (coalesce(k.slope, 0) * k.ncol / k.panker) * 100)) end, 1), 'raw', round(coalesce(k.slope, 0), 3)));
  end loop;

  -- 4) Konsistensi jawaban (pasangan item Likert)
  select avg(z.rng), count(*) into v_incons, v_pairs from (
    select q.meta ->> 'pair' as pk, max(nv.norm) - min(nv.norm) as rng
    from public.attempt_answers aa
    join public.questions q on q.id = aa.question_id
    cross join lateral (select ((aa.contrib -> q.category ->> 0)::numeric - (aa.contrib -> q.category ->> 1)::numeric)
        / nullif((aa.contrib -> q.category ->> 2)::numeric - (aa.contrib -> q.category ->> 1)::numeric, 0) as norm) nv
    where aa.attempt_id = p_id and aa.answered and q.type = 'likert' and q.meta ? 'pair'
    group by q.meta ->> 'pair' having count(*) >= 2
  ) z;
  if coalesce(v_pairs, 0) >= 2 then
    v_scores := v_scores || jsonb_build_object('konsistensi', jsonb_build_object('pct', round((1 - v_incons) * 100, 1), 'n', v_pairs));
  end if;

  -- 5) Skor per subtes
  select coalesce(jsonb_agg(jsonb_build_object(
      'index', ss.ord - 1, 'title', ss.sec ->> 'title', 'type', ss.sec ->> 'type',
      'total', coalesce(z.tot, 0), 'answered', coalesce(z.ans, 0), 'correct', coalesce(z.cor, 0),
      'points', coalesce(z.pts, 0), 'max_points', coalesce(z.mxp, 0),
      'pct', case
        when ss.sec ->> 'type' = 'kraepelin' then round((coalesce((v_scores -> 'kecepatan_kerja' ->> 'pct')::numeric, 0) + coalesce((v_scores -> 'ketelitian_kerja' ->> 'pct')::numeric, 0)
                + coalesce((v_scores -> 'stabilitas_kerja' ->> 'pct')::numeric, 0) + coalesce((v_scores -> 'ketahanan_kerja' ->> 'pct')::numeric, 0)) / 4, 1)
        when ss.sec ->> 'type' = 'cognitive' then round(greatest(0, coalesce(z.pts, 0)) / nullif(z.mxp, 0) * 100, 1)
        else round(z.avgpct, 1) end
    ) order by ss.ord), '[]'::jsonb)
  into v_sections
  from jsonb_array_elements(a.plan) with ordinality ss(sec, ord)
  left join (
    select aa.section_index, count(*) as tot, count(*) filter (where aa.answered) as ans,
      count(*) filter (where aa.is_correct) as cor, sum(aa.points) as pts, sum(aa.max_points) as mxp,
      avg(case when aa.answered and (aa.contrib -> q.category ->> 2)::numeric > (aa.contrib -> q.category ->> 1)::numeric
        then ((aa.contrib -> q.category ->> 0)::numeric - (aa.contrib -> q.category ->> 1)::numeric)
           / ((aa.contrib -> q.category ->> 2)::numeric - (aa.contrib -> q.category ->> 1)::numeric) * 100 end) as avgpct
    from public.attempt_answers aa join public.questions q on q.id = aa.question_id
    where aa.attempt_id = p_id group by aa.section_index
  ) z on z.section_index = ss.ord - 1;

  -- 6) Skor keseluruhan (indeks kesesuaian) – rata-rata tertimbang dimensi
  for r in select d.key, d.group_name, d.higher_is_better, (v_scores -> d.key ->> 'pct')::numeric as pct
           from public.dimensions d where v_scores ? d.key loop
    wt := coalesce(nullif(st -> 'dimension_weights' ->> r.key, '')::numeric,
                   case when r.group_name = 'validitas' then 0 else 1 end);
    if wt > 0 and r.pct is not null then
      w_sum := w_sum + wt;
      w_total := w_total + wt * case when r.higher_is_better then r.pct else 100 - r.pct end;
    end if;
  end loop;
  v_overall := round(w_total / nullif(w_sum, 0), 1);

  v_th := coalesce(st -> 'thresholds', '{"sangat":80,"rekomendasi":65,"pertimbangan":50}'::jsonb);
  v_rec := case
    when v_overall is null then 'Belum Dapat Dinilai'
    when v_overall >= coalesce((v_th ->> 'sangat')::numeric, 80) then 'Sangat Direkomendasikan'
    when v_overall >= coalesce((v_th ->> 'rekomendasi')::numeric, 65) then 'Direkomendasikan'
    when v_overall >= coalesce((v_th ->> 'pertimbangan')::numeric, 50) then 'Dipertimbangkan'
    else 'Tidak Direkomendasikan' end;

  -- 7) Flag validitas
  v_lie := (v_scores -> 'desirabilitas_sosial' ->> 'pct')::numeric;
  if v_lie is not null and v_lie >= coalesce((st ->> 'lie_threshold')::numeric, 70) then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'faking', 'level', 'danger',
      'message', format('Skor kecenderungan pencitraan tinggi (%s). Jawaban kepribadian berpotensi tidak jujur/faking good.', v_lie)));
    if coalesce((st ->> 'validity_downgrade')::boolean, true) then v_rec := 'Perlu Verifikasi'; end if;
  end if;
  if v_scores ? 'konsistensi' and (v_scores -> 'konsistensi' ->> 'pct')::numeric < 60 then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'inconsistent', 'level', 'warning',
      'message', format('Konsistensi jawaban rendah (%s). Kemungkinan menjawab asal-asalan.', v_scores -> 'konsistensi' ->> 'pct')));
  end if;
  if coalesce((st ->> 'max_tab_switches')::int, 0) > 0 and a.tab_switches > (st ->> 'max_tab_switches')::int then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'tab_switch', 'level', 'danger',
      'message', format('Peserta meninggalkan halaman tes sebanyak %s kali (batas %s).', a.tab_switches, st ->> 'max_tab_switches')));
  elsif a.tab_switches > 0 then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'tab_switch', 'level', 'info',
      'message', format('Peserta meninggalkan halaman tes sebanyak %s kali.', a.tab_switches)));
  end if;
  v_min_sec := coalesce((st ->> 'min_seconds_per_item')::numeric, 2);
  select avg(aa.time_ms) into v_avg_ms from public.attempt_answers aa join public.questions q on q.id = aa.question_id
  where aa.attempt_id = p_id and aa.answered and q.type in ('likert','sjt') and aa.time_ms is not null;
  if v_avg_ms is not null and v_avg_ms < v_min_sec * 1000 then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'too_fast', 'level', 'warning',
      'message', format('Rata-rata waktu menjawab kuesioner sangat cepat (%s detik/butir).', round(v_avg_ms / 1000, 1))));
  end if;
  select count(*), count(*) filter (where aa.answered) into v_kog_total, v_kog_answered
  from public.attempt_answers aa join public.questions q on q.id = aa.question_id where aa.attempt_id = p_id and q.type = 'cognitive';
  if v_kog_total > 0 and v_kog_answered::numeric / v_kog_total < 0.5 then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'incomplete', 'level', 'warning',
      'message', format('Hanya %s dari %s soal kognitif yang dijawab.', v_kog_answered, v_kog_total)));
  end if;

  update public.attempts set
    scores = v_scores,
    section_scores = v_sections,
    overall_score = v_overall,
    recommendation = v_rec,
    passed = v_overall is not null and v_overall >= coalesce((st ->> 'passing_score')::numeric, 60),
    flags = v_flags,
    kraepelin = coalesce(kraepelin, '{}'::jsonb) || jsonb_build_object('results', v_kres)
  where id = p_id;
end $$;

create or replace function public.submit_attempt(
  p_token uuid, p_answers jsonb default null, p_timings jsonb default null, p_progress jsonb default null,
  p_tab_switches int default null, p_kraepelin_answers jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.attempts; t public.tests;
begin
  perform public.save_progress(p_token, p_answers, p_timings, p_progress, p_tab_switches, p_kraepelin_answers);
  select * into a from public.attempts where token = p_token;
  if not found then raise exception 'Sesi tes tidak ditemukan'; end if;
  if a.status = 'in_progress' then
    update public.attempts set status = 'submitted', submitted_at = now(),
      duration_sec = extract(epoch from (now() - started_at))::int
    where id = a.id;
    perform public.score_attempt(a.id);
  end if;
  select * into t from public.tests where id = a.test_id;
  return jsonb_build_object('status', 'submitted', 'show_result', coalesce(t.settings ->> 'show_result', 'none'));
end $$;

create or replace function public.get_candidate_result(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.attempts; t public.tests; v_mode text;
begin
  select * into a from public.attempts where token = p_token;
  if not found then raise exception 'Sesi tes tidak ditemukan'; end if;
  select * into t from public.tests where id = a.test_id;
  v_mode := coalesce(t.settings ->> 'show_result', 'none');
  if a.status <> 'submitted' or v_mode = 'none' then
    return jsonb_build_object('status', a.status, 'show_result', v_mode, 'candidate_name', a.candidate_name,
      'test_title', t.title, 'submitted_at', a.submitted_at);
  end if;
  return jsonb_build_object(
    'status', a.status, 'show_result', v_mode, 'candidate_name', a.candidate_name, 'test_title', t.title,
    'submitted_at', a.submitted_at, 'duration_sec', a.duration_sec,
    'overall_score', case when v_mode = 'full' then a.overall_score end,
    'section_scores', case when v_mode = 'full' then a.section_scores end,
    'dimensions', coalesce((
      select jsonb_agg(jsonb_build_object('key', d.key, 'name', d.name, 'group_name', d.group_name, 'color', d.color,
        'higher_is_better', d.higher_is_better, 'low_threshold', d.low_threshold, 'high_threshold', d.high_threshold,
        'interp_low', d.interp_low, 'interp_mid', d.interp_mid, 'interp_high', d.interp_high,
        'description', d.description, 'pct', (a.scores -> d.key ->> 'pct')::numeric) order by d.sort)
      from public.dimensions d
      where a.scores ? d.key and d.group_name <> 'validitas'), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------
-- API ADMIN
-- ---------------------------------------------------------------------
create or replace function public.rescore_attempt(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Akses ditolak'; end if;
  perform public.score_attempt(p_id);
end $$;

create or replace function public.rescore_test(p_test uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not public.is_admin() then raise exception 'Akses ditolak'; end if;
  for r in select id from public.attempts where test_id = p_test and status = 'submitted' loop
    perform public.score_attempt(r.id); n := n + 1;
  end loop;
  return n;
end $$;

-- Analisis butir soal: tingkat kesulitan empiris (p-value), daya beda (point-biserial), waktu, distribusi opsi.
create or replace function public.item_analysis(p_test uuid default null)
returns table (
  question_id uuid, code text, type text, category text, difficulty text, prompt text, is_active boolean,
  n bigint, p_value numeric, discrimination numeric, avg_time_ms numeric, mean_score numeric, option_counts jsonb
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'Akses ditolak'; end if;
  return query
  select q.id, q.code, q.type, q.category, q.difficulty, q.prompt, q.is_active,
    count(aa.attempt_id) as n,
    round(avg(case when aa.is_correct then 1.0 else 0.0 end) filter (where q.type = 'cognitive'), 3) as p_value,
    round(corr(case when aa.is_correct then 1.0 else 0.0 end, (at.scores -> q.category ->> 'pct')::numeric)::numeric, 3) as discrimination,
    round(avg(aa.time_ms), 0) as avg_time_ms,
    round(avg(case when (aa.contrib -> q.category ->> 2)::numeric > (aa.contrib -> q.category ->> 1)::numeric
      then ((aa.contrib -> q.category ->> 0)::numeric - (aa.contrib -> q.category ->> 1)::numeric)
         / ((aa.contrib -> q.category ->> 2)::numeric - (aa.contrib -> q.category ->> 1)::numeric) * 100 end) filter (where aa.answered), 1) as mean_score,
    coalesce((select jsonb_object_agg(x.option_id, x.cnt) from (
      select aa2.option_id, count(*) as cnt from public.attempt_answers aa2
      join public.attempts at2 on at2.id = aa2.attempt_id
      where aa2.question_id = q.id and aa2.answered and (p_test is null or at2.test_id = p_test)
      group by aa2.option_id) x), '{}'::jsonb) as option_counts
  from public.questions q
  left join public.attempt_answers aa on aa.question_id = q.id
  left join public.attempts at on at.id = aa.attempt_id
  where (p_test is null or at.test_id = p_test or aa.attempt_id is null)
  group by q.id
  order by q.type, q.category, q.code;
end $$;

-- ---------------------------------------------------------------------
-- HAK AKSES FUNGSI
-- ---------------------------------------------------------------------
revoke execute on function public.pick_questions(text, text[], int, jsonb) from public, anon, authenticated;
revoke execute on function public.score_attempt(uuid) from public, anon, authenticated;
grant execute on function public.get_public_test(text) to anon, authenticated;
grant execute on function public.start_attempt(text, jsonb) to anon, authenticated;
grant execute on function public.get_attempt(uuid) to anon, authenticated;
grant execute on function public.save_progress(uuid, jsonb, jsonb, jsonb, int, jsonb) to anon, authenticated;
grant execute on function public.submit_attempt(uuid, jsonb, jsonb, jsonb, int, jsonb) to anon, authenticated;
grant execute on function public.get_candidate_result(uuid) to anon, authenticated;
grant execute on function public.admin_exists() to anon, authenticated;
grant execute on function public.claim_first_admin() to authenticated;
grant execute on function public.rescore_attempt(uuid) to authenticated;
grant execute on function public.rescore_test(uuid) to authenticated;
grant execute on function public.item_analysis(uuid) to authenticated;
