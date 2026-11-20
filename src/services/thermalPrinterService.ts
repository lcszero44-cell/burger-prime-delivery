import type {
  CashClosingSummary,
  KitchenOrder,
  KitchenSettings,
  StoreConfig,
} from '../types/order';
import { calculateCashChange, formatBRL } from '../utils/formatters';

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
}

interface SerialNavigatorLike {
  getPorts(): Promise<SerialPortLike[]>;
  requestPort(): Promise<SerialPortLike>;
}

function getSerialApi(): SerialNavigatorLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & { serial?: SerialNavigatorLike };
  return nav.serial ?? null;
}

const BAUD_STORAGE_KEY = 'burger_prime_printer_baud_v1';

let activePort: SerialPortLike | null = null;
let activePortLabel = '';

export function isWebSerialSupported(): boolean {
  return Boolean(getSerialApi());
}

export function isSerialPrinterConnected(): boolean {
  return Boolean(activePort && activePort.writable);
}

export function getConnectedPrinterLabel(): string {
  return activePortLabel || 'Impressora Térmica ESC/POS';
}

export function getSavedBaudRate(): number {
  try {
    const raw = Number(localStorage.getItem(BAUD_STORAGE_KEY));
    if ([9600, 19200, 38400, 57600, 115200].includes(raw)) return raw;
  } catch {
    // ignore
  }
  return 9600;
}

function buildPortLabel(port: SerialPortLike): string {
  try {
    const info = port.getInfo?.();
    if (info?.usbVendorId) {
      const vid = info.usbVendorId.toString(16).toUpperCase().padStart(4, '0');
      const pid = (info.usbProductId || 0)
        .toString(16)
        .toUpperCase()
        .padStart(4, '0');
      return `Térmica USB (${vid}:${pid})`;
    }
  } catch {
    // ignore
  }
  return 'Impressora Térmica (Serial/Bluetooth)';
}

/**
 * Abre o seletor nativo do navegador para o dono escolher a impressora térmica (USB/COM/Bluetooth).
 */
export async function connectSerialPrinter(baudRate = 9600): Promise<string> {
  const serial = getSerialApi();
  if (!serial) {
    throw new Error(
      'Seu navegador não suporta conexão direta USB/Serial. Use Google Chrome ou Microsoft Edge no computador, ou imprima via Impressora Padrão do Windows.'
    );
  }

  const port = await serial.requestPort();

  // Close previous port if replacing
  if (activePort && activePort !== port) {
    try {
      await activePort.close();
    } catch {
      // ignore
    }
  }

  if (!port.writable) {
    await port.open({ baudRate });
  }

  activePort = port;
  activePortLabel = buildPortLabel(port);

  try {
    localStorage.setItem(BAUD_STORAGE_KEY, String(baudRate));
  } catch {
    // ignore
  }

  return activePortLabel;
}

/**
 * Tenta reconectar automaticamente a uma impressora já autorizada anteriormente neste computador.
 */
export async function tryAutoReconnectSerialPrinter(): Promise<string | null> {
  const serial = getSerialApi();
  if (!serial) return null;
  if (isSerialPrinterConnected()) return activePortLabel;

  try {
    const ports = await serial.getPorts();
    if (!ports || ports.length === 0) return null;
    const port = ports[0];
    if (!port.writable) {
      await port.open({ baudRate: getSavedBaudRate() });
    }
    activePort = port;
    activePortLabel = buildPortLabel(port);
    return activePortLabel;
  } catch {
    return null;
  }
}

export async function disconnectSerialPrinter(): Promise<void> {
  if (!activePort) return;
  try {
    await activePort.close();
  } catch {
    // ignore
  } finally {
    activePort = null;
    activePortLabel = '';
  }
}

/**
 * Normaliza acentos para ASCII limpo (100% compatível com Epson, Elgin, Bematech, Daruma, Tanca, Knup e genéricas 58mm/80mm).
 */
function toPrinterAscii(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, ' ');
}

function wrapLine(text: string, width: number): string[] {
  const clean = toPrinterAscii(text).trim();
  if (!clean) return [];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function twoColLine(left: string, right: string, width: number): string {
  const l = toPrinterAscii(left);
  const r = toPrinterAscii(right);
  const spaces = Math.max(1, width - l.length - r.length);
  if (l.length + r.length + 1 > width) {
    const maxL = Math.max(6, width - r.length - 1);
    return `${l.slice(0, maxL)} ${r}`;
  }
  return `${l}${' '.repeat(spaces)}${r}`;
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

class EscPosBuilder {
  private bytes: number[] = [];

  raw(...vals: number[]): this {
    this.bytes.push(...vals);
    return this;
  }

  init(): this {
    return this.raw(ESC, 0x40);
  }

  align(mode: 'left' | 'center' | 'right'): this {
    const n = mode === 'center' ? 1 : mode === 'right' ? 2 : 0;
    return this.raw(ESC, 0x61, n);
  }

  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  size(scale: 'normal' | 'tall' | 'large'): this {
    const n = scale === 'large' ? 0x11 : scale === 'tall' ? 0x01 : 0x00;
    return this.raw(GS, 0x21, n);
  }

  invert(on: boolean): this {
    return this.raw(GS, 0x42, on ? 1 : 0);
  }

  line(text = ''): this {
    const ascii = toPrinterAscii(text);
    for (let i = 0; i < ascii.length; i++) {
      this.bytes.push(ascii.charCodeAt(i));
    }
    this.bytes.push(LF);
    return this;
  }

  hr(width: number, char = '-'): this {
    return this.line(char.repeat(width));
  }

  feed(lines = 3): this {
    for (let i = 0; i < lines; i++) {
      this.bytes.push(LF);
    }
    return this;
  }

  cut(): this {
    // Partial cut (standard on 80mm printers, safely ignored by 58mm tear-bar printers)
    return this.raw(GS, 0x56, 0x42, 0x00);
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

function appendCopyBytes(
  b: EscPosBuilder,
  order: KitchenOrder,
  store: StoreConfig,
  settings: KitchenSettings,
  copyLabel?: string
) {
  const width = settings.paperWidth === '58mm' ? 32 : 48;
  const isPixPaid = order.pagamento === 'pix' && order.pixStatus === 'confirmado';
  const isPixPending =
    order.pagamento === 'pix' && order.pixStatus !== 'confirmado';

  const dateStr = new Date(order.createdAtMs).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  b.init().align('center');
  if (copyLabel) {
    b.bold(true).line(`*** ${copyLabel} ***`).bold(false);
  }

  b.bold(true).size('tall').line(store.nome.toUpperCase()).size('normal').bold(false);
  b.line(dateStr);
  b.bold(true).size('large').line(`PEDIDO ${order.codigoPedido}`).size('normal');
  b.line(
    order.tipoPedido === 'entrega' ? '[ ENTREGA ]' : '[ RETIRADA NO BALCAO ]'
  );
  b.bold(false).hr(width, '=');

  // Payment / Pix Banner
  b.align('center').bold(true);
  if (isPixPaid) {
    b.invert(true)
      .line(' *** PAGAMENTO: PIX - PAGO *** ')
      .invert(false)
      .line('COMPROVANTE CONFIRMADO')
      .line('NAO COBRAR DO CLIENTE');
  } else if (isPixPending) {
    b.line('PAGAMENTO: PIX (PENDENTE)')
      .line('CONFERIR COMPROVANTE ANTES DE LIBERAR');
  } else if (order.pagamento === 'cartao') {
    b.line('CARTAO NA ENTREGA')
      .line(
        `LEVAR MAQUININHA - ${
          order.taxaACombinar
            ? `${formatBRL(order.subtotal)} + TAXA`
            : formatBRL(order.total)
        }`
      );
  } else {
    const changeCalc = !order.taxaACombinar
      ? calculateCashChange(order.trocoPara, order.total, order.semTroco)
      : null;
    b.line(
      `DINHEIRO - COBRAR ${
        order.taxaACombinar
          ? `${formatBRL(order.subtotal)} + TAXA`
          : formatBRL(order.total)
      }`
    );
    if (order.semTroco || !order.trocoPara) {
      b.line('SEM TROCO');
    } else if (changeCalc) {
      b.line(`TROCO PARA: ${formatBRL(changeCalc.paidAmount)}`);
      b.invert(true)
        .line(` TROCO A DEVOLVER: ${formatBRL(changeCalc.changeDue)} `)
        .invert(false);
    } else {
      b.line(`TROCO PARA: ${order.trocoPara}`);
    }
  }
  b.bold(false).hr(width, '-');

  // Customer & Address
  b.align('left');
  b.bold(true).line(`CLIENTE: ${order.clienteNome.toUpperCase()}`).bold(false);
  if (order.clienteWhatsapp) {
    b.line(`WHATSAPP: ${order.clienteWhatsapp}`);
  }
  if (order.tipoPedido === 'entrega') {
    wrapLine(`END: ${order.endereco}`, width).forEach((l) => b.line(l));
    if (order.bairroNome) b.line(`BAIRRO: ${order.bairroNome}`);
    if (order.pontoReferencia) {
      wrapLine(`REF: ${order.pontoReferencia}`, width).forEach((l) => b.line(l));
    }
  } else {
    b.line('RETIRAR NO BALCAO DA LOJA');
  }
  b.hr(width, '-');

  // Items
  b.bold(true).line('ITENS DO PEDIDO').bold(false);
  for (const item of order.itens) {
    b.bold(true).line(
      twoColLine(
        `${item.quantidade}x ${item.nome.toUpperCase()}`,
        formatBRL(item.precoTotal),
        width
      )
    ).bold(false);

    if (item.pontoCarne) {
      b.line(`  - OPCAO/PONTO: ${item.pontoCarne.toUpperCase()}`);
    }
    if (item.adicionais.length > 0) {
      wrapLine(`  + ADIC: ${item.adicionais.join(', ')}`, width).forEach((l) =>
        b.line(l)
      );
    }
    if (item.ingredientesRemovidos.length > 0) {
      wrapLine(
        `  - RETIRAR: SEM ${item.ingredientesRemovidos.join(', SEM ').toUpperCase()}`,
        width
      ).forEach((l) => b.line(l));
    }
    if (item.observacao) {
      b.bold(true);
      wrapLine(`  *** OBS: ${item.observacao.toUpperCase()} ***`, width).forEach(
        (l) => b.line(l)
      );
      b.bold(false);
    }
  }
  b.hr(width, '=');

  // Totals
  b.line(twoColLine('SUBTOTAL:', formatBRL(order.subtotal), width));
  b.line(
    twoColLine(
      'ENTREGA:',
      order.tipoPedido === 'retirada'
        ? 'GRATIS'
        : order.taxaACombinar
          ? 'A COMBINAR'
          : formatBRL(order.taxaEntrega),
      width
    )
  );
  b.bold(true)
    .size('tall')
    .line(
      twoColLine(
        'TOTAL:',
        order.taxaACombinar
          ? `${formatBRL(order.subtotal)} + TAXA`
          : formatBRL(order.total),
        width
      )
    )
    .size('normal')
    .bold(false);

  if (settings.storeFooterNote) {
    b.hr(width, '-').align('center');
    wrapLine(settings.storeFooterNote, width).forEach((l) => b.line(l));
  }

  b.feed(4).cut();
}

async function writeBytesToSerial(data: Uint8Array): Promise<void> {
  if (!activePort || !activePort.writable) {
    throw new Error('Nenhuma impressora direta conectada.');
  }
  const writer = activePort.writable.getWriter();
  try {
    await writer.write(data);
  } finally {
    writer.releaseLock();
  }
}

export async function printOrderDirectEscPos(
  order: KitchenOrder,
  store: StoreConfig,
  settings: KitchenSettings
): Promise<void> {
  const builder = new EscPosBuilder();
  const copies = settings.copies === 2 ? 2 : 1;

  appendCopyBytes(
    builder,
    order,
    store,
    settings,
    copies === 2 ? 'VIA 1 - COZINHA' : undefined
  );

  if (copies === 2) {
    appendCopyBytes(builder, order, store, settings, 'VIA 2 - ENTREGA / CAIXA');
  }

  await writeBytesToSerial(builder.build());
}

export async function printTestTicketDirectEscPos(
  storeName: string,
  paperWidth: '80mm' | '58mm'
): Promise<void> {
  const width = paperWidth === '58mm' ? 32 : 48;
  const b = new EscPosBuilder();
  b.init()
    .align('center')
    .bold(true)
    .size('tall')
    .line(storeName.toUpperCase())
    .size('normal')
    .line('TESTE DE IMPRESSORA TERMICA')
    .bold(false)
    .hr(width, '=')
    .align('left')
    .line(`Bobina configurada: ${paperWidth}`)
    .line(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`)
    .line('Modo: Conexao Direta ESC/POS (100% Automatica)')
    .hr(width, '-')
    .align('center')
    .bold(true)
    .line('IMPRESSORA CONECTADA COM SUCESSO!')
    .bold(false)
    .feed(4)
    .cut();

  await writeBytesToSerial(b.build());
}

export async function printCashClosingDirectEscPos(
  summary: CashClosingSummary,
  storeName: string,
  paperWidth: '80mm' | '58mm'
): Promise<void> {
  const width = paperWidth === '58mm' ? 32 : 48;
  const b = new EscPosBuilder();
  const printedAt = new Date(summary.printedAtMs).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  b.init()
    .align('center')
    .bold(true)
    .size('tall')
    .line(storeName.toUpperCase())
    .size('normal')
    .line('FECHAMENTO DE CAIXA')
    .bold(false)
    .line(`Periodo: ${summary.periodLabel}`)
    .line(`Emitido em: ${printedAt}`)
    .hr(width, '=')
    .align('left')
    .bold(true)
    .size('tall')
    .line(twoColLine('FATURAMENTO:', formatBRL(summary.totalRevenue), width))
    .size('normal')
    .bold(false)
    .line(
      twoColLine('Concluidos (R$):', formatBRL(summary.completedRevenue), width)
    )
    .line(twoColLine('Ticket medio:', formatBRL(summary.averageTicket), width))
    .line(
      twoColLine('Taxas entrega:', formatBRL(summary.deliveryFeesTotal), width)
    )
    .hr(width, '-')
    .bold(true)
    .line('QUANTIDADE DE PEDIDOS')
    .bold(false)
    .line(twoColLine('Pedidos validos:', String(summary.validOrdersCount), width))
    .line(twoColLine('Concluidos:', String(summary.completedOrdersCount), width))
    .line(
      twoColLine('Em andamento:', String(summary.inProgressOrdersCount), width)
    )
    .line(twoColLine('Cancelados:', String(summary.cancelledOrdersCount), width))
    .hr(width, '-')
    .bold(true)
    .line('RESUMO POR PAGAMENTO')
    .bold(false)
    .line(
      twoColLine(
        `PIX (${summary.pixCount}):`,
        formatBRL(summary.pixTotal),
        width
      )
    )
    .line(
      twoColLine(
        `CARTAO (${summary.cartaoCount}):`,
        formatBRL(summary.cartaoTotal),
        width
      )
    )
    .line(
      twoColLine(
        `DINHEIRO (${summary.dinheiroCount}):`,
        formatBRL(summary.dinheiroTotal),
        width
      )
    )
    .hr(width, '=')
    .feed(2)
    .align('center')
    .line('Conferido por: ______________________')
    .feed(4)
    .cut();

  await writeBytesToSerial(b.build());
}

