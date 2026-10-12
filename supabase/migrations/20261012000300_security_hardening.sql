-- 보안 점검 결과 반영 (SEC-002/003/004/007/008/009, INFO-4/8)

-- ---------------------------------------------------------------
-- SEC-002: 이메일 확인이 끝난 뒤에만 멤버(프로필)를 만든다
--   · 미확인 가입은 프로필이 없으므로 초대 이메일을 선점해도 접근 권한이 생기지 않는다
--   · 소셜 로그인(가입 시점에 이미 확인됨)은 INSERT 트리거가, 이메일 가입은 확인 시점의 UPDATE 트리거가 처리
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  inv public.invitations;
  display_name text;
  avatar text;
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  select * into inv from public.invitations
   where email = lower(new.email) and accepted_at is null;
  if not found then
    return new;
  end if;

  display_name := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  ), 50);
  if display_name = '' then display_name := '사용자'; end if;

  avatar := new.raw_user_meta_data ->> 'avatar_url';
  if avatar is null or avatar !~ '^https://' or char_length(avatar) > 500 then
    avatar := null;
  end if;

  insert into public.profiles (id, email, name, avatar_url, role)
  values (new.id, lower(new.email), display_name, avatar, inv.role);

  update public.invitations set accepted_at = now() where email = lower(new.email);

  insert into public.notification_prefs (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- SEC-003: 이미 수락된 초대는 재사용할 수 없고, 프로필이 지워지면 초대도 함께 지운다
-- ---------------------------------------------------------------
create or replace function public.enforce_invitation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.email is null
     or not exists (
       select 1 from public.invitations
        where email = lower(new.email) and accepted_at is null
     ) then
    raise exception 'NOT_INVITED: 초대받은 이메일만 가입할 수 있습니다.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.cleanup_invitation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.invitations where email = old.email;
  return old;
end;
$$;
revoke all on function public.cleanup_invitation() from public, anon, authenticated;

drop trigger if exists profiles_cleanup_invitation on public.profiles;
create trigger profiles_cleanup_invitation
  after delete on public.profiles
  for each row execute function public.cleanup_invitation();

-- INFO-8: 마지막 관리자는 강등할 수 없다
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
  if new_role = 'member'
     and (select role from public.profiles where id = target) = 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'LAST_ADMIN';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;

-- ---------------------------------------------------------------
-- SEC-004: 컬럼 삭제는 관리자 전용, 카드 삭제는 활동 로그에 남긴다
-- ---------------------------------------------------------------
drop policy if exists columns_all on public.columns;
create policy columns_select on public.columns
  for select to authenticated using (public.is_member());
create policy columns_insert on public.columns
  for insert to authenticated with check (public.is_member());
create policy columns_update on public.columns
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy columns_delete on public.columns
  for delete to authenticated using (public.is_admin());

create or replace function public.log_card_deleted()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- 보드 삭제로 인한 연쇄 삭제에서는 보드가 이미 없으므로 기록하지 않는다 (FK 위반 방지)
  if exists (select 1 from public.boards where id = old.board_id) then
    insert into public.activity_log (board_id, card_id, user_id, action, payload)
    values (old.board_id, null, auth.uid(), 'card_deleted',
            jsonb_build_object('title', old.title, 'column_id', old.column_id));
  end if;
  return old;
end;
$$;

drop trigger if exists cards_deleted_log on public.cards;
create trigger cards_deleted_log
  before delete on public.cards
  for each row execute function public.log_card_deleted();

-- ---------------------------------------------------------------
-- SEC-007: 길이/형식 제한 (기존 행은 검사하지 않음: NOT VALID)
-- ---------------------------------------------------------------
alter table public.cards add constraint cards_description_len
  check (char_length(description) <= 20000) not valid;
alter table public.profiles add constraint profiles_name_len
  check (char_length(name) between 1 and 50) not valid;
alter table public.profiles add constraint profiles_avatar_url_chk
  check (avatar_url is null or (char_length(avatar_url) <= 500 and avatar_url ~ '^https://')) not valid;
alter table public.cards add constraint cards_position_fmt
  check (position ~ '^[0-9A-Za-z]{1,64}$') not valid;
alter table public.columns add constraint columns_position_fmt
  check (position ~ '^[0-9A-Za-z]{1,64}$') not valid;
alter table public.checklist_items add constraint checklist_items_position_fmt
  check (position ~ '^[0-9A-Za-z]{1,64}$') not valid;

-- ---------------------------------------------------------------
-- SEC-008: 같은 카드 담당 알림은 10분에 한 번만
-- ---------------------------------------------------------------
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

  if new.user_id is distinct from auth.uid()
     and not exists (
       select 1 from public.notifications
        where user_id = new.user_id and card_id = new.card_id and type = 'assigned'
          and created_at > now() - interval '10 minutes'
     ) then
    insert into public.notifications (user_id, type, card_id, actor_id)
    values (new.user_id, 'assigned', new.card_id, auth.uid());
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- SEC-009: 작성자/작성 시각은 서버가 고정한다
-- ---------------------------------------------------------------
create or replace function public.pin_created_by()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists cards_pin_author on public.cards;
create trigger cards_pin_author before insert or update on public.cards
  for each row execute function public.pin_created_by();

drop trigger if exists boards_pin_author on public.boards;
create trigger boards_pin_author before insert or update on public.boards
  for each row execute function public.pin_created_by();

create or replace function public.pin_comment_identity()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.card_id := old.card_id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists comments_pin_identity on public.comments;
create trigger comments_pin_identity before update on public.comments
  for each row execute function public.pin_comment_identity();

-- ---------------------------------------------------------------
-- INFO-4: search_path 고정
-- ---------------------------------------------------------------
alter function public.set_updated_at() set search_path = public;
alter function public.sync_card_board() set search_path = public;
