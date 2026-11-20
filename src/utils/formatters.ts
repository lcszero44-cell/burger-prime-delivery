import type {
  CartItem,
  CustomerCheckoutData,
  LiveStoreSettings,
  NeighborhoodFee,
  StoreConfig,
} from '../types/order';

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatBRL(value: number): string {
  return brlFormatter.format(value);
}

export function formatSequentialCode(num: number): string {
  return `#${String(Math.max(1, Math.floor(num))).padStart(4, '0')}`;
}

export function formatWhatsAppMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function getCartItemUnitPrice(item: CartItem): number {
  const addonsSum = item.adicionais.reduce((acc, add) => acc + add.preco, 0);
  return item.precoBase + addonsSum;
}

export function getCartItemTotal(item: CartItem): number {
  return getCartItemUnitPrice(item) * item.quantidade;
}

export interface StoreOpenStatus {
  isOpen: boolean;
  label: string;
  detail: string;
}

/**
 * Converte a configuração em tempo real do Firestore no status Aberto / Fechado exibido no topo.
 */
export function getLiveStoreOpenStatus(
  settings: LiveStoreSettings
): StoreOpenStatus {
  if (settings.abertoManual) {
    return {
      isOpen: true,
      label: 'Aberto agora',
      detail: `Entrega ${settings.tempoEstimadoEntrega}`,
    };
  }
  return {
    isOpen: false,
    label: 'Fechado no momento',
    detail: settings.resumoHorario || 'Voltamos em breve',
  };
}

/**
 * Mescla a configuração ao vivo do Firestore com o fallback local da STORE_CONFIG.
 */
export function mergeLiveStoreConfig(
  base: StoreConfig,
  live: LiveStoreSettings
): StoreConfig {
  return {
    ...base,
    nome: live.nome || base.nome,
    slogan: live.slogan || base.slogan,
    whatsapp: live.whatsapp || base.whatsapp,
    enderecoRetirada: live.enderecoRetirada || base.enderecoRetirada,
    cidadeUf: live.cidadeUf || base.cidadeUf,
    tempoEstimadoEntrega:
      live.tempoEstimadoEntrega || base.tempoEstimadoEntrega,
    tempoEstimadoRetirada:
      live.tempoEstimadoRetirada || base.tempoEstimadoRetirada,
    pedidoMinimo:
      typeof live.pedidoMinimo === 'number'
        ? live.pedidoMinimo
        : base.pedidoMinimo,
    resumoHorario: live.resumoHorario || base.resumoHorario,
    pix: {
      chave: live.pixChave || base.pix.chave,
      nomeRecebedor: live.pixNomeRecebedor || base.pix.nomeRecebedor,
      cidadeRecebedor: live.pixCidadeRecebedor || base.pix.cidadeRecebedor,
    },
    bairrosEntrega:
      live.bairrosEntrega && live.bairrosEntrega.length > 0
        ? live.bairrosEntrega
        : base.bairrosEntrega,
  };
}

export function applyBrandColorVariables(
  hexColor: string,
  isDark: boolean
): void {
  const clean = hexColor.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return;

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  const darken = (val: number, factor: number) =>
    Math.max(0, Math.round(val * (1 - factor)));
  const lighten = (val: number, factor: number) =>
    Math.min(255, Math.round(val + (255 - val) * factor));

  const toHex = (nr: number, ng: number, nb: number) =>
    `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

  const hoverHex = toHex(darken(r, 0.14), darken(g, 0.14), darken(b, 0.14));
  const darkTextHex = toHex(
    lighten(r, 0.32),
    lighten(g, 0.32),
    lighten(b, 0.32)
  );
  const lightTextHex = toHex(darken(r, 0.14), darken(g, 0.14), darken(b, 0.14));

  const root = document.documentElement;
  root.style.setProperty('--brand-primary', `#${clean}`);
  root.style.setProperty('--brand-primary-hover', hoverHex);
  root.style.setProperty(
    '--brand-primary-soft',
    `rgba(${r}, ${g}, ${b}, ${isDark ? 0.18 : 0.1})`
  );
  root.style.setProperty(
    '--brand-primary-border',
    `rgba(${r}, ${g}, ${b}, ${isDark ? 0.38 : 0.28})`
  );
  root.style.setProperty(
    '--brand-primary-text',
    isDark ? darkTextHex : lightTextHex
  );
}

export function isDeliveryFeeToNegotiate(
  tipoPedido: CustomerCheckoutData['tipoPedido'],
  selectedNeighborhood?: NeighborhoodFee
): boolean {
  if (tipoPedido !== 'entrega' || !selectedNeighborhood) return false;
  return Boolean(
    selectedNeighborhood.aCombinar || selectedNeighborhood.taxa === null
  );
}

export function formatComposedAddress(customer: CustomerCheckoutData): string {
  const parts: string[] = [];
  if (customer.rua.trim()) {
    parts.push(
      customer.numero.trim()
        ? `${customer.rua.trim()}, ${customer.numero.trim()}`
        : customer.rua.trim()
    );
  }
  if (customer.complemento.trim()) {
    parts.push(customer.complemento.trim());
  }
  return parts.join(' — ') || customer.endereco.trim();
}

function normalizePixText(
  text: string,
  maxLength: number,
  fallback: string
): string {
  const cleaned = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
  return cleaned || fallback;
}

function formatEmvField(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildPixPayload(params: {
  chave: string;
  nomeRecebedor: string;
  cidadeRecebedor: string;
  valor: number;
  txid?: string;
}): string {
  const cleanKey = params.chave.trim();
  const merchantName = normalizePixText(params.nomeRecebedor, 25, 'LOJA');
  const merchantCity = normalizePixText(params.cidadeRecebedor, 15, 'BRASIL');
  const txid = (params.txid || '***').slice(0, 25);

  const merchantAccountInfo =
    formatEmvField('00', 'br.gov.bcb.pix') + formatEmvField('01', cleanKey);
  const additionalData = formatEmvField('05', txid);

  let payload =
    formatEmvField('00', '01') +
    formatEmvField('26', merchantAccountInfo) +
    formatEmvField('52', '0000') +
    formatEmvField('53', '986');

  if (params.valor > 0) {
    payload += formatEmvField('54', params.valor.toFixed(2));
  }

  payload +=
    formatEmvField('58', 'BR') +
    formatEmvField('59', merchantName) +
    formatEmvField('60', merchantCity) +
    formatEmvField('62', additionalData) +
    '6304';

  return payload + crc16ccitt(payload);
}

export function parseMoneyInput(raw: string): number | null {
  const cleaned = String(raw || '')
    .replace(/[R$\s]/gi, '')
    .trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Number(num.toFixed(2));
}

export function calculateCashChange(
  trocoPara: string,
  orderTotal: number,
  semTroco?: boolean
): { paidAmount: number; changeDue: number } | null {
  if (semTroco || !trocoPara || !trocoPara.trim()) return null;
  const paidAmount = parseMoneyInput(trocoPara);
  if (paidAmount === null || paidAmount <= orderTotal) return null;
  return {
    paidAmount,
    changeDue: Number((paidAmount - orderTotal).toFixed(2)),
  };
}

function formatChangeAmount(raw: string): string {
  const numeric = parseMoneyInput(raw);
  if (numeric !== null) {
    return formatBRL(numeric);
  }
  const trimmed = raw.trim();
  return trimmed.toLowerCase().startsWith('r$') ? trimmed : `R$ ${trimmed}`;
}

export function buildWhatsAppOrderMessage(params: {
  store: StoreConfig;
  items: CartItem[];
  customer: CustomerCheckoutData;
  selectedNeighborhood?: NeighborhoodFee;
  subtotal: number;
  deliveryFee: number;
  total: number;
  codigoPedido?: string;
}): string {
  const {
    store,
    items,
    customer,
    selectedNeighborhood,
    subtotal,
    deliveryFee,
    total,
    codigoPedido,
  } = params;

  const feeToNegotiate = isDeliveryFeeToNegotiate(
    customer.tipoPedido,
    selectedNeighborhood
  );

  const lines: string[] = [];

  lines.push(
    codigoPedido
      ? `*NOVO PEDIDO ${codigoPedido} — ${store.nome.toUpperCase()}*`
      : `*NOVO PEDIDO — ${store.nome.toUpperCase()}*`
  );
  lines.push('');
  lines.push(`*Cliente:* ${customer.nome.trim()}`);
  if (customer.whatsapp.trim()) {
    lines.push(`*WhatsApp:* ${customer.whatsapp.trim()}`);
  }
  lines.push(
    `*Tipo:* ${
      customer.tipoPedido === 'entrega' ? 'Entrega' : 'Retirada no balcão'
    }`
  );

  if (customer.tipoPedido === 'entrega') {
    lines.push(`*Endereço:* ${formatComposedAddress(customer)}`);
    if (selectedNeighborhood) {
      lines.push(`*Bairro:* ${selectedNeighborhood.nome}`);
    }
    if (customer.pontoReferencia.trim()) {
      lines.push(`*Ponto de referência:* ${customer.pontoReferencia.trim()}`);
    }
  } else {
    lines.push(`*Retirada em:* ${store.enderecoRetirada}`);
  }

  lines.push('');
  lines.push('*ITENS DO PEDIDO*');

  items.forEach((item) => {
    const lineTotal = formatBRL(getCartItemTotal(item));
    lines.push(`• *${item.quantidade}x ${item.nome}* — ${lineTotal}`);

    if (item.pontoCarne) {
      lines.push(`   Opção/Ponto: ${item.pontoCarne}`);
    }
    if (item.adicionais.length > 0) {
      const addonsText = item.adicionais
        .map((a) => `${a.nome} (+${formatBRL(a.preco)})`)
        .join(', ');
      lines.push(`   Adicionais: ${addonsText}`);
    }
    if (item.ingredientesRemovidos.length > 0) {
      lines.push(`   Retirar: Sem ${item.ingredientesRemovidos.join(', sem ')}`);
    }
    if (item.observacao.trim()) {
      lines.push(`   Obs: ${item.observacao.trim()}`);
    }
  });

  lines.push('');
  lines.push('*RESUMO*');
  lines.push(`Subtotal: ${formatBRL(subtotal)}`);
  if (customer.tipoPedido === 'retirada') {
    lines.push('Taxa de entrega: Grátis (Retirada)');
    lines.push(`*Total: ${formatBRL(total)}*`);
  } else if (feeToNegotiate) {
    lines.push('Taxa de entrega: A combinar');
    lines.push(`*Total: ${formatBRL(subtotal)} + entrega (a combinar)*`);
  } else {
    lines.push(`Taxa de entrega: ${formatBRL(deliveryFee)}`);
    lines.push(`*Total: ${formatBRL(total)}*`);
  }

  lines.push('');

  if (customer.pagamento === 'pix') {
    if (feeToNegotiate) {
      lines.push('Pagamento: Pix (valor total a confirmar)');
    } else {
      lines.push(`Pagamento: Pix (${formatBRL(total)})`);
      lines.push(
        'Acabei de finalizar o pedido via Pix pelo cardápio digital. Segue o comprovante!'
      );
    }
  } else if (customer.pagamento === 'pix_entrega') {
    lines.push('Pagamento: Pix na entrega.');
  } else if (customer.pagamento === 'cartao') {
    lines.push('Pagamento: Cartão na entrega (débito, crédito ou VR).');
  } else {
    if (customer.semTroco || !customer.trocoPara.trim()) {
      lines.push('Pagamento: Dinheiro, sem troco.');
    } else {
      const calc = calculateCashChange(
        customer.trocoPara,
        feeToNegotiate ? subtotal : total,
        customer.semTroco
      );
      if (calc && !feeToNegotiate) {
        lines.push(
          `Pagamento: Dinheiro, troco para ${formatBRL(calc.paidAmount)} (troco a devolver: ${formatBRL(calc.changeDue)})`
        );
      } else {
        lines.push(
          `Pagamento: Dinheiro, troco para ${formatChangeAmount(customer.trocoPara)}`
        );
      }
    }
  }

  return lines.join('\n');
}

export function sanitizeWhatsAppNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digitsOnly = sanitizeWhatsAppNumber(phone);
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}
