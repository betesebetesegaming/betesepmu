
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-lg w-full border-t-8 border-red-600">
            <h1 className="text-3xl font-black text-red-600 mb-4 uppercase">System Maintenance</h1>
            <p className="text-gray-700 mb-6 font-medium">
              We've encountered a critical interface error. This is usually caused by outdated browser data or a backend sync issue.
            </p>
            <div className="bg-gray-100 p-4 rounded-lg mb-6 overflow-auto max-h-40">
                <code className="text-xs text-red-800 font-mono italic">
                    {this.state.error?.message || "Unknown Runtime Error"}
                </code>
            </div>
            <div className="space-y-3">
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition-all shadow-lg uppercase tracking-wider"
                >
                    Refresh Terminal
                </button>
                <button 
                  onClick={() => {
                      localStorage.clear();
                      window.location.reload();
                  }}
                  className="w-full bg-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-300 transition-all text-sm uppercase"
                >
                    Clear Local Cache & Reset
                </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
