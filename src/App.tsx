import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, Loader2, Lock, SearchX } from 'lucide-react';
import { CATEGORIAS, PRODUTOS, STORE_CONFIG } from './config/menuData';
import { CartDrawer } from './components/CartDrawer';
import { CategoryBar } from './components/CategoryBar';
import { FloatingCartBar } from './components/FloatingCartBar';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { StoreHeader } from './components/StoreHeader';
import { WhatsAppFloatingButton } from './components/WhatsAppFloatingButton';
import {
  DEFAULT_LIVE_STORE_SETTINGS,
  subscribeToProducts,
  subscribeToStoreSettings,
} from './services/orderService';
import type {
  CartItem,
  CategoryId,
  CustomerCheckoutData,
  LiveStoreSettings,
  Product,
} from './types/order';
import {
  applyBrandColorVariables,
  getCartItemTotal,
  getLiveStoreOpenStatus,
  mergeLiveStoreConfig,
} from './utils/formatters';

// Lazy-load the Admin Panel so customers never download admin JS on initial load
const AdminPanel = lazy(() => import('./components/AdminPanel'));

const CART_STORAGE_KEY = 'burger_prime_cart_v1';
const CUSTOMER_STORAGE_KEY = 'burger_prime_customer_v2';
const THEME_STORAGE_KEY = 'burger_prime_theme';

const DEFAULT_CUSTOMER: CustomerCheckoutData = {
  tipoPedido: 'entrega',
  nome: '',
  whatsapp: '',
  rua: '',
  numero: '',
  complemento: '',
  endereco: '',
  pontoReferencia: '',
  bairroId: '',
  pagamento: 'pix',
  trocoPara: '',
  semTroco: false,
};

function loadInitialCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadInitialCustomer(): CustomerCheckoutData {
  try {
    const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOMER;
    return { ...DEFAULT_CUSTOMER, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CUSTOMER;
  }
}

function getInitialDarkMode(): boolean {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
  } catch {
    // ignore
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function buildCartItemSignature(item: Omit<CartItem, 'cartItemId'>): string {
  const addonsKey = item.adicionais
    .map((a) => a.id)
    .sort()
    .join(',');
  const removedKey = [...item.ingredientesRemovidos].sort().join(',');
  return [
    item.productId,
    item.pontoCarne || '',
    addonsKey,
    removedKey,
    item.observacao.trim().toLowerCase(),
  ].join('|');
}

function getInitialViewMode(): 'menu' | 'admin' {
  try {
    const params = new URLSearchParams(window.location.search);
    const painel = params.get('painel');
    if (
      painel === 'admin' ||
      painel === 'cozinha' ||
      window.location.hash === '#admin' ||
      window.location.hash === '#cozinha'
    ) {
      return 'admin';
    }
  } catch {
    // ignore
  }
  return 'menu';
}

export default function App() {
  const [viewMode, setViewMode] = useState<'menu' | 'admin'>(
    getInitialViewMode
  );
  const [isDark, setIsDark] = useState<boolean>(getInitialDarkMode);

  // Instant first paint using local defaults, seamlessly upgraded by live Firestore listeners
  const [liveSettings, setLiveSettings] = useState<LiveStoreSettings>(
    DEFAULT_LIVE_STORE_SETTINGS
  );
  const [allProducts, setAllProducts] = useState<Product[]>(() =>
    PRODUTOS.map((p, idx) => ({ ...p, ativo: true, ordem: idx }))
  );
  const [productsFromFirestore, setProductsFromFirestore] = useState(false);

  const [activeCategory, setActiveCategory] = useState<CategoryId>('destaques');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [cart, setCart] = useState<CartItem[]>(loadInitialCart);
  const [customer, setCustomer] = useState<CustomerCheckoutData>(
    loadInitialCustomer
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const isManualScrollRef = useRef(false);

  // Live Firestore subscriptions (store status/settings + menu products)
  useEffect(() => {
    const unsubSettings = subscribeToStoreSettings((next) => {
      setLiveSettings(next);
    });
    const unsubProducts = subscribeToProducts((list, fromDb) => {
      setAllProducts(list);
      setProductsFromFirestore(fromDb);
    });
    return () => {
      unsubSettings();
      unsubProducts();
    };
  }, []);

  const liveStoreConfig = useMemo(
    () => mergeLiveStoreConfig(STORE_CONFIG, liveSettings),
    [liveSettings]
  );

  const openStatus = useMemo(
    () => getLiveStoreOpenStatus(liveSettings),
    [liveSettings]
  );

  const publicProducts = useMemo(
    () => allProducts.filter((p) => p.ativo !== false),
    [allProducts]
  );

  // Sync theme class & dynamic brand color CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    applyBrandColorVariables(liveStoreConfig.corPrincipal, isDark);
  }, [isDark, liveStoreConfig.corPrincipal]);

  // Respect system theme changes if user hasn't explicitly overridden
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      try {
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          setIsDark(e.matches);
        }
      } catch {
        setIsDark(e.matches);
      }
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  // Persist customer checkout fields to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customer));
    } catch {
      // ignore
    }
  }, [customer]);

  const handleToggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  }, []);

  const handleAddToCart = useCallback(
    (incoming: Omit<CartItem, 'cartItemId'>) => {
      if (!openStatus.isOpen) {
        showToast('Loja fechada no momento — novos pedidos pausados');
        return;
      }
      const signature = buildCartItemSignature(incoming);
      setCart((prev) => {
        const existingIndex = prev.findIndex(
          (item) => buildCartItemSignature(item) === signature
        );
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantidade: updated[existingIndex].quantidade + incoming.quantidade,
          };
          return updated;
        }
        return [
          ...prev,
          {
            ...incoming,
            cartItemId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          },
        ];
      });
      showToast(`${incoming.nome} adicionado ao carrinho`);
    },
    [openStatus.isOpen, showToast]
  );

  const handleQuickAdd = useCallback(
    (product: Product) => {
      handleAddToCart({
        productId: product.id,
        nome: product.nome,
        imagem: product.imagem,
        precoBase: product.preco,
        quantidade: 1,
        adicionais: [],
        ingredientesRemovidos: [],
        observacao: '',
      });
    },
    [handleAddToCart]
  );

  const handleUpdateQuantity = useCallback(
    (cartItemId: string, delta: number) => {
      setCart((prev) =>
        prev
          .map((item) =>
            item.cartItemId === cartItemId
              ? { ...item, quantidade: item.quantidade + delta }
              : item
          )
          .filter((item) => item.quantidade > 0)
      );
    },
    []
  );

  const handleRemoveItem = useCallback((cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  }, []);

  const handleUpdateObservation = useCallback(
    (cartItemId: string, observacao: string) => {
      setCart((prev) =>
        prev.map((item) =>
          item.cartItemId === cartItemId ? { ...item, observacao } : item
        )
      );
    },
    []
  );

  const handleClearCart = useCallback(() => {
    setCart([]);
  }, []);

  // Scroll smoothly to category section
  const handleSelectCategory = (id: CategoryId) => {
    if (searchQuery) {
      setSearchQuery('');
    }
    setActiveCategory(id);
    isManualScrollRef.current = true;

    requestAnimationFrame(() => {
      const el = document.getElementById(`secao-${id}`);
      if (el) {
        const yOffset = -68;
        const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
      window.setTimeout(() => {
        isManualScrollRef.current = false;
      }, 650);
    });
  };

  // Scrollspy to highlight active category while scrolling
  useEffect(() => {
    if (viewMode !== 'menu' || searchQuery.trim()) return;

    const handleScroll = () => {
      if (isManualScrollRef.current) return;
      const offset = 110;
      let current: CategoryId = 'destaques';

      for (const cat of CATEGORIAS) {
        const el = document.getElementById(`secao-${cat.id}`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= offset) {
          current = cat.id;
        }
      }
      setActiveCategory(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [viewMode, searchQuery]);

  // Product counts currently in cart (by productId)
  const quantityByProductId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cart) {
      map[item.productId] = (map[item.productId] || 0) + item.quantidade;
    }
    return map;
  }, [cart]);

  const totalItemsInCart = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantidade, 0),
    [cart]
  );

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + getCartItemTotal(item), 0),
    [cart]
  );

  const normalizedQuery = searchQuery
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return publicProducts.filter((p) => {
      const haystack = `${p.nome} ${p.descricao} ${p.etiqueta || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, publicProducts]);

  const featuredProducts = useMemo(
    () => publicProducts.filter((p) => p.destaque),
    [publicProducts]
  );

  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    for (const product of publicProducts) {
      if (!grouped[product.categoria]) grouped[product.categoria] = [];
      grouped[product.categoria].push(product);
    }
    return grouped;
  }, [publicProducts]);

  const openAdminPanel = useCallback(() => {
    setViewMode('admin');
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('painel', 'admin');
      window.history.pushState({}, '', url.toString());
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0 });
  }, []);

  const backToMenu = useCallback(() => {
    setViewMode('menu');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('painel');
      url.hash = '';
      window.history.pushState({}, '', url.toString());
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setViewMode(getInitialViewMode());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (viewMode === 'admin') {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-[#FAF9F7] dark:bg-[#111010] text-[#57534E] dark:text-[#A8A29E] gap-2 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            <span>Carregando Painel Admin...</span>
          </div>
        }
      >
        <AdminPanel
          store={liveStoreConfig}
          liveSettings={liveSettings}
          products={allProducts}
          productsFromFirestore={productsFromFirestore}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          onBackToMenu={backToMenu}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F7] dark:bg-[#111010] text-[#181615] dark:text-[#F6F4F0] transition-colors duration-200">
      {/* Store Identity & Editorial Hero */}
      <StoreHeader
        store={liveStoreConfig}
        openStatus={openStatus}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
      />

      {/* Search Input & Sticky Scrollable Category Bar */}
      <CategoryBar
        categories={CATEGORIAS}
        activeCategory={activeCategory}
        onSelectCategory={handleSelectCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
      />

      {/* Main Menu Feed */}
      <main
        className={`flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 pt-6 sm:pt-8 ${
          totalItemsInCart > 0 ? 'pb-32' : 'pb-24'
        }`}
      >
        {normalizedQuery ? (
          <section aria-label="Resultados da busca">
            <div className="flex items-baseline justify-between gap-2 mb-5">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181615] dark:text-[#F6F4F0]">
                Resultados para “{searchQuery.trim()}”
              </h2>
              <span className="text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums whitespace-nowrap">
                {searchResults.length}{' '}
                {searchResults.length === 1 ? 'produto' : 'produtos'}
              </span>
            </div>

            {searchResults.length === 0 ? (
              <div className="py-14 px-4 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.07] dark:border-white/[0.08] text-center">
                <div className="w-12 h-12 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] text-[#78716C] dark:text-[#A8A29E] flex items-center justify-center mx-auto mb-3">
                  <SearchX className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="font-display text-base font-bold text-[#181615] dark:text-[#F6F4F0]">
                  Nenhum produto encontrado
                </h3>
                <p className="mt-1 text-sm text-[#57534E] dark:text-[#A8A29E]">
                  Tente buscar por outro termo como “bacon”, “combo” ou
                  “batata”.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="mt-5 min-h-[44px] px-5 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  Limpar busca
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                {searchResults.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    cartQuantity={quantityByProductId[product.id] || 0}
                    isStoreClosed={!openStatus.isOpen}
                    onOpenModal={setSelectedProduct}
                    onQuickAdd={handleQuickAdd}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-10 sm:space-y-12">
            {/* Destaques Section */}
            {featuredProducts.length > 0 && (
              <section
                id="secao-destaques"
                aria-labelledby="heading-destaques"
                className="scroll-mt-20"
              >
                <div className="flex items-baseline justify-between gap-2 mb-4">
                  <div>
                    <h2
                      id="heading-destaques"
                      className="font-display text-xl sm:text-2xl font-bold text-[#181615] dark:text-[#F6F4F0]"
                    >
                      Destaques
                    </h2>
                    <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A8A29E] mt-0.5">
                      Os favoritos de quem pede na {liveStoreConfig.nome}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                  {featuredProducts.map((product) => (
                    <ProductCard
                      key={`featured-${product.id}`}
                      product={product}
                      variant="featured"
                      cartQuantity={quantityByProductId[product.id] || 0}
                      isStoreClosed={!openStatus.isOpen}
                      onOpenModal={setSelectedProduct}
                      onQuickAdd={handleQuickAdd}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Remaining Categories */}
            {CATEGORIAS.filter((c) => c.id !== 'destaques').map((cat) => {
              const items = productsByCategory[cat.id] || [];
              if (items.length === 0) return null;

              return (
                <section
                  key={cat.id}
                  id={`secao-${cat.id}`}
                  aria-labelledby={`heading-${cat.id}`}
                  className="scroll-mt-20 pt-2 border-t border-black/[0.06] dark:border-white/[0.07]"
                >
                  <div className="flex items-baseline justify-between gap-2 mb-4 pt-4">
                    <h2
                      id={`heading-${cat.id}`}
                      className="font-display text-xl sm:text-2xl font-bold text-[#181615] dark:text-[#F6F4F0]"
                    >
                      {cat.nome}
                    </h2>
                    <span className="text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                      {items.length} {items.length === 1 ? 'opção' : 'opções'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                    {items.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        cartQuantity={quantityByProductId[product.id] || 0}
                        isStoreClosed={!openStatus.isOpen}
                        onOpenModal={setSelectedProduct}
                        onQuickAdd={handleQuickAdd}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Clean Quiet Footer with discreet Admin button */}
      <footer className="border-t border-black/[0.07] dark:border-white/[0.08] py-8 px-4 sm:px-6 text-center text-xs text-[#78716C] dark:text-[#8C857F]">
        <div className="mx-auto max-w-6xl space-y-1.5">
          <p className="font-semibold text-[#44403C] dark:text-[#D6D3D1]">
            {liveStoreConfig.nome} · {liveStoreConfig.cidadeUf}
          </p>
          <p>{liveStoreConfig.enderecoRetirada}</p>
          <p>{liveStoreConfig.resumoHorario}</p>
          <div className="pt-3">
            <button
              type="button"
              onClick={openAdminPanel}
              className="min-h-[38px] px-3 rounded-lg inline-flex items-center gap-1.5 text-xs font-medium text-[#78716C] dark:text-[#8C857F] hover:text-[#181615] dark:hover:text-[#F6F4F0] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Área do Restaurante / Admin</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Subtle Add-to-Cart Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl bg-[#181615] dark:bg-[#F6F4F0] text-white dark:text-[#181615] text-xs font-semibold shadow-lg flex items-center gap-2 whitespace-nowrap animate-fade-fast ${
            totalItemsInCart > 0 ? 'bottom-20 sm:bottom-22' : 'bottom-6'
          }`}
        >
          <Check
            className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0"
            aria-hidden="true"
          />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Fixed WhatsApp Direct Contact Button */}
      <WhatsAppFloatingButton
        phone={liveStoreConfig.whatsapp}
        message={liveStoreConfig.mensagemContatoWhatsApp}
        storeName={liveStoreConfig.nome}
        hasCartBar={totalItemsInCart > 0}
      />

      {/* Floating Cart Bar */}
      <FloatingCartBar
        itemCount={totalItemsInCart}
        subtotal={cartSubtotal}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Product Customization Modal */}
      <ProductModal
        product={selectedProduct}
        isStoreClosed={!openStatus.isOpen}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Cart & Checkout Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        store={liveStoreConfig}
        openStatus={openStatus}
        customer={customer}
        onCustomerChange={setCustomer}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onUpdateObservation={handleUpdateObservation}
        onClearCart={handleClearCart}
      />
    </div>
  );
}
