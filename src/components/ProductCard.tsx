import { memo } from 'react';
import { Lock, Plus } from 'lucide-react';
import type { Product } from '../types/order';
import { formatBRL } from '../utils/formatters';
import { FoodImage } from './FoodImage';

interface ProductCardProps {
  product: Product;
  cartQuantity: number;
  variant?: 'featured' | 'standard';
  isStoreClosed?: boolean;
  onOpenModal: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
}

export const ProductCard = memo(function ProductCard({
  product,
  cartQuantity,
  variant = 'standard',
  isStoreClosed = false,
  onOpenModal,
  onQuickAdd,
}: ProductCardProps) {
  const isCustomizable = Boolean(
    product.permitePontoCarne ||
      (product.opcoesObrigatorias && product.opcoesObrigatorias.length > 0) ||
      product.permiteAdicionais ||
      (product.adicionaisCustom && product.adicionaisCustom.length > 0)
  );

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isStoreClosed) {
      onOpenModal(product);
      return;
    }
    if (isCustomizable) {
      onOpenModal(product);
    } else {
      onQuickAdd(product);
    }
  };

  if (variant === 'featured') {
    return (
      <article
        onClick={() => onOpenModal(product)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenModal(product);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`Ver detalhes de ${product.nome}, ${formatBRL(product.preco)}`}
        className="group flex flex-col bg-white dark:bg-[#1B1918] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] overflow-hidden cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-black/30 focus-visible:outline-none"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <FoodImage
            src={product.imagem}
            alt={product.nome}
            className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {cartQuantity > 0 && (
            <span
              aria-label={`${cartQuantity} no carrinho`}
              className="absolute top-2.5 right-2.5 min-w-[26px] h-[26px] px-1.5 rounded-lg text-xs font-bold text-white flex items-center justify-center shadow-sm tabular-nums"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {cartQuantity}
            </span>
          )}
        </div>

        <div className="flex flex-col flex-1 p-4">
          {product.etiqueta && (
            <span
              className="text-xs font-semibold mb-1 tracking-tight"
              style={{ color: 'var(--brand-primary-text)' }}
            >
              {product.etiqueta}
            </span>
          )}

          <h3 className="font-display text-base font-bold text-[#181615] dark:text-[#F6F4F0] leading-snug">
            {product.nome}
          </h3>

          <p className="mt-1.5 text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] line-clamp-2 leading-relaxed flex-1">
            {product.descricao}
          </p>

          <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2">
            <span className="text-base font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
              {formatBRL(product.preco)}
            </span>

            <button
              type="button"
              onClick={handleAddClick}
              disabled={isStoreClosed}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-opacity whitespace-nowrap shrink-0 ${
                isStoreClosed
                  ? 'bg-black/[0.06] dark:bg-white/[0.08] text-[#78716C] dark:text-[#A8A29E] cursor-not-allowed'
                  : 'text-white hover:opacity-95 active:scale-[0.98]'
              }`}
              style={
                isStoreClosed
                  ? undefined
                  : { backgroundColor: 'var(--brand-primary)' }
              }
            >
              {isStoreClosed ? (
                <>
                  <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Fechado</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Adicionar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={() => onOpenModal(product)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenModal(product);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalhes de ${product.nome}, ${formatBRL(product.preco)}`}
      className="group flex flex-row sm:flex-col bg-white dark:bg-[#1B1918] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] overflow-hidden cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-black/30"
    >
      <div className="order-2 sm:order-1 relative w-28 h-28 sm:w-full sm:h-auto sm:aspect-[4/3] m-3 sm:m-0 rounded-xl sm:rounded-none shrink-0 overflow-hidden self-center sm:self-auto">
        <FoodImage
          src={product.imagem}
          alt={product.nome}
          className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {cartQuantity > 0 && (
          <span
            aria-label={`${cartQuantity} no carrinho`}
            className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 min-w-[24px] h-[24px] px-1.5 rounded-lg text-xs font-bold text-white flex items-center justify-center shadow-sm tabular-nums"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {cartQuantity}
          </span>
        )}
      </div>

      <div className="order-1 sm:order-2 flex flex-col flex-1 min-w-0 p-3.5 pr-1 sm:p-4">
        {product.etiqueta && (
          <span
            className="text-xs font-semibold mb-0.5 tracking-tight"
            style={{ color: 'var(--brand-primary-text)' }}
          >
            {product.etiqueta}
          </span>
        )}

        <h3 className="font-display text-[15px] sm:text-base font-bold text-[#181615] dark:text-[#F6F4F0] leading-snug">
          {product.nome}
        </h3>

        <p className="mt-1 text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] line-clamp-2 leading-relaxed flex-1">
          {product.descricao}
        </p>

        <div className="mt-3 sm:mt-4 sm:pt-3 sm:border-t sm:border-black/[0.06] sm:dark:border-white/[0.06] flex items-center justify-between gap-2">
          <span className="text-[15px] sm:text-base font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
            {formatBRL(product.preco)}
          </span>

          <button
            type="button"
            onClick={handleAddClick}
            disabled={isStoreClosed}
            className={`min-h-[38px] sm:min-h-[40px] px-3 sm:px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
              isStoreClosed
                ? 'bg-black/[0.06] dark:bg-white/[0.08] text-[#78716C] dark:text-[#A8A29E] cursor-not-allowed'
                : 'active:scale-[0.98]'
            }`}
            style={
              isStoreClosed
                ? undefined
                : {
                    backgroundColor: 'var(--brand-primary-soft)',
                    color: 'var(--brand-primary-text)',
                  }
            }
          >
            {isStoreClosed ? (
              <>
                <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Fechado</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Adicionar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
});
