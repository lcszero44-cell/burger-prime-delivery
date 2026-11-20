import type { CashClosingSummary, StoreConfig } from '../types/order';
import { formatBRL } from '../utils/formatters';

interface ThermalCashClosingTicketProps {
  summary: CashClosingSummary;
  store: StoreConfig;
  paperWidth: '80mm' | '58mm';
  previewMode?: boolean;
}

function formatDateTime(ms: number): string {
  try {
    return new Date(ms).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function ClosingContent({
  summary,
  store,
  paperWidth,
  previewMode,
}: ThermalCashClosingTicketProps) {
  const is58 = paperWidth === '58mm';

  return (
    <div
      className={`thermal-ticket-copy bg-white text-black font-mono leading-snug ${
        previewMode
          ? is58
            ? 'w-[240px] p-3 text-[11px] border border-dashed border-neutral-400 shadow-sm'
            : 'w-[302px] p-4 text-[12px] border border-dashed border-neutral-400 shadow-sm'
          : is58
            ? 'w-[58mm] px-[2mm] py-[3mm] text-[10.5px]'
            : 'w-[80mm] px-[3mm] py-[4mm] text-[12px]'
      }`}
    >
      {/* Header */}
      <div className="text-center border-b-2 border-black pb-2">
        <div className="text-[15px] font-bold uppercase tracking-tight">
          {store.nome}
        </div>
        <div className="mt-1 inline-block border-2 border-black px-2 py-0.5 text-[12px] font-bold uppercase">
          FECHAMENTO DE CAIXA
        </div>
        <div className="text-[11px] font-bold mt-1.5">
          PERIODO: {summary.periodLabel}
        </div>
        <div className="text-[10px] mt-0.5 tabular-nums">
          EMITIDO: {formatDateTime(summary.printedAtMs)}
        </div>
      </div>

      {/* Main Revenue Highlight */}
      <div className="mt-2.5 border-2 border-black bg-black text-white px-2 py-2 text-center">
        <div className="text-[10px] font-bold uppercase">
          FATURAMENTO TOTAL
        </div>
        <div className="text-[18px] font-bold tabular-nums mt-0.5">
          {formatBRL(summary.totalRevenue)}
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-2.5 border-b border-dashed border-black pb-2 space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span>CONCLUIDOS (R$):</span>
          <span className="font-bold tabular-nums">
            {formatBRL(summary.completedRevenue)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>TICKET MEDIO:</span>
          <span className="font-bold tabular-nums">
            {formatBRL(summary.averageTicket)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>TAXAS DE ENTREGA:</span>
          <span className="tabular-nums">
            {formatBRL(summary.deliveryFeesTotal)}
          </span>
        </div>
      </div>

      {/* Order Counts */}
      <div className="mt-2.5 border-b border-dashed border-black pb-2 space-y-1 text-[11px]">
        <div className="font-bold uppercase text-[11px] mb-1">
          QUANTIDADE DE PEDIDOS
        </div>
        <div className="flex justify-between">
          <span>Pedidos validos:</span>
          <span className="font-bold tabular-nums">
            {summary.validOrdersCount}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Concluidos:</span>
          <span className="font-bold tabular-nums">
            {summary.completedOrdersCount}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Em andamento:</span>
          <span className="tabular-nums">{summary.inProgressOrdersCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Cancelados:</span>
          <span className="tabular-nums">{summary.cancelledOrdersCount}</span>
        </div>
      </div>

      {/* Payment Breakdown */}
      <div className="mt-2.5 border-b-2 border-black pb-2.5 space-y-1 text-[11px]">
        <div className="font-bold uppercase text-[11px] mb-1">
          RESUMO POR PAGAMENTO
        </div>
        <div className="flex justify-between">
          <span>PIX ({summary.pixCount} ped.):</span>
          <span className="font-bold tabular-nums">
            {formatBRL(summary.pixTotal)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>CARTAO ({summary.cartaoCount} ped.):</span>
          <span className="font-bold tabular-nums">
            {formatBRL(summary.cartaoTotal)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>DINHEIRO ({summary.dinheiroCount} ped.):</span>
          <span className="font-bold tabular-nums">
            {formatBRL(summary.dinheiroTotal)}
          </span>
        </div>
      </div>

      {/* Signature */}
      <div className="mt-4 pt-2 text-center text-[10px] space-y-3">
        <div>Conferido por: ______________________</div>
      </div>
    </div>
  );
}

export function ThermalCashClosingTicket({
  summary,
  store,
  paperWidth,
  previewMode = false,
}: ThermalCashClosingTicketProps) {
  if (previewMode) {
    return (
      <ClosingContent
        summary={summary}
        store={store}
        paperWidth={paperWidth}
        previewMode
      />
    );
  }

  return (
    <div id="thermal-print-root" className="hidden print:block">
      <style>{`
        @page {
          size: ${paperWidth} auto;
          margin: 0;
        }
      `}</style>
      <ClosingContent
        summary={summary}
        store={store}
        paperWidth={paperWidth}
      />
    </div>
  );
}
