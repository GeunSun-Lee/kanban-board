# Kanban Board 요구사항 정의서

팀 내 소통·업무 현황 공유를 위한 애자일 칸반 보드. Supabase(백엔드) + Vercel(배포).

> 상태: v1.0 — 구현 현황 반영 (2026-10-12). 요구사항별 구현 상태는 10절, 알려진 한계는 11절 참고

## 1. 목적과 범위

- **목적**: 팀원이 업무 상태를 한눈에 공유하고, 카드 단위로 소통(댓글/멘션)한다.
- **사용자**: 단일 팀(가정: 5~30명). 외부 공개 서비스가 아니라 팀 내부용.
- **방식**: 스프린트 없는 **순수 칸반**(지속적 플로우, WIP 제한 중심).
- **언어**: 한국어 전용.
- **범위(MVP)**: 보드/컬럼/카드 관리, 드래그앤드롭, 댓글, 담당자, 실시간 동기화, 소셜 로그인, 이메일 알림.
- **범위 밖**: 스프린트/번다운, 멀티팀, 다국어, 외부 연동(Slack/GitHub), 모바일 앱, 자동화 규칙.

## 2. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프론트엔드 | Next.js (App Router) + TypeScript | 선호 없음 → Vercel과 궁합 최적인 Next.js로 확정 |
| 이메일 발송 | Gmail SMTP(앱 비밀번호) + nodemailer, Vercel 서버 라우트에서 발송 | 도메인이 없어 Resend 사용 불가(테스트 주소는 본인에게만 발송). Gmail 하루 500통 한도 |
| 스타일 | Tailwind CSS (+ shadcn/ui) | |
| 드래그앤드롭 | dnd-kit | 접근성(키보드) 지원 |
| 백엔드/DB | Supabase (Postgres) | |
| 인증 | Supabase Auth | 이메일/OAuth |
| 실시간 | Supabase Realtime | 카드 이동·댓글 즉시 반영 |
| 파일 | Supabase Storage | 카드 첨부 |
| 배포 | Vercel + Supabase 호스팅 | Git 연동 자동 배포, PR 프리뷰 |

## 3. 기능 요구사항

우선순위: **P0** = MVP 필수, **P1** = 1차 이후, **P2** = 추후

### 3.1 인증 / 팀
| ID | 요구사항 | 우선순위 |
|---|---|---|
| AUTH-1 | 이메일 로그인/가입 (Supabase Auth) | P0 |
| AUTH-2 | 소셜 로그인 (Google, GitHub) | P0 |
| AUTH-3 | 단일 팀 구조. **초대받은 이메일만 가입 가능**, 그 외 가입자는 차단(DB 트리거/훅으로 강제) | P0 |
| AUTH-4 | 역할: Admin / Member (Viewer는 필요 시) | P1 |

### 3.2 보드 / 컬럼
| ID | 요구사항 | 우선순위 |
|---|---|---|
| BOARD-1 | 보드 생성·수정·삭제·보관(archive) | P0 |
| BOARD-2 | 기본 컬럼 제공: Backlog / To Do / In Progress / Review / Done | P0 |
| BOARD-3 | 컬럼 추가·이름변경·순서변경·삭제 | P0 |
| BOARD-4 | 컬럼별 WIP 제한(초과 시 경고) — 순수 칸반 핵심 원칙 | P0 |
| BOARD-5 | 스윔레인(담당자/우선순위별 가로 그룹) | P2 |

### 3.3 카드
| ID | 요구사항 | 우선순위 |
|---|---|---|
| CARD-1 | 카드 생성·수정·삭제 (제목, 설명 마크다운) | P0 |
| CARD-2 | 드래그앤드롭으로 컬럼 간/컬럼 내 이동 및 순서 유지 | P0 |
| CARD-3 | 담당자 지정(복수 가능) | P0 |
| CARD-4 | 우선순위(Low/Medium/High/Urgent), 마감일 | P0 |
| CARD-5 | 라벨(색상 태그) | P1 |
| CARD-6 | 체크리스트(서브태스크) | P1 |
| CARD-7 | 예상 시간(선택) — 스토리 포인트는 스프린트 제외로 미포함 | P2 |
| CARD-8 | 파일 첨부 (Supabase Storage) | P1 |
| CARD-9 | 카드 변경 이력(활동 로그) | P1 |

### 3.4 소통 (핵심 목적)
| ID | 요구사항 | 우선순위 |
|---|---|---|
| COMM-1 | 카드별 댓글 작성·수정·삭제 | P0 |
| COMM-2 | `@멘션`으로 팀원 호출 | P1 |
| COMM-3 | 멘션/담당자 지정/마감 임박 알림 (앱 내 알림 센터) | P1 |
| COMM-4 | 이메일 알림: 멘션, 담당자 지정, 마감 임박(하루 전) 시 발송. 사용자별 수신 on/off 설정 | P1 |
| COMM-5 | 보드 단위 활동 피드("누가 무엇을 옮겼는지") | P1 |
| COMM-6 | 댓글 이모지 반응 | P2 |

### 3.5 실시간 협업
| ID | 요구사항 | 우선순위 |
|---|---|---|
| RT-1 | 다른 사람이 카드 이동/수정/댓글 시 새로고침 없이 반영 | P0 |
| RT-2 | 현재 보드를 보고 있는 접속자 표시(Presence) | P2 |
| RT-3 | 동시 수정 충돌 시 마지막 쓰기 우선 + 이동 순서 일관성 보장 | P0 |

### 3.6 칸반 메트릭 (스프린트 기능은 제외)
| ID | 요구사항 | 우선순위 |
|---|---|---|
| FLOW-1 | 사이클 타임 / 리드 타임 측정 (컬럼 이동 이력 기반) | P2 |
| FLOW-2 | 누적 흐름도(CFD), 컬럼별 카드 수 추이 | P2 |

### 3.7 검색 / 필터
| ID | 요구사항 | 우선순위 |
|---|---|---|
| FIND-1 | 담당자·라벨·우선순위·마감일 필터 | P0 |
| FIND-2 | 제목/설명 키워드 검색 | P1 |
| FIND-3 | "내 카드만 보기" 토글 | P0 |

## 4. 비기능 요구사항

| 항목 | 요구사항 |
|---|---|
| 성능 | 보드 초기 로딩 < 2초(카드 500개 기준), 카드 이동은 낙관적 업데이트로 즉각 반응 |
| 보안 | **모든 테이블에 RLS(Row Level Security) 적용**, 팀 멤버만 해당 보드 접근. 서비스 롤 키는 서버 전용, 클라이언트 노출 금지 |
| 권한 | 역할(Owner/Admin/Member/Viewer)별 쓰기 권한을 RLS 정책으로 강제 |
| 반응형 | 데스크톱 우선, 태블릿/모바일에서 열람·간단 수정 가능 |
| 접근성 | 키보드로 카드 이동, 적절한 aria 속성 |
| 언어 | 한국어 전용 (i18n 미적용, 문자열은 한 곳에 모아 추후 확장 여지만 둠) |
| 무료 플랜 제약 | Supabase Free: DB 500MB, Storage 1GB, 7일 비활동 시 프로젝트 일시정지, 자동 백업 없음, Realtime 동시접속 제한. Vercel Hobby: 비상업적 용도 한정, 서버리스 실행 시간 제한. Gmail SMTP: 하루 500통 |
| 가용성 | Vercel/Supabase 관리형 서비스 SLA에 의존 |
| 관측성 | 에러 로깅(Vercel Logs, 필요 시 Sentry) |

## 5. 데이터 모델 (초안)

```
profiles        (id = auth.users.id, name, avatar_url)
members         (user_id, role, invited_by)   -- 단일 팀이라 teams 테이블 없음
boards          (id, name, archived)
columns         (id, board_id, name, position, wip_limit)
cards           (id, column_id, board_id, title, description, position,
                 priority, due_date, created_by)
card_assignees  (card_id, user_id)
labels          (id, board_id, name, color)
card_labels     (card_id, label_id)
checklist_items (id, card_id, text, done, position)
comments        (id, card_id, user_id, body, created_at, updated_at)
attachments     (id, card_id, path, name, size)
activity_log    (id, board_id, card_id, user_id, action, payload, created_at)
notifications   (id, user_id, type, ref_id, read, emailed_at, created_at)
notification_prefs (user_id, email_mention, email_assigned, email_due)
```

- **카드 순서(position)**: 정수 재배열 대신 fractional indexing(예: LexoRank 방식 문자열)으로 이동 시 단일 행만 갱신.
- 모든 테이블 `created_at` / `updated_at` 포함, 삭제는 필요 시 soft delete.

## 6. 배포 / 운영

- **환경**: `local` / `preview`(PR별 Vercel 프리뷰) / `production`
- **Supabase**: 환경별 프로젝트 분리(최소 dev / prod). 스키마는 `supabase/migrations`로 버전 관리(Supabase CLI).
- **환경변수** (Vercel에 등록): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 두 개뿐입니다. 현재 앱은 서버 전용 키(`SUPABASE_SERVICE_ROLE_KEY` 등)를 쓰지 않으므로 등록하지 않으며, 값이 없으면 배포 빌드가 실패하도록 막아 두었습니다. 이메일 알림(M5)을 붙일 때 서버 전용 값이 추가됩니다.
- **CI/CD**: GitHub 저장소와 Vercel 프로젝트가 연결되어 `main` push 시 자동으로 프로덕션 배포됩니다. 다른 브랜치는 프리뷰로 배포되며 운영 DB 를 함께 쓰고, Supabase Redirect URL 에 프리뷰 주소가 없어 로그인은 되지 않습니다. 마이그레이션은 아직 자동화하지 않았고 SQL Editor 또는 Supabase CLI 로 수동 적용합니다.
- **백업**: Free 플랜은 자동 백업이 없으므로 주기적 `pg_dump`(GitHub Actions 스케줄 등) 수동 백업을 운영 절차에 포함.
- **일시정지 방지**: 7일 비활동 시 정지되므로 주기적 헬스체크(Vercel Cron 또는 GitHub Actions) 고려.
- **Vercel Hobby 약관**: 팀 내부 비상업적 사용이면 가능, 회사 업무용이면 Pro 필요 여부 확인.

## 7. 마일스톤 현황

1. **M1 기반** ✅: Next.js 세팅, Supabase 연결, 인증, 초대제 가입
2. **M2 보드** ✅: 보드/컬럼/카드 CRUD + 드래그앤드롭 + RLS
3. **M3 소통** 🟡: 댓글, 담당자, 필터, 실시간 동기화, WIP 제한 — 구현 완료, 로그인한 상태의 종단 간 검증은 남아 있음
4. **M4 배포** 🟡: Vercel 배포와 GitHub 자동 배포는 완료, 팀 온보딩(관리자 가입, 멤버 초대, SMTP, 소셜 로그인 설정)은 남아 있음
5. **M5 알림** ⬜: 이메일 알림(Gmail SMTP), 멘션·마감 임박 알림의 서버 생성 — 앱 내 알림 UI 와 담당자 지정 알림은 구현됨
6. **이후**: 첨부, 칸반 메트릭, 멤버·초대 관리 화면

범례: ✅ 완료, 🟡 일부 완료, ⬜ 미착수

## 8. 확정된 결정

| # | 항목 | 결정 |
|---|---|---|
| 1 | 팀 구조 | 단일 팀 |
| 2 | 로그인 | 이메일 + 소셜 로그인 |
| 3 | 알림 | 앱 내 + 이메일 |
| 4 | 방식 | 순수 칸반 (스프린트 제외) |
| 5 | 언어 | 한국어 전용 |
| 6 | 요금제 | Supabase / Vercel 무료 플랜 |
| 7 | 프레임워크 | 선호 없음 → Next.js |
| 8 | 소셜 로그인 | Google, GitHub |
| 9 | 용도 | 비상업적 → Vercel Hobby 사용 가능 |
| 10 | 이메일 발송 | 도메인 없음 → Gmail SMTP |
| 11 | 가입 제한 | 초대받은 이메일만 가입 (아래 가정 참고) |

## 9. 결정 후속 / 남은 확인 사항

1. **가입 제한**: "초대받은 이메일만 가입 가능"으로 확정했습니다. 이메일 확인이 끝난 뒤에만 멤버가 만들어집니다.
2. **Gmail 발송 계정**: 알림 발신용 Gmail 계정 1개(2단계 인증 + 앱 비밀번호)가 필요합니다. 개인 계정 대신 전용 계정을 권장하며, 스팸함으로 갈 수 있습니다. (M5 착수 전 필요)
3. **소셜 로그인 앱 등록**: Google Cloud Console(OAuth 클라이언트)과 GitHub(OAuth App) 등록이 필요하며, 콜백 URL 은 Supabase 가 안내하는 값을 씁니다. 현재 Provider 는 꺼져 있습니다.
4. **소셜 로그인과 초대 연동**: 소셜 계정 이메일이 초대 목록과 일치해야 가입됩니다. GitHub 는 비공개 이메일 설정 시 이메일을 못 가져올 수 있어 확인이 필요합니다.
5. **보안 체크리스트**: 대시보드에서 직접 해야 하는 설정은 [docs/SECURITY-CHECKLIST.md](docs/SECURITY-CHECKLIST.md) 에 정리했습니다.

## 10. 구현 현황 (요구사항별)

"구현"은 코드 작성과 빌드 확인을 뜻합니다. 로그인한 사용자로 실제 화면에서 끝까지 확인한 항목은 아직 없으므로, 아래 표의 구현 항목은 첫 사용 테스트에서 검증이 필요합니다. DB 계층(RLS, 트리거, 가입 제한)은 롤백되는 트랜잭션에서 시험해 확인했습니다.

| ID | 상태 | 비고 |
|---|---|---|
| AUTH-1 이메일 로그인 | 구현 | 이메일 확인 필수 |
| AUTH-2 소셜 로그인 | 코드만 구현 | Google/GitHub Provider 미설정 |
| AUTH-3 초대제 가입 | 구현·DB 시험 확인 | 초대 추가·멤버 제거는 SQL 로만 가능 |
| AUTH-4 역할 | 구현 | 관리자/멤버, 역할 변경은 SQL 함수로만 가능 (UI 없음) |
| BOARD-1 보드 | 구현 | 보관(archive) UI 없음 |
| BOARD-2~4 컬럼, WIP 제한 | 구현 | 컬럼 삭제는 관리자만 |
| BOARD-5 스윔레인 | 미구현 | |
| CARD-1~4 카드, 담당자, 우선순위, 마감일 | 구현 | 설명은 마크다운 렌더링 |
| CARD-5 라벨, CARD-6 체크리스트 | 구현 | |
| CARD-7 예상 시간, CARD-8 첨부 | 미구현 | |
| CARD-9 변경 이력 | 일부 | 생성·이동·삭제·담당자·댓글 기록만 (필드 변경 이력 없음) |
| COMM-1 댓글 | 구현 | 수정 UI 없음, 삭제 가능 |
| COMM-2 멘션 | 일부 | 자동완성과 강조 표시만, 멘션 알림은 생성하지 않음 |
| COMM-3 앱 내 알림 | 일부 | 담당자 지정 알림만 서버(DB 트리거)에서 생성, 멘션·마감 임박은 M5 |
| COMM-4 이메일 알림 | 미구현 | M5, 수신 설정은 저장됨 |
| COMM-5 활동 피드 | 구현 | 보드 패널과 카드별 기록 |
| COMM-6 이모지 반응 | 미구현 | |
| RT-1 실시간 반영 | 구현 | 변경 이벤트를 받으면 서버 상태를 다시 읽는 방식 |
| RT-2 접속자 표시 | 미구현 | |
| RT-3 동시 수정 | 구현 | 마지막 쓰기 우선, 카드 순서는 fractional indexing |
| FLOW-1~2 사이클 타임, CFD | 미구현 | 이동 기록은 쌓고 있음 |
| FIND-1~3 필터, 검색, 내 카드만 | 구현 | 필터 중에는 이동 비활성 |

추가로 구현한 것: 삭제 실행 취소 토스트, 알림 센터, 이메일 알림 수신 설정, 로컬 데모 모드(Supabase 환경변수가 없을 때).

## 11. 알려진 한계

- **종단 간 검증 부족**: 로그인 후 화면(보드 생성, 드래그앤드롭, 댓글, 실시간 반영)은 실제 계정으로 확인하지 못했습니다.
- **전체 조회 방식**: 로그인 때와 변경 이벤트마다 모든 데이터를 다시 읽습니다. 소규모 팀에는 충분하지만, 한 테이블이 1,000행(기본 조회 상한)을 넘으면 잘립니다.
- **관리 화면 없음**: 멤버 초대·제거, 역할 변경, 보드 보관은 SQL 로만 가능합니다.
- **무료 플랜**: Supabase 는 비활동 7일 후 일시정지되고 자동 백업이 없습니다. 보안 체크리스트의 백업 항목을 참고하세요.
- **프리뷰 배포**: 운영 DB 를 함께 쓰고 Redirect URL 에 없어 로그인되지 않습니다.
