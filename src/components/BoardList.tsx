import React, { useEffect, useState } from 'react';
import { listBoards, createBoard } from '../api/boards';
import type { Board } from '../types';

interface Props { onOpen(boardId: string): void }

export function BoardList({ onOpen }: Props) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => { (async () => {
    try { const data = await listBoards(); setBoards(data.boards); }
    catch (e: any) { setError(e?.message ?? 'Failed to load'); }
    finally { setLoading(false); }
  })(); }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!name.trim()) return;
    const b = await createBoard(name.trim(), description || null);
    setBoards([b, ...boards]); setName(''); setDescription('');
  };

  return (
    <div>
      <form onSubmit={onCreate}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Board name" />
        <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description" />
        <button type="submit">Create</button>
      </form>
      {loading ? 'Loading…' : error ? error : (
        <ul>
          {boards.map(b => (
            <li key={b.id}><button onClick={() => onOpen(b.id)}>{b.name}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

