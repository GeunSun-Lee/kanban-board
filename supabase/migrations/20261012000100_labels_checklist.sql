-- 라벨 / 체크리스트 (P1)

create table public.labels (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 30),
  color      text not null check (color in ('red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink')),
  created_at timestamptz not null default now()
);
create index labels_board_idx on public.labels (board_id);

create table public.card_labels (
  card_id  uuid not null references public.cards (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (card_id, label_id)
);
create index card_labels_label_idx on public.card_labels (label_id);

create table public.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.cards (id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 200),
  done       boolean not null default false,
  position   text not null collate "C",
  created_at timestamptz not null default now()
);
create index checklist_items_card_idx on public.checklist_items (card_id, position);

alter table public.labels          enable row level security;
alter table public.card_labels     enable row level security;
alter table public.checklist_items enable row level security;

create policy labels_all on public.labels
  for all to authenticated using (public.is_member()) with check (public.is_member());
create policy card_labels_all on public.card_labels
  for all to authenticated using (public.is_member()) with check (public.is_member());
create policy checklist_items_all on public.checklist_items
  for all to authenticated using (public.is_member()) with check (public.is_member());

revoke all on public.labels, public.card_labels, public.checklist_items from anon;

alter publication supabase_realtime add table
  public.labels, public.card_labels, public.checklist_items;
