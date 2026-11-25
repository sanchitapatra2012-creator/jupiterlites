import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  override componentDidCatch(error: Error): void {
    console.error('EcoDNA ErrorBoundary caught:', error);
  }

  override render() {
    if (this.state.hasError) {
      let friendlyMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string; path?: string };
        if (parsed.error) {
          friendlyMessage = `Data access error (${parsed.operationType ?? 'operation'} on ${parsed.path ?? 'resource'}): ${parsed.error}`;
        }
      } catch {
        // Plain error message
      }

      return (
        <div className="min-h-screen bg-[#F7FAF9] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h1 className="font-display text-xl font-bold text-[#061B14]">Application Recovery</h1>
            <p className="text-sm text-slate-600 leading-relaxed">{friendlyMessage}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/';
              }}
              className="px-4 py-2 bg-[#061B14] text-white text-sm font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer"
            >
              Return to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
