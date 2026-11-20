import type { KitchenOrder, KitchenSettings, StoreConfig } from '../types/order';
import { calculateCashChange, formatBRL } from '../utils/formatters';

interface ThermalTicketProps {
  order: KitchenOrder;
  store: StoreConfig;
  settings: KitchenSettings;
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

function TicketCopy({
  order,
  store,
  settings,
  copyLabel,
  previewMode,
}: {
  order: KitchenOrder;
  store: StoreConfig;
  settings: KitchenSettings;
  copyLabel?: string;
  previewMode?: boolean;
}) {
  const is58 = settings.paperWidth === '58mm';
  const isPixPaid = order.pagamento === 'pix' && order.pixStatus === 'confirmado';
  const isPixPending =
    order.pagamento === 'pix' && order.pixStatus !== 'confirmado';

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
        {copyLabel && (
          <div className="text-[10px] font-bold tracking-wider uppercase mb-1">
            *** {copyLabel} ***
          </div>
        )}
        <div className="text-[15px] font-bold uppercase tracking-tight">
          {store.nome}
        </div>
        <div className="text-[10px] mt-0.5 tabular-nums">
          {formatDateTime(order.createdAtMs)}
        </div>
        <div className="mt-1.5 text-[20px] font-bold tracking-tight tabular-nums">
          PEDIDO {order.codigoPedido}
        </div>
        <div className="mt-1 inline-block border-2 border-black px-2 py-0.5 text-[12px] font-bold uppercase">
          {order.tipoPedido === 'entrega' ? 'ENTREGA' : 'RETIRADA NO BALCAO'}
        </div>
      </div>

      {/* UNMISTAKABLE PAYMENT / PIX BANNER */}
      <div className="mt-2.5">
        {isPixPaid ? (
          <div className="border-2 border-black bg-black text-white px-2 py-2 text-center">
            <div className="text-[14px] font-bold tracking-wide uppercase">
              *** PAGAMENTO: PIX — PAGO ***
            </div>
            <div className="text-[11px] font-bold uppercase mt-0.5">
              COMPROVANTE CONFIRMADO
            </div>
            <div className="text-[10px] mt-1 uppercase">
              NAO COBRAR DO CLIENTE
            </div>
          </div>
        ) : isPixPending ? (
          <div className="border-2 border-dashed border-black px-2 py-2 text-center">
            <div className="text-[13px] font-bold uppercase">
              PAGAMENTO: PIX (AGUARDANDO CONFIRMACAO)
            </div>
            <div className="text-[10px] font-bold uppercase mt-0.5">
              CONFERIR COMPROVANTE ANTES DE LIBERAR
            </div>
          </div>
        ) : order.pagamento === 'pix_entrega' ? (
          <div className="border-2 border-black px-2 py-1.5 text-center">
            <div className="text-[13px] font-bold uppercase">
              PAGAMENTO: PIX NA ENTREGA
            </div>
            <div className="text-[11px] font-bold tabular-nums">
              COBRAR{' '}
              {order.taxaACombinar
                ? `${formatBRL(order.subtotal)} + TAXA`
                : formatBRL(order.total)}
            </div>
          </div>
        ) : order.pagamento === 'cartao' ? (
          <div className="border-2 border-black px-2 py-1.5 text-center">
            <div className="text-[13px] font-bold uppercase">
              CARTAO NA ENTREGA
            </div>
            <div className="text-[11px] font-bold uppercase tabular-nums">
              LEVAR MAQUININHA ·{' '}
              {order.taxaACombinar
                ? `${formatBRL(order.subtotal)} + TAXA`
                : formatBRL(order.total)}
            </div>
          </div>
        ) : (
          (() => {
            const changeCalc = !order.taxaACombinar
              ? calculateCashChange(order.trocoPara, order.total, order.semTroco)
              : null;
            return (
              <div className="border-2 border-black px-2 py-1.5 text-center space-y-1">
                <div className="text-[13px] font-bold uppercase tabular-nums">
                  DINHEIRO — COBRAR{' '}
                  {order.taxaACombinar
                    ? `${formatBRL(order.subtotal)} + TAXA`
                    : formatBRL(order.total)}
                </div>
                <div className="text-[11px] font-bold uppercase tabular-nums">
                  {order.semTroco || !order.trocoPara
                    ? 'SEM TROCO'
                    : changeCalc
                      ? `TROCO PARA: ${formatBRL(changeCalc.paidAmount)}`
                      : `TROCO PARA: ${order.trocoPara}`}
                </div>
                {changeCalc && (
                  <div className="bg-black text-white px-1.5 py-1 text-[12px] font-bold uppercase tabular-nums">
                    TROCO A DEVOLVER: {formatBRL(changeCalc.changeDue)}
                  </div>
                )}
              </div>
            );
          })()
        )}

        {/* Pix Details Box */}
        {order.pagamento === 'pix' && (
          <div className="mt-1.5 border border-black px-2 py-1 text-[10px] space-y-0.5">
            <div className="font-bold uppercase">
              FORMA: PIX ({isPixPaid ? 'CONFIRMADO' : 'PENDENTE'})
            </div>
            <div>
              Status:{' '}
              {order.pixConfirmadoPor === 'caixa_manual'
                ? 'Confirmado pelo caixa'
                : order.pixConfirmadoPor === 'cliente_declarado'
                  ? 'Cliente informou pagamento'
                  : 'Aguardando comprovante'}
            </div>
            {order.pixResumoVerificacao && (
              <div>Obs Pix: {order.pixResumoVerificacao}</div>
            )}
          </div>
        )}
      </div>

      {/* Customer & Address */}
      <div className="mt-2.5 border-b border-dashed border-black pb-2 space-y-0.5">
        <div className="font-bold text-[12px] uppercase">
          CLIENTE: {order.clienteNome}
        </div>
        {order.clienteWhatsapp && (
          <div className="font-bold text-[11px] tabular-nums">
            WHATSAPP: {order.clienteWhatsapp}
          </div>
        )}
        {order.tipoPedido === 'entrega' ? (
          <>
            <div className="font-bold">END: {order.endereco}</div>
            {order.bairroNome && <div>BAIRRO: {order.bairroNome}</div>}
            {order.pontoReferencia && <div>REF: {order.pontoReferencia}</div>}
          </>
        ) : (
          <div>RETIRAR NO BALCAO DA LOJA</div>
        )}
      </div>

      {/* Items */}
      <div className="mt-2.5 border-b-2 border-black pb-2">
        <div className="font-bold uppercase text-[11px] mb-1.5">
          ITENS DO PEDIDO
        </div>
        <div className="space-y-2">
          {order.itens.map((item, idx) => (
            <div
              key={`${item.nome}-${idx}`}
              className="border-b border-dotted border-black/60 pb-1.5 last:border-b-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-2 font-bold text-[12px]">
                <span>
                  {item.quantidade}x {item.nome.toUpperCase()}
                </span>
                <span className="tabular-nums whitespace-nowrap">
                  {formatBRL(item.precoTotal)}
                </span>
              </div>
              {item.pontoCarne && (
                <div className="pl-2 text-[11px] font-bold">
                  - OPCAO/PONTO: {item.pontoCarne.toUpperCase()}
                </div>
              )}
              {item.adicionais.length > 0 && (
                <div className="pl-2 text-[11px]">
                  + ADIC: {item.adicionais.join(', ')}
                </div>
              )}
              {item.ingredientesRemovidos.length > 0 && (
                <div className="pl-2 text-[11px] font-bold">
                  - RETIRAR: SEM{' '}
                  {item.ingredientesRemovidos.join(', SEM ').toUpperCase()}
                </div>
              )}
              {item.observacao && (
                <div className="mt-0.5 pl-2 text-[11px] font-bold uppercase">
                  *** OBS: {item.observacao} ***
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="mt-2 space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span>SUBTOTAL:</span>
          <span className="tabular-nums">{formatBRL(order.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>ENTREGA:</span>
          <span className="tabular-nums">
            {order.tipoPedido === 'retirada'
              ? 'GRATIS'
              : order.taxaACombinar
                ? 'A COMBINAR'
                : formatBRL(order.taxaEntrega)}
          </span>
        </div>
        <div className="flex justify-between text-[14px] font-bold border-t border-black pt-1 mt-1">
          <span>TOTAL:</span>
          <span className="tabular-nums">
            {order.taxaACombinar
              ? `${formatBRL(order.subtotal)} + TAXA`
              : formatBRL(order.total)}
          </span>
        </div>
      </div>

      {/* Footer Note */}
      {settings.storeFooterNote && (
        <div className="mt-3 pt-2 border-t border-dashed border-black text-center text-[10px]">
          {settings.storeFooterNote}
        </div>
      )}
    </div>
  );
}

export function ThermalTicket({
  order,
  store,
  settings,
  previewMode = false,
}: ThermalTicketProps) {
  const copies = settings.copies === 2 ? 2 : 1;

  if (previewMode) {
    return (
      <TicketCopy
        order={order}
        store={store}
        settings={settings}
        copyLabel={copies === 2 ? 'VIA 1 — COZINHA' : undefined}
        previewMode
      />
    );
  }

  return (
    <div id="thermal-print-root" className="hidden print:block">
      <style>{`
        @page {
          size: ${settings.paperWidth} auto;
          margin: 0;
        }
      `}</style>
      <TicketCopy
        order={order}
        store={store}
        settings={settings}
        copyLabel={copies === 2 ? 'VIA 1 — COZINHA' : undefined}
      />
      {copies === 2 && (
        <div className="thermal-page-break">
          <TicketCopy
            order={order}
            store={store}
            settings={settings}
            copyLabel="VIA 2 — ENTREGA / CAIXA"
          />
        </div>
      )}
    </div>
  );
}
