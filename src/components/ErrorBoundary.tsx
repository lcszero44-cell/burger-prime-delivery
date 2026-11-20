import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Ocorreu um erro inesperado.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMessage =
        'Não foi possível concluir a operação. Recarregue a página ou tente novamente.';
      if (this.state.message.includes('Missing or insufficient permissions')) {
        friendlyMessage =
          'Sem permissão para acessar estes dados no momento. Recarregue a tela ou verifique sua conexão.';
      } else if (this.state.message.includes('Quota exceeded')) {
        friendlyMessage =
          'Limite diário do banco de dados atingido. A cota é renovada automaticamente no próximo dia.';
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF9F7] dark:bg-[#111010] text-[#181615] dark:text-[#F6F4F0]">
          <div className="max-w-md w-full p-6 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.1] space-y-4">
            <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-display text-lg font-bold">
                Algo saiu do esperado
              </h2>
              <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                {friendlyMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="min-h-[44px] px-4 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Recarregar tela</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
