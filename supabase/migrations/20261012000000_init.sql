-- Kanban Board 초기 스키마 (MVP)
-- 단일 팀 / 초대제 가입 / RLS 전면 적용

-- ---------------------------------------------------------------
-- 공통
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- 초대 / 프로필
-- ---------------------------------------------------------------
create table public.invitations (
  email       text primary key check (email = lower(email)),
  role        text not null default 'member' check (role in ('admin', 'member')),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  name       text not null,
  avatar_url text,
  role       text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- 권한 확인 헬퍼 (RLS 재귀 방지를 위해 security definer)
create or replace function public.is_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 초대받지 않은 이메일의 가입 차단 (이메일/소셜 로그인 공통)
create or replace function public.enforce_invitation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.email is null
     or not exists (select 1 from public.invitations where email = lower(new.email)) then
    raise exception 'NOT_INVITED: 초대받은 이메일만 가입할 수 있습니다.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function public.enforce_invitation();

-- 가입 직후 프로필 생성 + 초대 수락 처리
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  inv public.invitations;
begin
  select * into inv from public.invitations where email = lower(new.email);

  insert into public.profiles (id, email, name, avatar_url, role)
  values (
    new.id,
    lower(new.email),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(inv.role, 'member')
  );

  update public.invitations set accepted_at = now() where email = lower(new.email);

  insert into public.notification_prefs (user_id) values (new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- 보드 / 컬럼 / 카드
-- position 은 fractional indexing 문자열 (COLLATE "C" 로 정렬)
-- ---------------------------------------------------------------
create table public.boards (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 100),
  archived   boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger boards_updated_at before update on public.boards
  for each row execute function public.set_updated_at();

create table public.columns (
  id        uuid primary key default gen_random_uuid(),
  board_id  uuid not null references public.boards (id) on delete cascade,
  name      text not null check (char_length(name) between 1 and 50),
  position  text not null collate "C",
  wip_limit integer check (wip_limit is null or wip_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index columns_board_idx on public.columns (board_id, position);
create trigger columns_updated_at before update on public.columns
  for each row execute function public.set_updated_at();

create table public.cards (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards (id) on delete cascade,
  column_id   uuid not null references public.columns (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  position    text not null collate "C",
  priority    text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date    date,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index cards_column_idx on public.cards (column_id, position);
create index cards_board_idx on public.cards (board_id);
create index cards_due_idx on public.cards (due_date) where due_date is not null;
create trigger cards_updated_at before update on public.cards
  for each row execute function public.set_updated_at();

create table public.card_assignees (
  card_id uuid not null references public.cards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (card_id, user_id)
);
create index card_assignees_user_idx on public.card_assignees (user_id);

-- 새 보드 생성 시 기본 컬럼 자동 생성
create or replace function public.create_default_columns()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.columns (board_id, name, position) values
    (new.id, 'Backlog',     'a0'),
    (new.id, 'To Do',       'a1'),
    (new.id, 'In Progress', 'a2'),
    (new.id, 'Review',      'a3'),
    (new.id, 'Done',        'a4');
  return new;
end;
$$;

create trigger boards_default_columns after insert on public.boards
  for each row execute function public.create_default_columns();

-- 카드의 board_id 는 컬럼의 board_id 와 항상 일치해야 함
create or replace function public.sync_card_board()
returns trigger
language plpgsql
as $$
begin
  select board_id into new.board_id from public.columns where id = new.column_id;
  return new;
end;
$$;

create trigger cards_sync_board before insert or update of column_id on public.cards
  for each row execute function public.sync_card_board();

-- ---------------------------------------------------------------
-- 소통: 댓글 / 활동 로그 / 알림
-- ---------------------------------------------------------------
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.cards (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body       text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_card_idx on public.comments (card_id, created_at);
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

create table public.activity_log (
  id         bigint generated always as identity primary key,
  board_id   uuid references public.boards (id) on delete cascade,
  card_id    uuid references public.cards (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  action     text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_board_idx on public.activity_log (board_id, created_at desc);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type in ('assigned', 'mention', 'due_soon')),
  card_id    uuid references public.cards (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  read       boolean not null default false,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read, created_at desc);
create index notifications_pending_email_idx on public.notifications (created_at) where emailed_at is null;
-- 마감 임박 알림 중복 방지
create unique index notifications_due_once_idx
  on public.notifications (user_id, card_id, type) where type = 'due_soon';

create table public.notification_prefs (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  email_mention  boolean not null default true,
  email_assigned boolean not null default true,
  email_due      boolean not null default true
);

-- handle_new_user 는 notification_prefs 를 참조하므로 테이블 생성 이후 트리거 연결
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 담당자 지정 → 알림 + 활동 로그
create or replace function public.on_card_assigned()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  c public.cards;
begin
  select * into c from public.cards where id = new.card_id;

  insert into public.activity_log (board_id, card_id, user_id, action, payload)
  values (c.board_id, c.id, auth.uid(), 'assigned', jsonb_build_object('assignee', new.user_id));

  if new.user_id is distinct from auth.uid() then
    insert into public.notifications (user_id, type, card_id, actor_id)
    values (new.user_id, 'assigned', new.card_id, auth.uid());
  end if;
  return new;
end;
$$;

create trigger card_assignees_notify after insert on public.card_assignees
  for each row execute function public.on_card_assigned();

-- 카드 생성/이동/수정 → 활동 로그 (이동은 사이클 타임 계산에도 사용)
create or replace function public.log_card_activity()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (board_id, card_id, user_id, action, payload)
    values (new.board_id, new.id, auth.uid(), 'card_created',
            jsonb_build_object('title', new.title, 'column_id', new.column_id));
  elsif new.column_id is distinct from old.column_id then
    insert into public.activity_log (board_id, card_id, user_id, action, payload)
    values (new.board_id, new.id, auth.uid(), 'card_moved',
            jsonb_build_object('from', old.column_id, 'to', new.column_id));
  end if;
  return new;
end;
$$;

create trigger cards_activity after insert or update on public.cards
  for each row execute function public.log_card_activity();

-- 댓글 작성 → 활동 로그
create or replace function public.log_comment_activity()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  b uuid;
begin
  select board_id into b from public.cards where id = new.card_id;
  insert into public.activity_log (board_id, card_id, user_id, action, payload)
  values (b, new.card_id, new.user_id, 'comment_added', jsonb_build_object('comment_id', new.id));
  return new;
end;
$$;

create trigger comments_activity after insert on public.comments
  for each row execute function public.log_comment_activity();

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
alter table public.invitations       enable row level security;
alter table public.profiles          enable row level security;
alter table public.boards            enable row level security;
alter table public.columns           enable row level security;
alter table public.cards             enable row level security;
alter table public.card_assignees    enable row level security;
alter table public.comments          enable row level security;
alter table public.activity_log      enable row level security;
alter table public.notifications     enable row level security;
alter table public.notification_prefs enable row level security;

-- 초대: 관리자만
create policy invitations_admin_all on public.invitations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 프로필: 멤버 전체 열람, 본인 수정(이름/아바타만 — 컬럼 권한으로 제한)
create policy profiles_select on public.profiles
  for select to authenticated using (public.is_member());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke update on public.profiles from authenticated;
grant update (name, avatar_url) on public.profiles to authenticated;
-- 역할 변경은 관리자 전용 함수로만 허용
create or replace function public.set_member_role(target uuid, new_role text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if new_role not in ('admin', 'member') then
    raise exception 'INVALID_ROLE';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;
revoke all on function public.set_member_role(uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, text) to authenticated;

-- 보드: 멤버 열람/생성/수정, 삭제는 관리자
create policy boards_select on public.boards
  for select to authenticated using (public.is_member());
create policy boards_insert on public.boards
  for insert to authenticated with check (public.is_member());
create policy boards_update on public.boards
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy boards_delete on public.boards
  for delete to authenticated using (public.is_admin());

-- 컬럼 / 카드 / 담당자: 멤버 전체 권한
create policy columns_all on public.columns
  for all to authenticated using (public.is_member()) with check (public.is_member());
create policy cards_all on public.cards
  for all to authenticated using (public.is_member()) with check (public.is_member());
create policy card_assignees_all on public.card_assignees
  for all to authenticated using (public.is_member()) with check (public.is_member());

-- 댓글: 열람/작성은 멤버, 수정은 본인, 삭제는 본인 또는 관리자
create policy comments_select on public.comments
  for select to authenticated using (public.is_member());
create policy comments_insert on public.comments
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy comments_update on public.comments
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy comments_delete on public.comments
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- 활동 로그: 열람만 (기록은 트리거가 수행)
create policy activity_select on public.activity_log
  for select to authenticated using (public.is_member());

-- 알림: 본인 것만 열람/읽음 처리
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;

-- 알림 설정: 본인 것만
create policy notification_prefs_select on public.notification_prefs
  for select to authenticated using (user_id = auth.uid());
create policy notification_prefs_update on public.notification_prefs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 비로그인(anon) 접근 차단
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

-- ---------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------
alter publication supabase_realtime add table
  public.boards, public.columns, public.cards, public.card_assignees,
  public.comments, public.notifications;
