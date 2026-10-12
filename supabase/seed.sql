-- 최초 관리자 초대 (가입 전에 한 번 실행). 이메일을 본인 것으로 교체하세요.
-- Supabase Dashboard > SQL Editor 에서 실행합니다.
insert into public.invitations (email, role)
values (lower('admin@example.com'), 'admin')
on conflict (email) do update set role = excluded.role;
