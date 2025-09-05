import { useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme, Container, Box } from '@mui/material';
import BoardList from './components/BoardList';
import BoardView from './components/BoardView';

export default function App() {
  const [boardId, setBoardId] = useState<string | null>(null);
  const theme = createTheme();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="xl">
        <Box sx={{ my: 2 }}>
          {boardId ? (
            <BoardView boardId={boardId} onBack={() => setBoardId(null)} />
          ) : (
            <BoardList onOpenBoard={setBoardId} />
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

