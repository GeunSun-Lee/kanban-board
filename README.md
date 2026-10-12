# 칸반 보드

팀원끼리 업무 현황을 공유하고 카드 단위로 소통하는 **애자일 칸반 보드**입니다. 스프린트 없이 흐름(Flow)과 WIP 제한 중심으로 운영하는 순수 칸반 방식이며, 초대받은 팀원만 사용할 수 있는 단일 팀용 앱입니다.

> 요구사항과 설계 결정은 [REQUIREMENTS.md](REQUIREMENTS.md)에 정리되어 있습니다.

## 주요 기능

- **보드·컬럼·카드** 관리와 **드래그앤드롭** (카드 이동, 컬럼 순서 변경, 키보드 조작 지원)
- 컬럼별 **WIP 제한** 표시와 초과 경고
- 카드 상세: 담당자, 우선순위, 마감일, **라벨**, **체크리스트**, **마크다운 설명**
- **댓글과 `@멘션`**, 카드·보드 단위 **활동 기록**
- **알림 센터**(담당자 지정·멘션·마감 임박)와 삭제 **실행 취소**
- 검색과 필터(담당자, 우선순위, 라벨, 내 카드만)
- **실시간 동기화**: 다른 팀원의 변경이 새로고침 없이 반영됩니다
- **초대제 가입**(이메일·Google·GitHub): 초대받은 이메일만 가입 가능, 역할은 관리자/멤버

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| 드래그앤드롭 | dnd-kit |
| 백엔드 | Supabase (Postgres, Auth, Realtime) — 모든 권한은 RLS로 강제 |
| 배포 | Vercel |

## 구조

- `src/components/` 화면 컴포넌트, `src/lib/` 상태 저장소와 Supabase 동기화
- `supabase/migrations/` 데이터베이스 스키마와 RLS 정책 (순서대로 적용)
- Supabase 환경변수가 없으면 로그인 없는 **데모 모드**(브라우저 localStorage)로 동작해 바로 체험할 수 있습니다.

## 로컬 개발

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

## 데모 모드

`.env.local`에 Supabase 환경변수가 없으면 **데모 모드**로 동작합니다. 로그인 없이 이 브라우저의 localStorage에 데이터를 저장하므로 Supabase 연결 전에도 UI를 사용할 수 있습니다. 데이터 계층은 `src/lib/demo-store.ts`에 모여 있으며, Supabase 연결 시 이 모듈의 액션을 쿼리로 교체합니다.

## Supabase 설정 (최초 1회)

1. [supabase.com](https://supabase.com)에서 프로젝트 생성 → `Project Settings > API`의 URL/anon key를 `.env.local`에 입력
2. `supabase/migrations/`의 SQL을 **파일명 순서대로 모두** SQL Editor에서 실행 (또는 `npx supabase link` 후 `npx supabase db push`). 현재 4개: `init` → `labels_checklist` → `client_creates_defaults` → `security_hardening`
3. SQL Editor에서 `supabase/seed.sql`의 이메일을 본인 것으로 바꿔 실행 → 최초 관리자 초대
4. `Authentication > Providers`에서 Google, GitHub 활성화 (각 콘솔에서 OAuth 앱 등록, 콜백 URL은 Supabase가 안내하는 값 사용)
5. `Authentication > URL Configuration`
   - Site URL: 배포 주소 (로컬은 `http://localhost:3000`)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://<배포도메인>/auth/callback`
6. 이메일 가입을 쓰려면 `Authentication > SMTP`에 Gmail SMTP를 설정 (기본 제공 SMTP는 시간당 발송 제한이 매우 낮음)

## 초대제 가입

`public.invitations`에 이메일이 있어야만 가입(이메일/소셜 모두)할 수 있습니다. DB 트리거(`enforce_invitation`)가 강제합니다.
멤버 초대는 관리자가 `invitations`에 행을 추가합니다 (초대 UI는 후속 단계).

## 배포 (Vercel)

1. GitHub에 push → Vercel에서 Import
2. 환경변수 등록 (`.env.example` 참고)
3. main 브랜치 머지 시 자동 배포, PR마다 프리뷰 배포

## 보안 운영 메모

- **이메일 확인(Confirm email)을 반드시 켜 두세요.** 가입 후 이메일 확인이 끝나야 멤버(프로필)가 만들어집니다.
- **첫 관리자는 `seed.sql` 실행 직후 바로 가입하세요.** 초대만 되고 가입 전인 시간이 길수록 이메일 선점 위험이 커집니다.
- **멤버 내보내기**: SQL Editor에서 `delete from auth.users where email = '...'` 를 실행하면 프로필과 초대가 함께 삭제되어 같은 이메일로 재가입할 수 없습니다.
- **권한**: 컬럼·보드 삭제는 관리자만 가능합니다(RLS). 일반 멤버의 카드 삭제는 활동 기록에 남습니다.
- **Vercel 환경변수**는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`만 등록하세요. 값이 없으면 빌드가 실패하도록 막아 두었습니다(인증 없는 데모 모드로 공개되는 사고 방지).
- `service_role` 키, 개인 액세스 토큰(GitHub/Vercel/Supabase)은 앱에 필요하지 않으니 프로젝트 폴더의 `.env`에 두지 마세요.
- 새 테이블을 만들 때는 반드시 RLS를 켜고 정책을 추가하세요.
