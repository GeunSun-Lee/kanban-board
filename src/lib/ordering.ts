import { generateKeyBetween } from "fractional-indexing";

/**
 * 순서값(position) 기준 정렬. 값이 같으면 id 로 순서를 정해 브라우저마다 같은 순서로 보이게 한다.
 */
export function byPosition<T extends { id: string; position: string }>(a: T, b: T): number {
  if (a.position < b.position) return -1;
  if (a.position > b.position) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * `others`(옮기는 항목을 뺀 목록) 안에서 toIndex 위치에 들어갈 새 순서값을 만든다.
 * 두 팀원이 동시에 항목을 추가해 같은 순서값이 생겼거나 앞뒤가 뒤집힌 경우에도 오류 없이 동작하도록,
 * 앞 이웃보다 크지 않은 뒤 이웃은 건너뛰고 그다음 이웃과의 사이에 끼워 넣는다.
 */
export function keyAmong(others: { position: string }[], toIndex: number): string {
  const before = others[toIndex - 1]?.position ?? null;
  let j = toIndex;
  while (before !== null && j < others.length && others[j].position <= before) j++;
  return generateKeyBetween(before, others[j]?.position ?? null);
}
