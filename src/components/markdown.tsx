import type { ComponentPropsWithoutRef, ElementType } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** react-markdown이 넘기는 `node` prop이 DOM 속성으로 새지 않도록 제거 */
function clean<T extends object>(props: T): Omit<T, "node"> {
  const copy = { ...props } as Record<string, unknown>;
  delete copy.node;
  return copy as Omit<T, "node">;
}

/** 태그에 클래스를 입힌 컴포넌트를 만든다 */
function styled<K extends ElementType>(Tag: K, className: string) {
  return function Styled(props: ComponentPropsWithoutRef<K>) {
    const Component = Tag as ElementType;
    return <Component className={className} {...clean(props)} />;
  };
}

// 원시 HTML은 렌더링하지 않고(react-markdown 기본값), 위험한 URL 스킴도 자동 제거됨
const components: Components = {
  h1: styled("h3", "mt-2 text-base font-bold"),
  h2: styled("h4", "mt-2 text-sm font-bold"),
  h3: styled("h5", "mt-2 text-sm font-semibold"),
  p: styled("p", "my-1 break-words"),
  ul: styled("ul", "my-1 list-disc pl-5"),
  ol: styled("ol", "my-1 list-decimal pl-5"),
  blockquote: styled("blockquote", "my-1 border-l-4 border-zinc-300 pl-3 text-zinc-500 dark:border-zinc-600"),
  pre: styled("pre", "my-1 overflow-x-auto rounded-md bg-zinc-100 p-2 text-xs dark:bg-zinc-800"),
  code: styled("code", "rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800"),
  table: styled("table", "my-1 border-collapse text-xs"),
  th: styled("th", "border border-zinc-300 px-2 py-1 dark:border-zinc-600"),
  td: styled("td", "border border-zinc-300 px-2 py-1 dark:border-zinc-600"),
  // 외부 이미지는 열람자의 IP/시각을 수집하는 데 쓰일 수 있어 렌더링하지 않는다
  img: ({ alt }) => <span className="text-zinc-400">[이미지{alt ? `: ${alt}` : ""}]</span>,
  a: (props) => (
    <a
      {...clean(props)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline"
    />
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
