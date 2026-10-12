# 보안 체크리스트

공개 배포 전 보안 점검(2026-10-12) 결과를 운영 체크리스트로 정리한 문서입니다.
`[x]` 는 확인 또는 적용이 끝난 항목, `[ ]` 는 대시보드나 로컬에서 직접 해야 하는 항목입니다.

> 이 저장소는 public 입니다. 키, 토큰, 내부 식별자는 이 문서와 코드에 적지 마세요.

## 이미 적용·확인한 것

- [x] 모든 테이블에 RLS 적용, 비로그인(anon) 접근 차단 (마이그레이션 시험으로 확인)
- [x] 초대받은 이메일만 가입 가능 (DB 트리거), 이메일 확인 후에만 멤버 프로필 생성
- [x] 계정이 삭제되면 초대도 함께 삭제되어 같은 이메일로 재가입 불가
- [x] 컬럼·보드 삭제는 관리자만, 카드 삭제는 활동 기록에 남음
- [x] 작성자·작성 시각은 서버가 고정 (위조 불가), 입력 길이·형식은 DB 제약으로 제한
- [x] 보안 헤더 적용 (`X-Frame-Options`, CSP `frame-ancestors`, `nosniff`, Referrer-Policy 등), 운영 응답에서 HSTS 확인
- [x] Supabase 환경변수가 없는 배포 빌드는 실패하도록 가드 (인증 없는 데모 모드로 공개되는 사고 방지)
- [x] Vercel 환경변수는 공개용 2개(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)만 등록, 관리용 토큰·service role 키는 등록하지 않음
- [x] `.env*`, `node_modules`, `.vercel` 은 `.gitignore` 로 제외, 저장소에 비밀 값 없음 확인
- [x] 로그인 오류는 코드로만 전달해 임의 문구가 화면에 나오지 않음, 마크다운의 외부 이미지는 렌더링하지 않음
- [x] `npm audit --omit=dev`: 취약점 0건
- [x] Supabase Auth: 이메일 확인 켜짐, 익명 로그인·전화번호 로그인 꺼짐
- [x] Supabase Auth: Site URL 을 운영 주소로 변경, Redirect URL 은 정확한 경로만 등록 (와일드카드 없음)

## 직접 해야 하는 것

### Supabase 대시보드

- [ ] **관리자 가입 완료**: 초대만 되고 가입 전인 상태가 길수록 이메일 선점 위험이 큽니다. 가장 먼저 가입하세요.
- [ ] `Authentication > Providers > Email`: 최소 비밀번호 길이를 **8자 이상**으로 (현재 6자)
- [ ] 같은 화면에서 **유출 비밀번호 차단(Leaked password protection)** 켜기 (플랜에 따라 제한될 수 있음)
- [ ] `Authentication > Attack Protection`: **CAPTCHA(Turnstile)** 켜기. 초대 이메일 추측과 무차별 가입을 막습니다.
- [ ] `Authentication > SMTP`: Gmail SMTP 설정. 기본 메일은 시간당 발송 한도가 낮아(현재 2건) 팀원 가입이 막힙니다. 앱 비밀번호는 대시보드에만 두세요.
- [ ] `Authentication > Rate Limits`: 값 검토
- [ ] `Authentication > Providers`: Google/GitHub 를 쓰려면 OAuth 앱을 등록한 뒤, **미검증 이메일 계정으로 초대된 이메일에 가입되는지** 테스트
- [ ] `Database > Security Advisor`: RLS 꺼진 테이블, 경고 확인
- [ ] 백업: 무료 플랜은 자동 백업이 없으므로 주기적 `pg_dump` 를 운영 절차에 포함 (삭제 사고 대비)
- [ ] 같은 Supabase 프로젝트를 다른 앱이 쓰고 있다면, 가입 규칙이 바뀐 영향이 없는지 확인

### Vercel 대시보드

- [ ] `Settings > Deployment Protection`: 프리뷰 배포에 Vercel Authentication 이 적용되는지 확인
- [ ] 프리뷰 배포는 운영 DB 를 함께 사용합니다. 프리뷰를 팀 밖에 공유하지 마세요. 프리뷰 주소는 Supabase Redirect URL 에 없으므로 로그인은 되지 않습니다.

### 로컬 / GitHub

- [ ] 프로젝트 폴더의 `.env` 에 있는 **개인 액세스 토큰**(GitHub, Vercel, Supabase 등)을 프로젝트 밖으로 옮기고 최소 권한으로 재발급 (이 앱은 사용하지 않음). 사용하지 않는 API 키는 삭제하세요.
- [ ] 새 의존성을 추가할 때마다 `npm audit`
- [ ] 새 테이블을 만들 때는 RLS 를 켜고 정책을 먼저 작성

## 운영 메모

- **멤버 내보내기**: SQL Editor 에서 `delete from auth.users where email = '...'` 를 실행하면 프로필과 초대가 함께 삭제됩니다.
- **멤버 초대**: 관리자가 `public.invitations` 에 이메일을 추가합니다 (초대 UI 는 아직 없음).
- **관리자 변경**: `select public.set_member_role('<user id>', 'admin' | 'member')`. 마지막 관리자는 강등할 수 없습니다.
- **알려진 한계**: 이메일 확인 전 가입 상태에서 같은 이메일로 먼저 가입해 이메일을 점유하는 경우의 동작은 Supabase 인증 서버에 달려 있어 앱에서 완전히 막을 수 없습니다.
