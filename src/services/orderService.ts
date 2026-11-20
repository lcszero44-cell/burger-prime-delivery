import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { PRODUTOS, STORE_CONFIG } from '../config/menuData';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  AddonOption,
  CartItem,
  CustomerCheckoutData,
  KitchenOrder,
  KitchenOrderItem,
  KitchenOrderStatus,
  LiveStoreSettings,
  NeighborhoodFee,
  PixConfirmationSource,
  PixStatus,
  Product,
  ProductBadge,
  ProductCategory,
} from '../types/order';
import {
  formatComposedAddress,
  formatSequentialCode,
  getCartItemTotal,
  getCartItemUnitPrice,
} from '../utils/formatters';

const ORDERS_PATH = 'orders';
const PRODUCTS_PATH = 'products';
const SETTINGS_PATH = 'storeSettings';
const SETTINGS_ID = 'main';
const ADMIN_AUTH_PATH = 'adminAuth';
const ADMIN_AUTH_ID = 'config';
const COUNTERS_PATH = 'counters';
const ORDERS_COUNTER_ID = 'orders';

export const DEFAULT_ADMIN_PASSWORD = '1234';

export const DEFAULT_LIVE_STORE_SETTINGS: LiveStoreSettings = {
  nome: STORE_CONFIG.nome,
  slogan: STORE_CONFIG.slogan,
  abertoManual: true,
  whatsapp: STORE_CONFIG.whatsapp,
  enderecoRetirada: STORE_CONFIG.enderecoRetirada,
  cidadeUf: STORE_CONFIG.cidadeUf,
  tempoEstimadoEntrega: STORE_CONFIG.tempoEstimadoEntrega,
  tempoEstimadoRetirada: STORE_CONFIG.tempoEstimadoRetirada,
  pedidoMinimo: STORE_CONFIG.pedidoMinimo,
  resumoHorario: STORE_CONFIG.resumoHorario,
  pixChave: STORE_CONFIG.pix.chave,
  pixNomeRecebedor: STORE_CONFIG.pix.nomeRecebedor,
  pixCidadeRecebedor: STORE_CONFIG.pix.cidadeRecebedor,
  bairrosEntrega: STORE_CONFIG.bairrosEntrega,
  autoPrintEnabled: true,
  autoPrintPendingPix: false,
  soundEnabled: true,
  paperWidth: '80mm',
  copies: 1,
  storeFooterNote: 'Obrigado pela preferência! Bom apetite.',
};

function sanitizeString(value: unknown, maxLength: number): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

function generateOrderDocId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `ord_${Date.now()}_${rand}`;
}

export function slugifyProductId(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${base || 'prod'}-${rand}`;
}

function timestampToMs(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export async function sha256Hex(plain: string): Promise<string> {
  const encoded = new TextEncoder().encode(plain);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic hash for non-HTTPS local preview environments
  let h = 2166136261;
  for (let i = 0; i < plain.length; i++) {
    h ^= plain.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fallback_${(h >>> 0).toString(16).padStart(16, '0')}`;
}

/**
 * Verifica a senha do Painel Admin (padrão inicial: "1234", persistida em adminAuth/config).
 */
export async function verifyAdminPassword(inputPassword: string): Promise<boolean> {
  const clean = inputPassword.trim();
  if (!clean) return false;
  const inputHash = await sha256Hex(clean);
  const ref = doc(db, ADMIN_AUTH_PATH, ADMIN_AUTH_ID);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const defaultHash = await sha256Hex(DEFAULT_ADMIN_PASSWORD);
      if (inputHash === defaultHash) {
        await setDoc(ref, {
          passHash: defaultHash,
          updatedAt: serverTimestamp(),
        });
        return true;
      }
      return false;
    }
    const storedHash = String(snap.data()?.passHash || '');
    return storedHash === inputHash;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.GET,
      `${ADMIN_AUTH_PATH}/${ADMIN_AUTH_ID}`
    );
  }
}

export async function updateAdminPassword(newPassword: string): Promise<void> {
  const clean = newPassword.trim();
  if (clean.length < 4) {
    throw new Error('A senha deve ter pelo menos 4 caracteres.');
  }
  const passHash = await sha256Hex(clean);
  const ref = doc(db, ADMIN_AUTH_PATH, ADMIN_AUTH_ID);
  try {
    await setDoc(ref, {
      passHash,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `${ADMIN_AUTH_PATH}/${ADMIN_AUTH_ID}`
    );
  }
}

/**
 * Escuta as configurações da loja em tempo real (Aberto/Fechado, Pix, Bairros, Impressora).
 */
export function subscribeToStoreSettings(
  onUpdate: (settings: LiveStoreSettings) => void,
  onError?: (err: Error) => void
) {
  const ref = doc(db, SETTINGS_PATH, SETTINGS_ID);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(DEFAULT_LIVE_STORE_SETTINGS);
        return;
      }
      const d = snap.data();
      const rawBairros = Array.isArray(d.bairrosEntrega)
        ? d.bairrosEntrega
        : DEFAULT_LIVE_STORE_SETTINGS.bairrosEntrega;

      const bairrosEntrega: NeighborhoodFee[] = rawBairros.map(
        (b: DocumentData, i: number) => ({
          id: String(b.id || `bairro-${i}`),
          nome: String(b.nome || 'Bairro'),
          taxa: b.aCombinar || b.taxa === null ? null : Number(b.taxa ?? 0),
          aCombinar: Boolean(b.aCombinar || b.taxa === null),
        })
      );

      onUpdate({
        nome: String(d.nome || DEFAULT_LIVE_STORE_SETTINGS.nome),
        slogan: String(d.slogan ?? DEFAULT_LIVE_STORE_SETTINGS.slogan),
        abertoManual:
          typeof d.abertoManual === 'boolean' ? d.abertoManual : true,
        whatsapp: String(d.whatsapp || DEFAULT_LIVE_STORE_SETTINGS.whatsapp),
        enderecoRetirada: String(
          d.enderecoRetirada || DEFAULT_LIVE_STORE_SETTINGS.enderecoRetirada
        ),
        cidadeUf: String(d.cidadeUf || DEFAULT_LIVE_STORE_SETTINGS.cidadeUf),
        tempoEstimadoEntrega: String(
          d.tempoEstimadoEntrega ||
            DEFAULT_LIVE_STORE_SETTINGS.tempoEstimadoEntrega
        ),
        tempoEstimadoRetirada: String(
          d.tempoEstimadoRetirada ||
            DEFAULT_LIVE_STORE_SETTINGS.tempoEstimadoRetirada
        ),
        pedidoMinimo: Number(
          d.pedidoMinimo ?? DEFAULT_LIVE_STORE_SETTINGS.pedidoMinimo
        ),
        resumoHorario: String(
          d.resumoHorario ?? DEFAULT_LIVE_STORE_SETTINGS.resumoHorario
        ),
        pixChave: String(d.pixChave || DEFAULT_LIVE_STORE_SETTINGS.pixChave),
        pixNomeRecebedor: String(
          d.pixNomeRecebedor || DEFAULT_LIVE_STORE_SETTINGS.pixNomeRecebedor
        ),
        pixCidadeRecebedor: String(
          d.pixCidadeRecebedor ||
            DEFAULT_LIVE_STORE_SETTINGS.pixCidadeRecebedor
        ),
        bairrosEntrega,
        autoPrintEnabled:
          typeof d.autoPrintEnabled === 'boolean'
            ? d.autoPrintEnabled
            : DEFAULT_LIVE_STORE_SETTINGS.autoPrintEnabled,
        autoPrintPendingPix:
          typeof d.autoPrintPendingPix === 'boolean'
            ? d.autoPrintPendingPix
            : DEFAULT_LIVE_STORE_SETTINGS.autoPrintPendingPix,
        soundEnabled:
          typeof d.soundEnabled === 'boolean'
            ? d.soundEnabled
            : DEFAULT_LIVE_STORE_SETTINGS.soundEnabled,
        paperWidth: d.paperWidth === '58mm' ? '58mm' : '80mm',
        copies: d.copies === 2 ? 2 : 1,
        storeFooterNote: String(
          d.storeFooterNote ?? DEFAULT_LIVE_STORE_SETTINGS.storeFooterNote
        ),
      });
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function saveStoreSettings(
  settings: LiveStoreSettings
): Promise<void> {
  const path = `${SETTINGS_PATH}/${SETTINGS_ID}`;
  const cleanBairros = settings.bairrosEntrega.slice(0, 80).map((b, idx) => ({
    id: sanitizeString(b.id || `bairro-${idx}`, 60) || `bairro-${idx}`,
    nome: sanitizeString(b.nome, 80) || 'Bairro',
    taxa: b.aCombinar || b.taxa === null ? null : Math.max(0, Number(b.taxa)),
    aCombinar: Boolean(b.aCombinar || b.taxa === null),
  }));

  try {
    await setDoc(doc(db, SETTINGS_PATH, SETTINGS_ID), {
      nome: sanitizeString(settings.nome, 100) || STORE_CONFIG.nome,
      slogan: sanitizeString(settings.slogan, 200),
      abertoManual: Boolean(settings.abertoManual),
      whatsapp: sanitizeString(settings.whatsapp, 30),
      enderecoRetirada: sanitizeString(settings.enderecoRetirada, 200),
      cidadeUf: sanitizeString(settings.cidadeUf, 80),
      tempoEstimadoEntrega: sanitizeString(settings.tempoEstimadoEntrega, 40),
      tempoEstimadoRetirada: sanitizeString(settings.tempoEstimadoRetirada, 40),
      pedidoMinimo: Math.max(0, Number(settings.pedidoMinimo) || 0),
      resumoHorario: sanitizeString(settings.resumoHorario, 140),
      pixChave: sanitizeString(settings.pixChave, 140),
      pixNomeRecebedor: sanitizeString(settings.pixNomeRecebedor, 60),
      pixCidadeRecebedor: sanitizeString(settings.pixCidadeRecebedor, 40),
      bairrosEntrega: cleanBairros,
      autoPrintEnabled: Boolean(settings.autoPrintEnabled),
      autoPrintPendingPix: Boolean(settings.autoPrintPendingPix),
      soundEnabled: Boolean(settings.soundEnabled),
      paperWidth: settings.paperWidth === '58mm' ? '58mm' : '80mm',
      copies: settings.copies === 2 ? 2 : 1,
      storeFooterNote: sanitizeString(settings.storeFooterNote, 140),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function mapDocToProduct(id: string, d: DocumentData): Product {
  const validCategories: ProductCategory[] = [
    'hamburgueres',
    'combos',
    'porcoes',
    'bebidas',
    'sobremesas',
  ];
  const categoria: ProductCategory = validCategories.includes(d.categoria)
    ? d.categoria
    : 'hamburgueres';

  const etiqueta: ProductBadge | undefined =
    d.etiqueta === 'Mais pedido' || d.etiqueta === 'Novo'
      ? d.etiqueta
      : undefined;

  const adicionaisCustom: AddonOption[] | undefined =
    Array.isArray(d.adicionaisCustom) && d.adicionaisCustom.length > 0
      ? d.adicionaisCustom.map((a: DocumentData, idx: number) => ({
          id: String(a.id || `add-${idx}`),
          nome: String(a.nome || 'Adicional'),
          preco: Math.max(0, Number(a.preco ?? 0)),
        }))
      : undefined;

  const opcoesObrigatorias: string[] | undefined =
    Array.isArray(d.opcoesObrigatorias) && d.opcoesObrigatorias.length > 0
      ? d.opcoesObrigatorias.map(String).filter(Boolean)
      : undefined;

  return {
    id,
    nome: String(d.nome || 'Produto'),
    descricao: String(d.descricao || ''),
    preco: Math.max(0, Number(d.preco ?? 0)),
    categoria,
    imagem: String(d.imagem || ''),
    etiqueta,
    destaque: Boolean(d.destaque),
    ativo: typeof d.ativo === 'boolean' ? d.ativo : true,
    ordem: Number(d.ordem ?? 0),
    permitePontoCarne: Boolean(d.permitePontoCarne),
    opcoesObrigatorias,
    permiteAdicionais: Boolean(d.permiteAdicionais),
    adicionaisCustom,
    ingredientesRemoviveis: Array.isArray(d.ingredientesRemoviveis)
      ? d.ingredientesRemoviveis.map(String).filter(Boolean)
      : [],
  };
}

/**
 * Escuta o cardápio em tempo real no Firestore.
 * Se a coleção ainda estiver vazia, devolve `isEmpty: true` para o app usar o fallback local.
 */
export function subscribeToProducts(
  onUpdate: (products: Product[], fromFirestore: boolean) => void,
  onError?: (err: Error) => void
) {
  const q = query(
    collection(db, PRODUCTS_PATH),
    where('ordem', '>=', 0),
    orderBy('ordem', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onUpdate(
          PRODUTOS.map((p, idx) => ({ ...p, ativo: true, ordem: idx })),
          false
        );
        return;
      }
      const list = snap.docs.map((docSnap) =>
        mapDocToProduct(docSnap.id, docSnap.data())
      );
      onUpdate(list, true);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

/**
 * Importa os 17 produtos iniciais para o Firestore caso a coleção ainda esteja vazia.
 */
export async function seedInitialProductsIfEmpty(): Promise<boolean> {
  const q = query(
    collection(db, PRODUCTS_PATH),
    where('ordem', '>=', 0),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) return false;

  const batch = writeBatch(db);
  PRODUTOS.forEach((p, idx) => {
    const ref = doc(db, PRODUCTS_PATH, p.id);
    batch.set(ref, {
      nome: sanitizeString(p.nome, 120),
      descricao: sanitizeString(p.descricao, 500),
      preco: Number(p.preco),
      categoria: p.categoria,
      imagem: sanitizeString(p.imagem, 500),
      etiqueta: p.etiqueta || '',
      destaque: Boolean(p.destaque),
      ativo: true,
      permitePontoCarne: Boolean(p.permitePontoCarne),
      opcoesObrigatorias: [],
      permiteAdicionais: Boolean(p.permiteAdicionais),
      adicionaisCustom: [],
      ingredientesRemoviveis: p.ingredientesRemoviveis || [],
      ordem: idx,
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PRODUCTS_PATH);
  }
}

export async function saveProductToFirestore(product: Product): Promise<void> {
  const id = sanitizeString(product.id, 120) || slugifyProductId(product.nome);
  const path = `${PRODUCTS_PATH}/${id}`;

  const cleanAddons = (product.adicionaisCustom || [])
    .slice(0, 20)
    .filter((a) => a.nome.trim())
    .map((a, idx) => ({
      id: sanitizeString(a.id || `add-${idx}`, 50) || `add-${idx}`,
      nome: sanitizeString(a.nome, 80),
      preco: Math.max(0, Number(a.preco) || 0),
    }));

  const cleanOptions = (product.opcoesObrigatorias || [])
    .slice(0, 10)
    .map((o) => sanitizeString(o, 60))
    .filter(Boolean);

  const cleanRemovables = (product.ingredientesRemoviveis || [])
    .slice(0, 20)
    .map((r) => sanitizeString(r, 60))
    .filter(Boolean);

  try {
    await setDoc(doc(db, PRODUCTS_PATH, id), {
      nome: sanitizeString(product.nome, 120),
      descricao: sanitizeString(product.descricao, 500),
      preco: Math.max(0, Number(product.preco) || 0),
      categoria: product.categoria,
      imagem: sanitizeString(product.imagem, 500),
      etiqueta: product.etiqueta || '',
      destaque: Boolean(product.destaque),
      ativo: product.ativo !== false,
      permitePontoCarne: Boolean(product.permitePontoCarne),
      opcoesObrigatorias: cleanOptions,
      permiteAdicionais: Boolean(product.permiteAdicionais),
      adicionaisCustom: cleanAddons,
      ingredientesRemoviveis: cleanRemovables,
      ordem: Math.max(0, Math.floor(product.ordem ?? 0)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const path = `${PRODUCTS_PATH}/${productId}`;
  try {
    await deleteDoc(doc(db, PRODUCTS_PATH, productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function mapDocToKitchenOrder(id: string, data: DocumentData): KitchenOrder {
  const rawItems = Array.isArray(data.itens) ? data.itens : [];
  const itens: KitchenOrderItem[] = rawItems.map((item: DocumentData) => ({
    nome: String(item.nome ?? ''),
    quantidade: Number(item.quantidade ?? 1),
    precoUnitario: Number(item.precoUnitario ?? 0),
    precoTotal: Number(item.precoTotal ?? 0),
    pontoCarne: String(item.pontoCarne ?? ''),
    adicionais: Array.isArray(item.adicionais)
      ? item.adicionais.map(String)
      : [],
    ingredientesRemovidos: Array.isArray(item.ingredientesRemovidos)
      ? item.ingredientesRemovidos.map(String)
      : [],
    observacao: String(item.observacao ?? ''),
  }));

  const numeroPedido = Math.max(1, Number(data.numeroPedido ?? 1));

  return {
    id,
    numeroPedido,
    codigoPedido: String(
      data.codigoPedido || formatSequentialCode(numeroPedido)
    ),
    clienteNome: String(data.clienteNome ?? 'Cliente'),
    clienteWhatsapp: String(data.clienteWhatsapp ?? ''),
    tipoPedido: data.tipoPedido === 'retirada' ? 'retirada' : 'entrega',
    rua: String(data.rua ?? ''),
    numero: String(data.numero ?? ''),
    complemento: String(data.complemento ?? ''),
    endereco: String(data.endereco ?? ''),
    bairroNome: String(data.bairroNome ?? ''),
    pontoReferencia: String(data.pontoReferencia ?? ''),
    itens,
    subtotal: Number(data.subtotal ?? 0),
    taxaEntrega: Number(data.taxaEntrega ?? 0),
    taxaACombinar: Boolean(data.taxaACombinar),
    total: Number(data.total ?? 0),
    pagamento:
      data.pagamento === 'pix' ||
      data.pagamento === 'pix_entrega' ||
      data.pagamento === 'cartao' ||
      data.pagamento === 'dinheiro'
        ? data.pagamento
        : 'pix',
    trocoPara: String(data.trocoPara ?? ''),
    semTroco: Boolean(data.semTroco),
    pixStatus:
      data.pixStatus === 'confirmado' ||
      data.pixStatus === 'aguardando_comprovante' ||
      data.pixStatus === 'nao_aplicavel'
        ? data.pixStatus
        : 'nao_aplicavel',
    pixConfirmadoPor:
      data.pixConfirmadoPor === 'cliente_declarado' ||
      data.pixConfirmadoPor === 'caixa_manual'
        ? data.pixConfirmadoPor
        : '',
    pixResumoVerificacao: String(data.pixResumoVerificacao ?? ''),
    status:
      data.status === 'em_preparo' ||
      data.status === 'saiu_entrega' ||
      data.status === 'concluido' ||
      data.status === 'cancelado'
        ? data.status
        : 'novo',
    impresso: Boolean(data.impresso),
    impressoCount: Number(data.impressoCount ?? 0),
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

/**
 * Gera próximo número sequencial atômico no Firestore (#0001, #0002, #0003...).
 */
async function getNextSequentialOrderNumber(): Promise<number> {
  const counterRef = doc(db, COUNTERS_PATH, ORDERS_COUNTER_ID);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const nextSeq = snap.exists() ? Number(snap.data()?.seq || 0) + 1 : 1;
    tx.set(counterRef, {
      seq: nextSeq,
      updatedAt: serverTimestamp(),
    });
    return nextSeq;
  });
}

/**
 * Salva um novo pedido no Firestore com número sequencial real em tempo real.
 */
export async function createKitchenOrder(params: {
  items: CartItem[];
  customer: CustomerCheckoutData;
  selectedNeighborhood?: NeighborhoodFee;
  subtotal: number;
  deliveryFee: number;
  feeToNegotiate: boolean;
  total: number;
  pixClienteJaPagou?: boolean;
}): Promise<{ orderId: string; numeroPedido: number; codigoPedido: string }> {
  const {
    items,
    customer,
    selectedNeighborhood,
    subtotal,
    deliveryFee,
    feeToNegotiate,
    total,
    pixClienteJaPagou = false,
  } = params;

  const orderId = generateOrderDocId();
  let numeroPedido = 1;
  try {
    numeroPedido = await getNextSequentialOrderNumber();
  } catch {
    numeroPedido = Math.floor(1000 + Math.random() * 8999);
  }
  const codigoPedido = formatSequentialCode(numeroPedido);

  const mappedItems: KitchenOrderItem[] = items.slice(0, 40).map((item) => ({
    nome: sanitizeString(item.nome, 120) || 'Item',
    quantidade: Math.max(1, Math.min(50, Math.round(item.quantidade))),
    precoUnitario: Math.max(0, Number(getCartItemUnitPrice(item).toFixed(2))),
    precoTotal: Math.max(0, Number(getCartItemTotal(item).toFixed(2))),
    pontoCarne: sanitizeString(item.pontoCarne || '', 60),
    adicionais: item.adicionais
      .slice(0, 20)
      .map((a) => sanitizeString(a.nome, 100))
      .filter(Boolean),
    ingredientesRemovidos: item.ingredientesRemovidos
      .slice(0, 20)
      .map((r) => sanitizeString(r, 80))
      .filter(Boolean),
    observacao: sanitizeString(item.observacao || '', 220),
  }));

  let pixStatus: PixStatus = 'nao_aplicavel';
  let pixConfirmadoPor: PixConfirmationSource = '';
  let pixResumoVerificacao = '';

  if (customer.pagamento === 'pix') {
    if (feeToNegotiate) {
      pixStatus = 'aguardando_comprovante';
      pixResumoVerificacao = 'Taxa a combinar antes do pagamento Pix.';
    } else if (pixClienteJaPagou) {
      pixStatus = 'aguardando_comprovante';
      pixConfirmadoPor = 'cliente_declarado';
      pixResumoVerificacao =
        'Cliente informou pagamento Pix no cardápio. Conferir recebimento no banco/WhatsApp.';
    } else {
      pixStatus = 'aguardando_comprovante';
      pixResumoVerificacao = 'Aguardando confirmação do pagamento Pix.';
    }
  }

  const composedAddress =
    customer.tipoPedido === 'entrega' ? formatComposedAddress(customer) : '';

  const payload = {
    numeroPedido,
    codigoPedido,
    clienteNome: sanitizeString(customer.nome, 100) || 'Cliente',
    clienteWhatsapp: sanitizeString(customer.whatsapp, 30),
    tipoPedido: customer.tipoPedido,
    rua:
      customer.tipoPedido === 'entrega' ? sanitizeString(customer.rua, 140) : '',
    numero:
      customer.tipoPedido === 'entrega'
        ? sanitizeString(customer.numero, 30)
        : '',
    complemento:
      customer.tipoPedido === 'entrega'
        ? sanitizeString(customer.complemento, 100)
        : '',
    endereco: sanitizeString(composedAddress, 260),
    bairroNome:
      customer.tipoPedido === 'entrega'
        ? sanitizeString(selectedNeighborhood?.nome || '', 100)
        : '',
    pontoReferencia:
      customer.tipoPedido === 'entrega'
        ? sanitizeString(customer.pontoReferencia, 160)
        : '',
    itens: mappedItems,
    subtotal: Math.max(0, Number(subtotal.toFixed(2))),
    taxaEntrega: Math.max(0, Number(deliveryFee.toFixed(2))),
    taxaACombinar: Boolean(feeToNegotiate),
    total: Math.max(0, Number(total.toFixed(2))),
    pagamento: customer.pagamento,
    trocoPara:
      customer.pagamento === 'dinheiro' && !customer.semTroco
        ? sanitizeString(customer.trocoPara, 40)
        : '',
    semTroco: Boolean(customer.semTroco),
    pixStatus,
    pixConfirmadoPor,
    pixResumoVerificacao,
    status: 'novo',
    impresso: false,
    impressoCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, ORDERS_PATH, orderId), payload);
    return { orderId, numeroPedido, codigoPedido };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${ORDERS_PATH}/${orderId}`);
  }
}

export async function createSimulatedTestOrder(
  mode: 'pix_confirmado' | 'pix_pendente' | 'cartao' | 'dinheiro'
): Promise<{ orderId: string; codigoPedido: string }> {
  const orderId = generateOrderDocId();
  let numeroPedido = 1;
  try {
    numeroPedido = await getNextSequentialOrderNumber();
  } catch {
    numeroPedido = Math.floor(1000 + Math.random() * 8999);
  }
  const codigoPedido = formatSequentialCode(numeroPedido);

  const isPix = mode === 'pix_confirmado' || mode === 'pix_pendente';
  const payload = {
    numeroPedido,
    codigoPedido,
    clienteNome:
      mode === 'pix_confirmado'
        ? 'Teste Pix Confirmado'
        : mode === 'pix_pendente'
          ? 'Teste Pix Aguardando'
          : mode === 'dinheiro'
            ? 'Teste Dinheiro c/ Troco'
            : 'Teste Cartão Entrega',
    clienteWhatsapp: '(34) 99102-9433',
    tipoPedido: 'entrega',
    rua: 'Av. João Naves de Ávila',
    numero: '1420',
    complemento: 'Apto 301',
    endereco: 'Av. João Naves de Ávila, 1420 — Apto 301',
    bairroNome: 'Santa Mônica',
    pontoReferencia: 'Pedido de teste do painel da cozinha',
    itens: [
      {
        nome: 'Prime Classic Smash',
        quantidade: 1,
        precoUnitario: 35.4,
        precoTotal: 35.4,
        pontoCarne: 'Ao ponto',
        adicionais: ['Bacon crocante'],
        ingredientesRemovidos: ['Picles'],
        observacao: 'Sem cebola, cortar ao meio',
      },
      {
        nome: 'Coca-Cola Lata 350ml',
        quantidade: 1,
        precoUnitario: 6.9,
        precoTotal: 6.9,
        pontoCarne: '',
        adicionais: [],
        ingredientesRemovidos: [],
        observacao: 'Bem gelada',
      },
    ],
    subtotal: 42.3,
    taxaEntrega: 5.0,
    taxaACombinar: false,
    total: 47.3,
    pagamento: isPix ? 'pix' : mode,
    trocoPara: mode === 'dinheiro' ? 'R$ 100,00' : '',
    semTroco: false,
    pixStatus:
      mode === 'pix_confirmado'
        ? 'confirmado'
        : mode === 'pix_pendente'
          ? 'aguardando_comprovante'
          : 'nao_aplicavel',
    pixConfirmadoPor: mode === 'pix_confirmado' ? 'caixa_manual' : '',
    pixResumoVerificacao:
      mode === 'pix_confirmado'
        ? 'Pagamento Pix conferido e confirmado.'
        : mode === 'pix_pendente'
          ? 'Aguardando conferência do comprovante Pix.'
          : '',
    status: 'novo',
    impresso: false,
    impressoCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, ORDERS_PATH, orderId), payload);
    return { orderId, codigoPedido };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${ORDERS_PATH}/${orderId}`);
  }
}

export function subscribeToOrders(
  onUpdate: (orders: KitchenOrder[]) => void,
  onError: (error: Error) => void
) {
  const q = query(
    collection(db, ORDERS_PATH),
    where('numeroPedido', '>=', 1),
    orderBy('numeroPedido', 'desc'),
    limit(150)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => mapDocToKitchenOrder(d.id, d.data()));
      onUpdate(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, ORDERS_PATH);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

/**
 * Consulta dedicada de pedidos por intervalo de datas (createdAt), sem limite de 150 pedidos.
 * Permite consultar vendas de qualquer data passada no Resumo Financeiro.
 */
export function subscribeToOrdersByDateRange(
  startMs: number,
  endMs: number,
  onUpdate: (orders: KitchenOrder[]) => void,
  onError: (error: Error) => void
) {
  const minAllowedMs = Date.UTC(2020, 0, 1);
  const safeStartMs = Math.max(startMs, minAllowedMs);
  const safeEndMs = Math.max(safeStartMs, endMs);

  const q = query(
    collection(db, ORDERS_PATH),
    where('createdAt', '>=', Timestamp.fromMillis(safeStartMs)),
    where('createdAt', '<=', Timestamp.fromMillis(safeEndMs)),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => mapDocToKitchenOrder(d.id, d.data()));
      onUpdate(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, ORDERS_PATH);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function markOrderPrinted(
  orderId: string,
  currentCount: number
): Promise<void> {
  const path = `${ORDERS_PATH}/${orderId}`;
  try {
    await updateDoc(doc(db, ORDERS_PATH, orderId), {
      impresso: true,
      impressoCount: Math.min(50, currentCount + 1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function confirmOrderPix(params: {
  orderId: string;
  note?: string;
  advanceToPreparing?: boolean;
}): Promise<void> {
  const { orderId, note, advanceToPreparing = false } = params;
  const path = `${ORDERS_PATH}/${orderId}`;
  const updates: Record<string, unknown> = {
    pixStatus: 'confirmado',
    pixConfirmadoPor: 'caixa_manual',
    pixResumoVerificacao: sanitizeString(
      note || 'Comprovante Pix conferido e confirmado pelo caixa.',
      240
    ),
    updatedAt: serverTimestamp(),
  };
  if (advanceToPreparing) {
    updates.status = 'em_preparo';
  }
  try {
    await updateDoc(doc(db, ORDERS_PATH, orderId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: KitchenOrderStatus
): Promise<void> {
  const path = `${ORDERS_PATH}/${orderId}`;
  try {
    await updateDoc(doc(db, ORDERS_PATH, orderId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Apaga todos os pedidos da coleção `orders` em lotes seguros (até 400 por lote)
 * e remove o documento `counters/orders` para reiniciar a numeração sequencial em #0001.
 */
export async function resetTestOrdersAndCounter(): Promise<{
  deletedCount: number;
}> {
  let deletedCount = 0;

  try {
    while (true) {
      const q = query(
        collection(db, ORDERS_PATH),
        where('numeroPedido', '>=', 1),
        limit(400)
      );
      const snap = await getDocs(q);
      if (snap.empty) break;

      const batch = writeBatch(db);
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      deletedCount += snap.size;

      if (snap.size < 400) break;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, ORDERS_PATH);
  }

  const counterPath = `${COUNTERS_PATH}/${ORDERS_COUNTER_ID}`;
  try {
    await deleteDoc(doc(db, COUNTERS_PATH, ORDERS_COUNTER_ID));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, counterPath);
  }

  return { deletedCount };
}

export function playKitchenAlertTone(variant: 'order' | 'pix_pending' = 'order') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes =
      variant === 'pix_pending' ? [587.33, 587.33, 880] : [659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.16);
      gain.gain.setValueAtTime(0.001, now + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.24, now + idx * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.24);
    });
  } catch {
    // Ignore autoplay restriction before user interaction
  }
}
