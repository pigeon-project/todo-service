import { useState } from 'react';
import { Box, Container, CssBaseline, Divider, ThemeProvider, Typography, createTheme } from '@mui/material';
import { BoardList } from './components/BoardList';
import { BoardView } from './components/BoardView';

const theme = createTheme();

export default function App() {
  const [boardId, setBoardId] = useState<string | null>(null);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ py: 2 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>TODO Service</Typography>
        <Divider sx={{ mb: 2 }} />
        <Box>
          {boardId ? (
            <BoardView boardId={boardId} onBack={() => setBoardId(null)} />
          ) : (
            <BoardList onOpen={(id) => setBoardId(id)} />
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

