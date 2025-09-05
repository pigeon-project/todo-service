export type Role = 'admin' | 'writer' | 'reader';

export interface BoardSummary {
  id: string;
  name: string;
  description?: string | null;
  owner: string;
  createdAt: string;
  updatedAt: string;
  myRole: Role;
  membersCount: number;
}

export interface BoardView {
  board: {
    id: string;
    name: string;
    description?: string | null;
    owner: string;
    createdAt: string;
    updatedAt: string;
    myRole: Role;
    membersCount: number;
  };
  columns: Column[];
  cards: Card[];
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  sortKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string | null;
  sortKey: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PaginatedBoards {
  boards: BoardSummary[];
  nextCursor: string | null;
}

