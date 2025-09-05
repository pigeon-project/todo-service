import React, { useState } from 'react';
import { Container, Divider, Typography } from '@mui/material';
import BoardList from './components/BoardList';
import NewBoardForm from './components/NewBoardForm';
import BoardView from './components/BoardView';

export default function App() {
  const [boardId, setBoardId] = useState<string | null>(null);

  return (
    <Container sx={{ py: 2 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>TODO Service</Typography>
      {!boardId ? (
        <>
          <NewBoardForm onCreated={setBoardId} />
          <Divider sx={{ my: 2 }} />
          <BoardList onOpen={setBoardId} />
        </>
      ) : (
        <BoardView boardId={boardId} onBack={() => setBoardId(null)} />
      )}
    </Container>
  );
}

