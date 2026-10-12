-- 멤버 관리 화면용: 관리자가 멤버를 내보낸다 (PLAN 17번)
--   · 서버 전용 키 없이 처리하려고 관리자만 호출할 수 있는 DB 함수로 만든다.
--   · 계정(auth.users)을 지우면 프로필이 함께 지워지고, 프로필 삭제 트리거가 초대도 지워
--     같은 이메일로 다시 초대하기 전까지 가입할 수 없다.
--   · 그 사람이 쓴 댓글, 담당자 지정, 알림은 함께 삭제된다.
-- 버그 수정: 작성자 고정 트리거가 사용자 삭제 때 DB 가 created_by 를 비우는(FK set null) 동작까지
-- 되돌려, 보드·카드를 만든 사람은 삭제되지 않았다. 다른 트리거 안에서 일어나는 수정(깊이 2 이상)은 건너뛴다.
create or replace function public.pin_created_by()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  elsif pg_trigger_depth() > 1 then
    return new; -- 외래 키 동작(set null)으로 인한 수정은 그대로 둔다
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create or replace function public.remove_member(target uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  target_role text;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if target = auth.uid() then
    raise exception 'SELF'; -- 자기 자신을 내보내 관리자가 없어지는 사고 방지
  end if;

  select role into target_role from public.profiles where id = target;
  if target_role is null then
    raise exception 'NOT_FOUND';
  end if;
  if target_role = 'admin' and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'LAST_ADMIN';
  end if;

  delete from auth.users where id = target;
end;
$$;

revoke all on function public.remove_member(uuid) from public, anon;
grant execute on function public.remove_member(uuid) to authenticated;
