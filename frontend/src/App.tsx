import { CssBaseline } from '@mui/material';
import { useState } from 'react';
import { BoardList } from './components/BoardList';
import { BoardView } from './components/BoardView';

export default function App() {
  const [boardId, setBoardId] = useState<string | null>(null);
  return (
    <>
      <CssBaseline />
      {boardId ? <BoardView boardId={boardId} onBack={() => setBoardId(null)} /> : <BoardList onOpen={setBoardId} />}
    </>
  );
}

