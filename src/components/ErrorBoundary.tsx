import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readableMessage =
      error.message || 'Ocurrió un error inesperado en la aplicación.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        readableMessage = parsed.error;
      }
    } catch {
      // Mensaje en texto plano
    }
    return { hasError: true, errorMessage: readableMessage };
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.hash = '#view-dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh w-full bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#DC2626] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#0F172A]">
                Algo salió mal
              </h2>
              <p className="text-sm text-[#64748B] leading-relaxed break-words">
                {this.state.errorMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recargar Docucloud</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
