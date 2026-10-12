export type Priority = "low" | "medium" | "high" | "urgent";

export const PRIORITIES: { value: Priority; label: string; className: string }[] = [
  { value: "low", label: "낮음", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
  { value: "medium", label: "보통", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  { value: "high", label: "높음", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { value: "urgent", label: "긴급", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
];

export type LabelColor = "red" | "orange" | "amber" | "green" | "teal" | "blue" | "violet" | "pink";

/** Tailwind가 클래스를 감지할 수 있도록 전체 문자열로 나열 */
export const LABEL_COLORS: { value: LabelColor; name: string; className: string; dot: string }[] = [
  { value: "red", name: "빨강", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", dot: "bg-red-500" },
  { value: "orange", name: "주황", className: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300", dot: "bg-orange-500" },
  { value: "amber", name: "노랑", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", dot: "bg-amber-500" },
  { value: "green", name: "초록", className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300", dot: "bg-green-500" },
  { value: "teal", name: "청록", className: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300", dot: "bg-teal-500" },
  { value: "blue", name: "파랑", className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300", dot: "bg-blue-500" },
  { value: "violet", name: "보라", className: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300", dot: "bg-violet-500" },
  { value: "pink", name: "분홍", className: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300", dot: "bg-pink-500" },
];

export interface Member {
  id: string;
  name: string;
}

export interface Board {
  id: string;
  name: string;
  archived: boolean;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  /** fractional-indexing 키 */
  position: string;
  wipLimit: number | null;
}

export interface Label {
  id: string;
  boardId: string;
  name: string;
  color: LabelColor;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Card {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  /** fractional-indexing 키 */
  position: string;
  priority: Priority;
  /** YYYY-MM-DD */
  dueDate: string | null;
  assigneeIds: string[];
  labelIds: string[];
  checklist: ChecklistItem[];
  createdAt: string;
}

export interface Comment {
  id: string;
  cardId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export type ActivityAction = "card_created" | "card_moved" | "card_deleted" | "assigned" | "comment_added";

/** 카드/제목은 삭제 후에도 표시할 수 있도록 스냅샷으로 저장 */
export interface Activity {
  id: string;
  boardId: string;
  cardId: string;
  cardTitle: string;
  userId: string;
  action: ActivityAction;
  /** 이동: "From → To", 담당: 담당자 이름, 댓글: 앞부분 미리보기 */
  detail: string | null;
  createdAt: string;
}

export type NotificationType = "assigned" | "mention" | "due_soon";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  boardId: string;
  cardId: string;
  cardTitle: string;
  actorId: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationPrefs {
  emailMention: boolean;
  emailAssigned: boolean;
  emailDue: boolean;
}

export interface AppState {
  me: string;
  /** 내가 관리자인지 (컬럼/보드 삭제 가능 여부; 실제 권한은 RLS가 강제) */
  isAdmin: boolean;
  members: Member[];
  boards: Board[];
  columns: Column[];
  labels: Label[];
  cards: Card[];
  comments: Comment[];
  activity: Activity[];
  notifications: Notification[];
  prefs: NotificationPrefs;
}
