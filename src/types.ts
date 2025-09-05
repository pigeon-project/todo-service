export type ID = string;

export interface Board {
  id: ID;
  name: string;
  description: string | null;
  owner: string;
  createdAt: string;
  updatedAt: string;
  myRole: 'admin' | 'writer' | 'reader';
  membersCount: number;
}

export interface Column {
  id: ID;
  boardId: ID;
  name: string;
  sortKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: ID;
  boardId: ID;
  columnId: ID;
  title: string;
  description: string | null;
  sortKey: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Invitation {
  id: ID;
  boardId: ID;
  email: string | null;
  role: 'admin' | 'writer' | 'reader';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  token: string;
}

