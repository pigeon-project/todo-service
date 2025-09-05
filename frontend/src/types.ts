export type Role = 'admin' | 'writer' | 'reader';

export interface BoardSummary {
  id: string;
  name: string;
  description: string | null;
  owner: string;
  createdAt: string;
  updatedAt: string;
  myRole: Role;
  membersCount: number;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  sortKey: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Card {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  sortKey: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BoardViewData {
  board: BoardSummary;
  columns: Column[];
  cards: Card[];
}

