export type Role = 'admin' | 'writer' | 'reader';

export interface BoardSummary {
  id: string;
  name: string;
  description?: string | null;
  owner?: string;
  myRole: Role;
  createdAt?: string;
  updatedAt?: string;
  membersCount?: number;
}

export interface ColumnDTO {
  id: string;
  boardId: string;
  name: string;
  sortKey: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CardDTO {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string | null;
  sortKey: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BoardViewResponse {
  board: BoardSummary;
  columns: ColumnDTO[];
  cards: CardDTO[];
}

export interface BoardsListResponse {
  boards: BoardSummary[];
  nextCursor: string | null;
}

