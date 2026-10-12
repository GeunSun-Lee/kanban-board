-- 기본 컬럼/라벨은 클라이언트가 보드 생성과 함께 직접 만든다 (낙관적 UI와 ID를 일치시키기 위함).
-- DB 트리거가 같이 만들면 컬럼이 중복 생성되므로 제거한다.
drop trigger if exists boards_default_columns on public.boards;
drop function if exists public.create_default_columns();
