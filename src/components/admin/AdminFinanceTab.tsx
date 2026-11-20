import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Calendar,
  CheckCircle2,
  CreditCard,
  Eye,
  Loader2,
  Printer,
  QrCode,
  Receipt,
  TrendingUp,
  X,
} from 'lucide-react';
import { subscribeToOrdersByDateRange } from '../../services/orderService';
import type {
  CashClosingSummary,
  KitchenOrder,
  StoreConfig,
} from '../../types/order';
import { formatBRL } from '../../utils/formatters';
import { ThermalCashClosingTicket } from '../ThermalCashClosingTicket';

interface AdminFinanceTabProps {
  store: StoreConfig;
  paperWidth: '80mm' | '58mm';
  onPrintCashClosing: (summary: CashClosingSummary) => Promise<void> | void;
}

function toLocalDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDateBounds(dateStr: string): { startMs: number; endMs: number } {
  const parts = dateStr.split('-').map((n) => Number(n));
  const year = parts[0] || new Date().getFullYear();
  const month = (parts[1] || 1) - 1;
  const day = parts[2] || 1;
  const start = new Date(year, month, day, 0, 0, 0, 0);
  const end = new Date(year, month, day, 23, 59, 59, 999);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function AdminFinanceTab({
  store,
  paperWidth,
  onPrintCashClosing,
}: AdminFinanceTabProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    toLocalDateInputValue(new Date())
  );
  const [rangeMode, setRangeMode] = useState<'single' | 'last7'>('single');
  const [periodOrders, setPeriodOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [printingClosing, setPrintingClosing] = useState(false);

  const dateRange = useMemo(() => {
    if (rangeMode === 'last7') {
      const now = new Date();
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 6,
        0,
        0,
        0,
        0
      );
      const end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      );
      return {
        startMs: start.getTime(),
        endMs: end.getTime(),
        periodLabel: `${formatDateBR(start)} a ${formatDateBR(end)}`,
      };
    }

    const bounds = parseLocalDateBounds(selectedDate);
    return {
      startMs: bounds.startMs,
      endMs: bounds.endMs,
      periodLabel: formatDateBR(new Date(bounds.startMs)),
    };
  }, [rangeMode, selectedDate]);

  // Dedicated Firestore date-range query (no 150-order limit, supports any historical date)
  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToOrdersByDateRange(
      dateRange.startMs,
      dateRange.endMs,
      (incoming) => {
        setPeriodOrders(incoming);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [dateRange.startMs, dateRange.endMs]);

  const completedOrders = useMemo(
    () => periodOrders.filter((o) => o.status === 'concluido'),
    [periodOrders]
  );

  const cancelledOrders = useMemo(
    () => periodOrders.filter((o) => o.status === 'cancelado'),
    [periodOrders]
  );

  const inProgressOrders = useMemo(
    () =>
      periodOrders.filter(
        (o) =>
          o.status === 'novo' ||
          o.status === 'em_preparo' ||
          o.status === 'saiu_entrega'
      ),
    [periodOrders]
  );

  const nonCancelledOrders = useMemo(
    () => periodOrders.filter((o) => o.status !== 'cancelado'),
    [periodOrders]
  );

  const totalRevenue = useMemo(
    () => nonCancelledOrders.reduce((sum, o) => sum + o.total, 0),
    [nonCancelledOrders]
  );

  const completedRevenue = useMemo(
    () => completedOrders.reduce((sum, o) => sum + o.total, 0),
    [completedOrders]
  );

  const deliveryFeesTotal = useMemo(
    () =>
      nonCancelledOrders.reduce(
        (sum, o) =>
          sum + (o.tipoPedido === 'entrega' && !o.taxaACombinar ? o.taxaEntrega : 0),
        0
      ),
    [nonCancelledOrders]
  );

  const averageTicket =
    nonCancelledOrders.length > 0
      ? totalRevenue / nonCancelledOrders.length
      : 0;

  const paymentBreakdown = useMemo(() => {
    const totals = { pix: 0, cartao: 0, dinheiro: 0 };
    const counts = { pix: 0, cartao: 0, dinheiro: 0 };
    for (const o of nonCancelledOrders) {
      if (o.pagamento === 'pix' || o.pagamento === 'pix_entrega') {
        totals.pix += o.total;
        counts.pix += 1;
      } else if (o.pagamento === 'cartao') {
        totals.cartao += o.total;
        counts.cartao += 1;
      } else {
        totals.dinheiro += o.total;
        counts.dinheiro += 1;
      }
    }
    return { totals, counts };
  }, [nonCancelledOrders]);

  const buildClosingSummary = (): CashClosingSummary => ({
    periodLabel: dateRange.periodLabel,
    printedAtMs: Date.now(),
    totalRevenue,
    completedRevenue,
    validOrdersCount: nonCancelledOrders.length,
    completedOrdersCount: completedOrders.length,
    cancelledOrdersCount: cancelledOrders.length,
    inProgressOrdersCount: inProgressOrders.length,
    averageTicket,
    pixTotal: paymentBreakdown.totals.pix,
    pixCount: paymentBreakdown.counts.pix,
    cartaoTotal: paymentBreakdown.totals.cartao,
    cartaoCount: paymentBreakdown.counts.cartao,
    dinheiroTotal: paymentBreakdown.totals.dinheiro,
    dinheiroCount: paymentBreakdown.counts.dinheiro,
    deliveryFeesTotal,
  });

  const handlePrintClosing = async () => {
    setPrintingClosing(true);
    try {
      await onPrintCashClosing(buildClosingSummary());
    } finally {
      window.setTimeout(() => setPrintingClosing(false), 350);
    }
  };

  const todayKey = toLocalDateInputValue(new Date());
  const yesterdayKey = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return toLocalDateInputValue(y);
  }, []);

  const selectToday = () => {
    setRangeMode('single');
    setSelectedDate(todayKey);
  };

  const selectYesterday = () => {
    setRangeMode('single');
    setSelectedDate(yesterdayKey);
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#181615] dark:text-[#F6F4F0]">
            Resumo Financeiro
          </h2>
          <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A8A29E]">
            Consulta direta por período ({dateRange.periodLabel}) — sem limite de
            pedidos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={selectToday}
            className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
              rangeMode === 'single' && selectedDate === todayKey
                ? 'bg-[#181615] dark:bg-[#F6F4F0] text-white dark:text-[#181615] border-transparent'
                : 'bg-white dark:bg-[#1B1918] border-black/[0.1] dark:border-white/[0.12]'
            }`}
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={selectYesterday}
            className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
              rangeMode === 'single' && selectedDate === yesterdayKey
                ? 'bg-[#181615] dark:bg-[#F6F4F0] text-white dark:text-[#181615] border-transparent'
                : 'bg-white dark:bg-[#1B1918] border-black/[0.1] dark:border-white/[0.12] hover:bg-black/[0.03]'
            }`}
          >
            Ontem
          </button>
          <button
            type="button"
            onClick={() => setRangeMode('last7')}
            className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
              rangeMode === 'last7'
                ? 'bg-[#181615] dark:bg-[#F6F4F0] text-white dark:text-[#181615] border-transparent'
                : 'bg-white dark:bg-[#1B1918] border-black/[0.1] dark:border-white/[0.12]'
            }`}
          >
            Últimos 7 dias
          </button>

          <label className="relative inline-flex items-center">
            <Calendar
              className="w-4 h-4 text-[#78716C] absolute left-3 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="date"
              aria-label="Filtrar por data"
              value={selectedDate}
              onChange={(e) => {
                if (!e.target.value) return;
                setRangeMode('single');
                setSelectedDate(e.target.value);
              }}
              className="min-h-[38px] pl-9 pr-3 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-xs font-semibold tabular-nums"
            />
          </label>

          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={loading}
            className="min-h-[38px] px-3 rounded-xl border border-black/[0.1] dark:border-white/[0.12] bg-white dark:bg-[#1B1918] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-black/[0.03] disabled:opacity-50"
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Prévia Cupom</span>
          </button>

          <button
            type="button"
            onClick={handlePrintClosing}
            disabled={loading || printingClosing}
            className="min-h-[38px] px-3.5 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {printingClosing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Imprimir Fechamento de Caixa</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Erro ao consultar vendas do período: {error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#78716C] dark:text-[#A8A29E]">
            <span>Faturamento total</span>
            <TrendingUp
              className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
          </div>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
            {formatBRL(totalRevenue)}
          </p>
          <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
            {formatBRL(completedRevenue)} já concluídos ·{' '}
            {nonCancelledOrders.length} pedidos válidos
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#78716C] dark:text-[#A8A29E]">
            <span>Pedidos concluídos</span>
            <CheckCircle2
              className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
          </div>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
            {completedOrders.length}
          </p>
          <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
            {cancelledOrders.length} cancelados · {inProgressOrders.length} em
            andamento
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#78716C] dark:text-[#A8A29E]">
            <span>Ticket médio</span>
            <Receipt
              className="w-4 h-4 text-[#78716C] dark:text-[#A8A29E]"
              aria-hidden="true"
            />
          </div>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
            {formatBRL(averageTicket)}
          </p>
          <p className="mt-1 text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
            Taxas de entrega no período: {formatBRL(deliveryFeesTotal)}
          </p>
        </div>
      </div>

      {/* Payment Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-[#78716C] dark:text-[#A8A29E]">
                Pix
              </p>
              <p className="text-base font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
                {formatBRL(paymentBreakdown.totals.pix)}
              </p>
            </div>
          </div>
          <span className="text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
            {paymentBreakdown.counts.pix} ped.
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-4 h-4 text-blue-600" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-[#78716C] dark:text-[#A8A29E]">
                Cartão
              </p>
              <p className="text-base font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
                {formatBRL(paymentBreakdown.totals.cartao)}
              </p>
            </div>
          </div>
          <span className="text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
            {paymentBreakdown.counts.cartao} ped.
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Banknote className="w-4 h-4 text-amber-600" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-[#78716C] dark:text-[#A8A29E]">
                Dinheiro
              </p>
              <p className="text-base font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
                {formatBRL(paymentBreakdown.totals.dinheiro)}
              </p>
            </div>
          </div>
          <span className="text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
            {paymentBreakdown.counts.dinheiro} ped.
          </span>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-black/[0.07] dark:border-white/[0.08] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
            Pedidos do período ({periodOrders.length})
          </h3>
          {loading && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#78716C] dark:text-[#A8A29E]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              Carregando...
            </span>
          )}
        </div>

        {loading && periodOrders.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#78716C] dark:text-[#A8A29E] inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Buscando vendas do período...</span>
          </div>
        ) : periodOrders.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#78716C] dark:text-[#A8A29E]">
            Nenhum pedido registrado em {dateRange.periodLabel}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#FAF9F7] dark:bg-[#141312] text-[#78716C] dark:text-[#A8A29E] border-b border-black/[0.06] dark:border-white/[0.06]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Pedido</th>
                  <th className="py-2.5 px-4 font-semibold">Data / Hora</th>
                  <th className="py-2.5 px-4 font-semibold">Cliente</th>
                  <th className="py-2.5 px-4 font-semibold">Pagamento</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {periodOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-3 px-4 font-bold tabular-nums">
                      {o.codigoPedido}
                    </td>
                    <td className="py-3 px-4 text-[#78716C] dark:text-[#A8A29E] tabular-nums whitespace-nowrap">
                      {rangeMode === 'last7'
                        ? new Date(o.createdAtMs).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : new Date(o.createdAtMs).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                    </td>
                    <td className="py-3 px-4 font-medium">{o.clienteNome}</td>
                    <td className="py-3 px-4">
                      {o.pagamento === 'pix'
                        ? o.pixStatus === 'confirmado'
                          ? 'Pix (Pago)'
                          : 'Pix (Pendente)'
                        : o.pagamento === 'cartao'
                          ? 'Cartão'
                          : 'Dinheiro'}
                    </td>
                    <td className="py-3 px-4">
                      {o.status === 'novo'
                        ? 'Novo'
                        : o.status === 'em_preparo'
                          ? 'Em preparo'
                          : o.status === 'saiu_entrega'
                            ? 'Saiu p/ entrega'
                            : o.status === 'concluido'
                              ? 'Concluído'
                              : 'Cancelado'}
                    </td>
                    <td className="py-3 px-4 font-bold text-right tabular-nums">
                      {formatBRL(o.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Thermal Cash Closing Preview Modal */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 print:hidden"
          onClick={() => setPreviewOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Prévia do Cupom de Fechamento de Caixa"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FAF9F7] dark:bg-[#1B1918] rounded-2xl border border-black/10 dark:border-white/10 p-5 max-h-[90vh] flex flex-col items-center gap-4 overflow-y-auto shadow-2xl"
          >
            <div className="w-full flex items-center justify-between gap-4">
              <h3 className="font-display text-base font-bold text-[#181615] dark:text-[#F6F4F0]">
                Prévia Fechamento de Caixa ({paperWidth})
              </h3>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                aria-label="Fechar prévia"
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <ThermalCashClosingTicket
              summary={buildClosingSummary()}
              store={store}
              paperWidth={paperWidth}
              previewMode
            />

            <div className="w-full flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="min-h-[40px] px-4 rounded-xl text-xs font-semibold text-[#57534E] dark:text-[#A8A29E]"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewOpen(false);
                  handlePrintClosing();
                }}
                className="min-h-[40px] px-4 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                <Printer className="w-4 h-4" aria-hidden="true" />
                <span>Imprimir agora</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
