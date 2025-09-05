import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      react: '/src/shims/react.ts',
      'react-dom/client': '/src/shims/react-dom-client.ts',
      'react/jsx-runtime': '/src/shims/react-jsx-runtime.ts',
      '@mui/material': '/src/shims/mui-material.ts',
      '@emotion/react': '/src/shims/emotion-react.ts',
      '@emotion/styled': '/src/shims/emotion-styled.ts',
      '@mui/icons-material': '/src/shims/mui-icons.ts',
    },
  },
  build: {
    sourcemap: false,
  },
});

