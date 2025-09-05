const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 8000;

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath, { index: false }));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PigeonToDoApp running at http://localhost:${PORT}`);
});

