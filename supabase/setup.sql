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


-- =====================================================================
-- LevelUp Psikotest – Seed data (dihasilkan otomatis oleh scripts/build-sql.mjs)
-- 21 dimensi, 255 soal, 1 paket tes contoh
-- =====================================================================

insert into public.dimensions (key, name, group_name, description, higher_is_better, interp_low, interp_mid, interp_high, color, sort) values
  ('verbal', 'Kemampuan Verbal', 'kognitif', 'Kemampuan memahami makna kata, hubungan konsep, dan isi bacaan.', true, 'Perlu waktu lebih untuk memahami instruksi tertulis dan konsep verbal yang kompleks.', 'Cukup mampu memahami instruksi dan informasi tertulis dalam pekerjaan sehari-hari.', 'Sangat baik dalam memahami bahasa, konsep, dan informasi tertulis yang kompleks.', '#6366f1', 1),
  ('numerik', 'Kemampuan Numerik', 'kognitif', 'Kemampuan berhitung, memahami pola angka, dan memecahkan soal kuantitatif.', true, 'Kurang cepat dan tepat dalam mengolah data angka; perlu pendampingan untuk tugas kuantitatif.', 'Cukup mampu menangani perhitungan dan data angka pada tingkat umum.', 'Cepat dan akurat mengolah angka; cocok untuk tugas analitis dan kuantitatif.', '#8b5cf6', 2),
  ('logika', 'Penalaran Logis', 'kognitif', 'Kemampuan menarik kesimpulan, berpikir sistematis, dan memecahkan masalah.', true, 'Cenderung kesulitan menarik kesimpulan yang tepat dari informasi yang tersedia.', 'Mampu berpikir runtut dan menarik kesimpulan pada masalah yang tidak terlalu kompleks.', 'Penalaran tajam dan sistematis; mampu memecahkan masalah kompleks dengan tepat.', '#0ea5e9', 3),
  ('figural', 'Penalaran Figural & Spasial', 'kognitif', 'Kemampuan mengenali pola abstrak, rotasi, dan hubungan ruang.', true, 'Kurang peka terhadap pola abstrak dan visualisasi ruang.', 'Cukup mampu mengenali pola visual dan hubungan ruang.', 'Sangat baik dalam berpikir abstrak dan visual-spasial.', '#14b8a6', 4),
  ('kecepatan_kerja', 'Kecepatan Kerja', 'kinerja', 'Tempo kerja (Panker) – rata-rata jumlah penjumlahan per lajur.', true, 'Tempo kerja lambat; perlu waktu lebih untuk menyelesaikan tugas rutin.', 'Tempo kerja sedang dan wajar.', 'Tempo kerja cepat dan produktif.', '#f59e0b', 10),
  ('ketelitian_kerja', 'Ketelitian Kerja', 'kinerja', 'Akurasi kerja (Tianker) – proporsi jawaban benar di bawah tekanan waktu.', true, 'Banyak kesalahan saat bekerja cepat; perlu kontrol kualitas.', 'Ketelitian cukup, sesekali terjadi kesalahan.', 'Sangat teliti dan akurat meskipun di bawah tekanan waktu.', '#ef4444', 11),
  ('stabilitas_kerja', 'Stabilitas Kerja', 'kinerja', 'Konsistensi tempo kerja antar lajur (Janker).', true, 'Performa naik-turun; mudah terpengaruh kondisi.', 'Performa cukup stabil.', 'Performa sangat stabil dan konsisten.', '#10b981', 12),
  ('ketahanan_kerja', 'Ketahanan Kerja', 'kinerja', 'Daya tahan/endurance (Hanker) – tren performa dari awal hingga akhir tes.', true, 'Performa menurun seiring waktu; mudah lelah pada tugas panjang.', 'Daya tahan kerja cukup baik.', 'Daya tahan tinggi; performa terjaga bahkan meningkat hingga akhir.', '#3b82f6', 13),
  ('tingkat_stres', 'Tingkat Stres', 'kepribadian', 'Tingkat stres yang dirasakan saat ini terkait pekerjaan (skor tinggi = stres tinggi).', false, 'Tingkat stres rendah; kondisi psikologis relatif tenang dan terkendali.', 'Tingkat stres sedang dan masih wajar; perlu manajemen beban kerja.', 'Tingkat stres tinggi; berisiko kelelahan (burnout) dan perlu perhatian.', '#f43f5e', 20),
  ('toleransi_tekanan', 'Ketahanan terhadap Tekanan', 'kepribadian', 'Kemampuan tetap efektif di bawah tekanan, tenggat, dan target tinggi.', true, 'Mudah terganggu saat ditekan tenggat atau target; performa cenderung turun.', 'Cukup mampu menghadapi tekanan kerja pada tingkat wajar.', 'Tangguh menghadapi tekanan; tetap tenang dan efektif saat situasi menuntut.', '#f97316', 21),
  ('stabilitas_emosi', 'Stabilitas Emosi', 'kepribadian', 'Kemampuan mengelola emosi, menerima kritik, dan menjaga suasana hati.', true, 'Emosi mudah berubah dan reaktif terhadap kritik atau masalah.', 'Umumnya dapat mengelola emosi dengan baik.', 'Emosi matang dan stabil; tenang dalam situasi sulit.', '#ec4899', 22),
  ('kerja_tim', 'Kerja Sama Tim', 'kepribadian', 'Kesediaan bekerja sama, berbagi, dan mendukung tujuan tim.', true, 'Lebih nyaman bekerja sendiri; kurang menonjol dalam kolaborasi.', 'Mampu bekerja sama dalam tim dengan baik.', 'Kolaboratif, suportif, dan berorientasi pada keberhasilan tim.', '#22c55e', 23),
  ('integritas', 'Integritas & Kejujuran', 'kepribadian', 'Kejujuran, kepatuhan pada aturan, dan etika kerja.', true, 'Cenderung permisif terhadap pelanggaran aturan; perlu pengawasan dan verifikasi.', 'Memiliki nilai kejujuran yang cukup baik.', 'Integritas tinggi; jujur, taat aturan, dan dapat dipercaya.', '#0f766e', 24),
  ('tanggung_jawab', 'Tanggung Jawab & Disiplin', 'kepribadian', 'Keteraturan, ketepatan waktu, dan kesediaan bertanggung jawab atas hasil kerja.', true, 'Cenderung menunda dan kurang teratur dalam menyelesaikan tugas.', 'Cukup disiplin dan bertanggung jawab.', 'Sangat disiplin, teratur, dan bertanggung jawab penuh atas hasil kerja.', '#2563eb', 25),
  ('adaptabilitas', 'Adaptabilitas', 'kepribadian', 'Kemampuan menyesuaikan diri dengan perubahan, sistem, dan lingkungan baru.', true, 'Kurang nyaman dengan perubahan; butuh waktu lama beradaptasi.', 'Cukup mampu menyesuaikan diri dengan perubahan.', 'Sangat fleksibel dan terbuka terhadap perubahan.', '#7c3aed', 26),
  ('komunikasi', 'Komunikasi Interpersonal', 'kepribadian', 'Kemampuan menyampaikan informasi dan berinteraksi secara efektif.', true, 'Komunikasi kurang efektif; cenderung pasif dalam menyampaikan informasi.', 'Komunikasi cukup efektif dalam situasi kerja umum.', 'Komunikator yang jelas, terbuka, dan efektif.', '#06b6d4', 27),
  ('kepemimpinan', 'Kepemimpinan & Inisiatif', 'kepribadian', 'Keberanian mengambil keputusan, inisiatif, dan kemampuan menggerakkan orang lain.', true, 'Cenderung menunggu arahan; inisiatif masih terbatas.', 'Memiliki inisiatif dan potensi kepemimpinan yang cukup.', 'Proaktif, berani mengambil keputusan, dan berpotensi memimpin.', '#a855f7', 28),
  ('motivasi_berprestasi', 'Motivasi Berprestasi', 'kepribadian', 'Dorongan untuk mencapai hasil terbaik dan terus berkembang.', true, 'Motivasi berprestasi rendah; cenderung puas dengan hasil minimal.', 'Memiliki motivasi kerja yang cukup.', 'Sangat termotivasi untuk berprestasi dan berkembang.', '#eab308', 29),
  ('orientasi_pelayanan', 'Orientasi Pelayanan', 'kepribadian', 'Kepedulian terhadap kebutuhan dan kepuasan pelanggan/pihak lain.', true, 'Kurang peka terhadap kebutuhan pelanggan.', 'Cukup peduli pada kualitas pelayanan.', 'Sangat berorientasi pada pelayanan dan kepuasan pelanggan.', '#84cc16', 30),
  ('desirabilitas_sosial', 'Kecenderungan Pencitraan', 'validitas', 'Skala kebohongan (lie scale): kecenderungan menampilkan diri secara berlebihan baik.', false, 'Menjawab apa adanya; hasil tes dapat dipercaya.', 'Ada sedikit kecenderungan menampilkan diri secara positif; masih wajar.', 'Kecenderungan pencitraan tinggi (faking good); hasil kepribadian perlu diverifikasi melalui wawancara.', '#64748b', 40),
  ('konsistensi', 'Konsistensi Jawaban', 'validitas', 'Kesesuaian jawaban pada pasangan pernyataan yang mengukur hal serupa.', true, 'Jawaban tidak konsisten; kemungkinan menjawab asal atau kurang memahami pernyataan.', 'Konsistensi jawaban cukup.', 'Jawaban konsisten; hasil dapat diandalkan.', '#94a3b8', 41)
on conflict (key) do update set name = excluded.name, group_name = excluded.group_name, description = excluded.description,
  higher_is_better = excluded.higher_is_better, interp_low = excluded.interp_low, interp_mid = excluded.interp_mid,
  interp_high = excluded.interp_high, color = excluded.color, sort = excluded.sort;

insert into public.questions (code, type, category, difficulty, prompt, stimulus, options, explanation, meta) values
  ('VRB-SIN-01', 'cognitive', 'verbal', 'mudah', 'Pilih kata yang paling SAMA artinya (sinonim) dengan: CERMAT', null, '[{"id":"a","text":"Teliti","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Cepat"},{"id":"c","text":"Ceroboh"},{"id":"d","text":"Cerdas"},{"id":"e","text":"Rajin"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-SIN-02', 'cognitive', 'verbal', 'mudah', 'Pilih kata yang paling SAMA artinya (sinonim) dengan: AKURAT', null, '[{"id":"a","text":"Tepat","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Cepat"},{"id":"c","text":"Kira-kira"},{"id":"d","text":"Baru"},{"id":"e","text":"Lengkap"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-SIN-03', 'cognitive', 'verbal', 'sedang', 'Pilih kata yang paling SAMA artinya (sinonim) dengan: KONKRET', null, '[{"id":"a","text":"Nyata","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Abstrak"},{"id":"c","text":"Kuat"},{"id":"d","text":"Padat"},{"id":"e","text":"Keras"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-SIN-04', 'cognitive', 'verbal', 'sedang', 'Pilih kata yang paling SAMA artinya (sinonim) dengan: KOMPETEN', null, '[{"id":"a","text":"Cakap","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Bersaing"},{"id":"c","text":"Lengkap"},{"id":"d","text":"Patuh"},{"id":"e","text":"Kompak"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-SIN-05', 'cognitive', 'verbal', 'sedang', 'Pilih kata yang paling SAMA artinya (sinonim) dengan: ELABORASI', null, '[{"id":"a","text":"Penggarapan secara tekun dan cermat","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Pengurangan"},{"id":"c","text":"Penyederhanaan"},{"id":"d","text":"Peringkasan"},{"id":"e","text":"Pembatalan"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-SIN-06', 'cognitive', 'verbal', 'sulit', 'Pilih kata yang paling SAMA artinya (sinonim) dengan: KONKLUSI', null, '[{"id":"a","text":"Simpulan","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Pendahuluan"},{"id":"c","text":"Pertimbangan"},{"id":"d","text":"Dugaan"},{"id":"e","text":"Pengantar"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-SIN-07', 'cognitive', 'verbal', 'sulit', 'Pilih kata yang paling SAMA artinya (sinonim) dengan: INSINUASI', null, '[{"id":"a","text":"Sindiran","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Pujian"},{"id":"c","text":"Ajakan"},{"id":"d","text":"Penegasan"},{"id":"e","text":"Penolakan"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-SIN-08', 'cognitive', 'verbal', 'sulit', 'Pilih kata yang paling SAMA artinya (sinonim) dengan: PROMINEN', null, '[{"id":"a","text":"Terkemuka","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Menjanjikan"},{"id":"c","text":"Sementara"},{"id":"d","text":"Berpotensi"},{"id":"e","text":"Terbelakang"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-SIN-09', 'cognitive', 'verbal', 'sulit', 'Pilih kata yang paling SAMA artinya (sinonim) dengan: NIRLABA', null, '[{"id":"a","text":"Tidak mencari keuntungan","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Tanpa modal"},{"id":"c","text":"Merugi"},{"id":"d","text":"Bebas pajak"},{"id":"e","text":"Bebas biaya"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANT-01', 'cognitive', 'verbal', 'mudah', 'Pilih kata yang paling BERLAWANAN artinya (antonim) dengan: OPTIMIS', null, '[{"id":"a","text":"Pesimis","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Realistis"},{"id":"c","text":"Idealis"},{"id":"d","text":"Egois"},{"id":"e","text":"Apatis"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANT-02', 'cognitive', 'verbal', 'mudah', 'Pilih kata yang paling BERLAWANAN artinya (antonim) dengan: SEMENTARA', null, '[{"id":"a","text":"Permanen","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Sebentar"},{"id":"c","text":"Sekarang"},{"id":"d","text":"Sesaat"},{"id":"e","text":"Sejenak"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANT-03', 'cognitive', 'verbal', 'sedang', 'Pilih kata yang paling BERLAWANAN artinya (antonim) dengan: PROGRESIF', null, '[{"id":"a","text":"Regresif","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Agresif"},{"id":"c","text":"Represif"},{"id":"d","text":"Pasif"},{"id":"e","text":"Impresif"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANT-04', 'cognitive', 'verbal', 'sedang', 'Pilih kata yang paling BERLAWANAN artinya (antonim) dengan: EFISIEN', null, '[{"id":"a","text":"Boros","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Hemat"},{"id":"c","text":"Lambat"},{"id":"d","text":"Efektif"},{"id":"e","text":"Tepat"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANT-05', 'cognitive', 'verbal', 'sedang', 'Pilih kata yang paling BERLAWANAN artinya (antonim) dengan: AMATIR', null, '[{"id":"a","text":"Profesional","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Pemula"},{"id":"c","text":"Awam"},{"id":"d","text":"Pelajar"},{"id":"e","text":"Penggemar"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANT-06', 'cognitive', 'verbal', 'sedang', 'Pilih kata yang paling BERLAWANAN artinya (antonim) dengan: HETEROGEN', null, '[{"id":"a","text":"Homogen","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Beragam"},{"id":"c","text":"Majemuk"},{"id":"d","text":"Campuran"},{"id":"e","text":"Heterodoks"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANT-07', 'cognitive', 'verbal', 'sulit', 'Pilih kata yang paling BERLAWANAN artinya (antonim) dengan: SPORADIS', null, '[{"id":"a","text":"Kontinu","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Jarang"},{"id":"c","text":"Acak"},{"id":"d","text":"Tersebar"},{"id":"e","text":"Sesekali"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANT-08', 'cognitive', 'verbal', 'sulit', 'Pilih kata yang paling BERLAWANAN artinya (antonim) dengan: SKEPTIS', null, '[{"id":"a","text":"Percaya","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Ragu"},{"id":"c","text":"Kritis"},{"id":"d","text":"Sinis"},{"id":"e","text":"Curiga"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANT-09', 'cognitive', 'verbal', 'sulit', 'Pilih kata yang paling BERLAWANAN artinya (antonim) dengan: KONVERGEN', null, '[{"id":"a","text":"Divergen","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Konvensional"},{"id":"c","text":"Terpusat"},{"id":"d","text":"Sejajar"},{"id":"e","text":"Menyatu"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANA-01', 'cognitive', 'verbal', 'mudah', 'Lengkapi analogi berikut: DOKTER : RUMAH SAKIT = GURU : …', null, '[{"id":"a","text":"Sekolah","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Murid"},{"id":"c","text":"Buku"},{"id":"d","text":"Kapur"},{"id":"e","text":"Pelajaran"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANA-02', 'cognitive', 'verbal', 'mudah', 'Lengkapi analogi berikut: AIR : HAUS = MAKANAN : …', null, '[{"id":"a","text":"Lapar","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Kenyang"},{"id":"c","text":"Piring"},{"id":"d","text":"Nasi"},{"id":"e","text":"Restoran"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANA-03', 'cognitive', 'verbal', 'sedang', 'Lengkapi analogi berikut: PENA : PENULIS = KUAS : …', null, '[{"id":"a","text":"Pelukis","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Kanvas"},{"id":"c","text":"Cat"},{"id":"d","text":"Gambar"},{"id":"e","text":"Warna"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANA-04', 'cognitive', 'verbal', 'sedang', 'Lengkapi analogi berikut: PANAS : API = DINGIN : …', null, '[{"id":"a","text":"Es","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Air"},{"id":"c","text":"Angin"},{"id":"d","text":"Hujan"},{"id":"e","text":"Awan"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANA-05', 'cognitive', 'verbal', 'sedang', 'Lengkapi analogi berikut: BENIH : POHON = TELUR : …', null, '[{"id":"a","text":"Ayam","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Cangkang"},{"id":"c","text":"Sarang"},{"id":"d","text":"Kuning telur"},{"id":"e","text":"Induk"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANA-06', 'cognitive', 'verbal', 'sedang', 'Lengkapi analogi berikut: KAKI : SEPATU = KEPALA : …', null, '[{"id":"a","text":"Topi","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Rambut"},{"id":"c","text":"Bantal"},{"id":"d","text":"Otak"},{"id":"e","text":"Leher"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANA-07', 'cognitive', 'verbal', 'sedang', 'Lengkapi analogi berikut: KEMARAU : KEKERINGAN = HUJAN DERAS : …', null, '[{"id":"a","text":"Banjir","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Musim"},{"id":"c","text":"Payung"},{"id":"d","text":"Petir"},{"id":"e","text":"Awan"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANA-08', 'cognitive', 'verbal', 'sulit', 'Lengkapi analogi berikut: LAPAR : MAKAN = LELAH : …', null, '[{"id":"a","text":"Istirahat","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Mengantuk"},{"id":"c","text":"Bekerja"},{"id":"d","text":"Lesu"},{"id":"e","text":"Sakit"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANA-09', 'cognitive', 'verbal', 'sulit', 'Lengkapi analogi berikut: AUDITOR : LAPORAN KEUANGAN = EDITOR : …', null, '[{"id":"a","text":"Naskah","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Penerbit"},{"id":"c","text":"Penulis"},{"id":"d","text":"Percetakan"},{"id":"e","text":"Pembaca"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-ANA-10', 'cognitive', 'verbal', 'sulit', 'Lengkapi analogi berikut: PROLOG : EPILOG = PEMBUKAAN : …', null, '[{"id":"a","text":"Penutup","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Isi"},{"id":"c","text":"Bab"},{"id":"d","text":"Kata pengantar"},{"id":"e","text":"Daftar isi"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-KLS-01', 'cognitive', 'verbal', 'mudah', 'Manakah yang TIDAK termasuk dalam kelompoknya?', null, '[{"id":"a","text":"Apel"},{"id":"b","text":"Mangga"},{"id":"c","text":"Jeruk"},{"id":"d","text":"Wortel","correct":true,"scores":{"verbal":1}},{"id":"e","text":"Pisang"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-KLS-02', 'cognitive', 'verbal', 'sedang', 'Manakah yang TIDAK termasuk dalam kelompoknya?', null, '[{"id":"a","text":"Merkurius"},{"id":"b","text":"Venus"},{"id":"c","text":"Mars"},{"id":"d","text":"Bulan","correct":true,"scores":{"verbal":1}},{"id":"e","text":"Jupiter"}]'::jsonb, 'Bulan adalah satelit, bukan planet.', '{}'::jsonb),
  ('VRB-KLS-03', 'cognitive', 'verbal', 'sedang', 'Manakah yang TIDAK termasuk dalam kelompoknya?', null, '[{"id":"a","text":"Kilogram"},{"id":"b","text":"Gram"},{"id":"c","text":"Ons"},{"id":"d","text":"Liter","correct":true,"scores":{"verbal":1}},{"id":"e","text":"Ton"}]'::jsonb, 'Liter adalah satuan volume, lainnya satuan massa.', '{}'::jsonb),
  ('VRB-KLS-04', 'cognitive', 'verbal', 'sedang', 'Manakah yang TIDAK termasuk dalam kelompoknya?', null, '[{"id":"a","text":"Biologi"},{"id":"b","text":"Kimia"},{"id":"c","text":"Fisika"},{"id":"d","text":"Sosiologi","correct":true,"scores":{"verbal":1}},{"id":"e","text":"Astronomi"}]'::jsonb, 'Sosiologi termasuk ilmu sosial.', '{}'::jsonb),
  ('VRB-KLS-05', 'cognitive', 'verbal', 'sulit', 'Manakah yang TIDAK termasuk dalam kelompoknya?', null, '[{"id":"a","text":"Rupiah"},{"id":"b","text":"Ringgit"},{"id":"c","text":"Baht"},{"id":"d","text":"Dong"},{"id":"e","text":"Yen","correct":true,"scores":{"verbal":1}}]'::jsonb, 'Yen bukan mata uang negara ASEAN.', '{}'::jsonb),
  ('VRB-BCA-01', 'cognitive', 'verbal', 'sedang', 'Apa alasan utama manajemen menetapkan dua hari kerja tatap muka?', 'Sebuah perusahaan logistik menerapkan sistem kerja hibrida sejak awal tahun. Dalam enam bulan, tingkat kehadiran rapat meningkat 15%, sementara biaya operasional kantor turun 20%. Namun, survei internal menunjukkan 30% karyawan merasa koordinasi antartim menjadi lebih lambat. Manajemen kemudian menetapkan dua hari kerja tatap muka wajib setiap minggu untuk memperbaiki koordinasi tanpa menghilangkan fleksibilitas.', '[{"id":"a","text":"Memperbaiki koordinasi antartim","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Menaikkan biaya operasional"},{"id":"c","text":"Meningkatkan kehadiran rapat"},{"id":"d","text":"Menghapus sistem hibrida"},{"id":"e","text":"Mengurangi jumlah karyawan"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-BCA-02', 'cognitive', 'verbal', 'sulit', 'Pernyataan yang PALING sesuai dengan bacaan adalah …', 'Sebuah perusahaan logistik menerapkan sistem kerja hibrida sejak awal tahun. Dalam enam bulan, tingkat kehadiran rapat meningkat 15%, sementara biaya operasional kantor turun 20%. Namun, survei internal menunjukkan 30% karyawan merasa koordinasi antartim menjadi lebih lambat. Manajemen kemudian menetapkan dua hari kerja tatap muka wajib setiap minggu untuk memperbaiki koordinasi tanpa menghilangkan fleksibilitas.', '[{"id":"a","text":"Sistem hibrida memberi manfaat biaya tetapi menimbulkan tantangan koordinasi","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Seluruh karyawan menolak sistem hibrida"},{"id":"c","text":"Biaya operasional naik 20% setelah sistem hibrida"},{"id":"d","text":"Kehadiran rapat menurun 15%"},{"id":"e","text":"Manajemen menghentikan fleksibilitas kerja"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-BCA-03', 'cognitive', 'verbal', 'sulit', 'Kesimpulan yang TIDAK dapat ditarik dari bacaan adalah …', 'Sebuah perusahaan logistik menerapkan sistem kerja hibrida sejak awal tahun. Dalam enam bulan, tingkat kehadiran rapat meningkat 15%, sementara biaya operasional kantor turun 20%. Namun, survei internal menunjukkan 30% karyawan merasa koordinasi antartim menjadi lebih lambat. Manajemen kemudian menetapkan dua hari kerja tatap muka wajib setiap minggu untuk memperbaiki koordinasi tanpa menghilangkan fleksibilitas.', '[{"id":"a","text":"Penjualan perusahaan meningkat setelah sistem hibrida","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Biaya kantor berkurang"},{"id":"c","text":"Sebagian karyawan merasa koordinasi melambat"},{"id":"d","text":"Kehadiran rapat meningkat"},{"id":"e","text":"Kebijakan tatap muka tetap mempertahankan fleksibilitas"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-BCA-04', 'cognitive', 'verbal', 'sedang', 'Mengapa perusahaan memberi wewenang lebih kepada petugas garis depan?', 'Data layanan pelanggan menunjukkan bahwa 70% keluhan diselesaikan pada kontak pertama. Keluhan yang tidak selesai pada kontak pertama rata-rata membutuhkan tiga hari untuk tuntas dan menurunkan skor kepuasan hingga 40%. Karena itu, perusahaan melatih petugas garis depan agar memiliki wewenang menyelesaikan masalah umum tanpa harus menunggu persetujuan supervisor.', '[{"id":"a","text":"Agar lebih banyak keluhan tuntas pada kontak pertama","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Agar supervisor tidak perlu bekerja"},{"id":"c","text":"Untuk mengurangi jumlah petugas"},{"id":"d","text":"Karena keluhan pelanggan meningkat 70%"},{"id":"e","text":"Agar pelanggan menunggu tiga hari"}]'::jsonb, null, '{}'::jsonb),
  ('VRB-BCA-05', 'cognitive', 'verbal', 'sulit', 'Berdasarkan bacaan, keluhan yang tidak selesai pada kontak pertama …', 'Data layanan pelanggan menunjukkan bahwa 70% keluhan diselesaikan pada kontak pertama. Keluhan yang tidak selesai pada kontak pertama rata-rata membutuhkan tiga hari untuk tuntas dan menurunkan skor kepuasan hingga 40%. Karena itu, perusahaan melatih petugas garis depan agar memiliki wewenang menyelesaikan masalah umum tanpa harus menunggu persetujuan supervisor.', '[{"id":"a","text":"Berdampak signifikan pada penurunan kepuasan pelanggan","correct":true,"scores":{"verbal":1}},{"id":"b","text":"Jumlahnya 70% dari seluruh keluhan"},{"id":"c","text":"Selalu selesai dalam satu hari"},{"id":"d","text":"Tidak memengaruhi kepuasan pelanggan"},{"id":"e","text":"Harus ditangani langsung oleh direktur"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-DRT-01', 'cognitive', 'numerik', 'mudah', 'Tentukan bilangan berikutnya dari deret: 2, 4, 6, 8, …', null, '[{"id":"a","text":"10","correct":true,"scores":{"numerik":1}},{"id":"b","text":"9"},{"id":"c","text":"12"},{"id":"d","text":"11"},{"id":"e","text":"14"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-DRT-02', 'cognitive', 'numerik', 'mudah', 'Tentukan bilangan berikutnya dari deret: 3, 6, 12, 24, …', null, '[{"id":"a","text":"48","correct":true,"scores":{"numerik":1}},{"id":"b","text":"36"},{"id":"c","text":"30"},{"id":"d","text":"42"},{"id":"e","text":"50"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-DRT-03', 'cognitive', 'numerik', 'mudah', 'Tentukan bilangan berikutnya dari deret: 50, 45, 40, 35, …', null, '[{"id":"a","text":"30","correct":true,"scores":{"numerik":1}},{"id":"b","text":"25"},{"id":"c","text":"32"},{"id":"d","text":"33"},{"id":"e","text":"28"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-DRT-04', 'cognitive', 'numerik', 'sedang', 'Tentukan bilangan berikutnya dari deret: 1, 4, 9, 16, 25, …', null, '[{"id":"a","text":"36","correct":true,"scores":{"numerik":1}},{"id":"b","text":"30"},{"id":"c","text":"34"},{"id":"d","text":"49"},{"id":"e","text":"32"}]'::jsonb, 'Bilangan kuadrat: 6² = 36.', '{}'::jsonb),
  ('NUM-DRT-05', 'cognitive', 'numerik', 'sedang', 'Tentukan bilangan berikutnya dari deret: 2, 3, 5, 8, 12, …', null, '[{"id":"a","text":"17","correct":true,"scores":{"numerik":1}},{"id":"b","text":"15"},{"id":"c","text":"16"},{"id":"d","text":"18"},{"id":"e","text":"20"}]'::jsonb, 'Selisih bertambah 1: +1, +2, +3, +4, +5.', '{}'::jsonb),
  ('NUM-DRT-06', 'cognitive', 'numerik', 'sedang', 'Tentukan bilangan berikutnya dari deret: 1, 1, 2, 3, 5, 8, …', null, '[{"id":"a","text":"13","correct":true,"scores":{"numerik":1}},{"id":"b","text":"11"},{"id":"c","text":"12"},{"id":"d","text":"14"},{"id":"e","text":"16"}]'::jsonb, 'Fibonacci: 5 + 8 = 13.', '{}'::jsonb),
  ('NUM-DRT-07', 'cognitive', 'numerik', 'sedang', 'Tentukan bilangan berikutnya dari deret: 5, 7, 10, 14, 19, …', null, '[{"id":"a","text":"25","correct":true,"scores":{"numerik":1}},{"id":"b","text":"24"},{"id":"c","text":"23"},{"id":"d","text":"26"},{"id":"e","text":"28"}]'::jsonb, 'Selisih +2, +3, +4, +5, +6.', '{}'::jsonb),
  ('NUM-DRT-08', 'cognitive', 'numerik', 'sulit', 'Tentukan bilangan berikutnya dari deret: 2, 6, 12, 20, 30, …', null, '[{"id":"a","text":"42","correct":true,"scores":{"numerik":1}},{"id":"b","text":"40"},{"id":"c","text":"36"},{"id":"d","text":"38"},{"id":"e","text":"44"}]'::jsonb, 'n × (n+1): 6 × 7 = 42.', '{}'::jsonb),
  ('NUM-DRT-09', 'cognitive', 'numerik', 'sulit', 'Tentukan bilangan berikutnya dari deret: 3, 5, 9, 17, 33, …', null, '[{"id":"a","text":"65","correct":true,"scores":{"numerik":1}},{"id":"b","text":"64"},{"id":"c","text":"66"},{"id":"d","text":"49"},{"id":"e","text":"57"}]'::jsonb, 'Selisih berlipat: +2, +4, +8, +16, +32.', '{}'::jsonb),
  ('NUM-DRT-10', 'cognitive', 'numerik', 'sulit', 'Tentukan bilangan berikutnya dari deret: 4, 8, 7, 14, 13, 26, …', null, '[{"id":"a","text":"25","correct":true,"scores":{"numerik":1}},{"id":"b","text":"52"},{"id":"c","text":"27"},{"id":"d","text":"24"},{"id":"e","text":"28"}]'::jsonb, 'Pola ×2, −1 berulang.', '{}'::jsonb),
  ('NUM-DRT-11', 'cognitive', 'numerik', 'sulit', 'Tentukan bilangan berikutnya dari deret: 1, 2, 6, 24, 120, …', null, '[{"id":"a","text":"720","correct":true,"scores":{"numerik":1}},{"id":"b","text":"600"},{"id":"c","text":"240"},{"id":"d","text":"840"},{"id":"e","text":"144"}]'::jsonb, 'Dikali 2, 3, 4, 5, 6.', '{}'::jsonb),
  ('NUM-DRT-12', 'cognitive', 'numerik', 'sulit', 'Tentukan bilangan berikutnya dari deret: 10, 8, 11, 9, 12, 10, …', null, '[{"id":"a","text":"13","correct":true,"scores":{"numerik":1}},{"id":"b","text":"11"},{"id":"c","text":"14"},{"id":"d","text":"12"},{"id":"e","text":"9"}]'::jsonb, 'Pola −2, +3 berulang.', '{}'::jsonb),
  ('NUM-ART-01', 'cognitive', 'numerik', 'mudah', '25% dari 240 adalah …', null, '[{"id":"a","text":"60","correct":true,"scores":{"numerik":1}},{"id":"b","text":"48"},{"id":"c","text":"50"},{"id":"d","text":"64"},{"id":"e","text":"80"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-ART-02', 'cognitive', 'numerik', 'mudah', '125 + 378 − 203 = …', null, '[{"id":"a","text":"300","correct":true,"scores":{"numerik":1}},{"id":"b","text":"310"},{"id":"c","text":"290"},{"id":"d","text":"303"},{"id":"e","text":"320"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-ART-03', 'cognitive', 'numerik', 'mudah', '18 × 15 = …', null, '[{"id":"a","text":"270","correct":true,"scores":{"numerik":1}},{"id":"b","text":"260"},{"id":"c","text":"280"},{"id":"d","text":"255"},{"id":"e","text":"285"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-ART-04', 'cognitive', 'numerik', 'mudah', 'Nilai dari 2³ + 4² = …', null, '[{"id":"a","text":"24","correct":true,"scores":{"numerik":1}},{"id":"b","text":"20"},{"id":"c","text":"16"},{"id":"d","text":"32"},{"id":"e","text":"28"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-ART-05', 'cognitive', 'numerik', 'sedang', '0,75 × 480 = …', null, '[{"id":"a","text":"360","correct":true,"scores":{"numerik":1}},{"id":"b","text":"340"},{"id":"c","text":"320"},{"id":"d","text":"380"},{"id":"e","text":"375"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-ART-06', 'cognitive', 'numerik', 'sedang', '3/8 dari 640 = …', null, '[{"id":"a","text":"240","correct":true,"scores":{"numerik":1}},{"id":"b","text":"220"},{"id":"c","text":"260"},{"id":"d","text":"200"},{"id":"e","text":"280"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-ART-07', 'cognitive', 'numerik', 'sedang', '√784 = …', null, '[{"id":"a","text":"28","correct":true,"scores":{"numerik":1}},{"id":"b","text":"26"},{"id":"c","text":"27"},{"id":"d","text":"24"},{"id":"e","text":"32"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-ART-08', 'cognitive', 'numerik', 'sedang', 'Jika 3x + 7 = 31, maka x = …', null, '[{"id":"a","text":"8","correct":true,"scores":{"numerik":1}},{"id":"b","text":"7"},{"id":"c","text":"9"},{"id":"d","text":"6"},{"id":"e","text":"10"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-CRT-01', 'cognitive', 'numerik', 'mudah', 'Rapat dimulai pukul 09.45 dan berlangsung 2 jam 30 menit. Rapat selesai pukul …', null, '[{"id":"a","text":"12.15","correct":true,"scores":{"numerik":1}},{"id":"b","text":"12.45"},{"id":"c","text":"11.45"},{"id":"d","text":"12.00"},{"id":"e","text":"12.30"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-CRT-02', 'cognitive', 'numerik', 'sedang', 'Harga printer Rp2.400.000 mendapat diskon 15%. Harga yang dibayar adalah …', null, '[{"id":"a","text":"Rp2.040.000","correct":true,"scores":{"numerik":1}},{"id":"b","text":"Rp2.160.000"},{"id":"c","text":"Rp2.000.000"},{"id":"d","text":"Rp1.960.000"},{"id":"e","text":"Rp2.100.000"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-CRT-03', 'cognitive', 'numerik', 'sedang', 'Seorang staf mengetik 45 kata per menit. Waktu untuk mengetik dokumen 1.800 kata adalah …', null, '[{"id":"a","text":"40 menit","correct":true,"scores":{"numerik":1}},{"id":"b","text":"36 menit"},{"id":"c","text":"45 menit"},{"id":"d","text":"42 menit"},{"id":"e","text":"38 menit"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-CRT-04', 'cognitive', 'numerik', 'sedang', 'Gaji pokok Rp4.500.000, tunjangan 20% dari gaji pokok, dan potongan Rp350.000. Gaji bersih adalah …', null, '[{"id":"a","text":"Rp5.050.000","correct":true,"scores":{"numerik":1}},{"id":"b","text":"Rp5.400.000"},{"id":"c","text":"Rp4.950.000"},{"id":"d","text":"Rp5.150.000"},{"id":"e","text":"Rp4.850.000"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-CRT-05', 'cognitive', 'numerik', 'sedang', 'Persediaan kertas 12 rim. Setiap hari terpakai 3/4 rim. Persediaan habis dalam … hari.', null, '[{"id":"a","text":"16","correct":true,"scores":{"numerik":1}},{"id":"b","text":"9"},{"id":"c","text":"12"},{"id":"d","text":"15"},{"id":"e","text":"18"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-CRT-06', 'cognitive', 'numerik', 'sulit', 'Penjualan Januari Rp80 juta dan Februari Rp92 juta. Persentase kenaikannya adalah …', null, '[{"id":"a","text":"15%","correct":true,"scores":{"numerik":1}},{"id":"b","text":"12%"},{"id":"c","text":"13%"},{"id":"d","text":"18%"},{"id":"e","text":"20%"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-CRT-07', 'cognitive', 'numerik', 'sulit', 'Tim A menyelesaikan pekerjaan dalam 6 hari, Tim B dalam 12 hari. Jika bekerja bersama, pekerjaan selesai dalam …', null, '[{"id":"a","text":"4 hari","correct":true,"scores":{"numerik":1}},{"id":"b","text":"9 hari"},{"id":"c","text":"3 hari"},{"id":"d","text":"5 hari"},{"id":"e","text":"6 hari"}]'::jsonb, '1/6 + 1/12 = 1/4 → 4 hari.', '{}'::jsonb),
  ('NUM-CRT-08', 'cognitive', 'numerik', 'sulit', 'Rata-rata nilai 5 karyawan adalah 76. Setelah 1 karyawan baru bergabung, rata-rata menjadi 78. Nilai karyawan baru adalah …', null, '[{"id":"a","text":"88","correct":true,"scores":{"numerik":1}},{"id":"b","text":"80"},{"id":"c","text":"86"},{"id":"d","text":"90"},{"id":"e","text":"84"}]'::jsonb, '6 × 78 − 5 × 76 = 468 − 380 = 88.', '{}'::jsonb),
  ('NUM-CRT-09', 'cognitive', 'numerik', 'sulit', 'Sebuah mobil menempuh 180 km dalam 2 jam 15 menit. Kecepatan rata-ratanya adalah …', null, '[{"id":"a","text":"80 km/jam","correct":true,"scores":{"numerik":1}},{"id":"b","text":"90 km/jam"},{"id":"c","text":"75 km/jam"},{"id":"d","text":"85 km/jam"},{"id":"e","text":"72 km/jam"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-CRT-10', 'cognitive', 'numerik', 'sulit', 'Perbandingan karyawan pria dan wanita 5 : 3. Jika karyawan wanita 45 orang, total karyawan adalah …', null, '[{"id":"a","text":"120","correct":true,"scores":{"numerik":1}},{"id":"b","text":"75"},{"id":"c","text":"105"},{"id":"d","text":"135"},{"id":"e","text":"96"}]'::jsonb, null, '{}'::jsonb),
  ('NUM-CRT-11', 'cognitive', 'numerik', 'sulit', 'Modal Rp50 juta dengan bunga sederhana 8% per tahun. Total uang setelah 3 tahun adalah …', null, '[{"id":"a","text":"Rp62 juta","correct":true,"scores":{"numerik":1}},{"id":"b","text":"Rp58 juta"},{"id":"c","text":"Rp62,9 juta"},{"id":"d","text":"Rp54 juta"},{"id":"e","text":"Rp66 juta"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-SIL-01', 'cognitive', 'logika', 'mudah', 'Semua karyawan wajib mengikuti pelatihan K3. Budi adalah karyawan. Kesimpulannya …', null, '[{"id":"a","text":"Budi wajib mengikuti pelatihan K3","correct":true,"scores":{"logika":1}},{"id":"b","text":"Budi tidak wajib mengikuti pelatihan K3"},{"id":"c","text":"Budi sudah mengikuti pelatihan K3"},{"id":"d","text":"Sebagian karyawan tidak mengikuti pelatihan K3"},{"id":"e","text":"Tidak dapat disimpulkan"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-SIL-02', 'cognitive', 'logika', 'mudah', 'Tidak ada ikan yang hidup di darat. Lele adalah ikan. Kesimpulannya …', null, '[{"id":"a","text":"Lele tidak hidup di darat","correct":true,"scores":{"logika":1}},{"id":"b","text":"Lele hidup di darat"},{"id":"c","text":"Sebagian lele hidup di darat"},{"id":"d","text":"Lele bukan ikan"},{"id":"e","text":"Tidak dapat disimpulkan"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-SIL-03', 'cognitive', 'logika', 'sedang', 'Jika hujan, maka jalan basah. Jalan tidak basah. Kesimpulannya …', null, '[{"id":"a","text":"Tidak hujan","correct":true,"scores":{"logika":1}},{"id":"b","text":"Hujan"},{"id":"c","text":"Jalan kering karena panas"},{"id":"d","text":"Mungkin hujan"},{"id":"e","text":"Tidak dapat disimpulkan"}]'::jsonb, 'Modus tollens.', '{}'::jsonb),
  ('LOG-SIL-04', 'cognitive', 'logika', 'sedang', 'Semua peserta yang lulus tes tertulis mengikuti wawancara. Sinta tidak mengikuti wawancara. Kesimpulannya …', null, '[{"id":"a","text":"Sinta tidak lulus tes tertulis","correct":true,"scores":{"logika":1}},{"id":"b","text":"Sinta lulus tes tertulis"},{"id":"c","text":"Sinta akan mengikuti wawancara"},{"id":"d","text":"Semua peserta mengikuti wawancara"},{"id":"e","text":"Tidak dapat disimpulkan"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-SIL-05', 'cognitive', 'logika', 'sedang', 'Semua A adalah B. Tidak ada B yang C. Kesimpulannya …', null, '[{"id":"a","text":"Tidak ada A yang C","correct":true,"scores":{"logika":1}},{"id":"b","text":"Semua C adalah A"},{"id":"c","text":"Sebagian A adalah C"},{"id":"d","text":"Semua B adalah A"},{"id":"e","text":"Sebagian C adalah B"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-SIL-06', 'cognitive', 'logika', 'sedang', 'Semua staf IT bisa coding. Sebagian staf IT bisa desain. Pernyataan yang PASTI benar …', null, '[{"id":"a","text":"Sebagian orang yang bisa coding juga bisa desain","correct":true,"scores":{"logika":1}},{"id":"b","text":"Semua yang bisa desain adalah staf IT"},{"id":"c","text":"Semua staf IT bisa desain"},{"id":"d","text":"Tidak ada staf IT yang bisa desain"},{"id":"e","text":"Semua yang bisa coding adalah staf IT"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-SIL-07', 'cognitive', 'logika', 'sulit', 'Semua manajer adalah pemimpin. Sebagian pemimpin adalah pembicara yang baik. Kesimpulan yang PASTI benar …', null, '[{"id":"a","text":"Belum dapat dipastikan ada manajer yang merupakan pembicara yang baik","correct":true,"scores":{"logika":1}},{"id":"b","text":"Semua manajer adalah pembicara yang baik"},{"id":"c","text":"Sebagian manajer adalah pembicara yang baik"},{"id":"d","text":"Tidak ada manajer yang pembicara yang baik"},{"id":"e","text":"Semua pembicara yang baik adalah manajer"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-SIL-08', 'cognitive', 'logika', 'sulit', 'Jika target tercapai, karyawan mendapat bonus. Andi mendapat bonus. Kesimpulannya …', null, '[{"id":"a","text":"Belum tentu target Andi tercapai","correct":true,"scores":{"logika":1}},{"id":"b","text":"Target Andi pasti tercapai"},{"id":"c","text":"Target Andi tidak tercapai"},{"id":"d","text":"Andi adalah karyawan terbaik"},{"id":"e","text":"Semua karyawan mendapat bonus"}]'::jsonb, 'Menegaskan konsekuen bukan penalaran yang sah.', '{}'::jsonb),
  ('LOG-NEG-01', 'cognitive', 'logika', 'sulit', 'Negasi dari pernyataan ''Semua karyawan datang tepat waktu'' adalah …', null, '[{"id":"a","text":"Ada karyawan yang tidak datang tepat waktu","correct":true,"scores":{"logika":1}},{"id":"b","text":"Semua karyawan tidak datang tepat waktu"},{"id":"c","text":"Tidak ada karyawan yang datang tepat waktu"},{"id":"d","text":"Sebagian karyawan datang tepat waktu"},{"id":"e","text":"Semua karyawan datang terlambat"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-NEG-02', 'cognitive', 'logika', 'sulit', 'Negasi dari ''Jika lembur, maka mendapat uang makan'' adalah …', null, '[{"id":"a","text":"Lembur dan tidak mendapat uang makan","correct":true,"scores":{"logika":1}},{"id":"b","text":"Tidak lembur dan mendapat uang makan"},{"id":"c","text":"Jika tidak lembur maka tidak mendapat uang makan"},{"id":"d","text":"Lembur atau mendapat uang makan"},{"id":"e","text":"Tidak lembur atau tidak mendapat uang makan"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-ANL-01', 'cognitive', 'logika', 'mudah', 'Pukul 03.00, berapa derajat sudut terkecil antara jarum jam dan jarum menit?', null, '[{"id":"a","text":"90°","correct":true,"scores":{"logika":1}},{"id":"b","text":"60°"},{"id":"c","text":"120°"},{"id":"d","text":"45°"},{"id":"e","text":"180°"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-ANL-02', 'cognitive', 'logika', 'sedang', 'Rina lebih tinggi dari Dewi. Dewi lebih tinggi dari Sari. Tari lebih pendek dari Sari. Siapa yang paling pendek?', null, '[{"id":"a","text":"Tari","correct":true,"scores":{"logika":1}},{"id":"b","text":"Sari"},{"id":"c","text":"Dewi"},{"id":"d","text":"Rina"},{"id":"e","text":"Tidak dapat ditentukan"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-ANL-03', 'cognitive', 'logika', 'sedang', 'Dalam antrean, Ali di depan Beni, Citra di belakang Beni, dan Dodi di depan Ali. Urutan dari depan adalah …', null, '[{"id":"a","text":"Dodi – Ali – Beni – Citra","correct":true,"scores":{"logika":1}},{"id":"b","text":"Ali – Dodi – Beni – Citra"},{"id":"c","text":"Dodi – Beni – Ali – Citra"},{"id":"d","text":"Ali – Beni – Citra – Dodi"},{"id":"e","text":"Citra – Beni – Ali – Dodi"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-ANL-04', 'cognitive', 'logika', 'sulit', 'Lima karyawan (P, Q, R, S, T) duduk berjajar. P di ujung kiri, R tepat di kanan P, T tidak di ujung, S tepat di kanan T, dan Q tidak bersebelahan dengan R. Siapa yang duduk di ujung kanan?', null, '[{"id":"a","text":"Q","correct":true,"scores":{"logika":1}},{"id":"b","text":"S"},{"id":"c","text":"T"},{"id":"d","text":"R"},{"id":"e","text":"Tidak dapat ditentukan"}]'::jsonb, 'Urutan: P – R – T – S – Q.', '{}'::jsonb),
  ('LOG-ANL-05', 'cognitive', 'logika', 'sulit', 'Jika hari ini Rabu, maka 100 hari lagi adalah hari …', null, '[{"id":"a","text":"Jumat","correct":true,"scores":{"logika":1}},{"id":"b","text":"Kamis"},{"id":"c","text":"Sabtu"},{"id":"d","text":"Rabu"},{"id":"e","text":"Senin"}]'::jsonb, '100 mod 7 = 2 → Rabu + 2 = Jumat.', '{}'::jsonb),
  ('LOG-ANL-06', 'cognitive', 'logika', 'sulit', 'Berapa derajat sudut terkecil antara jarum jam dan jarum menit pada pukul 04.30?', null, '[{"id":"a","text":"45°","correct":true,"scores":{"logika":1}},{"id":"b","text":"30°"},{"id":"c","text":"60°"},{"id":"d","text":"75°"},{"id":"e","text":"90°"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-ANL-07', 'cognitive', 'logika', 'sulit', 'Jika A > B, B > C, dan D > A, pernyataan yang PASTI benar adalah …', null, '[{"id":"a","text":"D > C","correct":true,"scores":{"logika":1}},{"id":"b","text":"C > A"},{"id":"c","text":"B > D"},{"id":"d","text":"A = D"},{"id":"e","text":"C > D"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-ANL-08', 'cognitive', 'logika', 'sulit', 'Jika 5 mesin membuat 5 barang dalam 5 menit, berapa menit yang diperlukan 100 mesin untuk membuat 100 barang?', null, '[{"id":"a","text":"5 menit","correct":true,"scores":{"logika":1}},{"id":"b","text":"100 menit"},{"id":"c","text":"20 menit"},{"id":"d","text":"1 menit"},{"id":"e","text":"25 menit"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-ANL-09', 'cognitive', 'logika', 'sulit', 'Tiga kotak berlabel ''Pena'', ''Pensil'', dan ''Campuran''. Semua label SALAH. Anda mengambil satu barang dari kotak berlabel ''Campuran'' dan mendapat pena. Isi kotak berlabel ''Pensil'' adalah …', null, '[{"id":"a","text":"Campuran","correct":true,"scores":{"logika":1}},{"id":"b","text":"Pensil"},{"id":"c","text":"Pena"},{"id":"d","text":"Kosong"},{"id":"e","text":"Tidak dapat ditentukan"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-HRF-01', 'cognitive', 'logika', 'mudah', 'Lanjutkan deret huruf: Z, X, V, T, …', null, '[{"id":"a","text":"R","correct":true,"scores":{"logika":1}},{"id":"b","text":"S"},{"id":"c","text":"Q"},{"id":"d","text":"P"},{"id":"e","text":"U"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-HRF-02', 'cognitive', 'logika', 'sedang', 'Lanjutkan deret huruf: A, C, F, J, O, …', null, '[{"id":"a","text":"U","correct":true,"scores":{"logika":1}},{"id":"b","text":"T"},{"id":"c","text":"V"},{"id":"d","text":"S"},{"id":"e","text":"W"}]'::jsonb, 'Loncatan +2, +3, +4, +5, +6.', '{}'::jsonb),
  ('LOG-HRF-03', 'cognitive', 'logika', 'sedang', 'Lanjutkan deret huruf: B, D, G, K, …', null, '[{"id":"a","text":"P","correct":true,"scores":{"logika":1}},{"id":"b","text":"O"},{"id":"c","text":"Q"},{"id":"d","text":"N"},{"id":"e","text":"R"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-HRF-04', 'cognitive', 'logika', 'sulit', 'Lanjutkan deret: 2A, 4C, 8E, 16G, …', null, '[{"id":"a","text":"32I","correct":true,"scores":{"logika":1}},{"id":"b","text":"32H"},{"id":"c","text":"24I"},{"id":"d","text":"30I"},{"id":"e","text":"32J"}]'::jsonb, null, '{}'::jsonb),
  ('LOG-KOD-01', 'cognitive', 'logika', 'sulit', 'Jika KANTOR ditulis LBOUPS, maka PEGAWAI ditulis …', null, '[{"id":"a","text":"QFHBXBJ","correct":true,"scores":{"logika":1}},{"id":"b","text":"QFHBWBJ"},{"id":"c","text":"OFHBXBJ"},{"id":"d","text":"QEHBXBJ"},{"id":"e","text":"QFHCXBJ"}]'::jsonb, 'Setiap huruf bergeser +1.', '{}'::jsonb),
  ('FIG-POL-01', 'cognitive', 'figural', 'mudah', 'Lanjutkan pola berikut:', '▲  ■  ●  ▲  ■  ●  ▲  ■  ?', '[{"id":"a","text":"●","correct":true,"scores":{"figural":1}},{"id":"b","text":"▲"},{"id":"c","text":"■"},{"id":"d","text":"◆"},{"id":"e","text":"★"}]'::jsonb, null, '{}'::jsonb),
  ('FIG-POL-02', 'cognitive', 'figural', 'mudah', 'Lanjutkan pola berikut:', '■  □  □  ■  □  □  ■  □  ?', '[{"id":"a","text":"□","correct":true,"scores":{"figural":1}},{"id":"b","text":"■"},{"id":"c","text":"▲"},{"id":"d","text":"●"},{"id":"e","text":"◆"}]'::jsonb, null, '{}'::jsonb),
  ('FIG-POL-03', 'cognitive', 'figural', 'mudah', 'Jika panah ↑ diputar 90° searah jarum jam sebanyak dua kali, hasilnya …', null, '[{"id":"a","text":"↓","correct":true,"scores":{"figural":1}},{"id":"b","text":"→"},{"id":"c","text":"←"},{"id":"d","text":"↑"},{"id":"e","text":"↘"}]'::jsonb, null, '{}'::jsonb),
  ('FIG-POL-04', 'cognitive', 'figural', 'sedang', 'Lanjutkan pola berikut:', '○ ●   ○ ● ●   ○ ● ● ●   ?', '[{"id":"a","text":"○","correct":true,"scores":{"figural":1}},{"id":"b","text":"●"},{"id":"c","text":"◐"},{"id":"d","text":"◇"},{"id":"e","text":"□"}]'::jsonb, null, '{}'::jsonb),
  ('FIG-POL-05', 'cognitive', 'figural', 'sedang', 'Lanjutkan pola berikut:', '↑  →  ↓  ←  ↑  →  ?', '[{"id":"a","text":"↓","correct":true,"scores":{"figural":1}},{"id":"b","text":"←"},{"id":"c","text":"↑"},{"id":"d","text":"→"},{"id":"e","text":"↗"}]'::jsonb, null, '{}'::jsonb),
  ('FIG-POL-06', 'cognitive', 'figural', 'sedang', 'Lanjutkan pola berikut (setiap langkah berputar 45° searah jarum jam):', '↑  ↗  →  ↘  ?', '[{"id":"a","text":"↓","correct":true,"scores":{"figural":1}},{"id":"b","text":"←"},{"id":"c","text":"↙"},{"id":"d","text":"↑"},{"id":"e","text":"↖"}]'::jsonb, null, '{}'::jsonb),
  ('FIG-POL-07', 'cognitive', 'figural', 'sedang', 'Lanjutkan pola berikut:', '▲     ▲▲     ▲▲▲     ?', '[{"id":"a","text":"▲▲▲▲","correct":true,"scores":{"figural":1}},{"id":"b","text":"▲▲▲"},{"id":"c","text":"▲▲▲▲▲"},{"id":"d","text":"△△△△"},{"id":"e","text":"▲▲"}]'::jsonb, null, '{}'::jsonb),
  ('FIG-POL-08', 'cognitive', 'figural', 'sedang', 'Manakah susunan yang BERBEDA polanya?', null, '[{"id":"a","text":"△ ▲ △"},{"id":"b","text":"□ ■ □"},{"id":"c","text":"○ ● ○"},{"id":"d","text":"◇ ◆ ◇"},{"id":"e","text":"☆ ★ ★","correct":true,"scores":{"figural":1}}]'::jsonb, null, '{}'::jsonb),
  ('FIG-POL-09', 'cognitive', 'figural', 'sedang', 'Lengkapi pola berikut:', '★ ☆ ☆  |  ★ ★ ☆ ☆ ☆  |  ★ ★ ★ ?', '[{"id":"a","text":"☆","correct":true,"scores":{"figural":1}},{"id":"b","text":"★"},{"id":"c","text":"◆"},{"id":"d","text":"●"},{"id":"e","text":"▲"}]'::jsonb, null, '{}'::jsonb),
  ('FIG-MTX-01', 'cognitive', 'figural', 'sedang', 'Tentukan angka yang hilang pada matriks:', '3   5   8
4   6   10
5   7   ?', '[{"id":"a","text":"12","correct":true,"scores":{"figural":1}},{"id":"b","text":"11"},{"id":"c","text":"13"},{"id":"d","text":"14"},{"id":"e","text":"10"}]'::jsonb, 'Kolom ke-3 = kolom 1 + kolom 2.', '{}'::jsonb),
  ('FIG-MTX-02', 'cognitive', 'figural', 'sulit', 'Tentukan angka yang hilang pada matriks:', '2   4    8
3   9    27
4   16   ?', '[{"id":"a","text":"64","correct":true,"scores":{"figural":1}},{"id":"b","text":"48"},{"id":"c","text":"32"},{"id":"d","text":"60"},{"id":"e","text":"56"}]'::jsonb, 'Baris: n, n², n³.', '{}'::jsonb),
  ('FIG-MTX-03', 'cognitive', 'figural', 'sulit', 'Tentukan angka yang hilang pada matriks:', '7   3   21
6   4   24
9   ?   45', '[{"id":"a","text":"5","correct":true,"scores":{"figural":1}},{"id":"b","text":"4"},{"id":"c","text":"6"},{"id":"d","text":"36"},{"id":"e","text":"7"}]'::jsonb, 'Kolom 1 × kolom 2 = kolom 3.', '{}'::jsonb),
  ('FIG-MTX-04', 'cognitive', 'figural', 'sedang', 'Lengkapi matriks berikut:', '●     ●●     ●●●
■     ■■     ■■■
▲     ▲▲     ?', '[{"id":"a","text":"▲▲▲","correct":true,"scores":{"figural":1}},{"id":"b","text":"▲▲"},{"id":"c","text":"■■■"},{"id":"d","text":"●●●"},{"id":"e","text":"▲▲▲▲"}]'::jsonb, null, '{}'::jsonb),
  ('FIG-POL-10', 'cognitive', 'figural', 'sulit', 'Pola simbol berulang: ▲ ■ ● ▲ ■ ● … Simbol ke-20 adalah …', null, '[{"id":"a","text":"■","correct":true,"scores":{"figural":1}},{"id":"b","text":"▲"},{"id":"c","text":"●"},{"id":"d","text":"◆"},{"id":"e","text":"★"}]'::jsonb, '20 mod 3 = 2 → simbol ke-2.', '{}'::jsonb),
  ('FIG-ROT-01', 'cognitive', 'figural', 'sulit', 'Jika panah ↗ diputar 135° berlawanan arah jarum jam, hasilnya …', null, '[{"id":"a","text":"←","correct":true,"scores":{"figural":1}},{"id":"b","text":"↑"},{"id":"c","text":"↖"},{"id":"d","text":"↙"},{"id":"e","text":"↓"}]'::jsonb, null, '{}'::jsonb),
  ('FIG-SPA-01', 'cognitive', 'figural', 'sedang', 'Sebuah segitiga dibagi oleh satu garis lurus dari puncak ke alasnya. Berapa total segitiga yang terbentuk (termasuk segitiga besar)?', null, '[{"id":"a","text":"3","correct":true,"scores":{"figural":1}},{"id":"b","text":"2"},{"id":"c","text":"4"},{"id":"d","text":"5"},{"id":"e","text":"6"}]'::jsonb, null, '{}'::jsonb),
  ('FIG-SPA-02', 'cognitive', 'figural', 'sulit', 'Sebuah kubus dicat seluruh permukaannya lalu dipotong menjadi 27 kubus kecil sama besar. Berapa kubus kecil yang memiliki tepat 2 sisi bercat?', null, '[{"id":"a","text":"12","correct":true,"scores":{"figural":1}},{"id":"b","text":"8"},{"id":"c","text":"6"},{"id":"d","text":"4"},{"id":"e","text":"1"}]'::jsonb, null, '{}'::jsonb),
  ('FIG-SPA-03', 'cognitive', 'figural', 'sulit', 'Sebuah kubus dicat seluruh permukaannya lalu dipotong menjadi 27 kubus kecil sama besar. Berapa kubus kecil yang TIDAK bercat sama sekali?', null, '[{"id":"a","text":"1","correct":true,"scores":{"figural":1}},{"id":"b","text":"0"},{"id":"c","text":"6"},{"id":"d","text":"8"},{"id":"e","text":"12"}]'::jsonb, null, '{}'::jsonb),
  ('STR-01', 'likert', 'tingkat_stres', 'sedang', 'Saya sering merasa tegang ketika pekerjaan menumpuk.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tingkat_stres":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tingkat_stres":2}},{"id":"3","text":"Netral","scores":{"tingkat_stres":3}},{"id":"4","text":"Sesuai","scores":{"tingkat_stres":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tingkat_stres":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('STR-02', 'likert', 'tingkat_stres', 'sedang', 'Saya mudah merasa cemas memikirkan pekerjaan yang belum selesai.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tingkat_stres":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tingkat_stres":2}},{"id":"3","text":"Netral","scores":{"tingkat_stres":3}},{"id":"4","text":"Sesuai","scores":{"tingkat_stres":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tingkat_stres":5}}]'::jsonb, null, '{"reverse":false,"pair":"str1"}'::jsonb),
  ('STR-03', 'likert', 'tingkat_stres', 'sedang', 'Saya jarang merasa cemas tentang pekerjaan yang belum selesai.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tingkat_stres":5}},{"id":"2","text":"Tidak Sesuai","scores":{"tingkat_stres":4}},{"id":"3","text":"Netral","scores":{"tingkat_stres":3}},{"id":"4","text":"Sesuai","scores":{"tingkat_stres":2}},{"id":"5","text":"Sangat Sesuai","scores":{"tingkat_stres":1}}]'::jsonb, null, '{"reverse":true,"pair":"str1"}'::jsonb),
  ('STR-04', 'likert', 'tingkat_stres', 'sedang', 'Saya sulit tidur karena memikirkan masalah pekerjaan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tingkat_stres":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tingkat_stres":2}},{"id":"3","text":"Netral","scores":{"tingkat_stres":3}},{"id":"4","text":"Sesuai","scores":{"tingkat_stres":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tingkat_stres":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('STR-05', 'likert', 'tingkat_stres', 'sedang', 'Saya merasa kewalahan dengan tanggung jawab sehari-hari.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tingkat_stres":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tingkat_stres":2}},{"id":"3","text":"Netral","scores":{"tingkat_stres":3}},{"id":"4","text":"Sesuai","scores":{"tingkat_stres":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tingkat_stres":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('STR-06', 'likert', 'tingkat_stres', 'sedang', 'Saya mudah tersinggung ketika sedang lelah bekerja.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tingkat_stres":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tingkat_stres":2}},{"id":"3","text":"Netral","scores":{"tingkat_stres":3}},{"id":"4","text":"Sesuai","scores":{"tingkat_stres":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tingkat_stres":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('STR-07', 'likert', 'tingkat_stres', 'sedang', 'Akhir-akhir ini saya merasa mampu mengendalikan hal-hal penting dalam hidup saya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tingkat_stres":5}},{"id":"2","text":"Tidak Sesuai","scores":{"tingkat_stres":4}},{"id":"3","text":"Netral","scores":{"tingkat_stres":3}},{"id":"4","text":"Sesuai","scores":{"tingkat_stres":2}},{"id":"5","text":"Sangat Sesuai","scores":{"tingkat_stres":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('STR-08', 'likert', 'tingkat_stres', 'sedang', 'Saya sering merasa lelah secara mental bahkan sebelum hari kerja dimulai.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tingkat_stres":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tingkat_stres":2}},{"id":"3","text":"Netral","scores":{"tingkat_stres":3}},{"id":"4","text":"Sesuai","scores":{"tingkat_stres":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tingkat_stres":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('STR-09', 'likert', 'tingkat_stres', 'sedang', 'Saya dapat bersantai dengan mudah setelah jam kerja selesai.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tingkat_stres":5}},{"id":"2","text":"Tidak Sesuai","scores":{"tingkat_stres":4}},{"id":"3","text":"Netral","scores":{"tingkat_stres":3}},{"id":"4","text":"Sesuai","scores":{"tingkat_stres":2}},{"id":"5","text":"Sangat Sesuai","scores":{"tingkat_stres":1}}]'::jsonb, null, '{"reverse":true,"pair":"str2"}'::jsonb),
  ('STR-10', 'likert', 'tingkat_stres', 'sedang', 'Setelah jam kerja, pikiran saya masih terus terbebani urusan kantor.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tingkat_stres":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tingkat_stres":2}},{"id":"3","text":"Netral","scores":{"tingkat_stres":3}},{"id":"4","text":"Sesuai","scores":{"tingkat_stres":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tingkat_stres":5}}]'::jsonb, null, '{"reverse":false,"pair":"str2"}'::jsonb),
  ('STR-11', 'likert', 'tingkat_stres', 'sedang', 'Hal-hal kecil pun dapat membuat saya gelisah.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tingkat_stres":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tingkat_stres":2}},{"id":"3","text":"Netral","scores":{"tingkat_stres":3}},{"id":"4","text":"Sesuai","scores":{"tingkat_stres":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tingkat_stres":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TKN-01', 'likert', 'toleransi_tekanan', 'sedang', 'Saya tetap dapat berpikir jernih saat dikejar tenggat waktu.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"toleransi_tekanan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"toleransi_tekanan":2}},{"id":"3","text":"Netral","scores":{"toleransi_tekanan":3}},{"id":"4","text":"Sesuai","scores":{"toleransi_tekanan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"toleransi_tekanan":5}}]'::jsonb, null, '{"reverse":false,"pair":"tkn1"}'::jsonb),
  ('TKN-02', 'likert', 'toleransi_tekanan', 'sedang', 'Tenggat waktu yang ketat membuat saya sulit berkonsentrasi.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"toleransi_tekanan":5}},{"id":"2","text":"Tidak Sesuai","scores":{"toleransi_tekanan":4}},{"id":"3","text":"Netral","scores":{"toleransi_tekanan":3}},{"id":"4","text":"Sesuai","scores":{"toleransi_tekanan":2}},{"id":"5","text":"Sangat Sesuai","scores":{"toleransi_tekanan":1}}]'::jsonb, null, '{"reverse":true,"pair":"tkn1"}'::jsonb),
  ('TKN-03', 'likert', 'toleransi_tekanan', 'sedang', 'Saya mampu menyelesaikan beberapa tugas mendesak sekaligus dengan baik.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"toleransi_tekanan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"toleransi_tekanan":2}},{"id":"3","text":"Netral","scores":{"toleransi_tekanan":3}},{"id":"4","text":"Sesuai","scores":{"toleransi_tekanan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"toleransi_tekanan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TKN-04', 'likert', 'toleransi_tekanan', 'sedang', 'Kritik keras dari atasan membuat saya kehilangan semangat berhari-hari.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"toleransi_tekanan":5}},{"id":"2","text":"Tidak Sesuai","scores":{"toleransi_tekanan":4}},{"id":"3","text":"Netral","scores":{"toleransi_tekanan":3}},{"id":"4","text":"Sesuai","scores":{"toleransi_tekanan":2}},{"id":"5","text":"Sangat Sesuai","scores":{"toleransi_tekanan":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('TKN-05', 'likert', 'toleransi_tekanan', 'sedang', 'Saya melihat target yang tinggi sebagai tantangan, bukan beban.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"toleransi_tekanan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"toleransi_tekanan":2}},{"id":"3","text":"Netral","scores":{"toleransi_tekanan":3}},{"id":"4","text":"Sesuai","scores":{"toleransi_tekanan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"toleransi_tekanan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TKN-06', 'likert', 'toleransi_tekanan', 'sedang', 'Ketika rencana gagal, saya segera mencari cara lain.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"toleransi_tekanan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"toleransi_tekanan":2}},{"id":"3","text":"Netral","scores":{"toleransi_tekanan":3}},{"id":"4","text":"Sesuai","scores":{"toleransi_tekanan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"toleransi_tekanan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TKN-07', 'likert', 'toleransi_tekanan', 'sedang', 'Saya cenderung panik jika terjadi masalah mendadak di tempat kerja.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"toleransi_tekanan":5}},{"id":"2","text":"Tidak Sesuai","scores":{"toleransi_tekanan":4}},{"id":"3","text":"Netral","scores":{"toleransi_tekanan":3}},{"id":"4","text":"Sesuai","scores":{"toleransi_tekanan":2}},{"id":"5","text":"Sangat Sesuai","scores":{"toleransi_tekanan":1}}]'::jsonb, null, '{"reverse":true,"pair":"tkn2"}'::jsonb),
  ('TKN-08', 'likert', 'toleransi_tekanan', 'sedang', 'Saya tetap tenang saat menghadapi masalah mendadak di pekerjaan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"toleransi_tekanan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"toleransi_tekanan":2}},{"id":"3","text":"Netral","scores":{"toleransi_tekanan":3}},{"id":"4","text":"Sesuai","scores":{"toleransi_tekanan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"toleransi_tekanan":5}}]'::jsonb, null, '{"reverse":false,"pair":"tkn2"}'::jsonb),
  ('TKN-09', 'likert', 'toleransi_tekanan', 'sedang', 'Saya tetap bekerja dengan baik di lingkungan yang ramai dan sibuk.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"toleransi_tekanan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"toleransi_tekanan":2}},{"id":"3","text":"Netral","scores":{"toleransi_tekanan":3}},{"id":"4","text":"Sesuai","scores":{"toleransi_tekanan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"toleransi_tekanan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TKN-10', 'likert', 'toleransi_tekanan', 'sedang', 'Saya mudah menyerah ketika pekerjaan terasa terlalu berat.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"toleransi_tekanan":5}},{"id":"2","text":"Tidak Sesuai","scores":{"toleransi_tekanan":4}},{"id":"3","text":"Netral","scores":{"toleransi_tekanan":3}},{"id":"4","text":"Sesuai","scores":{"toleransi_tekanan":2}},{"id":"5","text":"Sangat Sesuai","scores":{"toleransi_tekanan":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('EMO-01', 'likert', 'stabilitas_emosi', 'sedang', 'Suasana hati saya relatif stabil sepanjang hari.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"stabilitas_emosi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"stabilitas_emosi":2}},{"id":"3","text":"Netral","scores":{"stabilitas_emosi":3}},{"id":"4","text":"Sesuai","scores":{"stabilitas_emosi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"stabilitas_emosi":5}}]'::jsonb, null, '{"reverse":false,"pair":"emo1"}'::jsonb),
  ('EMO-02', 'likert', 'stabilitas_emosi', 'sedang', 'Suasana hati saya mudah berubah-ubah tanpa alasan yang jelas.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"stabilitas_emosi":5}},{"id":"2","text":"Tidak Sesuai","scores":{"stabilitas_emosi":4}},{"id":"3","text":"Netral","scores":{"stabilitas_emosi":3}},{"id":"4","text":"Sesuai","scores":{"stabilitas_emosi":2}},{"id":"5","text":"Sangat Sesuai","scores":{"stabilitas_emosi":1}}]'::jsonb, null, '{"reverse":true,"pair":"emo1"}'::jsonb),
  ('EMO-03', 'likert', 'stabilitas_emosi', 'sedang', 'Saya dapat mengendalikan amarah ketika berbeda pendapat dengan rekan kerja.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"stabilitas_emosi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"stabilitas_emosi":2}},{"id":"3","text":"Netral","scores":{"stabilitas_emosi":3}},{"id":"4","text":"Sesuai","scores":{"stabilitas_emosi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"stabilitas_emosi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('EMO-04', 'likert', 'stabilitas_emosi', 'sedang', 'Saya mudah meluapkan emosi di depan orang lain saat kesal.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"stabilitas_emosi":5}},{"id":"2","text":"Tidak Sesuai","scores":{"stabilitas_emosi":4}},{"id":"3","text":"Netral","scores":{"stabilitas_emosi":3}},{"id":"4","text":"Sesuai","scores":{"stabilitas_emosi":2}},{"id":"5","text":"Sangat Sesuai","scores":{"stabilitas_emosi":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('EMO-05', 'likert', 'stabilitas_emosi', 'sedang', 'Saya dapat menerima kegagalan dengan lapang dada.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"stabilitas_emosi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"stabilitas_emosi":2}},{"id":"3","text":"Netral","scores":{"stabilitas_emosi":3}},{"id":"4","text":"Sesuai","scores":{"stabilitas_emosi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"stabilitas_emosi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('EMO-06', 'likert', 'stabilitas_emosi', 'sedang', 'Saya sering merasa rendah diri dibandingkan rekan kerja.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"stabilitas_emosi":5}},{"id":"2","text":"Tidak Sesuai","scores":{"stabilitas_emosi":4}},{"id":"3","text":"Netral","scores":{"stabilitas_emosi":3}},{"id":"4","text":"Sesuai","scores":{"stabilitas_emosi":2}},{"id":"5","text":"Sangat Sesuai","scores":{"stabilitas_emosi":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('EMO-07', 'likert', 'stabilitas_emosi', 'sedang', 'Saya tidak mudah terbawa perasaan saat menerima masukan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"stabilitas_emosi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"stabilitas_emosi":2}},{"id":"3","text":"Netral","scores":{"stabilitas_emosi":3}},{"id":"4","text":"Sesuai","scores":{"stabilitas_emosi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"stabilitas_emosi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('EMO-08', 'likert', 'stabilitas_emosi', 'sedang', 'Masalah pribadi sering memengaruhi kinerja saya di kantor.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"stabilitas_emosi":5}},{"id":"2","text":"Tidak Sesuai","scores":{"stabilitas_emosi":4}},{"id":"3","text":"Netral","scores":{"stabilitas_emosi":3}},{"id":"4","text":"Sesuai","scores":{"stabilitas_emosi":2}},{"id":"5","text":"Sangat Sesuai","scores":{"stabilitas_emosi":1}}]'::jsonb, null, '{"reverse":true,"pair":"emo2"}'::jsonb),
  ('EMO-09', 'likert', 'stabilitas_emosi', 'sedang', 'Saya mampu memisahkan masalah pribadi dari urusan pekerjaan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"stabilitas_emosi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"stabilitas_emosi":2}},{"id":"3","text":"Netral","scores":{"stabilitas_emosi":3}},{"id":"4","text":"Sesuai","scores":{"stabilitas_emosi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"stabilitas_emosi":5}}]'::jsonb, null, '{"reverse":false,"pair":"emo2"}'::jsonb),
  ('EMO-10', 'likert', 'stabilitas_emosi', 'sedang', 'Saya merasa nyaman dan menerima diri saya apa adanya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"stabilitas_emosi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"stabilitas_emosi":2}},{"id":"3","text":"Netral","scores":{"stabilitas_emosi":3}},{"id":"4","text":"Sesuai","scores":{"stabilitas_emosi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"stabilitas_emosi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TIM-01', 'likert', 'kerja_tim', 'sedang', 'Saya senang berbagi informasi yang dapat membantu pekerjaan rekan tim.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kerja_tim":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kerja_tim":2}},{"id":"3","text":"Netral","scores":{"kerja_tim":3}},{"id":"4","text":"Sesuai","scores":{"kerja_tim":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kerja_tim":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TIM-02', 'likert', 'kerja_tim', 'sedang', 'Saya lebih suka mengerjakan semuanya sendiri daripada bekerja sama.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kerja_tim":5}},{"id":"2","text":"Tidak Sesuai","scores":{"kerja_tim":4}},{"id":"3","text":"Netral","scores":{"kerja_tim":3}},{"id":"4","text":"Sesuai","scores":{"kerja_tim":2}},{"id":"5","text":"Sangat Sesuai","scores":{"kerja_tim":1}}]'::jsonb, null, '{"reverse":true,"pair":"tim1"}'::jsonb),
  ('TIM-03', 'likert', 'kerja_tim', 'sedang', 'Saya menikmati bekerja sama dengan orang lain untuk mencapai tujuan bersama.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kerja_tim":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kerja_tim":2}},{"id":"3","text":"Netral","scores":{"kerja_tim":3}},{"id":"4","text":"Sesuai","scores":{"kerja_tim":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kerja_tim":5}}]'::jsonb, null, '{"reverse":false,"pair":"tim1"}'::jsonb),
  ('TIM-04', 'likert', 'kerja_tim', 'sedang', 'Saya bersedia membantu rekan yang kesulitan meskipun bukan tugas saya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kerja_tim":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kerja_tim":2}},{"id":"3","text":"Netral","scores":{"kerja_tim":3}},{"id":"4","text":"Sesuai","scores":{"kerja_tim":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kerja_tim":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TIM-05', 'likert', 'kerja_tim', 'sedang', 'Saya menghargai pendapat anggota tim walaupun berbeda dengan pendapat saya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kerja_tim":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kerja_tim":2}},{"id":"3","text":"Netral","scores":{"kerja_tim":3}},{"id":"4","text":"Sesuai","scores":{"kerja_tim":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kerja_tim":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TIM-06', 'likert', 'kerja_tim', 'sedang', 'Keberhasilan tim lebih penting daripada pengakuan pribadi bagi saya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kerja_tim":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kerja_tim":2}},{"id":"3","text":"Netral","scores":{"kerja_tim":3}},{"id":"4","text":"Sesuai","scores":{"kerja_tim":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kerja_tim":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TIM-07', 'likert', 'kerja_tim', 'sedang', 'Saya merasa terganggu jika harus menyesuaikan diri dengan cara kerja orang lain.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kerja_tim":5}},{"id":"2","text":"Tidak Sesuai","scores":{"kerja_tim":4}},{"id":"3","text":"Netral","scores":{"kerja_tim":3}},{"id":"4","text":"Sesuai","scores":{"kerja_tim":2}},{"id":"5","text":"Sangat Sesuai","scores":{"kerja_tim":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('TIM-08', 'likert', 'kerja_tim', 'sedang', 'Saya jarang menawarkan bantuan kepada rekan kerja.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kerja_tim":5}},{"id":"2","text":"Tidak Sesuai","scores":{"kerja_tim":4}},{"id":"3","text":"Netral","scores":{"kerja_tim":3}},{"id":"4","text":"Sesuai","scores":{"kerja_tim":2}},{"id":"5","text":"Sangat Sesuai","scores":{"kerja_tim":1}}]'::jsonb, null, '{"reverse":true,"pair":"tim2"}'::jsonb),
  ('TIM-09', 'likert', 'kerja_tim', 'sedang', 'Saya sering menawarkan bantuan kepada rekan kerja tanpa diminta.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kerja_tim":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kerja_tim":2}},{"id":"3","text":"Netral","scores":{"kerja_tim":3}},{"id":"4","text":"Sesuai","scores":{"kerja_tim":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kerja_tim":5}}]'::jsonb, null, '{"reverse":false,"pair":"tim2"}'::jsonb),
  ('TIM-10', 'likert', 'kerja_tim', 'sedang', 'Saya berusaha menjaga suasana tim tetap kondusif ketika terjadi perbedaan pendapat.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kerja_tim":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kerja_tim":2}},{"id":"3","text":"Netral","scores":{"kerja_tim":3}},{"id":"4","text":"Sesuai","scores":{"kerja_tim":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kerja_tim":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('INT-01', 'likert', 'integritas', 'sedang', 'Saya melaporkan kesalahan yang saya buat, meskipun tidak ada yang mengetahuinya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"integritas":1}},{"id":"2","text":"Tidak Sesuai","scores":{"integritas":2}},{"id":"3","text":"Netral","scores":{"integritas":3}},{"id":"4","text":"Sesuai","scores":{"integritas":4}},{"id":"5","text":"Sangat Sesuai","scores":{"integritas":5}}]'::jsonb, null, '{"reverse":false,"pair":"int1"}'::jsonb),
  ('INT-02', 'likert', 'integritas', 'sedang', 'Jika tidak ada yang tahu, saya tidak perlu mengakui kesalahan saya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"integritas":5}},{"id":"2","text":"Tidak Sesuai","scores":{"integritas":4}},{"id":"3","text":"Netral","scores":{"integritas":3}},{"id":"4","text":"Sesuai","scores":{"integritas":2}},{"id":"5","text":"Sangat Sesuai","scores":{"integritas":1}}]'::jsonb, null, '{"reverse":true,"pair":"int1"}'::jsonb),
  ('INT-03', 'likert', 'integritas', 'sedang', 'Menggunakan fasilitas kantor untuk keperluan pribadi adalah hal yang wajar.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"integritas":5}},{"id":"2","text":"Tidak Sesuai","scores":{"integritas":4}},{"id":"3","text":"Netral","scores":{"integritas":3}},{"id":"4","text":"Sesuai","scores":{"integritas":2}},{"id":"5","text":"Sangat Sesuai","scores":{"integritas":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('INT-04', 'likert', 'integritas', 'sedang', 'Saya menolak hadiah yang dapat memengaruhi keputusan pekerjaan saya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"integritas":1}},{"id":"2","text":"Tidak Sesuai","scores":{"integritas":2}},{"id":"3","text":"Netral","scores":{"integritas":3}},{"id":"4","text":"Sesuai","scores":{"integritas":4}},{"id":"5","text":"Sangat Sesuai","scores":{"integritas":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('INT-05', 'likert', 'integritas', 'sedang', 'Sedikit melebihkan laporan lembur adalah hal yang biasa.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"integritas":5}},{"id":"2","text":"Tidak Sesuai","scores":{"integritas":4}},{"id":"3","text":"Netral","scores":{"integritas":3}},{"id":"4","text":"Sesuai","scores":{"integritas":2}},{"id":"5","text":"Sangat Sesuai","scores":{"integritas":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('INT-06', 'likert', 'integritas', 'sedang', 'Saya menepati janji walaupun itu merugikan saya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"integritas":1}},{"id":"2","text":"Tidak Sesuai","scores":{"integritas":2}},{"id":"3","text":"Netral","scores":{"integritas":3}},{"id":"4","text":"Sesuai","scores":{"integritas":4}},{"id":"5","text":"Sangat Sesuai","scores":{"integritas":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('INT-07', 'likert', 'integritas', 'sedang', 'Saya akan menegur rekan yang melakukan kecurangan, meskipun ia teman dekat.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"integritas":1}},{"id":"2","text":"Tidak Sesuai","scores":{"integritas":2}},{"id":"3","text":"Netral","scores":{"integritas":3}},{"id":"4","text":"Sesuai","scores":{"integritas":4}},{"id":"5","text":"Sangat Sesuai","scores":{"integritas":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('INT-08', 'likert', 'integritas', 'sedang', 'Aturan boleh dilanggar selama hasil kerjanya baik.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"integritas":5}},{"id":"2","text":"Tidak Sesuai","scores":{"integritas":4}},{"id":"3","text":"Netral","scores":{"integritas":3}},{"id":"4","text":"Sesuai","scores":{"integritas":2}},{"id":"5","text":"Sangat Sesuai","scores":{"integritas":1}}]'::jsonb, null, '{"reverse":true,"pair":"int2"}'::jsonb),
  ('INT-09', 'likert', 'integritas', 'sedang', 'Saya tetap mengikuti prosedur meskipun ada jalan pintas yang lebih cepat.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"integritas":1}},{"id":"2","text":"Tidak Sesuai","scores":{"integritas":2}},{"id":"3","text":"Netral","scores":{"integritas":3}},{"id":"4","text":"Sesuai","scores":{"integritas":4}},{"id":"5","text":"Sangat Sesuai","scores":{"integritas":5}}]'::jsonb, null, '{"reverse":false,"pair":"int2"}'::jsonb),
  ('INT-10', 'likert', 'integritas', 'sedang', 'Saya menjaga kerahasiaan data perusahaan dengan sungguh-sungguh.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"integritas":1}},{"id":"2","text":"Tidak Sesuai","scores":{"integritas":2}},{"id":"3","text":"Netral","scores":{"integritas":3}},{"id":"4","text":"Sesuai","scores":{"integritas":4}},{"id":"5","text":"Sangat Sesuai","scores":{"integritas":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TGJ-01', 'likert', 'tanggung_jawab', 'sedang', 'Saya selalu menyelesaikan pekerjaan sesuai tenggat waktu.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tanggung_jawab":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tanggung_jawab":2}},{"id":"3","text":"Netral","scores":{"tanggung_jawab":3}},{"id":"4","text":"Sesuai","scores":{"tanggung_jawab":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tanggung_jawab":5}}]'::jsonb, null, '{"reverse":false,"pair":"tgj1"}'::jsonb),
  ('TGJ-02', 'likert', 'tanggung_jawab', 'sedang', 'Saya sering menunda pekerjaan hingga mendekati batas waktu.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tanggung_jawab":5}},{"id":"2","text":"Tidak Sesuai","scores":{"tanggung_jawab":4}},{"id":"3","text":"Netral","scores":{"tanggung_jawab":3}},{"id":"4","text":"Sesuai","scores":{"tanggung_jawab":2}},{"id":"5","text":"Sangat Sesuai","scores":{"tanggung_jawab":1}}]'::jsonb, null, '{"reverse":true,"pair":"tgj1"}'::jsonb),
  ('TGJ-03', 'likert', 'tanggung_jawab', 'sedang', 'Saya datang tepat waktu ke kantor maupun rapat.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tanggung_jawab":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tanggung_jawab":2}},{"id":"3","text":"Netral","scores":{"tanggung_jawab":3}},{"id":"4","text":"Sesuai","scores":{"tanggung_jawab":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tanggung_jawab":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TGJ-04', 'likert', 'tanggung_jawab', 'sedang', 'Saya memeriksa kembali hasil pekerjaan sebelum menyerahkannya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tanggung_jawab":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tanggung_jawab":2}},{"id":"3","text":"Netral","scores":{"tanggung_jawab":3}},{"id":"4","text":"Sesuai","scores":{"tanggung_jawab":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tanggung_jawab":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TGJ-05', 'likert', 'tanggung_jawab', 'sedang', 'Saya membuat rencana kerja sebelum memulai tugas.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tanggung_jawab":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tanggung_jawab":2}},{"id":"3","text":"Netral","scores":{"tanggung_jawab":3}},{"id":"4","text":"Sesuai","scores":{"tanggung_jawab":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tanggung_jawab":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TGJ-06', 'likert', 'tanggung_jawab', 'sedang', 'Saya mudah lupa terhadap tugas yang diberikan kepada saya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tanggung_jawab":5}},{"id":"2","text":"Tidak Sesuai","scores":{"tanggung_jawab":4}},{"id":"3","text":"Netral","scores":{"tanggung_jawab":3}},{"id":"4","text":"Sesuai","scores":{"tanggung_jawab":2}},{"id":"5","text":"Sangat Sesuai","scores":{"tanggung_jawab":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('TGJ-07', 'likert', 'tanggung_jawab', 'sedang', 'Saya bertanggung jawab penuh atas hasil kerja saya, baik atau buruk.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tanggung_jawab":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tanggung_jawab":2}},{"id":"3","text":"Netral","scores":{"tanggung_jawab":3}},{"id":"4","text":"Sesuai","scores":{"tanggung_jawab":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tanggung_jawab":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('TGJ-08', 'likert', 'tanggung_jawab', 'sedang', 'Jika pekerjaan gagal, saya cenderung mencari pihak lain untuk disalahkan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tanggung_jawab":5}},{"id":"2","text":"Tidak Sesuai","scores":{"tanggung_jawab":4}},{"id":"3","text":"Netral","scores":{"tanggung_jawab":3}},{"id":"4","text":"Sesuai","scores":{"tanggung_jawab":2}},{"id":"5","text":"Sangat Sesuai","scores":{"tanggung_jawab":1}}]'::jsonb, null, '{"reverse":true,"pair":"tgj2"}'::jsonb),
  ('TGJ-09', 'likert', 'tanggung_jawab', 'sedang', 'Saya mengakui bagian saya ketika pekerjaan tim tidak berhasil.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tanggung_jawab":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tanggung_jawab":2}},{"id":"3","text":"Netral","scores":{"tanggung_jawab":3}},{"id":"4","text":"Sesuai","scores":{"tanggung_jawab":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tanggung_jawab":5}}]'::jsonb, null, '{"reverse":false,"pair":"tgj2"}'::jsonb),
  ('TGJ-10', 'likert', 'tanggung_jawab', 'sedang', 'Saya menjaga meja dan berkas kerja saya tetap teratur.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"tanggung_jawab":1}},{"id":"2","text":"Tidak Sesuai","scores":{"tanggung_jawab":2}},{"id":"3","text":"Netral","scores":{"tanggung_jawab":3}},{"id":"4","text":"Sesuai","scores":{"tanggung_jawab":4}},{"id":"5","text":"Sangat Sesuai","scores":{"tanggung_jawab":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('ADP-01', 'likert', 'adaptabilitas', 'sedang', 'Saya cepat menyesuaikan diri dengan lingkungan kerja yang baru.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"adaptabilitas":1}},{"id":"2","text":"Tidak Sesuai","scores":{"adaptabilitas":2}},{"id":"3","text":"Netral","scores":{"adaptabilitas":3}},{"id":"4","text":"Sesuai","scores":{"adaptabilitas":4}},{"id":"5","text":"Sangat Sesuai","scores":{"adaptabilitas":5}}]'::jsonb, null, '{"reverse":false,"pair":"adp1"}'::jsonb),
  ('ADP-02', 'likert', 'adaptabilitas', 'sedang', 'Saya butuh waktu sangat lama untuk terbiasa dengan lingkungan baru.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"adaptabilitas":5}},{"id":"2","text":"Tidak Sesuai","scores":{"adaptabilitas":4}},{"id":"3","text":"Netral","scores":{"adaptabilitas":3}},{"id":"4","text":"Sesuai","scores":{"adaptabilitas":2}},{"id":"5","text":"Sangat Sesuai","scores":{"adaptabilitas":1}}]'::jsonb, null, '{"reverse":true,"pair":"adp1"}'::jsonb),
  ('ADP-03', 'likert', 'adaptabilitas', 'sedang', 'Saya terbuka mempelajari sistem atau teknologi baru.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"adaptabilitas":1}},{"id":"2","text":"Tidak Sesuai","scores":{"adaptabilitas":2}},{"id":"3","text":"Netral","scores":{"adaptabilitas":3}},{"id":"4","text":"Sesuai","scores":{"adaptabilitas":4}},{"id":"5","text":"Sangat Sesuai","scores":{"adaptabilitas":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('ADP-04', 'likert', 'adaptabilitas', 'sedang', 'Perubahan prosedur kerja yang mendadak membuat saya kesal.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"adaptabilitas":5}},{"id":"2","text":"Tidak Sesuai","scores":{"adaptabilitas":4}},{"id":"3","text":"Netral","scores":{"adaptabilitas":3}},{"id":"4","text":"Sesuai","scores":{"adaptabilitas":2}},{"id":"5","text":"Sangat Sesuai","scores":{"adaptabilitas":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('ADP-05', 'likert', 'adaptabilitas', 'sedang', 'Saya dapat bekerja dengan atasan yang memiliki gaya kepemimpinan berbeda-beda.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"adaptabilitas":1}},{"id":"2","text":"Tidak Sesuai","scores":{"adaptabilitas":2}},{"id":"3","text":"Netral","scores":{"adaptabilitas":3}},{"id":"4","text":"Sesuai","scores":{"adaptabilitas":4}},{"id":"5","text":"Sangat Sesuai","scores":{"adaptabilitas":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('ADP-06', 'likert', 'adaptabilitas', 'sedang', 'Saya lebih nyaman dengan rutinitas yang tidak pernah berubah.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"adaptabilitas":5}},{"id":"2","text":"Tidak Sesuai","scores":{"adaptabilitas":4}},{"id":"3","text":"Netral","scores":{"adaptabilitas":3}},{"id":"4","text":"Sesuai","scores":{"adaptabilitas":2}},{"id":"5","text":"Sangat Sesuai","scores":{"adaptabilitas":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('ADP-07', 'likert', 'adaptabilitas', 'sedang', 'Saya melihat perubahan sebagai kesempatan untuk berkembang.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"adaptabilitas":1}},{"id":"2","text":"Tidak Sesuai","scores":{"adaptabilitas":2}},{"id":"3","text":"Netral","scores":{"adaptabilitas":3}},{"id":"4","text":"Sesuai","scores":{"adaptabilitas":4}},{"id":"5","text":"Sangat Sesuai","scores":{"adaptabilitas":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('ADP-08', 'likert', 'adaptabilitas', 'sedang', 'Saya bersedia dipindahkan ke tugas atau divisi lain jika dibutuhkan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"adaptabilitas":1}},{"id":"2","text":"Tidak Sesuai","scores":{"adaptabilitas":2}},{"id":"3","text":"Netral","scores":{"adaptabilitas":3}},{"id":"4","text":"Sesuai","scores":{"adaptabilitas":4}},{"id":"5","text":"Sangat Sesuai","scores":{"adaptabilitas":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('ADP-09', 'likert', 'adaptabilitas', 'sedang', 'Saya enggan mencoba cara kerja baru jika cara lama masih berjalan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"adaptabilitas":5}},{"id":"2","text":"Tidak Sesuai","scores":{"adaptabilitas":4}},{"id":"3","text":"Netral","scores":{"adaptabilitas":3}},{"id":"4","text":"Sesuai","scores":{"adaptabilitas":2}},{"id":"5","text":"Sangat Sesuai","scores":{"adaptabilitas":1}}]'::jsonb, null, '{"reverse":true,"pair":"adp2"}'::jsonb),
  ('ADP-10', 'likert', 'adaptabilitas', 'sedang', 'Saya senang mencoba cara kerja baru yang lebih efektif.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"adaptabilitas":1}},{"id":"2","text":"Tidak Sesuai","scores":{"adaptabilitas":2}},{"id":"3","text":"Netral","scores":{"adaptabilitas":3}},{"id":"4","text":"Sesuai","scores":{"adaptabilitas":4}},{"id":"5","text":"Sangat Sesuai","scores":{"adaptabilitas":5}}]'::jsonb, null, '{"reverse":false,"pair":"adp2"}'::jsonb),
  ('KOM-01', 'likert', 'komunikasi', 'sedang', 'Saya mampu menyampaikan ide dengan jelas kepada orang lain.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"komunikasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"komunikasi":2}},{"id":"3","text":"Netral","scores":{"komunikasi":3}},{"id":"4","text":"Sesuai","scores":{"komunikasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"komunikasi":5}}]'::jsonb, null, '{"reverse":false,"pair":"kom1"}'::jsonb),
  ('KOM-02', 'likert', 'komunikasi', 'sedang', 'Orang lain sering salah paham dengan maksud yang saya sampaikan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"komunikasi":5}},{"id":"2","text":"Tidak Sesuai","scores":{"komunikasi":4}},{"id":"3","text":"Netral","scores":{"komunikasi":3}},{"id":"4","text":"Sesuai","scores":{"komunikasi":2}},{"id":"5","text":"Sangat Sesuai","scores":{"komunikasi":1}}]'::jsonb, null, '{"reverse":true,"pair":"kom1"}'::jsonb),
  ('KOM-03', 'likert', 'komunikasi', 'sedang', 'Saya mendengarkan lawan bicara sampai selesai sebelum menanggapi.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"komunikasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"komunikasi":2}},{"id":"3","text":"Netral","scores":{"komunikasi":3}},{"id":"4","text":"Sesuai","scores":{"komunikasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"komunikasi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('KOM-04', 'likert', 'komunikasi', 'sedang', 'Saya merasa sangat canggung berbicara di depan banyak orang.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"komunikasi":5}},{"id":"2","text":"Tidak Sesuai","scores":{"komunikasi":4}},{"id":"3","text":"Netral","scores":{"komunikasi":3}},{"id":"4","text":"Sesuai","scores":{"komunikasi":2}},{"id":"5","text":"Sangat Sesuai","scores":{"komunikasi":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('KOM-05', 'likert', 'komunikasi', 'sedang', 'Saya menyampaikan ketidaksetujuan dengan cara yang sopan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"komunikasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"komunikasi":2}},{"id":"3","text":"Netral","scores":{"komunikasi":3}},{"id":"4","text":"Sesuai","scores":{"komunikasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"komunikasi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('KOM-06', 'likert', 'komunikasi', 'sedang', 'Saya terbiasa memberikan kabar perkembangan pekerjaan kepada atasan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"komunikasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"komunikasi":2}},{"id":"3","text":"Netral","scores":{"komunikasi":3}},{"id":"4","text":"Sesuai","scores":{"komunikasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"komunikasi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('KOM-07', 'likert', 'komunikasi', 'sedang', 'Saya mudah memulai percakapan dengan orang yang baru dikenal.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"komunikasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"komunikasi":2}},{"id":"3","text":"Netral","scores":{"komunikasi":3}},{"id":"4","text":"Sesuai","scores":{"komunikasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"komunikasi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('KOM-08', 'likert', 'komunikasi', 'sedang', 'Saya cenderung diam walaupun ada informasi penting yang perlu disampaikan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"komunikasi":5}},{"id":"2","text":"Tidak Sesuai","scores":{"komunikasi":4}},{"id":"3","text":"Netral","scores":{"komunikasi":3}},{"id":"4","text":"Sesuai","scores":{"komunikasi":2}},{"id":"5","text":"Sangat Sesuai","scores":{"komunikasi":1}}]'::jsonb, null, '{"reverse":true,"pair":"kom2"}'::jsonb),
  ('KOM-09', 'likert', 'komunikasi', 'sedang', 'Saya segera menyampaikan informasi penting kepada pihak terkait.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"komunikasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"komunikasi":2}},{"id":"3","text":"Netral","scores":{"komunikasi":3}},{"id":"4","text":"Sesuai","scores":{"komunikasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"komunikasi":5}}]'::jsonb, null, '{"reverse":false,"pair":"kom2"}'::jsonb),
  ('KOM-10', 'likert', 'komunikasi', 'sedang', 'Saya menyesuaikan cara bicara dengan lawan bicara yang berbeda latar belakang.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"komunikasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"komunikasi":2}},{"id":"3","text":"Netral","scores":{"komunikasi":3}},{"id":"4","text":"Sesuai","scores":{"komunikasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"komunikasi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LDR-01', 'likert', 'kepemimpinan', 'sedang', 'Saya berani mengambil keputusan ketika situasi menuntut.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kepemimpinan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kepemimpinan":2}},{"id":"3","text":"Netral","scores":{"kepemimpinan":3}},{"id":"4","text":"Sesuai","scores":{"kepemimpinan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kepemimpinan":5}}]'::jsonb, null, '{"reverse":false,"pair":"ldr1"}'::jsonb),
  ('LDR-02', 'likert', 'kepemimpinan', 'sedang', 'Saya lebih suka menunggu orang lain mengambil keputusan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kepemimpinan":5}},{"id":"2","text":"Tidak Sesuai","scores":{"kepemimpinan":4}},{"id":"3","text":"Netral","scores":{"kepemimpinan":3}},{"id":"4","text":"Sesuai","scores":{"kepemimpinan":2}},{"id":"5","text":"Sangat Sesuai","scores":{"kepemimpinan":1}}]'::jsonb, null, '{"reverse":true,"pair":"ldr1"}'::jsonb),
  ('LDR-03', 'likert', 'kepemimpinan', 'sedang', 'Saya sering mengusulkan ide perbaikan di tempat kerja.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kepemimpinan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kepemimpinan":2}},{"id":"3","text":"Netral","scores":{"kepemimpinan":3}},{"id":"4","text":"Sesuai","scores":{"kepemimpinan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kepemimpinan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LDR-04', 'likert', 'kepemimpinan', 'sedang', 'Saya mampu memotivasi orang lain untuk mencapai target.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kepemimpinan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kepemimpinan":2}},{"id":"3","text":"Netral","scores":{"kepemimpinan":3}},{"id":"4","text":"Sesuai","scores":{"kepemimpinan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kepemimpinan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LDR-05', 'likert', 'kepemimpinan', 'sedang', 'Saya mengambil inisiatif tanpa harus selalu diperintah.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kepemimpinan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kepemimpinan":2}},{"id":"3","text":"Netral","scores":{"kepemimpinan":3}},{"id":"4","text":"Sesuai","scores":{"kepemimpinan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kepemimpinan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LDR-06', 'likert', 'kepemimpinan', 'sedang', 'Saya enggan diminta memimpin kelompok.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kepemimpinan":5}},{"id":"2","text":"Tidak Sesuai","scores":{"kepemimpinan":4}},{"id":"3","text":"Netral","scores":{"kepemimpinan":3}},{"id":"4","text":"Sesuai","scores":{"kepemimpinan":2}},{"id":"5","text":"Sangat Sesuai","scores":{"kepemimpinan":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('LDR-07', 'likert', 'kepemimpinan', 'sedang', 'Saya mampu membagi tugas secara adil kepada anggota tim.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kepemimpinan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kepemimpinan":2}},{"id":"3","text":"Netral","scores":{"kepemimpinan":3}},{"id":"4","text":"Sesuai","scores":{"kepemimpinan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kepemimpinan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LDR-08', 'likert', 'kepemimpinan', 'sedang', 'Saya bersedia menanggung risiko atas keputusan yang saya ambil.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kepemimpinan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kepemimpinan":2}},{"id":"3","text":"Netral","scores":{"kepemimpinan":3}},{"id":"4","text":"Sesuai","scores":{"kepemimpinan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kepemimpinan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LDR-09', 'likert', 'kepemimpinan', 'sedang', 'Saya hanya mengerjakan apa yang diminta, tidak lebih.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kepemimpinan":5}},{"id":"2","text":"Tidak Sesuai","scores":{"kepemimpinan":4}},{"id":"3","text":"Netral","scores":{"kepemimpinan":3}},{"id":"4","text":"Sesuai","scores":{"kepemimpinan":2}},{"id":"5","text":"Sangat Sesuai","scores":{"kepemimpinan":1}}]'::jsonb, null, '{"reverse":true,"pair":"ldr2"}'::jsonb),
  ('LDR-10', 'likert', 'kepemimpinan', 'sedang', 'Saya sering mengerjakan lebih dari yang diminta demi hasil yang lebih baik.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"kepemimpinan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"kepemimpinan":2}},{"id":"3","text":"Netral","scores":{"kepemimpinan":3}},{"id":"4","text":"Sesuai","scores":{"kepemimpinan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"kepemimpinan":5}}]'::jsonb, null, '{"reverse":false,"pair":"ldr2"}'::jsonb),
  ('MOT-01', 'likert', 'motivasi_berprestasi', 'sedang', 'Saya menetapkan target pribadi yang lebih tinggi dari standar.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"motivasi_berprestasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"motivasi_berprestasi":2}},{"id":"3","text":"Netral","scores":{"motivasi_berprestasi":3}},{"id":"4","text":"Sesuai","scores":{"motivasi_berprestasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"motivasi_berprestasi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('MOT-02', 'likert', 'motivasi_berprestasi', 'sedang', 'Saya puas dengan hasil kerja yang sekadar cukup.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"motivasi_berprestasi":5}},{"id":"2","text":"Tidak Sesuai","scores":{"motivasi_berprestasi":4}},{"id":"3","text":"Netral","scores":{"motivasi_berprestasi":3}},{"id":"4","text":"Sesuai","scores":{"motivasi_berprestasi":2}},{"id":"5","text":"Sangat Sesuai","scores":{"motivasi_berprestasi":1}}]'::jsonb, null, '{"reverse":true,"pair":"mot1"}'::jsonb),
  ('MOT-03', 'likert', 'motivasi_berprestasi', 'sedang', 'Saya selalu berusaha memberikan hasil kerja terbaik.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"motivasi_berprestasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"motivasi_berprestasi":2}},{"id":"3","text":"Netral","scores":{"motivasi_berprestasi":3}},{"id":"4","text":"Sesuai","scores":{"motivasi_berprestasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"motivasi_berprestasi":5}}]'::jsonb, null, '{"reverse":false,"pair":"mot1"}'::jsonb),
  ('MOT-04', 'likert', 'motivasi_berprestasi', 'sedang', 'Saya aktif mencari kesempatan untuk mempelajari keterampilan baru.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"motivasi_berprestasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"motivasi_berprestasi":2}},{"id":"3","text":"Netral","scores":{"motivasi_berprestasi":3}},{"id":"4","text":"Sesuai","scores":{"motivasi_berprestasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"motivasi_berprestasi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('MOT-05', 'likert', 'motivasi_berprestasi', 'sedang', 'Saya tetap bersemangat walaupun pekerjaan terasa monoton.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"motivasi_berprestasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"motivasi_berprestasi":2}},{"id":"3","text":"Netral","scores":{"motivasi_berprestasi":3}},{"id":"4","text":"Sesuai","scores":{"motivasi_berprestasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"motivasi_berprestasi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('MOT-06', 'likert', 'motivasi_berprestasi', 'sedang', 'Saya mudah kehilangan motivasi ketika tidak ada pengawasan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"motivasi_berprestasi":5}},{"id":"2","text":"Tidak Sesuai","scores":{"motivasi_berprestasi":4}},{"id":"3","text":"Netral","scores":{"motivasi_berprestasi":3}},{"id":"4","text":"Sesuai","scores":{"motivasi_berprestasi":2}},{"id":"5","text":"Sangat Sesuai","scores":{"motivasi_berprestasi":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('MOT-07', 'likert', 'motivasi_berprestasi', 'sedang', 'Saya ingin terus berkembang dan meningkatkan karier saya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"motivasi_berprestasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"motivasi_berprestasi":2}},{"id":"3","text":"Netral","scores":{"motivasi_berprestasi":3}},{"id":"4","text":"Sesuai","scores":{"motivasi_berprestasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"motivasi_berprestasi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('MOT-08', 'likert', 'motivasi_berprestasi', 'sedang', 'Saya bekerja keras untuk mencapai tujuan jangka panjang.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"motivasi_berprestasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"motivasi_berprestasi":2}},{"id":"3","text":"Netral","scores":{"motivasi_berprestasi":3}},{"id":"4","text":"Sesuai","scores":{"motivasi_berprestasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"motivasi_berprestasi":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('MOT-09', 'likert', 'motivasi_berprestasi', 'sedang', 'Saya jarang memikirkan cara meningkatkan kualitas kerja saya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"motivasi_berprestasi":5}},{"id":"2","text":"Tidak Sesuai","scores":{"motivasi_berprestasi":4}},{"id":"3","text":"Netral","scores":{"motivasi_berprestasi":3}},{"id":"4","text":"Sesuai","scores":{"motivasi_berprestasi":2}},{"id":"5","text":"Sangat Sesuai","scores":{"motivasi_berprestasi":1}}]'::jsonb, null, '{"reverse":true,"pair":"mot2"}'::jsonb),
  ('MOT-10', 'likert', 'motivasi_berprestasi', 'sedang', 'Saya rutin mengevaluasi cara kerja saya agar lebih baik.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"motivasi_berprestasi":1}},{"id":"2","text":"Tidak Sesuai","scores":{"motivasi_berprestasi":2}},{"id":"3","text":"Netral","scores":{"motivasi_berprestasi":3}},{"id":"4","text":"Sesuai","scores":{"motivasi_berprestasi":4}},{"id":"5","text":"Sangat Sesuai","scores":{"motivasi_berprestasi":5}}]'::jsonb, null, '{"reverse":false,"pair":"mot2"}'::jsonb),
  ('PLY-01', 'likert', 'orientasi_pelayanan', 'sedang', 'Saya merasa puas ketika dapat membantu menyelesaikan masalah pelanggan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"orientasi_pelayanan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"orientasi_pelayanan":2}},{"id":"3","text":"Netral","scores":{"orientasi_pelayanan":3}},{"id":"4","text":"Sesuai","scores":{"orientasi_pelayanan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"orientasi_pelayanan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('PLY-02', 'likert', 'orientasi_pelayanan', 'sedang', 'Saya tetap sopan meskipun menghadapi pelanggan yang marah.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"orientasi_pelayanan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"orientasi_pelayanan":2}},{"id":"3","text":"Netral","scores":{"orientasi_pelayanan":3}},{"id":"4","text":"Sesuai","scores":{"orientasi_pelayanan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"orientasi_pelayanan":5}}]'::jsonb, null, '{"reverse":false,"pair":"ply1"}'::jsonb),
  ('PLY-03', 'likert', 'orientasi_pelayanan', 'sedang', 'Saya mudah terpancing emosi ketika pelanggan mengeluh.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"orientasi_pelayanan":5}},{"id":"2","text":"Tidak Sesuai","scores":{"orientasi_pelayanan":4}},{"id":"3","text":"Netral","scores":{"orientasi_pelayanan":3}},{"id":"4","text":"Sesuai","scores":{"orientasi_pelayanan":2}},{"id":"5","text":"Sangat Sesuai","scores":{"orientasi_pelayanan":1}}]'::jsonb, null, '{"reverse":true,"pair":"ply1"}'::jsonb),
  ('PLY-04', 'likert', 'orientasi_pelayanan', 'sedang', 'Saya berusaha memahami kebutuhan orang lain sebelum menawarkan solusi.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"orientasi_pelayanan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"orientasi_pelayanan":2}},{"id":"3","text":"Netral","scores":{"orientasi_pelayanan":3}},{"id":"4","text":"Sesuai","scores":{"orientasi_pelayanan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"orientasi_pelayanan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('PLY-05', 'likert', 'orientasi_pelayanan', 'sedang', 'Saya menindaklanjuti permintaan orang lain sampai tuntas.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"orientasi_pelayanan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"orientasi_pelayanan":2}},{"id":"3","text":"Netral","scores":{"orientasi_pelayanan":3}},{"id":"4","text":"Sesuai","scores":{"orientasi_pelayanan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"orientasi_pelayanan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('PLY-06', 'likert', 'orientasi_pelayanan', 'sedang', 'Keluhan pelanggan bukan urusan saya jika bukan bagian tugas saya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"orientasi_pelayanan":5}},{"id":"2","text":"Tidak Sesuai","scores":{"orientasi_pelayanan":4}},{"id":"3","text":"Netral","scores":{"orientasi_pelayanan":3}},{"id":"4","text":"Sesuai","scores":{"orientasi_pelayanan":2}},{"id":"5","text":"Sangat Sesuai","scores":{"orientasi_pelayanan":1}}]'::jsonb, null, '{"reverse":true}'::jsonb),
  ('PLY-07', 'likert', 'orientasi_pelayanan', 'sedang', 'Saya berusaha memberikan pelayanan melebihi harapan.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"orientasi_pelayanan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"orientasi_pelayanan":2}},{"id":"3","text":"Netral","scores":{"orientasi_pelayanan":3}},{"id":"4","text":"Sesuai","scores":{"orientasi_pelayanan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"orientasi_pelayanan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('PLY-08', 'likert', 'orientasi_pelayanan', 'sedang', 'Saya menganggap kepuasan pelanggan sebagai ukuran keberhasilan kerja.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"orientasi_pelayanan":1}},{"id":"2","text":"Tidak Sesuai","scores":{"orientasi_pelayanan":2}},{"id":"3","text":"Netral","scores":{"orientasi_pelayanan":3}},{"id":"4","text":"Sesuai","scores":{"orientasi_pelayanan":4}},{"id":"5","text":"Sangat Sesuai","scores":{"orientasi_pelayanan":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LIE-01', 'likert', 'desirabilitas_sosial', 'sedang', 'Saya tidak pernah sekali pun berbohong seumur hidup saya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"desirabilitas_sosial":1}},{"id":"2","text":"Tidak Sesuai","scores":{"desirabilitas_sosial":2}},{"id":"3","text":"Netral","scores":{"desirabilitas_sosial":3}},{"id":"4","text":"Sesuai","scores":{"desirabilitas_sosial":4}},{"id":"5","text":"Sangat Sesuai","scores":{"desirabilitas_sosial":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LIE-02', 'likert', 'desirabilitas_sosial', 'sedang', 'Saya tidak pernah merasa kesal kepada siapa pun.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"desirabilitas_sosial":1}},{"id":"2","text":"Tidak Sesuai","scores":{"desirabilitas_sosial":2}},{"id":"3","text":"Netral","scores":{"desirabilitas_sosial":3}},{"id":"4","text":"Sesuai","scores":{"desirabilitas_sosial":4}},{"id":"5","text":"Sangat Sesuai","scores":{"desirabilitas_sosial":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LIE-03', 'likert', 'desirabilitas_sosial', 'sedang', 'Saya selalu menyukai semua orang yang saya temui.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"desirabilitas_sosial":1}},{"id":"2","text":"Tidak Sesuai","scores":{"desirabilitas_sosial":2}},{"id":"3","text":"Netral","scores":{"desirabilitas_sosial":3}},{"id":"4","text":"Sesuai","scores":{"desirabilitas_sosial":4}},{"id":"5","text":"Sangat Sesuai","scores":{"desirabilitas_sosial":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LIE-04', 'likert', 'desirabilitas_sosial', 'sedang', 'Saya tidak pernah terlambat sekali pun dalam hidup saya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"desirabilitas_sosial":1}},{"id":"2","text":"Tidak Sesuai","scores":{"desirabilitas_sosial":2}},{"id":"3","text":"Netral","scores":{"desirabilitas_sosial":3}},{"id":"4","text":"Sesuai","scores":{"desirabilitas_sosial":4}},{"id":"5","text":"Sangat Sesuai","scores":{"desirabilitas_sosial":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LIE-05', 'likert', 'desirabilitas_sosial', 'sedang', 'Saya tidak pernah membicarakan orang lain di belakangnya.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"desirabilitas_sosial":1}},{"id":"2","text":"Tidak Sesuai","scores":{"desirabilitas_sosial":2}},{"id":"3","text":"Netral","scores":{"desirabilitas_sosial":3}},{"id":"4","text":"Sesuai","scores":{"desirabilitas_sosial":4}},{"id":"5","text":"Sangat Sesuai","scores":{"desirabilitas_sosial":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LIE-06', 'likert', 'desirabilitas_sosial', 'sedang', 'Saya tidak pernah menunda pekerjaan sama sekali.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"desirabilitas_sosial":1}},{"id":"2","text":"Tidak Sesuai","scores":{"desirabilitas_sosial":2}},{"id":"3","text":"Netral","scores":{"desirabilitas_sosial":3}},{"id":"4","text":"Sesuai","scores":{"desirabilitas_sosial":4}},{"id":"5","text":"Sangat Sesuai","scores":{"desirabilitas_sosial":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LIE-07', 'likert', 'desirabilitas_sosial', 'sedang', 'Saya selalu menepati setiap janji tanpa kecuali.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"desirabilitas_sosial":1}},{"id":"2","text":"Tidak Sesuai","scores":{"desirabilitas_sosial":2}},{"id":"3","text":"Netral","scores":{"desirabilitas_sosial":3}},{"id":"4","text":"Sesuai","scores":{"desirabilitas_sosial":4}},{"id":"5","text":"Sangat Sesuai","scores":{"desirabilitas_sosial":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LIE-08', 'likert', 'desirabilitas_sosial', 'sedang', 'Saya tidak pernah merasa iri terhadap keberhasilan orang lain.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"desirabilitas_sosial":1}},{"id":"2","text":"Tidak Sesuai","scores":{"desirabilitas_sosial":2}},{"id":"3","text":"Netral","scores":{"desirabilitas_sosial":3}},{"id":"4","text":"Sesuai","scores":{"desirabilitas_sosial":4}},{"id":"5","text":"Sangat Sesuai","scores":{"desirabilitas_sosial":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LIE-09', 'likert', 'desirabilitas_sosial', 'sedang', 'Saya selalu bersikap sabar dalam situasi apa pun.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"desirabilitas_sosial":1}},{"id":"2","text":"Tidak Sesuai","scores":{"desirabilitas_sosial":2}},{"id":"3","text":"Netral","scores":{"desirabilitas_sosial":3}},{"id":"4","text":"Sesuai","scores":{"desirabilitas_sosial":4}},{"id":"5","text":"Sangat Sesuai","scores":{"desirabilitas_sosial":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('LIE-10', 'likert', 'desirabilitas_sosial', 'sedang', 'Saya tidak pernah melanggar aturan sekecil apa pun.', null, '[{"id":"1","text":"Sangat Tidak Sesuai","scores":{"desirabilitas_sosial":1}},{"id":"2","text":"Tidak Sesuai","scores":{"desirabilitas_sosial":2}},{"id":"3","text":"Netral","scores":{"desirabilitas_sosial":3}},{"id":"4","text":"Sesuai","scores":{"desirabilitas_sosial":4}},{"id":"5","text":"Sangat Sesuai","scores":{"desirabilitas_sosial":5}}]'::jsonb, null, '{"reverse":false}'::jsonb),
  ('SJT-01', 'sjt', 'kerja_tim', 'sedang', 'Rekan satu tim tidak menyelesaikan bagiannya sehingga proyek tim terancam terlambat. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Mengajaknya bicara untuk memahami kendalanya, lalu bersama-sama mencari solusi dan membagi ulang tugas bila perlu.","scores":{"kerja_tim":4,"komunikasi":3}},{"id":"b","text":"Langsung melaporkannya ke atasan agar ia mendapat teguran.","scores":{"kerja_tim":1,"komunikasi":1}},{"id":"c","text":"Mengerjakan bagiannya diam-diam tanpa memberi tahu siapa pun.","scores":{"kerja_tim":2,"komunikasi":0}},{"id":"d","text":"Membiarkannya karena itu tanggung jawab dia.","scores":{"kerja_tim":0,"komunikasi":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-02', 'sjt', 'integritas', 'sedang', 'Anda mengetahui rekan kerja memalsukan nota perjalanan dinas dengan nominal kecil. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Menyampaikan kepadanya bahwa tindakan itu salah dan memintanya memperbaiki; bila berulang, melaporkan sesuai prosedur.","scores":{"integritas":4,"komunikasi":3}},{"id":"b","text":"Langsung melaporkannya ke atasan tanpa berbicara terlebih dahulu.","scores":{"integritas":3,"komunikasi":1}},{"id":"c","text":"Diam saja karena nominalnya kecil.","scores":{"integritas":1,"komunikasi":0}},{"id":"d","text":"Ikut melakukan hal yang sama karena dianggap kebiasaan.","scores":{"integritas":0,"komunikasi":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-03', 'sjt', 'toleransi_tekanan', 'sulit', 'Menjelang tenggat, atasan memberi tambahan tugas mendesak, sementara pekerjaan Anda belum selesai. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Menyusun prioritas, mengonfirmasi urutannya ke atasan, lalu mengerjakan secara fokus.","scores":{"toleransi_tekanan":4,"komunikasi":3,"tanggung_jawab":3}},{"id":"b","text":"Menerima semua tugas dan lembur tanpa bertanya, walau hasilnya mungkin kurang maksimal.","scores":{"toleransi_tekanan":2,"komunikasi":1,"tanggung_jawab":2}},{"id":"c","text":"Menolak tugas tambahan karena pekerjaan sudah banyak.","scores":{"toleransi_tekanan":1,"komunikasi":1,"tanggung_jawab":1}},{"id":"d","text":"Mengerjakan seadanya agar semuanya cepat selesai.","scores":{"toleransi_tekanan":0,"komunikasi":0,"tanggung_jawab":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-04', 'sjt', 'orientasi_pelayanan', 'sedang', 'Pelanggan marah karena pesanannya terlambat, padahal penyebabnya adalah pihak ekspedisi. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Mendengarkan keluhannya, meminta maaf atas ketidaknyamanan, menjelaskan solusi, dan memantau pengirimannya.","scores":{"orientasi_pelayanan":4,"stabilitas_emosi":4}},{"id":"b","text":"Menjelaskan bahwa itu kesalahan ekspedisi, bukan perusahaan.","scores":{"orientasi_pelayanan":1,"stabilitas_emosi":2}},{"id":"c","text":"Memberikan nomor kontak ekspedisi agar ia menghubungi sendiri.","scores":{"orientasi_pelayanan":1,"stabilitas_emosi":2}},{"id":"d","text":"Membalas dengan nada tinggi agar ia berhenti marah.","scores":{"orientasi_pelayanan":0,"stabilitas_emosi":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-05', 'sjt', 'kepemimpinan', 'sulit', 'Anda ditunjuk memimpin tim baru yang anggotanya lebih senior dan tampak meragukan Anda. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Mengajak diskusi, mendengarkan pengalaman mereka, menyepakati tujuan bersama, dan menunjukkan hasil kerja.","scores":{"kepemimpinan":4,"komunikasi":4,"kerja_tim":3}},{"id":"b","text":"Menegaskan bahwa Anda adalah pemimpin dan semua harus patuh.","scores":{"kepemimpinan":1,"komunikasi":1,"kerja_tim":0}},{"id":"c","text":"Menyerahkan pengambilan keputusan sepenuhnya kepada anggota senior.","scores":{"kepemimpinan":1,"komunikasi":2,"kerja_tim":2}},{"id":"d","text":"Meminta atasan mengganti anggota tim.","scores":{"kepemimpinan":0,"komunikasi":0,"kerja_tim":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-06', 'sjt', 'komunikasi', 'sedang', 'Anda belum memahami instruksi atasan tentang tugas penting, sementara atasan terlihat sangat sibuk. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Mencatat poin yang belum jelas lalu meminta waktu singkat untuk konfirmasi.","scores":{"komunikasi":4,"tanggung_jawab":4}},{"id":"b","text":"Mengerjakan sesuai tebakan sendiri.","scores":{"komunikasi":1,"tanggung_jawab":1}},{"id":"c","text":"Bertanya kepada rekan yang belum tentu tahu.","scores":{"komunikasi":2,"tanggung_jawab":2}},{"id":"d","text":"Menunggu sampai atasan menanyakan perkembangan.","scores":{"komunikasi":0,"tanggung_jawab":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-07', 'sjt', 'tanggung_jawab', 'sedang', 'Anda menyadari ada kesalahan data pada laporan yang sudah dikirim ke klien. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Segera memberi tahu atasan, mengirim koreksi kepada klien, dan mencegah kesalahan serupa.","scores":{"tanggung_jawab":4,"integritas":4}},{"id":"b","text":"Memperbaiki diam-diam di versi berikutnya tanpa memberi tahu.","scores":{"tanggung_jawab":2,"integritas":1}},{"id":"c","text":"Menunggu apakah klien menyadarinya.","scores":{"tanggung_jawab":1,"integritas":1}},{"id":"d","text":"Menyalahkan tim lain yang memberi data.","scores":{"tanggung_jawab":0,"integritas":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-08', 'sjt', 'adaptabilitas', 'sedang', 'Perusahaan mengganti aplikasi kerja yang sudah Anda kuasai dengan sistem baru. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Mempelajari sistem baru secara aktif dan membantu rekan yang kesulitan.","scores":{"adaptabilitas":4,"kerja_tim":4}},{"id":"b","text":"Mempelajarinya hanya ketika diwajibkan.","scores":{"adaptabilitas":2,"kerja_tim":2}},{"id":"c","text":"Tetap menggunakan cara lama selama masih bisa.","scores":{"adaptabilitas":1,"kerja_tim":1}},{"id":"d","text":"Mengeluh dan mengajak rekan menolak perubahan.","scores":{"adaptabilitas":0,"kerja_tim":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-09', 'sjt', 'stabilitas_emosi', 'sedang', 'Ide Anda dikritik keras dalam rapat di depan banyak orang. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Mendengarkan dengan tenang, mengambil poin yang berguna, dan menanggapi secara objektif.","scores":{"stabilitas_emosi":4,"komunikasi":4}},{"id":"b","text":"Membela ide dengan nada tinggi.","scores":{"stabilitas_emosi":1,"komunikasi":1}},{"id":"c","text":"Diam saja lalu mengurangi kontribusi di rapat berikutnya.","scores":{"stabilitas_emosi":1,"komunikasi":0}},{"id":"d","text":"Membalas dengan mengkritik ide orang tersebut.","scores":{"stabilitas_emosi":0,"komunikasi":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-10', 'sjt', 'integritas', 'sulit', 'Seorang vendor menawarkan voucher liburan jika Anda memenangkan tendernya. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Menolak dengan sopan dan melaporkan tawaran tersebut sesuai kebijakan perusahaan.","scores":{"integritas":4}},{"id":"b","text":"Menolak tanpa melaporkan.","scores":{"integritas":3}},{"id":"c","text":"Menerima namun tetap berusaha menilai secara objektif.","scores":{"integritas":1}},{"id":"d","text":"Menerima dan memenangkan vendor tersebut.","scores":{"integritas":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-11', 'sjt', 'kerja_tim', 'sedang', 'Dua rekan di tim Anda berselisih sehingga suasana kerja menjadi tidak nyaman. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Mengajak keduanya berbicara untuk mencari titik temu demi tujuan tim.","scores":{"kerja_tim":4,"komunikasi":3,"kepemimpinan":3}},{"id":"b","text":"Membiarkan karena bukan urusan Anda.","scores":{"kerja_tim":1,"komunikasi":0,"kepemimpinan":0}},{"id":"c","text":"Memihak rekan yang lebih dekat dengan Anda.","scores":{"kerja_tim":0,"komunikasi":1,"kepemimpinan":0}},{"id":"d","text":"Melaporkan ke atasan tanpa mencoba membantu.","scores":{"kerja_tim":2,"komunikasi":2,"kepemimpinan":1}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-12', 'sjt', 'toleransi_tekanan', 'sedang', 'Target penjualan bulan ini dinaikkan 30% secara mendadak. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Menganalisis peluang, menyusun strategi baru, dan memantau kemajuan secara rutin.","scores":{"toleransi_tekanan":4,"motivasi_berprestasi":4}},{"id":"b","text":"Bekerja seperti biasa dan berharap target tercapai.","scores":{"toleransi_tekanan":2,"motivasi_berprestasi":1}},{"id":"c","text":"Memprotes kebijakan kepada manajemen.","scores":{"toleransi_tekanan":1,"motivasi_berprestasi":1}},{"id":"d","text":"Mulai mencari pekerjaan lain.","scores":{"toleransi_tekanan":0,"motivasi_berprestasi":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-13', 'sjt', 'orientasi_pelayanan', 'sulit', 'Pelanggan meminta layanan di luar prosedur standar yang dapat merugikan perusahaan. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Menolak dengan sopan, menjelaskan alasannya, dan menawarkan alternatif sesuai prosedur.","scores":{"orientasi_pelayanan":4,"integritas":4}},{"id":"b","text":"Menuruti permintaannya agar pelanggan puas.","scores":{"orientasi_pelayanan":2,"integritas":0}},{"id":"c","text":"Menolak tanpa penjelasan.","scores":{"orientasi_pelayanan":0,"integritas":3}},{"id":"d","text":"Melempar permintaan itu ke rekan lain.","scores":{"orientasi_pelayanan":1,"integritas":2}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-14', 'sjt', 'motivasi_berprestasi', 'sedang', 'Anda mencapai target bulan ini seminggu lebih cepat. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Menggunakan waktu tersisa untuk meningkatkan kualitas atau membantu target tim.","scores":{"motivasi_berprestasi":4,"kerja_tim":4}},{"id":"b","text":"Bersantai karena target sudah tercapai.","scores":{"motivasi_berprestasi":1,"kerja_tim":1}},{"id":"c","text":"Mengerjakan tugas rutin seperti biasa.","scores":{"motivasi_berprestasi":2,"kerja_tim":2}},{"id":"d","text":"Menahan sebagian hasil untuk dilaporkan bulan depan.","scores":{"motivasi_berprestasi":1,"kerja_tim":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-15', 'sjt', 'kepemimpinan', 'sedang', 'Anda melihat proses kerja di divisi tidak efisien dan memakan banyak waktu. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Menyusun usulan perbaikan berbasis data dan mendiskusikannya dengan atasan.","scores":{"kepemimpinan":4,"komunikasi":3,"kerja_tim":3}},{"id":"b","text":"Mengeluhkannya kepada rekan kerja.","scores":{"kepemimpinan":0,"komunikasi":1,"kerja_tim":1}},{"id":"c","text":"Mengubah prosesnya sendiri tanpa koordinasi.","scores":{"kepemimpinan":2,"komunikasi":0,"kerja_tim":0}},{"id":"d","text":"Mengikuti saja karena sudah menjadi aturan.","scores":{"kepemimpinan":1,"komunikasi":1,"kerja_tim":2}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-16', 'sjt', 'tanggung_jawab', 'sulit', 'Anda sakit di hari presentasi penting yang sudah Anda siapkan. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Segera memberi kabar, menyerahkan materi dan catatan kepada rekan yang dapat menggantikan.","scores":{"tanggung_jawab":4,"komunikasi":4}},{"id":"b","text":"Memaksakan diri datang walau kondisi buruk.","scores":{"tanggung_jawab":2,"komunikasi":1}},{"id":"c","text":"Tidak memberi kabar dan berharap acara ditunda.","scores":{"tanggung_jawab":0,"komunikasi":0}},{"id":"d","text":"Meminta presentasi ditunda tanpa menyiapkan pengganti.","scores":{"tanggung_jawab":1,"komunikasi":2}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-17', 'sjt', 'integritas', 'sedang', 'Atasan meminta Anda mengubah data laporan agar kinerja divisi terlihat lebih baik. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Menolak dengan sopan, menjelaskan risikonya, dan menawarkan penyajian data apa adanya disertai rencana perbaikan.","scores":{"integritas":4,"komunikasi":4}},{"id":"b","text":"Menurutinya karena itu perintah atasan.","scores":{"integritas":0,"komunikasi":1}},{"id":"c","text":"Menurutinya sebagian saja.","scores":{"integritas":1,"komunikasi":1}},{"id":"d","text":"Menolak lalu langsung mengundurkan diri.","scores":{"integritas":3,"komunikasi":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-18', 'sjt', 'toleransi_tekanan', 'sulit', 'Sistem mengalami error tepat saat banyak pelanggan menunggu layanan Anda. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Tetap tenang, menginformasikan pelanggan, menjalankan prosedur darurat, dan melapor ke tim IT.","scores":{"toleransi_tekanan":4,"orientasi_pelayanan":4}},{"id":"b","text":"Meminta semua pelanggan kembali besok.","scores":{"toleransi_tekanan":1,"orientasi_pelayanan":0}},{"id":"c","text":"Panik dan menunggu sampai sistem pulih sendiri.","scores":{"toleransi_tekanan":0,"orientasi_pelayanan":1}},{"id":"d","text":"Melayani secara manual tanpa mencatat transaksi.","scores":{"toleransi_tekanan":2,"orientasi_pelayanan":2}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-19', 'sjt', 'kerja_tim', 'sulit', 'Hasil kerja Anda diakui atasan sebagai hasil kerja rekan lain. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Membicarakannya baik-baik dengan rekan tersebut, lalu mengklarifikasi kepada atasan secara profesional dengan bukti.","scores":{"kerja_tim":3,"komunikasi":4,"stabilitas_emosi":4}},{"id":"b","text":"Membiarkannya demi menjaga hubungan.","scores":{"kerja_tim":2,"komunikasi":1,"stabilitas_emosi":2}},{"id":"c","text":"Menceritakannya kepada rekan-rekan lain.","scores":{"kerja_tim":0,"komunikasi":0,"stabilitas_emosi":1}},{"id":"d","text":"Menolak bekerja sama dengan rekan itu di proyek berikutnya.","scores":{"kerja_tim":0,"komunikasi":1,"stabilitas_emosi":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-20', 'sjt', 'adaptabilitas', 'sulit', 'Anda dipindahkan ke divisi baru dengan tugas yang sama sekali berbeda. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Mempelajari tugas baru, meminta bimbingan, dan menetapkan target belajar.","scores":{"adaptabilitas":4,"motivasi_berprestasi":4}},{"id":"b","text":"Menerima namun bekerja dengan setengah hati.","scores":{"adaptabilitas":1,"motivasi_berprestasi":0}},{"id":"c","text":"Meminta dikembalikan ke divisi lama.","scores":{"adaptabilitas":0,"motivasi_berprestasi":1}},{"id":"d","text":"Menunggu pelatihan formal sebelum mulai bekerja.","scores":{"adaptabilitas":2,"motivasi_berprestasi":2}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-21', 'sjt', 'komunikasi', 'sulit', 'Anda harus menyampaikan kepada klien bahwa proyek akan terlambat. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Menghubungi klien lebih awal, menjelaskan penyebab, rencana pemulihan, dan jadwal baru.","scores":{"komunikasi":4,"integritas":4,"orientasi_pelayanan":4}},{"id":"b","text":"Menyampaikan mendekati tenggat agar keluhan tidak muncul lebih awal.","scores":{"komunikasi":1,"integritas":1,"orientasi_pelayanan":1}},{"id":"c","text":"Meminta rekan lain yang menyampaikan.","scores":{"komunikasi":1,"integritas":2,"orientasi_pelayanan":1}},{"id":"d","text":"Tidak memberi kabar dan berusaha mengejar ketertinggalan.","scores":{"komunikasi":0,"integritas":0,"orientasi_pelayanan":0}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-22', 'sjt', 'orientasi_pelayanan', 'mudah', 'Pelanggan bertanya tentang produk yang bukan bidang Anda. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Menghubungkannya dengan petugas yang tepat dan memastikan ia terlayani.","scores":{"orientasi_pelayanan":4}},{"id":"b","text":"Menjawab sebisanya walau tidak yakin.","scores":{"orientasi_pelayanan":1}},{"id":"c","text":"Mengatakan bahwa itu bukan bagian Anda.","scores":{"orientasi_pelayanan":0}},{"id":"d","text":"Menyarankan ia mencari informasi di situs web.","scores":{"orientasi_pelayanan":2}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-23', 'sjt', 'kepemimpinan', 'sulit', 'Tim yang Anda pimpin gagal mencapai target kuartal ini. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Mengevaluasi bersama tim, mengakui kekurangan, dan menyusun rencana perbaikan yang jelas.","scores":{"kepemimpinan":4,"tanggung_jawab":4}},{"id":"b","text":"Menyalahkan anggota tim yang kinerjanya rendah.","scores":{"kepemimpinan":0,"tanggung_jawab":0}},{"id":"c","text":"Menunggu arahan dari atasan.","scores":{"kepemimpinan":1,"tanggung_jawab":2}},{"id":"d","text":"Mengambil alih semua pekerjaan sendiri.","scores":{"kepemimpinan":1,"tanggung_jawab":3}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-24', 'sjt', 'integritas', 'mudah', 'Anda menemukan dompet berisi uang di area kantor. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Menyerahkannya ke bagian keamanan/HR atau langsung kepada pemiliknya.","scores":{"integritas":4}},{"id":"b","text":"Mengambil uangnya lalu mengembalikan dompetnya.","scores":{"integritas":0}},{"id":"c","text":"Membiarkannya di tempat.","scores":{"integritas":2}},{"id":"d","text":"Menyimpannya dulu sambil menunggu ada yang mencari.","scores":{"integritas":3}}]'::jsonb, null, '{}'::jsonb),
  ('SJT-25', 'sjt', 'tanggung_jawab', 'mudah', 'Anda diberi tugas yang belum pernah dikerjakan dengan tenggat dua hari. Apa yang paling mungkin Anda lakukan?', null, '[{"id":"a","text":"Menerima, mempelajari kebutuhan tugas, dan bertanya jika ada hal yang belum jelas.","scores":{"tanggung_jawab":4,"adaptabilitas":4}},{"id":"b","text":"Menolak karena belum berpengalaman.","scores":{"tanggung_jawab":1,"adaptabilitas":0}},{"id":"c","text":"Menerima lalu menunda hingga hari terakhir.","scores":{"tanggung_jawab":0,"adaptabilitas":1}},{"id":"d","text":"Meminta rekan mengerjakannya.","scores":{"tanggung_jawab":1,"adaptabilitas":1}}]'::jsonb, null, '{}'::jsonb)
on conflict (code) do update set type = excluded.type, category = excluded.category, difficulty = excluded.difficulty,
  prompt = excluded.prompt, stimulus = excluded.stimulus, options = excluded.options, explanation = excluded.explanation, meta = excluded.meta;

insert into public.tests (title, description, instructions, access_code, is_active, sections, settings) values
  ('Psikotes Rekrutmen Karyawan – Standar', 'Paket psikotes lengkap untuk seleksi karyawan: kemampuan kognitif, tes ketahanan kerja (Kraepelin), inventori kepribadian kerja, dan situational judgment.', 'Kerjakan dengan jujur dan sungguh-sungguh. Pastikan koneksi internet stabil dan Anda berada di tempat yang tenang. Jangan berpindah tab/jendela selama tes berlangsung.', 'DEMO2026', true, '[{"id":"sec-verbal","title":"Tes Kemampuan Verbal","type":"cognitive","selection":"random","categories":["verbal"],"question_count":10,"count_per_category":false,"difficulty_counts":{"mudah":3,"sedang":4,"sulit":3},"points":{"mudah":1,"sedang":2,"sulit":3},"negative_marking":0,"time_limit_sec":480,"shuffle_questions":true,"shuffle_options":true,"instructions":"Pilih satu jawaban yang paling tepat. Waktu terbatas, kerjakan yang mudah terlebih dahulu."},{"id":"sec-numerik","title":"Tes Kemampuan Numerik","type":"cognitive","selection":"random","categories":["numerik"],"question_count":10,"count_per_category":false,"difficulty_counts":{"mudah":3,"sedang":4,"sulit":3},"points":{"mudah":1,"sedang":2,"sulit":3},"negative_marking":0,"time_limit_sec":600,"shuffle_questions":true,"shuffle_options":true,"instructions":"Hitung dengan teliti. Anda boleh menggunakan kertas buram, tetapi tidak menggunakan kalkulator."},{"id":"sec-logika","title":"Penalaran Logis & Figural","type":"cognitive","selection":"random","categories":["logika","figural"],"question_count":6,"count_per_category":true,"difficulty_counts":{"mudah":1,"sedang":3,"sulit":2},"points":{"mudah":1,"sedang":2,"sulit":3},"negative_marking":0,"time_limit_sec":720,"shuffle_questions":true,"shuffle_options":true,"instructions":"Perhatikan pola, aturan, dan hubungan antar informasi sebelum menjawab."},{"id":"sec-kraepelin","title":"Tes Ketahanan Kerja (Kraepelin)","type":"kraepelin","kraepelin":{"columns":15,"rows":26,"seconds_per_column":15,"target_per_column":14},"instructions":"Jumlahkan dua angka yang berdekatan, lalu tuliskan HANYA angka satuannya (contoh: 7 + 8 = 15 → ketik 5). Setiap lajur memiliki batas waktu; saat waktu habis Anda otomatis pindah ke lajur berikutnya. Kerjakan secepat dan seteliti mungkin."},{"id":"sec-kepribadian","title":"Inventori Sikap & Kepribadian Kerja","type":"likert","selection":"random","categories":["tingkat_stres","toleransi_tekanan","stabilitas_emosi","kerja_tim","integritas","tanggung_jawab","adaptabilitas","komunikasi","kepemimpinan","motivasi_berprestasi","orientasi_pelayanan","desirabilitas_sosial"],"question_count":6,"count_per_category":true,"time_limit_sec":1200,"shuffle_questions":true,"shuffle_options":false,"instructions":"Tidak ada jawaban benar atau salah. Pilih respons yang paling menggambarkan diri Anda yang sebenarnya, bukan yang Anda anggap ideal."},{"id":"sec-sjt","title":"Situational Judgment Test","type":"sjt","selection":"random","categories":[],"question_count":10,"count_per_category":false,"time_limit_sec":900,"shuffle_questions":true,"shuffle_options":true,"instructions":"Bacalah setiap situasi kerja, lalu pilih tindakan yang PALING mungkin Anda lakukan."}]'::jsonb, '{"allow_back":true,"show_result":"summary","max_tab_switches":3,"auto_submit_on_violation":false,"max_attempts":0,"require_fields":["email","phone","position"],"passing_score":60,"thresholds":{"sangat":80,"rekomendasi":65,"pertimbangan":50},"lie_threshold":70,"min_seconds_per_item":2,"dimension_weights":{}}'::jsonb)
on conflict (access_code) do nothing;
