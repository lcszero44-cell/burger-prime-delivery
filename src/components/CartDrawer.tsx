import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Bike,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  Lock,
  MessageCircle,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createKitchenOrder } from '../services/orderService';
import type {
  CartItem,
  CustomerCheckoutData,
  PaymentMethod,
  StoreConfig,
} from '../types/order';
import {
  buildPixPayload,
  buildWhatsAppOrderMessage,
  buildWhatsAppUrl,
  calculateCashChange,
  formatBRL,
  formatComposedAddress,
  formatWhatsAppMask,
  getCartItemTotal,
  isDeliveryFeeToNegotiate,
  parseMoneyInput,
  type StoreOpenStatus,
} from '../utils/formatters';
import { FoodImage } from './FoodImage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  store: StoreConfig;
  openStatus: StoreOpenStatus;
  customer: CustomerCheckoutData;
  onCustomerChange: (next: CustomerCheckoutData) => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onUpdateObservation: (cartItemId: string, obs: string) => void;
  onClearCart: () => void;
}

interface ConfirmedOrderSummary {
  codigoPedido: string;
  clienteNome: string;
  tipoPedido: CustomerCheckoutData['tipoPedido'];
  enderecoResumo: string;
  pagamentoLabel: string;
  totalLabel: string;
  whatsAppHref: string;
  tempoEstimado: string;
  isPix: boolean;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  store,
  openStatus,
  customer,
  onCustomerChange,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateObservation,
  onClearCart,
}: CartDrawerProps) {
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [pixClienteJaPagou, setPixClienteJaPagou] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] =
    useState<ConfirmedOrderSummary | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + getCartItemTotal(item), 0),
    [items]
  );

  const selectedNeighborhood = useMemo(
    () => store.bairrosEntrega.find((b) => b.id === customer.bairroId),
    [store.bairrosEntrega, customer.bairroId]
  );

  const feeToNegotiate = isDeliveryFeeToNegotiate(
    customer.tipoPedido,
    selectedNeighborhood
  );

  const deliveryFee =
    customer.tipoPedido === 'entrega' &&
    selectedNeighborhood &&
    !feeToNegotiate
      ? selectedNeighborhood.taxa ?? 0
      : 0;

  const total = subtotal + deliveryFee;
  const cashCompareTotal = feeToNegotiate ? subtotal : total;

  const parsedCashInput = useMemo(
    () =>
      customer.pagamento === 'dinheiro' && !customer.semTroco
        ? parseMoneyInput(customer.trocoPara)
        : null,
    [customer.pagamento, customer.semTroco, customer.trocoPara]
  );

  const liveCashChange = useMemo(
    () =>
      customer.pagamento === 'dinheiro' && !customer.semTroco
        ? calculateCashChange(
            customer.trocoPara,
            cashCompareTotal,
            customer.semTroco
          )
        : null,
    [customer.pagamento, customer.semTroco, customer.trocoPara, cashCompareTotal]
  );

  const belowMinimum =
    items.length > 0 && store.pedidoMinimo > 0 && subtotal < store.pedidoMinimo;

  const pixPayload = useMemo(() => {
    if (customer.pagamento !== 'pix' || items.length === 0 || feeToNegotiate) {
      return '';
    }
    return buildPixPayload({
      chave: store.pix.chave,
      nomeRecebedor: store.pix.nomeRecebedor,
      cidadeRecebedor: store.pix.cidadeRecebedor,
      valor: total,
      txid: 'BURGERPRIME',
    });
  }, [customer.pagamento, items.length, feeToNegotiate, store.pix, total]);

  const updateField = <K extends keyof CustomerCheckoutData>(
    key: K,
    value: CustomerCheckoutData[K]
  ) => {
    setFormErrors([]);
    setSubmitError(null);
    onCustomerChange({ ...customer, [key]: value });
  };

  const handleCopyText = async (
    value: string,
    target: 'key' | 'payload'
  ) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      if (target === 'key') {
        setCopiedKey(true);
        window.setTimeout(() => setCopiedKey(false), 2400);
      } else {
        setCopiedPayload(true);
        window.setTimeout(() => setCopiedPayload(false), 2400);
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      if (target === 'key') {
        setCopiedKey(true);
        window.setTimeout(() => setCopiedKey(false), 2400);
      } else {
        setCopiedPayload(true);
        window.setTimeout(() => setCopiedPayload(false), 2400);
      }
    }
  };

  const validateCheckout = (): string[] => {
    const errors: string[] = [];
    if (!openStatus.isOpen) {
      errors.push(
        'A loja está fechada no momento. Novos pedidos estão temporariamente pausados.'
      );
      return errors;
    }
    if (items.length === 0) {
      errors.push('Seu carrinho está vazio.');
    }
    if (belowMinimum) {
      errors.push(
        `O pedido mínimo é de ${formatBRL(store.pedidoMinimo)} (faltam ${formatBRL(
          store.pedidoMinimo - subtotal
        )}).`
      );
    }
    if (!customer.nome.trim() || customer.nome.trim().length < 2) {
      errors.push('Informe seu nome completo.');
    }
    const phoneDigits = customer.whatsapp.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      errors.push('Informe um número de WhatsApp válido com DDD.');
    }
    if (customer.tipoPedido === 'entrega') {
      if (!selectedNeighborhood) {
        errors.push('Selecione o bairro para entrega.');
      }
      if (!customer.rua.trim()) {
        errors.push('Informe o nome da rua.');
      }
      if (!customer.numero.trim()) {
        errors.push('Informe o número da residência ou prédio.');
      }
      if (!customer.pontoReferencia.trim()) {
        errors.push('Informe um ponto de referência para o entregador.');
      }
    }
    if (customer.pagamento === 'dinheiro' && !customer.semTroco) {
      if (!customer.trocoPara.trim()) {
        errors.push(
          'Informe para quanto precisa de troco ou marque "Não preciso de troco".'
        );
      } else {
        const paid = parseMoneyInput(customer.trocoPara);
        if (paid === null || paid <= cashCompareTotal) {
          errors.push(
            `O valor informado para troco deve ser maior que o total do pedido (${formatBRL(cashCompareTotal)}).`
          );
        }
      }
    }
    return errors;
  };

  const handleFinalizeOrder = async () => {
    const errors = validateCheckout();
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const normalizedCustomer: CustomerCheckoutData =
      customer.pagamento === 'dinheiro' &&
      !customer.semTroco &&
      parsedCashInput !== null
        ? { ...customer, trocoPara: formatBRL(parsedCashInput) }
        : customer;

    const computedChange =
      normalizedCustomer.pagamento === 'dinheiro' && !normalizedCustomer.semTroco
        ? calculateCashChange(
            normalizedCustomer.trocoPara,
            cashCompareTotal,
            normalizedCustomer.semTroco
          )
        : null;

    try {
      const created = await createKitchenOrder({
        items,
        customer: normalizedCustomer,
        selectedNeighborhood,
        subtotal,
        deliveryFee,
        feeToNegotiate,
        total,
        pixClienteJaPagou,
      });

      const message = buildWhatsAppOrderMessage({
        store,
        items,
        customer: normalizedCustomer,
        selectedNeighborhood,
        subtotal,
        deliveryFee,
        total,
        codigoPedido: created.codigoPedido,
      });

      const whatsAppHref = buildWhatsAppUrl(store.whatsapp, message);

      const pagamentoLabel =
        normalizedCustomer.pagamento === 'pix'
          ? pixClienteJaPagou
            ? 'Pix (pago informado pelo cliente)'
            : 'Pix'
          : normalizedCustomer.pagamento === 'cartao'
            ? 'Cartão na entrega'
            : normalizedCustomer.semTroco || !normalizedCustomer.trocoPara.trim()
              ? 'Dinheiro (sem troco)'
              : computedChange
                ? `Dinheiro (troco p/ ${formatBRL(computedChange.paidAmount)} · devolver ${formatBRL(computedChange.changeDue)})`
                : `Dinheiro (troco para ${normalizedCustomer.trocoPara})`;

      setConfirmedOrder({
        codigoPedido: created.codigoPedido,
        clienteNome: customer.nome.trim(),
        tipoPedido: customer.tipoPedido,
        enderecoResumo:
          customer.tipoPedido === 'entrega'
            ? `${formatComposedAddress(customer)} — ${selectedNeighborhood?.nome || ''}`
            : store.enderecoRetirada,
        pagamentoLabel,
        totalLabel: feeToNegotiate
          ? `${formatBRL(subtotal)} + entrega a combinar`
          : formatBRL(total),
        whatsAppHref,
        tempoEstimado:
          customer.tipoPedido === 'entrega'
            ? store.tempoEstimadoEntrega
            : store.tempoEstimadoRetirada,
        isPix: customer.pagamento === 'pix',
      });

      onClearCart();
      setPixClienteJaPagou(false);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar o pedido agora. Tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseDrawer = () => {
    setConfirmedOrder(null);
    setFormErrors([]);
    setSubmitError(null);
    onClose();
  };

  if (!isOpen) return null;

  const paymentOptions: {
    id: PaymentMethod;
    label: string;
    subtitle: string;
    icon: typeof QrCode;
  }[] = [
    {
      id: 'pix',
      label: 'Pix',
      subtitle: 'Chave Pix e QR Code na hora',
      icon: QrCode,
    },
    {
      id: 'cartao',
      label: 'Cartão na entrega',
      subtitle: 'Débito, crédito ou VR',
      icon: CreditCard,
    },
    {
      id: 'dinheiro',
      label: 'Dinheiro',
      subtitle: 'Informe se precisa de troco',
      icon: Banknote,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-[2px] animate-fade-fast"
      onClick={handleCloseDrawer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[480px] h-full flex flex-col bg-[#FAF9F7] dark:bg-[#141312] shadow-2xl border-l border-black/10 dark:border-white/10"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-white dark:bg-[#1B1918] border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between gap-3">
          <div>
            <h2
              id="cart-drawer-title"
              className="font-display text-lg font-bold text-[#181615] dark:text-[#F6F4F0]"
            >
              {confirmedOrder ? 'Pedido confirmado' : 'Seu pedido'}
            </h2>
            {!confirmedOrder && items.length > 0 && (
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                {items.reduce((acc, i) => acc + i.quantidade, 0)}{' '}
                {items.reduce((acc, i) => acc + i.quantidade, 0) === 1
                  ? 'item selecionado'
                  : 'itens selecionados'}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleCloseDrawer}
            aria-label="Fechar carrinho"
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#57534E] dark:text-[#A8A29E] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-6">
          {confirmedOrder ? (
            /* ORDER CONFIRMATION SCREEN */
            <div className="py-4 space-y-5">
              <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Pedido recebido na cozinha
                </p>
                <h3 className="font-display text-3xl font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
                  Pedido {confirmedOrder.codigoPedido}
                </h3>
                <p className="text-sm text-[#44403C] dark:text-[#D6D3D1]">
                  Obrigado, <strong>{confirmedOrder.clienteNome}</strong>! Seu
                  pedido já entrou em tempo real na nossa fila de preparo.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] space-y-2.5 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-[#78716C] dark:text-[#A8A29E]">
                    Modalidade
                  </span>
                  <span className="font-semibold text-[#181615] dark:text-[#F6F4F0]">
                    {confirmedOrder.tipoPedido === 'entrega'
                      ? 'Entrega'
                      : 'Retirada no balcão'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#78716C] dark:text-[#A8A29E]">
                    Previsão
                  </span>
                  <span className="font-semibold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
                    {confirmedOrder.tempoEstimado}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#78716C] dark:text-[#A8A29E]">
                    Pagamento
                  </span>
                  <span className="font-semibold text-[#181615] dark:text-[#F6F4F0] text-right">
                    {confirmedOrder.pagamentoLabel}
                  </span>
                </div>
                <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] flex justify-between gap-2">
                  <span className="text-[#78716C] dark:text-[#A8A29E]">
                    Endereço
                  </span>
                  <span className="font-medium text-[#181615] dark:text-[#F6F4F0] text-right">
                    {confirmedOrder.enderecoResumo}
                  </span>
                </div>
                <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] flex justify-between items-baseline">
                  <span className="font-bold text-[#181615] dark:text-[#F6F4F0]">
                    Total
                  </span>
                  <span className="text-lg font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
                    {confirmedOrder.totalLabel}
                  </span>
                </div>
              </div>

              {confirmedOrder.isPix && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                  Se você escolheu <strong>Pix</strong>, pode enviar o
                  comprovante pelo WhatsApp abaixo para agilizar a confirmação
                  no caixa.
                </div>
              )}

              <div className="space-y-2.5">
                <a
                  href={confirmedOrder.whatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {confirmedOrder.isPix
                      ? 'Enviar comprovante / resumo no WhatsApp'
                      : 'Acompanhar pedido no WhatsApp'}
                  </span>
                </a>

                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="w-full min-h-[44px] px-4 rounded-xl bg-white dark:bg-[#1F1D1C] border border-black/[0.1] dark:border-white/[0.12] text-sm font-semibold text-[#181615] dark:text-[#F6F4F0] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
                >
                  Voltar ao cardápio
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            /* EMPTY CART */
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-black/[0.05] dark:bg-white/[0.06] text-[#78716C] dark:text-[#A8A29E] flex items-center justify-center mx-auto">
                <ShoppingBag className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="font-display text-lg font-bold text-[#181615] dark:text-[#F6F4F0]">
                Seu carrinho está vazio
              </h3>
              <p className="text-sm text-[#57534E] dark:text-[#A8A29E] max-w-xs mx-auto">
                Escolha seus hambúrgueres, combos ou bebidas no cardápio para
                começar seu pedido.
              </p>
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="mt-2 min-h-[44px] px-5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                Explorar cardápio
              </button>
            </div>
          ) : (
            /* ACTIVE CART + COMPLETE CHECKOUT */
            <>
              {/* Closed Store Alert inside Drawer */}
              {!openStatus.isOpen && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong>Loja fechada no momento.</strong> Novos pedidos
                    estão bloqueados até a reabertura ({openStatus.detail}).
                  </span>
                </div>
              )}

              {/* Cart Items List */}
              <section aria-label="Itens do carrinho" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                    Itens ({items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={onClearCart}
                    className="text-xs font-medium text-[#78716C] hover:text-rose-600 dark:text-[#A8A29E] dark:hover:text-rose-400 transition-colors"
                  >
                    Limpar carrinho
                  </button>
                </div>

                {items.map((item) => (
                  <div
                    key={item.cartItemId}
                    className="p-3.5 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.07] dark:border-white/[0.08] space-y-2.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
                        <FoodImage
                          src={item.imagem}
                          alt={item.nome}
                          className="w-full h-full"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-sm font-bold text-[#181615] dark:text-[#F6F4F0] leading-snug">
                            {item.nome}
                          </h4>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.cartItemId)}
                            aria-label={`Remover ${item.nome}`}
                            className="p-1 text-[#A8A29E] hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>

                        <div className="mt-1 space-y-0.5 text-xs text-[#57534E] dark:text-[#A8A29E]">
                          {item.pontoCarne && (
                            <p>Opção/Ponto: {item.pontoCarne}</p>
                          )}
                          {item.adicionais.length > 0 && (
                            <p>
                              Adicionais:{' '}
                              {item.adicionais.map((a) => a.nome).join(', ')}
                            </p>
                          )}
                          {item.ingredientesRemovidos.length > 0 && (
                            <p>
                              Retirar: Sem{' '}
                              {item.ingredientesRemovidos.join(', sem ')}
                            </p>
                          )}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
                            {formatBRL(getCartItemTotal(item))}
                          </span>

                          <div className="flex items-center border border-black/[0.1] dark:border-white/[0.12] rounded-lg bg-[#FAF9F7] dark:bg-[#141312]">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateQuantity(item.cartItemId, -1)
                              }
                              aria-label="Diminuir quantidade"
                              className="w-8 h-8 flex items-center justify-center text-[#181615] dark:text-[#F6F4F0]"
                            >
                              <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold tabular-nums">
                              {item.quantidade}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateQuantity(item.cartItemId, 1)
                              }
                              aria-label="Aumentar quantidade"
                              className="w-8 h-8 flex items-center justify-center text-[#181615] dark:text-[#F6F4F0]"
                            >
                              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <input
                      type="text"
                      maxLength={180}
                      value={item.observacao}
                      onChange={(e) =>
                        onUpdateObservation(item.cartItemId, e.target.value)
                      }
                      placeholder="Observação deste item (ex: sem cebola)..."
                      className="w-full px-3 py-2 rounded-lg bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.07] dark:border-white/[0.08] text-xs text-[#181615] dark:text-[#F6F4F0] placeholder:text-[#8C857F] focus:border-[var(--brand-primary)] focus:outline-none"
                    />
                  </div>
                ))}
              </section>

              {/* Delivery vs Pickup */}
              <section className="pt-4 border-t border-black/[0.08] dark:border-white/[0.08] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                  1. Como deseja receber?
                </h3>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => updateField('tipoPedido', 'entrega')}
                    aria-pressed={customer.tipoPedido === 'entrega'}
                    className={`min-h-[52px] px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors ${
                      customer.tipoPedido === 'entrega'
                        ? 'bg-white dark:bg-[#221F1E] shadow-xs'
                        : 'bg-white/60 dark:bg-[#1B1918] border-black/[0.08] dark:border-white/[0.08]'
                    }`}
                    style={
                      customer.tipoPedido === 'entrega'
                        ? { borderColor: 'var(--brand-primary)' }
                        : undefined
                    }
                  >
                    <Bike
                      className="w-5 h-5 shrink-0"
                      style={
                        customer.tipoPedido === 'entrega'
                          ? { color: 'var(--brand-primary-text)' }
                          : undefined
                      }
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#181615] dark:text-[#F6F4F0]">
                        Entrega
                      </p>
                      <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] truncate">
                        {store.tempoEstimadoEntrega}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateField('tipoPedido', 'retirada')}
                    aria-pressed={customer.tipoPedido === 'retirada'}
                    className={`min-h-[52px] px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors ${
                      customer.tipoPedido === 'retirada'
                        ? 'bg-white dark:bg-[#221F1E] shadow-xs'
                        : 'bg-white/60 dark:bg-[#1B1918] border-black/[0.08] dark:border-white/[0.08]'
                    }`}
                    style={
                      customer.tipoPedido === 'retirada'
                        ? { borderColor: 'var(--brand-primary)' }
                        : undefined
                    }
                  >
                    <Store
                      className="w-5 h-5 shrink-0"
                      style={
                        customer.tipoPedido === 'retirada'
                          ? { color: 'var(--brand-primary-text)' }
                          : undefined
                      }
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#181615] dark:text-[#F6F4F0]">
                        Retirada
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        Grátis · {store.tempoEstimadoRetirada}
                      </p>
                    </div>
                  </button>
                </div>

                {customer.tipoPedido === 'retirada' && (
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] bg-white dark:bg-[#1B1918] border border-black/[0.07] dark:border-white/[0.08] rounded-xl p-3">
                    <strong>Endereço para retirada:</strong>{' '}
                    {store.enderecoRetirada}
                  </p>
                )}
              </section>

              {/* Customer & Complete Address Fields */}
              <section className="pt-4 border-t border-black/[0.08] dark:border-white/[0.08] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                  2. Seus dados{' '}
                  {customer.tipoPedido === 'entrega' ? 'e endereço' : ''}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="checkout-nome"
                      className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1"
                    >
                      Nome completo *
                    </label>
                    <input
                      id="checkout-nome"
                      type="text"
                      autoComplete="name"
                      value={customer.nome}
                      onChange={(e) => updateField('nome', e.target.value)}
                      placeholder="Ex: Ana Paula"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-sm text-[#181615] dark:text-[#F6F4F0] placeholder:text-[#8C857F] focus:border-[var(--brand-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-whatsapp"
                      className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1"
                    >
                      WhatsApp *
                    </label>
                    <input
                      id="checkout-whatsapp"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={customer.whatsapp}
                      onChange={(e) =>
                        updateField(
                          'whatsapp',
                          formatWhatsAppMask(e.target.value)
                        )
                      }
                      placeholder="(34) 99999-9999"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-sm text-[#181615] dark:text-[#F6F4F0] placeholder:text-[#8C857F] tabular-nums focus:border-[var(--brand-primary)] focus:outline-none"
                    />
                  </div>
                </div>

                {customer.tipoPedido === 'entrega' && (
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="checkout-bairro"
                        className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1"
                      >
                        Bairro *
                      </label>
                      <select
                        id="checkout-bairro"
                        value={customer.bairroId}
                        onChange={(e) =>
                          updateField('bairroId', e.target.value)
                        }
                        className="w-full min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-sm text-[#181615] dark:text-[#F6F4F0] focus:border-[var(--brand-primary)] focus:outline-none"
                      >
                        <option value="">Selecione seu bairro...</option>
                        {store.bairrosEntrega.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nome} —{' '}
                            {b.aCombinar || b.taxa === null
                              ? 'Taxa a combinar'
                              : b.taxa === 0
                                ? 'Entrega grátis'
                                : formatBRL(b.taxa)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-12 gap-2.5">
                      <div className="col-span-8">
                        <label
                          htmlFor="checkout-rua"
                          className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1"
                        >
                          Rua / Avenida *
                        </label>
                        <input
                          id="checkout-rua"
                          type="text"
                          value={customer.rua}
                          onChange={(e) => updateField('rua', e.target.value)}
                          placeholder="Ex: Av. João Naves de Ávila"
                          className="w-full min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-sm text-[#181615] dark:text-[#F6F4F0] placeholder:text-[#8C857F] focus:border-[var(--brand-primary)] focus:outline-none"
                        />
                      </div>

                      <div className="col-span-4">
                        <label
                          htmlFor="checkout-numero"
                          className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1"
                        >
                          Número *
                        </label>
                        <input
                          id="checkout-numero"
                          type="text"
                          value={customer.numero}
                          onChange={(e) =>
                            updateField('numero', e.target.value)
                          }
                          placeholder="1420"
                          className="w-full min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-sm text-[#181615] dark:text-[#F6F4F0] placeholder:text-[#8C857F] focus:border-[var(--brand-primary)] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor="checkout-complemento"
                          className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1"
                        >
                          Complemento (opcional)
                        </label>
                        <input
                          id="checkout-complemento"
                          type="text"
                          value={customer.complemento}
                          onChange={(e) =>
                            updateField('complemento', e.target.value)
                          }
                          placeholder="Apto 302, Bloco B"
                          className="w-full min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-sm text-[#181615] dark:text-[#F6F4F0] placeholder:text-[#8C857F] focus:border-[var(--brand-primary)] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="checkout-ref"
                          className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1"
                        >
                          Ponto de referência *
                        </label>
                        <input
                          id="checkout-ref"
                          type="text"
                          value={customer.pontoReferencia}
                          onChange={(e) =>
                            updateField('pontoReferencia', e.target.value)
                          }
                          placeholder="Próx. à padaria / portão preto"
                          className="w-full min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-sm text-[#181615] dark:text-[#F6F4F0] placeholder:text-[#8C857F] focus:border-[var(--brand-primary)] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Payment Method */}
              <section className="pt-4 border-t border-black/[0.08] dark:border-white/[0.08] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                  3. Forma de pagamento
                </h3>

                <div className="space-y-2">
                  {paymentOptions.map((opt) => {
                    const Icon = opt.icon;
                    const active = customer.pagamento === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateField('pagamento', opt.id)}
                        aria-pressed={active}
                        className={`w-full min-h-[52px] px-3.5 py-2.5 rounded-xl border flex items-center gap-3 text-left transition-colors ${
                          active
                            ? 'bg-white dark:bg-[#221F1E]'
                            : 'bg-white/60 dark:bg-[#1B1918] border-black/[0.08] dark:border-white/[0.08]'
                        }`}
                        style={
                          active
                            ? { borderColor: 'var(--brand-primary)' }
                            : undefined
                        }
                      >
                        <Icon
                          className="w-5 h-5 shrink-0"
                          style={
                            active
                              ? { color: 'var(--brand-primary-text)' }
                              : undefined
                          }
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[#181615] dark:text-[#F6F4F0]">
                            {opt.label}
                          </p>
                          <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                            {opt.subtitle}
                          </p>
                        </div>
                        <span
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            active
                              ? 'border-[var(--brand-primary)]'
                              : 'border-black/25 dark:border-white/25'
                          }`}
                        >
                          {active && (
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: 'var(--brand-primary)' }}
                            />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* PIX Panel: Store Pix Key + Copy Key Button + QR Code */}
                {customer.pagamento === 'pix' && (
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.09] dark:border-white/[0.1] space-y-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          Chave Pix da loja
                        </p>
                        <p className="mt-0.5 text-sm font-mono font-bold text-[#181615] dark:text-[#F6F4F0] break-all">
                          {store.pix.chave}
                        </p>
                        <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-0.5">
                          Favorecido: {store.pix.nomeRecebedor}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(store.pix.chave, 'key')}
                        className="min-h-[38px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 border border-black/[0.1] dark:border-white/[0.12] bg-[#FAF9F7] dark:bg-[#141312] text-[#181615] dark:text-[#F6F4F0] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                      >
                        {copiedKey ? (
                          <>
                            <Check
                              className="w-3.5 h-3.5 text-emerald-600"
                              aria-hidden="true"
                            />
                            <span>Copiada!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Copiar Chave</span>
                          </>
                        )}
                      </button>
                    </div>

                    {!feeToNegotiate && pixPayload ? (
                      <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row items-center gap-4">
                        <div className="p-2.5 bg-white rounded-xl border border-black/10 shrink-0">
                          <QRCodeSVG value={pixPayload} size={112} />
                        </div>
                        <div className="flex-1 space-y-2 text-center sm:text-left">
                          <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                            Valor exato do QR Code:{' '}
                            <strong className="text-[#181615] dark:text-[#F6F4F0] tabular-nums">
                              {formatBRL(total)}
                            </strong>
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(pixPayload, 'payload')
                            }
                            className="w-full sm:w-auto min-h-[38px] px-3.5 rounded-xl text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5"
                            style={{ backgroundColor: 'var(--brand-primary)' }}
                          >
                            {copiedPayload ? (
                              <>
                                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Pix Copia e Cola copiado</span>
                              </>
                            ) : (
                              <>
                                <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Copiar Pix Copia e Cola</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        A taxa deste bairro é a combinar — aguarde a confirmação
                        do valor total antes de transferir.
                      </p>
                    )}

                    <label className="flex items-center gap-2.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.06] cursor-pointer text-xs text-[#44403C] dark:text-[#D6D3D1]">
                      <input
                        type="checkbox"
                        checked={pixClienteJaPagou}
                        onChange={(e) =>
                          setPixClienteJaPagou(e.target.checked)
                        }
                        className="w-4 h-4 rounded accent-[var(--brand-primary)]"
                      />
                      <span>Já realizei o pagamento via Pix agora</span>
                    </label>
                  </div>
                )}

                {/* Cash Change Panel */}
                {customer.pagamento === 'dinheiro' && (
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.09] dark:border-white/[0.1] space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label
                          htmlFor="checkout-troco"
                          className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1]"
                        >
                          Precisa de troco para quanto?
                        </label>
                        <span className="text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                          Total: {formatBRL(cashCompareTotal)}
                        </span>
                      </div>
                      <input
                        id="checkout-troco"
                        type="text"
                        inputMode="decimal"
                        disabled={customer.semTroco}
                        value={customer.semTroco ? '' : customer.trocoPara}
                        onChange={(e) =>
                          updateField('trocoPara', e.target.value)
                        }
                        placeholder="Ex: 50,00 ou 100,00"
                        className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm text-[#181615] dark:text-[#F6F4F0] placeholder:text-[#8C857F] disabled:opacity-50 focus:border-[var(--brand-primary)] focus:outline-none tabular-nums"
                      />
                    </div>

                    {!customer.semTroco && customer.trocoPara.trim() && (
                      liveCashChange ? (
                        <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          <span>Troco a devolver pelo entregador:</span>
                          <span className="text-sm tabular-nums">
                            {formatBRL(liveCashChange.changeDue)}
                          </span>
                        </div>
                      ) : (
                        <p className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold text-rose-700 dark:text-rose-300 tabular-nums">
                          Informe um valor maior que {formatBRL(cashCompareTotal)}.
                        </p>
                      )
                    )}

                    <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[#44403C] dark:text-[#D6D3D1]">
                      <input
                        type="checkbox"
                        checked={customer.semTroco}
                        onChange={(e) =>
                          updateField('semTroco', e.target.checked)
                        }
                        className="w-4 h-4 rounded accent-[var(--brand-primary)]"
                      />
                      <span>Não preciso de troco (valor exato)</span>
                    </label>
                  </div>
                )}
              </section>

              {/* Validation Errors */}
              {(formErrors.length > 0 || submitError) && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 space-y-1"
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Confira antes de finalizar:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {formErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {submitError && <li>{submitError}</li>}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky Footer Totals & Finalize CTA */}
        {!confirmedOrder && items.length > 0 && (
          <div className="p-4 sm:p-5 bg-white dark:bg-[#1B1918] border-t border-black/[0.08] dark:border-white/[0.08] space-y-3">
            <div className="space-y-1 text-xs sm:text-sm">
              <div className="flex justify-between text-[#57534E] dark:text-[#A8A29E]">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#57534E] dark:text-[#A8A29E]">
                <span>
                  {customer.tipoPedido === 'retirada'
                    ? 'Retirada no balcão'
                    : selectedNeighborhood
                      ? `Entrega (${selectedNeighborhood.nome})`
                      : 'Taxa de entrega'}
                </span>
                <span className="tabular-nums">
                  {customer.tipoPedido === 'retirada'
                    ? 'Grátis'
                    : !selectedNeighborhood
                      ? 'Selecione o bairro'
                      : feeToNegotiate
                        ? 'A combinar'
                        : deliveryFee === 0
                          ? 'Grátis'
                          : formatBRL(deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-black/[0.07] dark:border-white/[0.08]">
                <span className="font-bold text-[#181615] dark:text-[#F6F4F0]">
                  Total
                </span>
                <span className="text-lg font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
                  {feeToNegotiate
                    ? `${formatBRL(subtotal)} + entrega`
                    : formatBRL(total)}
                </span>
              </div>
            </div>

            {belowMinimum && (
              <p className="text-xs text-amber-700 dark:text-amber-300 text-center">
                Pedido mínimo de {formatBRL(store.pedidoMinimo)} — faltam{' '}
                <strong className="tabular-nums">
                  {formatBRL(store.pedidoMinimo - subtotal)}
                </strong>
                .
              </p>
            )}

            <button
              type="button"
              onClick={handleFinalizeOrder}
              disabled={submitting || !openStatus.isOpen}
              className="w-full min-h-[50px] px-5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.99] disabled:opacity-55 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Enviando pedido...</span>
                </>
              ) : !openStatus.isOpen ? (
                <>
                  <Lock className="w-4 h-4" aria-hidden="true" />
                  <span>Loja fechada no momento</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>Finalizar pedido</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
