import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { CategoryId } from '../types/order';

interface CategoryBarProps {
  categories: { id: CategoryId; nome: string }[];
  activeCategory: CategoryId;
  onSelectCategory: (id: CategoryId) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function CategoryBar({
  categories,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  searchInputRef,
}: CategoryBarProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const activeBtn = tabRefs.current[activeCategory];
    if (activeBtn && railRef.current) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activeCategory]);

  return (
    <>
      {/* Scrollable Search Box (stays in normal document flow to protect mobile sticky cap) */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C] dark:text-[#A8A29E]"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar hambúrguer, combo, bebida..."
            aria-label="Buscar produtos no cardápio"
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.09] dark:border-white/[0.1] text-sm text-[#181615] dark:text-[#F6F4F0] placeholder:text-[#8C857F] dark:placeholder:text-[#78716C] transition-colors focus:border-[var(--brand-primary)] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpar busca"
              className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#78716C] hover:text-[#181615] dark:text-[#A8A29E] dark:hover:text-white"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Compact Sticky Category Navigation Bar (height: 48px) */}
      <nav
        aria-label="Categorias do cardápio"
        className="sticky top-0 z-30 bg-[#FAF9F7]/92 dark:bg-[#111010]/92 backdrop-blur-md border-y border-black/[0.07] dark:border-white/[0.08]"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center gap-2">
          <div
            ref={railRef}
            className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1.5 flex-1"
          >
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  ref={(el) => {
                    tabRefs.current[cat.id] = el;
                  }}
                  type="button"
                  onClick={() => onSelectCategory(cat.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className={`relative min-h-[40px] px-3.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'text-white shadow-xs'
                      : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#181615] dark:hover:text-[#F6F4F0] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: 'var(--brand-primary)' }
                      : undefined
                  }
                >
                  {cat.nome}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
