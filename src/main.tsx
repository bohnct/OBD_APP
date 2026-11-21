import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/archivo/latin-600.css';
import '@fontsource/archivo/latin-700.css';
import '@fontsource/archivo/latin-800.css';
import '@fontsource/archivo-narrow/latin-600.css';
import '@fontsource/archivo-narrow/latin-700.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import { App } from './App';
import './ui/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
