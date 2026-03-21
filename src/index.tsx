import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './lib/theme-context';
import { Toaster } from './components/ui/toast';
import './styles.css';
import './styles/generated.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <App />
          <Toaster />
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
