import { useEffect, useMemo, useState } from 'react';
import { Check, Lock, Minus, Plus, X } from 'lucide-react';
import { ADICIONAIS_PADRAO, PONTOS_CARNE } from '../config/menuData';
import type { AddonOption, CartItem, Product } from '../types/order';
import { formatBRL } from '../utils/formatters';
import { FoodImage } from './FoodImage';

interface ProductModalProps {
  product: Product | null;
  isStoreClosed?: boolean;
  onClose: () => void;
  onAddToCart: (item: Omit<CartItem, 'cartItemId'>) => void;
}

export function ProductModal({
  product,
  isStoreClosed = false,
  onClose,
  onAddToCart,
}: ProductModalProps) {
  const [pontoCarne, setPontoCarne] = useState<string>('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);
  const [observacao, setObservacao] = useState('');
  const [quantidade, setQuantidade] = useState(1);

  const requiredOptions = useMemo(() => {
    if (!product) return [];
    if (product.opcoesObrigatorias && product.opcoesObrigatorias.length > 0) {
      return product.opcoesObrigatorias;
    }
    if (product.permitePontoCarne) {
      return PONTOS_CARNE;
    }
    return [];
  }, [product]);

  const availableAddons = useMemo<AddonOption[]>(() => {
    if (!product) return [];
    if (product.adicionaisCustom && product.adicionaisCustom.length > 0) {
      return product.adicionaisCustom;
    }
    if (product.permiteAdicionais) {
      return ADICIONAIS_PADRAO;
    }
    return [];
  }, [product]);

  const requiredLabel =
    product?.opcoesObrigatorias && product.opcoesObrigatorias.length > 0
      ? 'Escolha sua opção'
      : 'Ponto da carne';

  useEffect(() => {
    if (!product) return;
    if (requiredOptions.length > 0) {
      setPontoCarne(
        requiredOptions.includes('Ao ponto') ? 'Ao ponto' : requiredOptions[0]
      );
    } else {
      setPontoCarne('');
    }
    setSelectedAddonIds([]);
    setRemovedIngredients([]);
    setObservacao('');
    setQuantidade(1);
  }, [product, requiredOptions]);

  useEffect(() => {
    if (!product) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [product, onClose]);

  if (!product) return null;

  const selectedAddons: AddonOption[] = availableAddons.filter((a) =>
    selectedAddonIds.includes(a.id)
  );
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.preco, 0);
  const unitPrice = product.preco + addonsTotal;
  const finalTotal = unitPrice * quantidade;

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleRemoveIngredient = (ing: string) => {
    setRemovedIngredients((prev) =>
      prev.includes(ing) ? prev.filter((item) => item !== ing) : [...prev, ing]
    );
  };

  const handleConfirm = () => {
    if (isStoreClosed) return;
    onAddToCart({
      productId: product.id,
      nome: product.nome,
      imagem: product.imagem,
      precoBase: product.preco,
      quantidade,
      pontoCarne: requiredOptions.length > 0 ? pontoCarne : undefined,
      adicionais: selectedAddons,
      ingredientesRemovidos: removedIngredients,
      observacao: observacao.trim(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px] animate-fade-fast sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-product-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-[#FAF9F7] dark:bg-[#161514] rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 animate-sheet-up"
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-[#FAF9F7] dark:bg-[#161514]">
          <div className="w-10 h-1.5 rounded-full bg-black/15 dark:bg-white/20" />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Product Image Banner */}
          <div className="relative aspect-[16/10] w-full bg-[#EFECE7] dark:bg-[#23201E]">
            <FoodImage
              src={product.imagem}
              alt={product.nome}
              eager
              className="w-full h-full"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela do produto"
              className="absolute top-3 right-3 min-h-[44px] min-w-[44px] rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* Title & Description */}
            <div>
              {product.etiqueta && (
                <p
                  className="text-xs font-semibold mb-1"
                  style={{ color: 'var(--brand-primary-text)' }}
                >
                  {product.etiqueta}
                </p>
              )}
              <div className="flex items-start justify-between gap-3">
                <h2
                  id="modal-product-title"
                  className="font-display text-xl sm:text-2xl font-bold text-[#181615] dark:text-[#F6F4F0] leading-tight"
                >
                  {product.nome}
                </h2>
                <span className="text-lg font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums whitespace-nowrap shrink-0">
                  {formatBRL(product.preco)}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                {product.descricao}
              </p>
            </div>

            {/* Required Options Selector */}
            {requiredOptions.length > 0 && (
              <fieldset className="pt-5 border-t border-black/[0.08] dark:border-white/[0.08]">
                <div className="flex items-baseline justify-between gap-2 mb-3">
                  <legend className="text-sm font-bold text-[#181615] dark:text-[#F6F4F0]">
                    {requiredLabel}
                  </legend>
                  <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                    Obrigatório · Escolha 1
                  </span>
                </div>

                <div
                  className={`grid gap-2 ${
                    requiredOptions.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'
                  }`}
                >
                  {requiredOptions.map((opt) => {
                    const selected = pontoCarne === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setPontoCarne(opt)}
                        aria-pressed={selected}
                        className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors text-center ${
                          selected
                            ? 'text-white border-transparent shadow-xs'
                            : 'bg-white dark:bg-[#1F1D1C] border-black/[0.09] dark:border-white/[0.1] text-[#292524] dark:text-[#E7E5E4] hover:border-black/25 dark:hover:border-white/25'
                        }`}
                        style={
                          selected
                            ? { backgroundColor: 'var(--brand-primary)' }
                            : undefined
                        }
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Add-ons Checklist */}
            {availableAddons.length > 0 && (
              <fieldset className="pt-5 border-t border-black/[0.08] dark:border-white/[0.08]">
                <div className="flex items-baseline justify-between gap-2 mb-3">
                  <legend className="text-sm font-bold text-[#181615] dark:text-[#F6F4F0]">
                    Turbinar com adicionais
                  </legend>
                  <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                    Opcional
                  </span>
                </div>

                <div className="space-y-2">
                  {availableAddons.map((addon) => {
                    const checked = selectedAddonIds.includes(addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddon(addon.id)}
                        role="checkbox"
                        aria-checked={checked}
                        className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-left transition-colors ${
                          checked
                            ? 'bg-white dark:bg-[#221F1E]'
                            : 'bg-white/70 dark:bg-[#1B1918] border-black/[0.07] dark:border-white/[0.08] hover:border-black/20 dark:hover:border-white/20'
                        }`}
                        style={
                          checked
                            ? { borderColor: 'var(--brand-primary)' }
                            : undefined
                        }
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                              checked
                                ? 'text-white border-transparent'
                                : 'border-black/25 dark:border-white/25 bg-transparent'
                            }`}
                            style={
                              checked
                                ? { backgroundColor: 'var(--brand-primary)' }
                                : undefined
                            }
                          >
                            {checked && (
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                          </span>
                          <span className="text-sm font-medium text-[#181615] dark:text-[#F6F4F0] truncate">
                            {addon.nome}
                          </span>
                        </div>

                        <span className="text-xs sm:text-sm font-semibold text-[#57534E] dark:text-[#D6D3D1] tabular-nums whitespace-nowrap shrink-0">
                          + {formatBRL(addon.preco)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Remove Ingredients */}
            {product.ingredientesRemoviveis &&
              product.ingredientesRemoviveis.length > 0 && (
                <fieldset className="pt-5 border-t border-black/[0.08] dark:border-white/[0.08]">
                  <div className="flex items-baseline justify-between gap-2 mb-3">
                    <legend className="text-sm font-bold text-[#181615] dark:text-[#F6F4F0]">
                      Retirar algum ingrediente?
                    </legend>
                    <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                      Opcional
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {product.ingredientesRemoviveis.map((ing) => {
                      const isRemoved = removedIngredients.includes(ing);
                      return (
                        <button
                          key={ing}
                          type="button"
                          onClick={() => toggleRemoveIngredient(ing)}
                          aria-pressed={isRemoved}
                          className={`min-h-[40px] px-3.5 rounded-xl text-xs sm:text-sm font-medium border transition-colors ${
                            isRemoved
                              ? 'bg-[#181615] text-white border-[#181615] dark:bg-[#F6F4F0] dark:text-[#181615] dark:border-[#F6F4F0]'
                              : 'bg-white dark:bg-[#1F1D1C] border-black/[0.09] dark:border-white/[0.1] text-[#44403C] dark:text-[#D6D3D1] hover:border-black/25 dark:hover:border-white/25'
                          }`}
                        >
                          {isRemoved ? `Sem ${ing}` : `Tirar ${ing}`}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

            {/* Observation */}
            <div className="pt-5 border-t border-black/[0.08] dark:border-white/[0.08]">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <label
                  htmlFor="product-obs"
                  className="text-sm font-bold text-[#181615] dark:text-[#F6F4F0]"
                >
                  Alguma observação?
                </label>
                <span className="text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                  {observacao.length}/180
                </span>
              </div>
              <textarea
                id="product-obs"
                rows={2}
                maxLength={180}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: sem cebola, cortar ao meio, mandar maionese à parte..."
                className="w-full p-3 rounded-xl bg-white dark:bg-[#1F1D1C] border border-black/[0.09] dark:border-white/[0.1] text-sm text-[#181615] dark:text-[#F6F4F0] placeholder:text-[#8C857F] dark:placeholder:text-[#78716C] resize-none focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Sticky Modal Footer: Quantity + Live Add CTA */}
        <div className="p-4 bg-white dark:bg-[#1B1918] border-t border-black/[0.08] dark:border-white/[0.08] flex items-center gap-3">
          {isStoreClosed ? (
            <div className="w-full min-h-[48px] px-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-sm font-semibold flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Loja fechada no momento — pedidos pausados</span>
            </div>
          ) : (
            <>
              <div
                aria-label="Quantidade"
                className="flex items-center border border-black/[0.1] dark:border-white/[0.12] rounded-xl bg-[#FAF9F7] dark:bg-[#141312] shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                  disabled={quantidade <= 1}
                  aria-label="Diminuir quantidade"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#181615] dark:text-[#F6F4F0] disabled:opacity-35 transition-opacity"
                >
                  <Minus className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="w-7 text-center text-sm font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums">
                  {quantidade}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => Math.min(20, q + 1))}
                  aria-label="Aumentar quantidade"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#181615] dark:text-[#F6F4F0]"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 min-h-[48px] px-4 rounded-xl text-sm font-semibold text-white flex items-center justify-between gap-2 shadow-sm transition-transform active:scale-[0.98]"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                <span>Adicionar</span>
                <span className="tabular-nums font-bold">
                  {formatBRL(finalTotal)}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
