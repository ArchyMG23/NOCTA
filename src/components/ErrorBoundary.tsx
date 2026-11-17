import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    let display = error.message || 'Une erreur inattendue est survenue.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; path?: string };
      if (parsed && parsed.error) {
        display = `${parsed.error}${parsed.path ? ` (${parsed.path})` : ''}`;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, message: display };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#100D10] text-[#F4EEF0] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#191217] border border-[#4B1028] rounded-xl p-8 space-y-5">
            <p className="text-xs tracking-[0.18em] uppercase text-[#C5A276]">NOCTA</p>
            <h1 className="font-display text-3xl font-semibold text-[#F4EEF0]">
              Session interrompue / Session interrupted
            </h1>
            <p className="text-sm text-[#B8AAB0] leading-relaxed break-words">
              {this.state.message}
            </p>
            <div className="flex items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => window.location.assign('/')}
                className="px-5 py-2.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                Revenir à l’accueil / Return home
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 border border-[#4B1028] hover:border-[#C5A276] text-[#B8AAB0] hover:text-[#F4EEF0] text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                Recharger / Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
