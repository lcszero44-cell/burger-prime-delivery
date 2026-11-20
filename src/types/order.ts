export type CategoryId =
  | 'destaques'
  | 'hamburgueres'
  | 'combos'
  | 'porcoes'
  | 'bebidas'
  | 'sobremesas';

export type ProductCategory = Exclude<CategoryId, 'destaques'>;

export type ProductBadge = 'Mais pedido' | 'Novo';

export interface AddonOption {
  id: string;
  nome: string;
  preco: number;
}

export interface Product {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  categoria: ProductCategory;
  imagem: string;
  etiqueta?: ProductBadge;
  destaque?: boolean;
  ativo?: boolean;
  ordem?: number;
  permitePontoCarne?: boolean;
  opcoesObrigatorias?: string[];
  permiteAdicionais?: boolean;
  adicionaisCustom?: AddonOption[];
  ingredientesRemoviveis?: string[];
}

export interface NeighborhoodFee {
  id: string;
  nome: string;
  taxa: number | null; // null quando a taxa for "a combinar"
  aCombinar?: boolean;
}

export interface PixConfig {
  chave: string;
  nomeRecebedor: string;
  cidadeRecebedor: string;
}

export interface DaySchedule {
  aberto: boolean;
  abre: string;
  fecha: string;
}

export interface StoreConfig {
  nome: string;
  slogan: string;
  corPrincipal: string;
  whatsapp: string;
  pix: PixConfig;
  mensagemContatoWhatsApp: string;
  logoUrl?: string;
  heroBannerUrl: string;
  enderecoRetirada: string;
  cidadeUf: string;
  tempoEstimadoEntrega: string;
  tempoEstimadoRetirada: string;
  pedidoMinimo: number;
  resumoHorario: string;
  horarioFuncionamento: Record<number, DaySchedule>;
  bairrosEntrega: NeighborhoodFee[];
}

export interface LiveStoreSettings {
  nome: string;
  slogan: string;
  abertoManual: boolean;
  whatsapp: string;
  enderecoRetirada: string;
  cidadeUf: string;
  tempoEstimadoEntrega: string;
  tempoEstimadoRetirada: string;
  pedidoMinimo: number;
  resumoHorario: string;
  pixChave: string;
  pixNomeRecebedor: string;
  pixCidadeRecebedor: string;
  bairrosEntrega: NeighborhoodFee[];
  autoPrintEnabled: boolean;
  autoPrintPendingPix: boolean;
  soundEnabled: boolean;
  paperWidth: '80mm' | '58mm';
  copies: 1 | 2;
  storeFooterNote: string;
}

export interface CartItem {
  cartItemId: string;
  productId: string;
  nome: string;
  imagem: string;
  precoBase: number;
  quantidade: number;
  pontoCarne?: string;
  adicionais: AddonOption[];
  ingredientesRemovidos: string[];
  observacao: string;
}

export type DeliveryType = 'entrega' | 'retirada';
export type PaymentMethod = 'pix' | 'pix_entrega' | 'cartao' | 'dinheiro';

export interface CustomerCheckoutData {
  tipoPedido: DeliveryType;
  nome: string;
  whatsapp: string;
  rua: string;
  numero: string;
  complemento: string;
  endereco: string;
  pontoReferencia: string;
  bairroId: string;
  pagamento: PaymentMethod;
  trocoPara: string;
  semTroco: boolean;
}

export type PixStatus =
  | 'nao_aplicavel'
  | 'aguardando_comprovante'
  | 'confirmado';

export type PixConfirmationSource = '' | 'cliente_declarado' | 'caixa_manual';

export type KitchenOrderStatus =
  | 'novo'
  | 'em_preparo'
  | 'saiu_entrega'
  | 'concluido'
  | 'cancelado';

export interface KitchenOrderItem {
  nome: string;
  quantidade: number;
  precoUnitario: number;
  precoTotal: number;
  pontoCarne: string;
  adicionais: string[];
  ingredientesRemovidos: string[];
  observacao: string;
}

export interface KitchenOrder {
  id: string;
  numeroPedido: number;
  codigoPedido: string;
  clienteNome: string;
  clienteWhatsapp: string;
  tipoPedido: DeliveryType;
  rua: string;
  numero: string;
  complemento: string;
  endereco: string;
  bairroNome: string;
  pontoReferencia: string;
  itens: KitchenOrderItem[];
  subtotal: number;
  taxaEntrega: number;
  taxaACombinar: boolean;
  total: number;
  pagamento: PaymentMethod;
  trocoPara: string;
  semTroco: boolean;
  pixStatus: PixStatus;
  pixConfirmadoPor: PixConfirmationSource;
  pixResumoVerificacao: string;
  status: KitchenOrderStatus;
  impresso: boolean;
  impressoCount: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface KitchenSettings {
  autoPrintEnabled: boolean;
  autoPrintPendingPix: boolean;
  soundEnabled: boolean;
  paperWidth: '80mm' | '58mm';
  copies: 1 | 2;
  storeFooterNote: string;
}

export interface CashClosingSummary {
  periodLabel: string;
  printedAtMs: number;
  totalRevenue: number;
  completedRevenue: number;
  validOrdersCount: number;
  completedOrdersCount: number;
  cancelledOrdersCount: number;
  inProgressOrdersCount: number;
  averageTicket: number;
  pixTotal: number;
  pixCount: number;
  cartaoTotal: number;
  cartaoCount: number;
  dinheiroTotal: number;
  dinheiroCount: number;
  deliveryFeesTotal: number;
}

