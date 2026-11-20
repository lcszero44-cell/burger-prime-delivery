import { AlertCircle, Clock, MapPin, Moon, ShoppingBag, Sun } from 'lucide-react';
import type { StoreConfig } from '../types/order';
import { formatBRL, type StoreOpenStatus } from '../utils/formatters';
import { BrandLogo } from './BrandLogo';
import { FoodImage } from './FoodImage';

interface StoreHeaderProps {
  store: StoreConfig;
  openStatus: StoreOpenStatus;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function StoreHeader({
  store,
  openStatus,
  isDark,
  onToggleTheme,
}: StoreHeaderProps) {
  return (
    <header className="w-full">
      {/* Real-time Closed Store Banner */}
      {!openStatus.isOpen && (
        <div
          role="status"
          className="bg-rose-600 text-white px-4 py-2.5 text-center text-xs sm:text-sm font-semibold"
        >
          <div className="mx-auto max-w-6xl flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Estamos fechados no momento ({openStatus.detail}). Você pode
              navegar pelo cardápio, mas novos pedidos estão pausados.
            </span>
          </div>
        </div>
      )}

      {/* Compact top utility bar */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-3 pb-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-[#6B6560] dark:text-[#A8A29E] min-w-0">
          <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{store.cidadeUf}</span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
          className="min-h-[44px] min-w-[44px] px-3 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-medium text-[#44403C] dark:text-[#D6D3D1] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors whitespace-nowrap shrink-0"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Modo claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Modo escuro</span>
            </>
          )}
        </button>
      </div>

      {/* Storefront Hero: mobile stacked banner + desktop balanced 2-column split */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-5 sm:pb-7">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 lg:items-stretch">
          {/* Editorial Photo */}
          <div className="lg:col-span-6 lg:order-2 relative rounded-2xl overflow-hidden aspect-[16/9] lg:aspect-auto lg:min-h-[260px] shadow-sm">
            <FoodImage
              src={store.heroBannerUrl}
              alt={`Hambúrguer artesanal da ${store.nome}`}
              eager
              className="w-full h-full"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent"
            />
          </div>

          {/* Brand identity & essential delivery info */}
          <div className="lg:col-span-6 lg:order-1 flex flex-col justify-center">
            <div className="flex items-start gap-3.5 sm:gap-4">
              <BrandLogo
                logoUrl={store.logoUrl}
                storeName={store.nome}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#181615] dark:text-[#F6F4F0] text-balance leading-tight">
                    {store.nome}
                  </h1>
                </div>

                {/* Live Open / Closed Status (explicit text + icon, never color-only) */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <span
                    className={`inline-flex items-center gap-1.5 font-semibold ${
                      openStatus.isOpen
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    {openStatus.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-[#A8A29E] dark:text-[#57534E]"
                  >
                    ·
                  </span>
                  <span className="text-[#57534E] dark:text-[#A8A29E]">
                    {openStatus.detail}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3.5 text-sm sm:text-base text-[#57534E] dark:text-[#B8B2AC] leading-relaxed max-w-xl">
              {store.slogan}
            </p>

            {/* Unboxed structured delivery metadata */}
            <div className="mt-4 pt-4 border-t border-black/[0.07] dark:border-white/[0.08] flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E]">
              <span className="inline-flex items-center gap-1.5">
                <ShoppingBag
                  className="w-3.5 h-3.5 shrink-0 text-[#78716C] dark:text-[#A8A29E]"
                  aria-hidden="true"
                />
                <span>
                  Mínimo{' '}
                  <strong className="font-semibold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
                    {formatBRL(store.pedidoMinimo)}
                  </strong>
                </span>
              </span>
              <span
                aria-hidden="true"
                className="text-[#D6D3D1] dark:text-[#44403C]"
              >
                ·
              </span>
              <span>
                Entrega{' '}
                <strong className="font-semibold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
                  {store.tempoEstimadoEntrega}
                </strong>
              </span>
              <span
                aria-hidden="true"
                className="text-[#D6D3D1] dark:text-[#44403C]"
              >
                ·
              </span>
              <span>
                Retirada{' '}
                <strong className="font-semibold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
                  {store.tempoEstimadoRetirada}
                </strong>
              </span>
            </div>

            <p className="mt-2 text-xs text-[#78716C] dark:text-[#8C857F]">
              {store.resumoHorario}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
