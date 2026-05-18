
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initPerformanceMonitoring } from './monitor';

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Uncaught runtime error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.stack || event.error?.toString(),
  });
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', {
    reason: event.reason?.message || event.reason?.toString(),
    stack: event.reason?.stack,
  });
});

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  initPerformanceMonitoring();
  
  // Log metrics summary on page visibility change
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('⏸️  App backgrounded');
      }
    });
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
