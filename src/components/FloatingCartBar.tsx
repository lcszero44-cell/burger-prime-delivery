import { ShoppingBag } from 'lucide-react';
import { formatBRL } from '../utils/formatters';

interface FloatingCartBarProps {
  itemCount: number;
  subtotal: number;
  onOpenCart: () => void;
}

export function FloatingCartBar({
  itemCount,
  subtotal,
  onOpenCart,
}: FloatingCartBarProps) {
  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none px-4 pb-4 pt-2 sm:pb-5">
      <div className="mx-auto max-w-xl pointer-events-auto">
        <button
          type="button"
          onClick={onOpenCart}
          aria-label={`Abrir carrinho com ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}, subtotal ${formatBRL(subtotal)}`}
          className="w-full min-h-[54px] px-4 sm:px-5 rounded-2xl text-white shadow-xl shadow-black/25 flex items-center justify-between gap-3 transition-transform duration-150 active:scale-[0.985]"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-7 min-w-[28px] px-2 rounded-lg bg-black/20 text-xs font-bold flex items-center justify-center tabular-nums">
              {itemCount}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold truncate">
              <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Ver carrinho</span>
            </span>
          </div>

          <span className="text-sm sm:text-base font-bold tabular-nums whitespace-nowrap shrink-0">
            {formatBRL(subtotal)}
          </span>
        </button>
      </div>
    </div>
  );
}
