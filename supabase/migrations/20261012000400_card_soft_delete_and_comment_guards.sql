-- PLAN 10번 점검 결과 반영 (문제 1, 5, 9)

-- ---------------------------------------------------------------
-- 문제 1: 카드를 지울 때 행을 없애지 않고 deleted_at 만 표시한다 (소프트 삭제)
--   · 다른 멤버의 댓글이 연쇄 삭제로 사라지지 않는다
--   · 실행 취소는 deleted_at 을 비우기만 하면 되므로 댓글을 다시 넣을 필요가 없다
-- ---------------------------------------------------------------
alter table public.cards add column if not exists deleted_at timestamptz;
create index if not exists cards_deleted_idx on public.cards (deleted_at) where deleted_at is not null;

-- 소프트 삭제도 활동 기록에 남긴다 (행 삭제용 기록 트리거는 연쇄 삭제용으로 그대로 둔다)
create or replace function public.log_card_soft_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.activity_log (board_id, card_id, user_id, action, payload)
  values (new.board_id, new.id, auth.uid(), 'card_deleted',
          jsonb_build_object('title', new.title, 'column_id', new.column_id));
  return new;
end;
$$;

drop trigger if exists cards_soft_delete_log on public.cards;
create trigger cards_soft_delete_log
  after update of deleted_at on public.cards
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.log_card_soft_delete();

-- ---------------------------------------------------------------
-- 문제 5: 댓글 작성 시각은 새로 쓸 때도 서버가 고정한다
-- ---------------------------------------------------------------
create or replace function public.pin_comment_insert()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists comments_pin_insert on public.comments;
create trigger comments_pin_insert
  before insert on public.comments
  for each row execute function public.pin_comment_insert();

-- ---------------------------------------------------------------
-- 문제 9: 공백만 있는 댓글은 DB 에서도 거절한다 (기존 행은 검사하지 않음)
-- ---------------------------------------------------------------
alter table public.comments add constraint comments_body_not_blank
  check (char_length(btrim(body)) >= 1) not valid;
