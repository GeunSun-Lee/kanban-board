export interface MentionSegment {
  text: string;
  mention: boolean;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 댓글 본문을 "일반 글자"와 "멘션" 조각으로 나눈다.
 * 멘션은 `@` 앞이 처음이거나 공백이고, 뒤에 팀원 이름이 **정확히** 이어진 뒤
 * 끝이거나 공백·문장부호가 올 때만 인정한다. (예: 이름이 "나"일 때 "@나머지"는 멘션이 아님)
 */
export function splitMentions(body: string, names: string[]): MentionSegment[] {
  const sorted = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return [{ text: body, mention: false }];

  const re = new RegExp(`(^|\\s)(@(?:${sorted.map(escapeRegExp).join("|")}))(?=$|[\\s.,!?…:;)\\]])`, "g");
  const out: MentionSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const start = m.index + m[1].length;
    if (start > last) out.push({ text: body.slice(last, start), mention: false });
    out.push({ text: m[2], mention: true });
    last = start + m[2].length;
  }
  if (last < body.length) out.push({ text: body.slice(last), mention: false });
  return out;
}
