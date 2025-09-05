import React, { useMemo, useState } from 'react';
import type { Column, Card } from '../types';
import { useBoard } from '../state/useBoard';

interface Props { boardId: string; onBack(): void }

export function BoardView({ boardId, onBack }: Props) {
  const { state, addColumn, addCard, moveCardTo } = useBoard(boardId);
  const [colName, setColName] = useState('');
  const cardsByCol = useMemo(() => {
    const m = new Map<string, Card[]>();
    for (const c of state.cards) { const a = m.get(c.columnId) || []; a.push(c); m.set(c.columnId, a); }
    for (const [k, v] of m) v.sort((a,b)=> a.sortKey.localeCompare(b.sortKey) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return m;
  }, [state.cards]);
  const onAddCol = async (e: React.FormEvent) => { e.preventDefault(); if (!colName.trim()) return; await addColumn(colName.trim()); setColName(''); };
  return (
    <div>
      <button onClick={onBack}>Back</button>
      <form onSubmit={onAddCol}><input value={colName} onChange={e=>setColName(e.target.value)} placeholder="New column" /><button type="submit">Add</button></form>
      <div style={{ display:'flex', gap:12 }}>
        {state.columns.map(col => (
          <Column key={col.id} column={col} cards={cardsByCol.get(col.id)||[]} onAdd={t=>addCard(col.id, t)} onMove={(id,i)=>moveCardTo(id, col.id, null, null, (state.cards.find(c=>c.id===id)?.version)||0)} />
        ))}
      </div>
    </div>
  );
}

function Column({ column, cards, onAdd, onMove }: { column: Column; cards: Card[]; onAdd(title: string): void; onMove(cardId: string, toIndex: number): void }) {
  const [title, setTitle] = useState('');
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!title.trim()) return; onAdd(title.trim()); setTitle(''); };
  return (
    <div>
      <strong>{column.name}</strong>
      <div>
        {cards.map((c, i) => (
          <div key={c.id}>
            {c.title} <button onClick={()=>onMove(c.id, Math.max(0, i-1))}>▲</button> <button onClick={()=>onMove(c.id, Math.min(cards.length-1, i+1))}>▼</button>
          </div>
        ))}
      </div>
      <form onSubmit={submit}><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="New card" /><button type="submit">Add</button></form>
    </div>
  );
}

