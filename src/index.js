import React, { Suspense } from 'react';
import RouteMetadata from './components/RouteMetadata';
import RouteBoundary from './components/RouteBoundary';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import App from './App';
import ThemeProvider from './ThemeProvider';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider />
        <RouteMetadata />
        <RouteBoundary><Suspense fallback={<main className="app-shell" role="status">Loading page…</main>}><App /></Suspense></RouteBoundary>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
