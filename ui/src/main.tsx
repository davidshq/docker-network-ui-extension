import React from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import App from './App'

const theme = createTheme({
  palette: { mode: 'light' }
})

// Add error boundary and logging
try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  console.log('Initializing Docker Networks UI extension...');
  
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
  
  console.log('Docker Networks UI extension initialized successfully');
} catch (error) {
  console.error('Failed to initialize extension:', error);
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif;">
        <h2>Extension Initialization Error</h2>
        <p>${error instanceof Error ? error.message : String(error)}</p>
        <p>Check the browser console for more details.</p>
      </div>
    `;
  }
}
