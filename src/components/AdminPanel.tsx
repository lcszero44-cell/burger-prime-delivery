import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  BarChart3,
  Bell,
  BellOff,
  Bike,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  Download,
  Eye,
  KeyRound,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  Moon,
  Phone,
  Plug,
  Power,
  Printer,
  QrCode,
  Settings,
  Store,
  Sun,
  Unplug,
  Usb,
  UtensilsCrossed,
  X,
  XCircle,
} from 'lucide-react';
import {
  confirmOrderPix,
  createSimulatedTestOrder,
  markOrderPrinted,
  playKitchenAlertTone,
  saveStoreSettings,
  subscribeToOrders,
  updateOrderStatus,
  verifyAdminPassword,
} from '../services/orderService';
import {
  connectSerialPrinter,
  disconnectSerialPrinter,
  getConnectedPrinterLabel,
  getSavedBaudRate,
  isSerialPrinterConnected,
  isWebSerialSupported,
  printCashClosingDirectEscPos,
  printOrderDirectEscPos,
  printTestTicketDirectEscPos,
  tryAutoReconnectSerialPrinter,
} from '../services/thermalPrinterService';
import type {
  CashClosingSummary,
  KitchenOrder,
  KitchenOrderStatus,
  KitchenSettings,
  LiveStoreSettings,
  Product,
  StoreConfig,
} from '../types/order';
import {
  buildWhatsAppUrl,
  calculateCashChange,
  formatBRL,
} from '../utils/formatters';
import { ThermalCashClosingTicket } from './ThermalCashClosingTicket';
import { ThermalTicket } from './ThermalTicket';
import { AdminFinanceTab } from './admin/AdminFinanceTab';
import { AdminMenuTab } from './admin/AdminMenuTab';
import { AdminSettingsTab } from './admin/AdminSettingsTab';

const ADMIN_SESSION_KEY = 'burger_prime_admin_auth_v2';

type AdminTab = 'cozinha' | 'cardapio' | 'config' | 'financeiro';
type OrderFilter = 'ativos' | 'pix_pendente' | 'concluidos' | 'todos';

interface AdminPanelProps {
  store: StoreConfig;
  liveSettings: LiveStoreSettings;
  products: Product[];
  productsFromFirestore: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onBackToMenu: () => void;
}

function formatTime(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--:--';
  }
}

const STATUS_META: Record<
  KitchenOrderStatus,
  { label: string; badgeClass: string; next?: KitchenOrderStatus; nextLabel?: string }
> = {
  novo: {
    label: 'Novo',
    badgeClass:
      'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    next: 'em_preparo',
    nextLabel: 'Iniciar preparo',
  },
  em_preparo: {
    label: 'Em preparo',
    badgeClass:
      'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800',
    next: 'saiu_entrega',
    nextLabel: 'Saiu para entrega',
  },
  saiu_entrega: {
    label: 'Saiu p/ entrega',
    badgeClass:
      'bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-300 border-violet-300 dark:border-violet-800',
    next: 'concluido',
    nextLabel: 'Concluir pedido',
  },
  concluido: {
    label: 'Concluído',
    badgeClass:
      'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
  },
  cancelado: {
    label: 'Cancelado',
    badgeClass:
      'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700',
  },
};

export default function AdminPanel({
  store,
  liveSettings,
  products,
  productsFromFirestore,
  isDark,
  onToggleTheme,
  onBackToMenu,
}: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('cozinha');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('ativos');
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [creatingTest, setCreatingTest] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<KitchenOrder | null>(null);
  const [activePrintOrder, setActivePrintOrder] = useState<KitchenOrder | null>(
    null
  );
  const [activePrintClosing, setActivePrintClosing] =
    useState<CashClosingSummary | null>(null);

  // Thermal printer direct connection state (Web Serial ESC/POS)
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [printerConnected, setPrinterConnected] = useState<boolean>(() =>
    isSerialPrinterConnected()
  );
  const [printerLabel, setPrinterLabel] = useState<string>(() =>
    getConnectedPrinterLabel()
  );
  const [printerBaudRate, setPrinterBaudRate] = useState<number>(() =>
    getSavedBaudRate()
  );
  const [printerBusy, setPrinterBusy] = useState(false);
  const [printerMessage, setPrinterMessage] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const webSerialAvailable = isWebSerialSupported();

  // Refs for real-time sound alert & automatic print FIFO queue
  const initializedOrdersRef = useRef(false);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const autoPrintedIdsRef = useRef<Set<string>>(new Set());
  const printQueueRef = useRef<KitchenOrder[]>([]);
  const isPrintingRef = useRef(false);
  const liveSettingsRef = useRef(liveSettings);

  useEffect(() => {
    liveSettingsRef.current = liveSettings;
  }, [liveSettings]);

  // Auto-reconnect previously authorized thermal printer on panel load
  useEffect(() => {
    if (!isAuthenticated || !webSerialAvailable) return;
    let active = true;
    tryAutoReconnectSerialPrinter().then((label) => {
      if (active && label) {
        setPrinterConnected(true);
        setPrinterLabel(label);
      }
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated, webSerialAvailable]);

  const kitchenSettings: KitchenSettings = useMemo(
    () => ({
      autoPrintEnabled: liveSettings.autoPrintEnabled,
      autoPrintPendingPix: liveSettings.autoPrintPendingPix,
      soundEnabled: liveSettings.soundEnabled,
      paperWidth: liveSettings.paperWidth,
      copies: liveSettings.copies,
      storeFooterNote: liveSettings.storeFooterNote,
    }),
    [liveSettings]
  );

  const kitchenSettingsRef = useRef(kitchenSettings);
  useEffect(() => {
    kitchenSettingsRef.current = kitchenSettings;
  }, [kitchenSettings]);

  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const processNextPrint = useCallback(() => {
    if (isPrintingRef.current) return;
    const next = printQueueRef.current.shift();
    if (!next) return;

    isPrintingRef.current = true;

    // 1. If a direct ESC/POS thermal printer is connected, print 100% silently with zero dialog!
    if (isSerialPrinterConnected()) {
      printOrderDirectEscPos(next, storeRef.current, kitchenSettingsRef.current)
        .then(() => {
          markOrderPrinted(next.id, next.impressoCount).catch(() => {});
        })
        .catch(() => {
          // If cable was unplugged, mark disconnected and fall back to browser print
          setPrinterConnected(false);
          setActivePrintClosing(null);
          setActivePrintOrder(next);
          window.setTimeout(() => {
            try {
              window.print();
            } catch {
              // ignore
            }
            markOrderPrinted(next.id, next.impressoCount).catch(() => {});
          }, 220);
        })
        .finally(() => {
          window.setTimeout(() => {
            isPrintingRef.current = false;
            if (printQueueRef.current.length > 0) {
              processNextPrint();
            }
          }, 500);
        });
      return;
    }

    // 2. Fallback: standard Windows / Chrome thermal print via @media print
    setActivePrintClosing(null);
    setActivePrintOrder(next);
    window.setTimeout(() => {
      try {
        window.print();
      } catch {
        // ignore browser print errors
      }
      markOrderPrinted(next.id, next.impressoCount).catch(() => {});

      window.setTimeout(() => {
        isPrintingRef.current = false;
        if (printQueueRef.current.length > 0) {
          processNextPrint();
        }
      }, 900);
    }, 220);
  }, []);

  const enqueuePrint = useCallback(
    (order: KitchenOrder) => {
      printQueueRef.current.push(order);
      processNextPrint();
    },
    [processNextPrint]
  );

  const handlePrintCashClosing = useCallback(
    async (summary: CashClosingSummary) => {
      if (isSerialPrinterConnected()) {
        try {
          await printCashClosingDirectEscPos(
            summary,
            storeRef.current.nome,
            kitchenSettingsRef.current.paperWidth
          );
          return;
        } catch {
          setPrinterConnected(false);
        }
      }

      setActivePrintOrder(null);
      setActivePrintClosing(summary);
      window.setTimeout(() => {
        try {
          window.print();
        } catch {
          // ignore browser print errors
        }
      }, 220);
    },
    []
  );

  const handleConnectPrinter = async () => {
    setPrinterBusy(true);
    setPrinterMessage(null);
    try {
      const label = await connectSerialPrinter(printerBaudRate);
      setPrinterConnected(true);
      setPrinterLabel(label);
      setPrinterMessage({
        type: 'ok',
        text: `Impressora conectada (${label})! A partir de agora os pedidos imprimem direto sem abrir janela.`,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Não foi possível conectar.';
      if (!msg.toLowerCase().includes('no port selected')) {
        setPrinterMessage({ type: 'err', text: msg });
      }
    } finally {
      setPrinterBusy(false);
    }
  };

  const handleDisconnectPrinter = async () => {
    setPrinterBusy(true);
    setPrinterMessage(null);
    try {
      await disconnectSerialPrinter();
      setPrinterConnected(false);
      setPrinterMessage({
        type: 'ok',
        text: 'Impressora direta desconectada. O sistema voltou para a impressora padrão do Windows.',
      });
    } finally {
      setPrinterBusy(false);
    }
  };

  const handleTestDirectPrint = async () => {
    setPrinterBusy(true);
    setPrinterMessage(null);
    try {
      await printTestTicketDirectEscPos(store.nome, liveSettings.paperWidth);
      setPrinterMessage({
        type: 'ok',
        text: 'Cupom de teste enviado diretamente para a impressora!',
      });
    } catch (err) {
      setPrinterMessage({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Erro ao imprimir cupom de teste.',
      });
    } finally {
      setPrinterBusy(false);
    }
  };

  const handleDownloadAutoPrintBat = () => {
    const panelUrl = `${window.location.origin}/?painel=admin`;
    const batContent = [
      '@echo off',
      'title Painel da Cozinha - Impressao Automatica',
      'echo Abrindo Painel da Cozinha em modo Impressao Automatica (Kiosk Printing)...',
      `start "" chrome --kiosk-printing --app="${panelUrl}"`,
      'exit',
    ].join('\r\n');

    const blob = new Blob([batContent], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'abrir-cozinha-impressao-automatica.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Real-time Firestore listener for orders once authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    setOrdersLoading(true);
    setOrdersError(null);
    initializedOrdersRef.current = false;

    const unsubscribe = subscribeToOrders(
      (incomingOrders) => {
        setOrders(incomingOrders);
        setOrdersLoading(false);

        const cfg = liveSettingsRef.current;

        if (!initializedOrdersRef.current) {
          incomingOrders.forEach((o) => {
            seenOrderIdsRef.current.add(o.id);
            if (o.impresso) autoPrintedIdsRef.current.add(o.id);
          });
          initializedOrdersRef.current = true;
          return;
        }

        // Detect newly arrived orders
        let playedSound = false;
        for (const order of incomingOrders) {
          const isNewOrder = !seenOrderIdsRef.current.has(order.id);
          if (isNewOrder) {
            seenOrderIdsRef.current.add(order.id);
            if (cfg.soundEnabled && !playedSound && order.status === 'novo') {
              playKitchenAlertTone(
                order.pagamento === 'pix' && order.pixStatus !== 'confirmado'
                  ? 'pix_pending'
                  : 'order'
              );
              playedSound = true;
            }
          }

          // Auto-print rule
          if (
            cfg.autoPrintEnabled &&
            !order.impresso &&
            !autoPrintedIdsRef.current.has(order.id) &&
            order.status !== 'cancelado' &&
            order.status !== 'concluido'
          ) {
            const isPendingPix =
              order.pagamento === 'pix' && order.pixStatus !== 'confirmado';
            if (!isPendingPix || cfg.autoPrintPendingPix) {
              autoPrintedIdsRef.current.add(order.id);
              enqueuePrint(order);
            }
          }
        }
      },
      (err) => {
        setOrdersLoading(false);
        setOrdersError(err.message);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, enqueuePrint]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const ok = await verifyAdminPassword(passwordInput);
      if (ok) {
        try {
          sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
        } catch {
          // ignore
        }
        setIsAuthenticated(true);
        setPasswordInput('');
      } else {
        setAuthError(
          'Senha incorreta. (A senha padrão inicial é 1234, caso ainda não tenha sido alterada.)'
        );
      }
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Erro ao validar a senha no servidor.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
  };

  const handleToggleAutoPrint = async () => {
    await saveStoreSettings({
      ...liveSettings,
      autoPrintEnabled: !liveSettings.autoPrintEnabled,
    });
  };

  const handleToggleSound = async () => {
    const nextSound = !liveSettings.soundEnabled;
    if (nextSound) playKitchenAlertTone('order');
    await saveStoreSettings({
      ...liveSettings,
      soundEnabled: nextSound,
    });
  };

  const handleQuickToggleStore = async () => {
    await saveStoreSettings({
      ...liveSettings,
      abertoManual: !liveSettings.abertoManual,
    });
  };

  const handleStatusChange = async (
    order: KitchenOrder,
    nextStatus: KitchenOrderStatus
  ) => {
    setBusyOrderId(order.id);
    try {
      await updateOrderStatus(order.id, nextStatus);
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleConfirmPixAndPrint = async (order: KitchenOrder) => {
    setBusyOrderId(order.id);
    try {
      await confirmOrderPix({
        orderId: order.id,
        advanceToPreparing: order.status === 'novo',
      });
      autoPrintedIdsRef.current.add(order.id);
      enqueuePrint({
        ...order,
        pixStatus: 'confirmado',
        pixConfirmadoPor: 'caixa_manual',
        pixResumoVerificacao: 'Comprovante Pix conferido e confirmado pelo caixa.',
      });
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleCreateTest = async (
    mode: 'pix_confirmado' | 'pix_pendente' | 'cartao' | 'dinheiro'
  ) => {
    setCreatingTest(true);
    try {
      await createSimulatedTestOrder(mode);
    } finally {
      setCreatingTest(false);
    }
  };

  const activeOrdersCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === 'novo' ||
          o.status === 'em_preparo' ||
          o.status === 'saiu_entrega'
      ).length,
    [orders]
  );

  const pendingPixCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.pagamento === 'pix' &&
          o.pixStatus !== 'confirmado' &&
          o.status !== 'cancelado'
      ).length,
    [orders]
  );

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'ativos') {
      return orders.filter(
        (o) =>
          o.status === 'novo' ||
          o.status === 'em_preparo' ||
          o.status === 'saiu_entrega'
      );
    }
    if (orderFilter === 'pix_pendente') {
      return orders.filter(
        (o) =>
          o.pagamento === 'pix' &&
          o.pixStatus !== 'confirmado' &&
          o.status !== 'cancelado'
      );
    }
    if (orderFilter === 'concluidos') {
      return orders.filter(
        (o) => o.status === 'concluido' || o.status === 'cancelado'
      );
    }
    return orders;
  }, [orders, orderFilter]);

  /* ---------------- PASSWORD LOGIN GATE ---------------- */
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF9F7] dark:bg-[#111010] text-[#181615] dark:text-[#F6F4F0]">
        <header className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToMenu}
            className="min-h-[42px] px-3.5 rounded-xl inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#57534E] dark:text-[#A8A29E] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Voltar ao cardápio</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Alternar tema"
            className="min-h-[42px] min-w-[42px] rounded-xl flex items-center justify-center text-[#57534E] dark:text-[#A8A29E] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <form
            onSubmit={handleLoginSubmit}
            className="w-full max-w-sm p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] shadow-sm space-y-5"
          >
            <div className="text-center space-y-1.5">
              <div
                className="w-12 h-12 rounded-2xl text-white flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                <KeyRound className="w-5 h-5" aria-hidden="true" />
              </div>
              <h1 className="font-display text-xl font-bold">
                Área do Restaurante / Admin
              </h1>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                {store.nome} · Digite sua senha para gerenciar comandas,
                cardápio e financeiro.
              </p>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1.5"
              >
                Senha de acesso
              </label>
              <input
                id="admin-password"
                type="password"
                autoFocus
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Digite a senha (padrão: 1234)"
                className="w-full min-h-[46px] px-4 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.12] dark:border-white/[0.14] text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>

            {authError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full min-h-[48px] rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-sm"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {authLoading && (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              )}
              <span>Entrar no Painel</span>
            </button>
          </form>
        </main>
      </div>
    );
  }

  /* ---------------- AUTHENTICATED 4-TAB ADMIN DASHBOARD ---------------- */
  const tabs: { id: AdminTab; label: string; icon: typeof ChefHat; badge?: number }[] = [
    {
      id: 'cozinha',
      label: 'Comandas / Cozinha',
      icon: ChefHat,
      badge: activeOrdersCount,
    },
    {
      id: 'cardapio',
      label: 'Cardápio',
      icon: UtensilsCrossed,
    },
    {
      id: 'config',
      label: 'Configurações',
      icon: Settings,
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      icon: BarChart3,
    },
  ];

  return (
    <>
      <div
        id="app-screen-root"
        className="min-h-screen flex flex-col bg-[#FAF9F7] dark:bg-[#111010] text-[#181615] dark:text-[#F6F4F0]"
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#171514]/95 backdrop-blur-md border-b border-black/[0.08] dark:border-white/[0.08]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onBackToMenu}
                aria-label="Voltar ao cardápio público"
                className="min-h-[40px] px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.1] inline-flex items-center gap-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06] shrink-0"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Cardápio</span>
              </button>

              <div className="min-w-0">
                <h1 className="font-display text-base sm:text-lg font-bold truncate">
                  {store.nome} · Painel Admin
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleQuickToggleStore}
                className={`min-h-[38px] px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition-colors ${
                  liveSettings.abertoManual
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                }`}
              >
                <Power className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{liveSettings.abertoManual ? 'Aberta' : 'Fechada'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="Alternar tema"
                className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-[#57534E] dark:text-[#A8A29E] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                {isDark ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sair do Painel Admin"
                className="min-h-[38px] px-3 rounded-xl text-xs font-semibold text-[#57534E] dark:text-[#A8A29E] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>

          {/* 4-Tab Navigation */}
          <nav
            aria-label="Seções do painel administrativo"
            className="mx-auto max-w-6xl px-4 sm:px-6 flex gap-1 overflow-x-auto no-scrollbar"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[44px] px-3.5 sm:px-4 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                    active
                      ? 'border-[var(--brand-primary)] text-[#181615] dark:text-[#F6F4F0]'
                      : 'border-transparent text-[#78716C] dark:text-[#A8A29E] hover:text-[#181615] dark:hover:text-[#F6F4F0]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{tab.label}</span>
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded-md text-[11px] font-bold text-white tabular-nums"
                      style={{ backgroundColor: 'var(--brand-primary)' }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </header>

        {/* Tab Body */}
        <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6">
          {activeTab === 'cozinha' && (
            <div className="space-y-5">
              {/* Auto-Print & Sound Control Strip */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPrinterMessage(null);
                      setPrinterModalOpen(true);
                    }}
                    className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 border transition-colors ${
                      printerConnected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : 'bg-[#181615] dark:bg-[#F6F4F0] text-white dark:text-[#181615] border-transparent hover:opacity-90'
                    }`}
                  >
                    <Usb className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      {printerConnected
                        ? 'Impressora Conectada'
                        : 'Conectar Impressora'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleAutoPrint}
                    aria-pressed={liveSettings.autoPrintEnabled}
                    className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 border transition-colors ${
                      liveSettings.autoPrintEnabled
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-[#FAF9F7] dark:bg-[#141312] text-[#44403C] dark:text-[#D6D3D1] border-black/[0.12] dark:border-white/[0.14]'
                    }`}
                  >
                    <Printer className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      Impressão Automática:{' '}
                      {liveSettings.autoPrintEnabled ? 'LIGADA' : 'DESLIGADA'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleSound}
                    aria-pressed={liveSettings.soundEnabled}
                    className={`min-h-[44px] px-3.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 border transition-colors ${
                      liveSettings.soundEnabled
                        ? 'bg-white dark:bg-[#23201E] text-[#181615] dark:text-[#F6F4F0] border-black/[0.12] dark:border-white/[0.14]'
                        : 'bg-[#FAF9F7] dark:bg-[#141312] text-[#78716C] border-black/[0.08] dark:border-white/[0.08]'
                    }`}
                  >
                    {liveSettings.soundEnabled ? (
                      <>
                        <Bell className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                        <span>Som ligado</span>
                      </>
                    ) : (
                      <>
                        <BellOff className="w-4 h-4" aria-hidden="true" />
                        <span>Som mudo</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[#78716C] dark:text-[#A8A29E] mr-1">
                    Simular pedido:
                  </span>
                  <button
                    type="button"
                    disabled={creatingTest}
                    onClick={() => handleCreateTest('pix_confirmado')}
                    className="min-h-[36px] px-3 rounded-lg bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.09] dark:border-white/[0.1] text-xs font-semibold hover:bg-black/[0.04]"
                  >
                    + Pix Pago
                  </button>
                  <button
                    type="button"
                    disabled={creatingTest}
                    onClick={() => handleCreateTest('pix_pendente')}
                    className="min-h-[36px] px-3 rounded-lg bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.09] dark:border-white/[0.1] text-xs font-semibold hover:bg-black/[0.04]"
                  >
                    + Pix Pendente
                  </button>
                  <button
                    type="button"
                    disabled={creatingTest}
                    onClick={() => handleCreateTest('dinheiro')}
                    className="min-h-[36px] px-3 rounded-lg bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.09] dark:border-white/[0.1] text-xs font-semibold hover:bg-black/[0.04]"
                  >
                    + Dinheiro
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: 'ativos', label: `Ativos (${activeOrdersCount})` },
                    {
                      id: 'pix_pendente',
                      label: `Aguardando Pix (${pendingPixCount})`,
                    },
                    { id: 'concluidos', label: 'Concluídos / Cancelados' },
                    { id: 'todos', label: `Todos (${orders.length})` },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setOrderFilter(f.id)}
                    className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold border transition-colors tabular-nums ${
                      orderFilter === f.id
                        ? 'bg-[#181615] dark:bg-[#F6F4F0] text-white dark:text-[#181615] border-transparent'
                        : 'bg-white dark:bg-[#1B1918] border-black/[0.09] dark:border-white/[0.1] text-[#44403C] dark:text-[#D6D3D1]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {ordersError && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300">
                  Erro ao carregar comandas: {ordersError}
                </div>
              )}

              {/* Orders Grid */}
              {ordersLoading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#78716C]">
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>Conectando às comandas em tempo real...</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-14 px-4 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] text-center space-y-2">
                  <ChefHat
                    className="w-8 h-8 text-[#A8A29E] mx-auto"
                    aria-hidden="true"
                  />
                  <h3 className="font-display text-base font-bold">
                    Nenhuma comanda nesta fila
                  </h3>
                  <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A8A29E]">
                    Assim que um cliente finalizar um pedido no cardápio, ele
                    aparecerá aqui instantaneamente com alerta sonoro.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredOrders.map((order) => {
                    const meta = STATUS_META[order.status];
                    const isPixPending =
                      order.pagamento === 'pix' &&
                      order.pixStatus !== 'confirmado';
                    const isPixPaid =
                      order.pagamento === 'pix' &&
                      order.pixStatus === 'confirmado';
                    const cashChange =
                      order.pagamento === 'dinheiro' && !order.taxaACombinar
                        ? calculateCashChange(
                            order.trocoPara,
                            order.total,
                            order.semTroco
                          )
                        : null;
                    const isBusy = busyOrderId === order.id;

                    return (
                      <article
                        key={order.id}
                        className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] flex flex-col gap-3.5"
                      >
                        {/* Card Top Header */}
                        <div className="flex items-start justify-between gap-2 pb-3 border-b border-black/[0.07] dark:border-white/[0.08]">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-display text-xl font-bold tabular-nums">
                                {order.codigoPedido}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </span>
                              {order.impresso && (
                                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                                  <Check className="w-3 h-3" aria-hidden="true" />
                                  Impresso
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{formatTime(order.createdAtMs)}</span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 font-semibold text-[#181615] dark:text-[#F6F4F0]">
                                {order.tipoPedido === 'entrega' ? (
                                  <>
                                    <Bike className="w-3.5 h-3.5" aria-hidden="true" />
                                    Entrega
                                  </>
                                ) : (
                                  <>
                                    <Store className="w-3.5 h-3.5" aria-hidden="true" />
                                    Retirada
                                  </>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-lg font-bold tabular-nums">
                              {order.taxaACombinar
                                ? `${formatBRL(order.subtotal)} + taxa`
                                : formatBRL(order.total)}
                            </p>
                            <p className="text-[11px] font-semibold text-[#57534E] dark:text-[#A8A29E]">
                              {order.pagamento === 'pix'
                                ? isPixPaid
                                  ? 'PIX — PAGO'
                                  : 'PIX — PENDENTE'
                                : order.pagamento === 'cartao'
                                  ? 'Cartão na entrega'
                                  : order.semTroco || !order.trocoPara
                                    ? 'Dinheiro (sem troco)'
                                    : `Dinheiro · Troco p/ ${order.trocoPara}`}
                            </p>
                          </div>
                        </div>

                        {/* Cash Change Highlight Banner */}
                        {cashChange && order.status !== 'cancelado' && (
                          <div className="px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-800/70 text-xs text-amber-950 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
                              <Banknote
                                className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400"
                                aria-hidden="true"
                              />
                              <span>
                                Dinheiro · Pago com{' '}
                                <strong>{formatBRL(cashChange.paidAmount)}</strong>
                              </span>
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white font-bold tabular-nums">
                              Troco a devolver: {formatBRL(cashChange.changeDue)}
                            </span>
                          </div>
                        )}

                        {/* Payment Banner for Pix */}
                        {isPixPaid && (
                          <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                            <QrCode className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>
                              PIX CONFIRMADO — NÃO COBRAR NA ENTREGA
                            </span>
                          </div>
                        )}
                        {isPixPending && order.status !== 'cancelado' && (
                          <div className="px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <QrCode
                                className="w-4 h-4 shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <div>
                                <p className="font-bold">
                                  PIX aguardando confirmação de comprovante
                                </p>
                                {order.pixResumoVerificacao && (
                                  <p className="text-[11px] opacity-90">
                                    {order.pixResumoVerificacao}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleConfirmPixAndPrint(order)}
                              className="min-h-[36px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold whitespace-nowrap shrink-0"
                            >
                              Confirmar Pix e Imprimir
                            </button>
                          </div>
                        )}

                        {/* Customer & Address */}
                        <div className="text-xs sm:text-sm space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-bold text-[#181615] dark:text-[#F6F4F0]">
                              {order.clienteNome}
                            </p>
                            {order.clienteWhatsapp && (
                              <a
                                href={buildWhatsAppUrl(
                                  `55${order.clienteWhatsapp.replace(/\D/g, '')}`,
                                  `Olá ${order.clienteNome}! Sobre seu pedido ${order.codigoPedido} na ${store.nome}:`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline tabular-nums"
                              >
                                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{order.clienteWhatsapp}</span>
                                <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                              </a>
                            )}
                          </div>

                          {order.tipoPedido === 'entrega' ? (
                            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] flex items-start gap-1.5">
                              <MapPin
                                className="w-3.5 h-3.5 shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <span>
                                {order.endereco}
                                {order.bairroNome ? ` · ${order.bairroNome}` : ''}
                                {order.pontoReferencia
                                  ? ` (Ref: ${order.pontoReferencia})`
                                  : ''}
                              </span>
                            </p>
                          ) : (
                            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                              Cliente vai retirar no balcão
                            </p>
                          )}
                        </div>

                        {/* Items List */}
                        <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.06] dark:border-white/[0.06] space-y-2">
                          {order.itens.map((item, idx) => (
                            <div
                              key={`${item.nome}-${idx}`}
                              className="text-xs border-b border-black/[0.05] dark:border-white/[0.05] pb-2 last:border-b-0 last:pb-0"
                            >
                              <div className="flex justify-between gap-2 font-bold text-[#181615] dark:text-[#F6F4F0]">
                                <span>
                                  {item.quantidade}x {item.nome}
                                </span>
                                <span className="tabular-nums">
                                  {formatBRL(item.precoTotal)}
                                </span>
                              </div>
                              {item.pontoCarne && (
                                <p className="text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                                  Opção/Ponto: <strong>{item.pontoCarne}</strong>
                                </p>
                              )}
                              {item.adicionais.length > 0 && (
                                <p className="text-[#57534E] dark:text-[#A8A29E]">
                                  + {item.adicionais.join(', ')}
                                </p>
                              )}
                              {item.ingredientesRemovidos.length > 0 && (
                                <p className="text-rose-700 dark:text-rose-400 font-semibold">
                                  Retirar: Sem{' '}
                                  {item.ingredientesRemovidos.join(', sem ')}
                                </p>
                              )}
                              {item.observacao && (
                                <p className="mt-1 px-2 py-1 rounded-md bg-amber-100/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold">
                                  Obs: {item.observacao}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Payment Method Summary Row */}
                        <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E]">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            {order.pagamento === 'pix' ? (
                              <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : order.pagamento === 'cartao' ? (
                              <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : (
                              <Banknote className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            <span className="tabular-nums">
                              {order.pagamento === 'dinheiro' && cashChange
                                ? `Dinheiro · Troco p/ ${formatBRL(cashChange.paidAmount)} (devolver ${formatBRL(cashChange.changeDue)})`
                                : order.pagamento === 'dinheiro' &&
                                    !order.semTroco &&
                                    order.trocoPara
                                  ? `Dinheiro · Troco para ${order.trocoPara}`
                                  : order.pagamento === 'dinheiro'
                                    ? 'Dinheiro · Sem troco'
                                    : order.pagamento === 'cartao'
                                      ? 'Cartão na entrega'
                                      : 'Pix'}
                            </span>
                          </span>
                          <span className="tabular-nums">
                            Entrega:{' '}
                            {order.tipoPedido === 'retirada'
                              ? 'Grátis'
                              : order.taxaACombinar
                                ? 'A combinar'
                                : formatBRL(order.taxaEntrega)}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 border-t border-black/[0.07] dark:border-white/[0.08] flex flex-wrap items-center gap-2 mt-auto">
                          {meta.next && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleStatusChange(order, meta.next!)
                              }
                              className="flex-1 min-h-[40px] px-3.5 rounded-xl text-xs font-bold text-white inline-flex items-center justify-center gap-1.5"
                              style={{
                                backgroundColor: 'var(--brand-primary)',
                              }}
                            >
                              <CheckCircle2
                                className="w-4 h-4 shrink-0"
                                aria-hidden="true"
                              />
                              <span>{meta.nextLabel}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => enqueuePrint(order)}
                            className="min-h-[40px] px-3.5 rounded-xl bg-[#181615] dark:bg-[#F6F4F0] text-white dark:text-[#181615] text-xs font-bold inline-flex items-center gap-1.5"
                          >
                            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Imprimir Comanda</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPreviewOrder(order)}
                            aria-label="Visualizar cupom térmico"
                            className="min-h-[40px] px-3 rounded-xl border border-black/[0.1] dark:border-white/[0.12] text-xs font-semibold inline-flex items-center gap-1 hover:bg-black/[0.04]"
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">Cupom</span>
                          </button>

                          {order.status !== 'concluido' &&
                            order.status !== 'cancelado' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  handleStatusChange(order, 'cancelado')
                                }
                                aria-label="Cancelar pedido"
                                className="min-h-[40px] px-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-1"
                              >
                                <XCircle className="w-4 h-4" aria-hidden="true" />
                              </button>
                            )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'cardapio' && (
            <AdminMenuTab
              products={products}
              isFromFirestore={productsFromFirestore}
            />
          )}

          {activeTab === 'config' && (
            <AdminSettingsTab settings={liveSettings} />
          )}

          {activeTab === 'financeiro' && (
            <AdminFinanceTab
              store={store}
              paperWidth={liveSettings.paperWidth}
              onPrintCashClosing={handlePrintCashClosing}
            />
          )}
        </main>
      </div>

      {/* Thermal Receipt Preview Modal */}
      {previewOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 print:hidden"
          onClick={() => setPreviewOrder(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FAF9F7] dark:bg-[#1B1918] rounded-2xl border border-black/10 dark:border-white/10 p-5 max-h-[90vh] flex flex-col items-center gap-4 overflow-y-auto shadow-2xl"
          >
            <div className="w-full flex items-center justify-between gap-4">
              <h3 className="font-display text-base font-bold text-[#181615] dark:text-[#F6F4F0]">
                Prévia Cupom Térmico ({liveSettings.paperWidth})
              </h3>
              <button
                type="button"
                onClick={() => setPreviewOrder(null)}
                className="p-1.5 rounded-lg hover:bg-black/5"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <ThermalTicket
              order={previewOrder}
              store={store}
              settings={kitchenSettings}
              previewMode
            />

            <div className="w-full flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewOrder(null)}
                className="min-h-[40px] px-4 rounded-xl text-xs font-semibold text-[#57534E]"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = previewOrder;
                  setPreviewOrder(null);
                  enqueuePrint(target);
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

      {/* Printer Connection Modal */}
      {printerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 print:hidden"
          onClick={() => setPrinterModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="printer-modal-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#FAF9F7] dark:bg-[#161514] rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl"
          >
            <div className="px-5 py-4 bg-white dark:bg-[#1B1918] border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Printer className="w-5 h-5" aria-hidden="true" />
                <h3
                  id="printer-modal-title"
                  className="font-display text-base sm:text-lg font-bold text-[#181615] dark:text-[#F6F4F0]"
                >
                  Conectar Impressora Térmica
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPrinterModalOpen(false)}
                aria-label="Fechar janela da impressora"
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#57534E] dark:text-[#A8A29E] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Current Connection Status */}
              <div
                className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 ${
                  printerConnected
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-white dark:bg-[#1B1918] border-black/[0.08] dark:border-white/[0.08] text-[#44403C] dark:text-[#D6D3D1]'
                }`}
              >
                <Usb className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-bold">
                    {printerConnected
                      ? `Conectada diretamente: ${printerLabel}`
                      : 'Modo atual: Impressora Padrão do Windows (Chrome)'}
                  </p>
                  <p className="text-xs opacity-85 mt-0.5">
                    {printerConnected
                      ? 'Novos pedidos serão impressos diretamente em ESC/POS com corte automático, sem abrir nenhuma janela.'
                      : 'Conecte sua impressora térmica abaixo ou use a impressora padrão já instalada no Windows.'}
                  </p>
                </div>
              </div>

              {printerMessage && (
                <div
                  role="status"
                  className={`p-3 rounded-xl border text-xs font-semibold ${
                    printerMessage.type === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {printerMessage.text}
                </div>
              )}

              {/* Option 1: Direct Web Serial ESC/POS */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] space-y-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Opção 1 — Mais simples (Sem baixar nada)
                  </p>
                  <h4 className="font-display text-sm sm:text-base font-bold mt-0.5">
                    Conexão Direta USB / Serial / Bluetooth (ESC/POS)
                  </h4>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1 leading-relaxed">
                    Clique em <strong>Conectar Impressora</strong> e escolha a
                    porta da sua térmica (Elgin, Epson, Bematech, Daruma, Tanca,
                    Knup). Depois de autorizar 1 vez, ela reconecta sozinha ao
                    abrir este painel e imprime direto sem pop-up.
                  </p>
                </div>

                {!webSerialAvailable ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
                    Abra o painel pelo <strong>Google Chrome</strong> ou{' '}
                    <strong>Microsoft Edge</strong> no computador para usar a
                    conexão direta USB/Serial.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="printer-baud"
                        className="text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1]"
                      >
                        Velocidade da porta (padrão 9600):
                      </label>
                      <select
                        id="printer-baud"
                        value={printerBaudRate}
                        onChange={(e) =>
                          setPrinterBaudRate(Number(e.target.value))
                        }
                        className="min-h-[36px] px-2.5 rounded-lg bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-xs font-semibold tabular-nums"
                      >
                        <option value={9600}>9600 (Padrão)</option>
                        <option value={115200}>115200 (Alta vel.)</option>
                        <option value={38400}>38400</option>
                        <option value={19200}>19200</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!printerConnected ? (
                        <button
                          type="button"
                          disabled={printerBusy}
                          onClick={handleConnectPrinter}
                          className="flex-1 min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold text-white inline-flex items-center justify-center gap-2"
                          style={{ backgroundColor: 'var(--brand-primary)' }}
                        >
                          {printerBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Plug className="w-4 h-4" aria-hidden="true" />
                          )}
                          <span>Conectar Impressora Agora</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={printerBusy}
                            onClick={handleTestDirectPrint}
                            className="flex-1 min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold text-white inline-flex items-center justify-center gap-2"
                            style={{ backgroundColor: 'var(--brand-primary)' }}
                          >
                            <Printer className="w-4 h-4" aria-hidden="true" />
                            <span>Imprimir Cupom de Teste</span>
                          </button>

                          <button
                            type="button"
                            disabled={printerBusy}
                            onClick={handleDisconnectPrinter}
                            className="min-h-[44px] px-3.5 rounded-xl border border-black/[0.1] dark:border-white/[0.12] text-xs font-semibold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <Unplug className="w-4 h-4" aria-hidden="true" />
                            <span>Desconectar</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Option 2: Windows Spooler Printer + Kiosk Printing */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] space-y-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                    Opção 2 — Impressora já instalada no Windows (USB / Rede)
                  </p>
                  <h4 className="font-display text-sm sm:text-base font-bold mt-0.5">
                    Impressora Padrão do Windows (sem porta COM)
                  </h4>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1 leading-relaxed">
                    Se a sua impressora térmica não aparecer na lista USB/COM
                    acima, basta defini-la como{' '}
                    <strong>Impressora Padrão no Windows</strong> e abrir o
                    painel usando o atalho abaixo — o Chrome passa a imprimir
                    sozinho sem perguntar nada.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadAutoPrintBat}
                  className="w-full min-h-[42px] px-4 rounded-xl border border-black/[0.12] dark:border-white/[0.14] bg-[#FAF9F7] dark:bg-[#141312] text-xs font-bold inline-flex items-center justify-center gap-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span>Baixar atalho Windows (Impressão Automática .bat)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Thermal Print Target (only visible inside @media print) */}
      {activePrintOrder && (
        <ThermalTicket
          order={activePrintOrder}
          store={store}
          settings={kitchenSettings}
        />
      )}
      {activePrintClosing && !activePrintOrder && (
        <ThermalCashClosingTicket
          summary={activePrintClosing}
          store={store}
          paperWidth={liveSettings.paperWidth}
        />
      )}
    </>
  );
}
