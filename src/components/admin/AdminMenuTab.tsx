import { useMemo, useState } from 'react';
import {
  Check,
  Database,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteProductFromFirestore,
  saveProductToFirestore,
  seedInitialProductsIfEmpty,
  slugifyProductId,
} from '../../services/orderService';
import type {
  AddonOption,
  Product,
  ProductBadge,
  ProductCategory,
} from '../../types/order';
import { formatBRL } from '../../utils/formatters';
import { FoodImage } from '../FoodImage';

interface AdminMenuTabProps {
  products: Product[];
  isFromFirestore: boolean;
}

const LOCAL_IMAGE_GALLERY: { label: string; path: string }[] = [
  {
    label: 'Classic Smash',
    path: '/src/assets/images/burger_classic_smash_1795091232144.jpg',
  },
  {
    label: 'Cheddar & Bacon',
    path: '/src/assets/images/burger_cheddar_bacon_1795091175542.jpg',
  },
  {
    label: 'Duplo na Brasa',
    path: '/src/assets/images/burger_duplo_brasa_1795091175333.jpg',
  },
  {
    label: 'Trufado Gourmet',
    path: '/src/assets/images/burger_trufado_gourmet_1795091174416.jpg',
  },
  {
    label: 'Crispy Chicken',
    path: '/src/assets/images/burger_chicken_crispy_1795091176332.jpg',
  },
  {
    label: 'Veggie Artesanal',
    path: '/src/assets/images/burger_veggie_artisan_1795091175048.jpg',
  },
  {
    label: 'Combo Burger + Fritas',
    path: '/src/assets/images/combo_burger_fries_1795091175480.jpg',
  },
  {
    label: 'Batata Cheddar & Bacon',
    path: '/src/assets/images/sides_loaded_fries_1795091175128.jpg',
  },
  {
    label: 'Onion Rings',
    path: '/src/assets/images/sides_onion_rings_1795091174630.jpg',
  },
  {
    label: 'Milkshake Ovomaltine',
    path: '/src/assets/images/drink_milkshake_ovo_1795091174744.jpg',
  },
  {
    label: 'Limonada / Bebida',
    path: '/src/assets/images/drink_limonada_gelada_1795091175613.jpg',
  },
  {
    label: 'Brownie com Sorvete',
    path: '/src/assets/images/dessert_brownie_sorvete_1795091175937.jpg',
  },
  {
    label: 'Pudim de Leite',
    path: '/src/assets/images/dessert_pudim_leite_1795091175228.jpg',
  },
];

const CATEGORY_OPTIONS: { id: ProductCategory; label: string }[] = [
  { id: 'hamburgueres', label: 'Hambúrgueres' },
  { id: 'combos', label: 'Combos' },
  { id: 'porcoes', label: 'Porções' },
  { id: 'bebidas', label: 'Bebidas' },
  { id: 'sobremesas', label: 'Sobremesas' },
];

interface ProductFormState {
  id: string;
  nome: string;
  descricao: string;
  precoStr: string;
  categoria: ProductCategory;
  imagem: string;
  etiqueta: ProductBadge | '';
  destaque: boolean;
  ativo: boolean;
  permitePontoCarne: boolean;
  opcoesObrigatoriasText: string;
  permiteAdicionais: boolean;
  adicionaisCustom: AddonOption[];
  ingredientesRemoviveisText: string;
  ordem: number;
}

function createEmptyForm(nextOrder: number): ProductFormState {
  return {
    id: '',
    nome: '',
    descricao: '',
    precoStr: '29.90',
    categoria: 'hamburgueres',
    imagem: LOCAL_IMAGE_GALLERY[0].path,
    etiqueta: '',
    destaque: false,
    ativo: true,
    permitePontoCarne: true,
    opcoesObrigatoriasText: '',
    permiteAdicionais: true,
    adicionaisCustom: [],
    ingredientesRemoviveisText: 'Cebola, Picles, Tomate',
    ordem: nextOrder,
  };
}

function productToForm(p: Product): ProductFormState {
  return {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    precoStr: p.preco.toFixed(2),
    categoria: p.categoria,
    imagem: p.imagem || LOCAL_IMAGE_GALLERY[0].path,
    etiqueta: p.etiqueta || '',
    destaque: Boolean(p.destaque),
    ativo: p.ativo !== false,
    permitePontoCarne: Boolean(p.permitePontoCarne),
    opcoesObrigatoriasText: (p.opcoesObrigatorias || []).join(', '),
    permiteAdicionais: Boolean(p.permiteAdicionais),
    adicionaisCustom: p.adicionaisCustom ? [...p.adicionaisCustom] : [],
    ingredientesRemoviveisText: (p.ingredientesRemoviveis || []).join(', '),
    ordem: p.ordem ?? 0,
  };
}

export function AdminMenuTab({
  products,
  isFromFirestore,
}: AdminMenuTabProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>(
    'all'
  );
  const [editingForm, setEditingForm] = useState<ProductFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [newAddonName, setNewAddonName] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState('');

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3000);
  };

  const ensureFirestoreSeeded = async () => {
    if (isFromFirestore) return;
    await seedInitialProductsIfEmpty();
  };

  const handleSeedClick = async () => {
    setSeeding(true);
    try {
      const seeded = await seedInitialProductsIfEmpty();
      showFeedback(
        seeded
          ? 'Cardápio inicial importado para o Firestore com sucesso!'
          : 'O cardápio já estava sincronizado no Firestore.'
      );
    } catch (err) {
      showFeedback(
        err instanceof Error ? err.message : 'Erro ao sincronizar cardápio.'
      );
    } finally {
      setSeeding(false);
    }
  };

  const handleToggleActive = async (product: Product) => {
    setBusyId(product.id);
    try {
      await ensureFirestoreSeeded();
      await saveProductToFirestore({
        ...product,
        ativo: product.ativo === false,
      });
      showFeedback(
        product.ativo === false
          ? `${product.nome} reativado no cardápio.`
          : `${product.nome} pausado (oculto para clientes).`
      );
    } catch (err) {
      showFeedback(
        err instanceof Error ? err.message : 'Erro ao atualizar status.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (product: Product) => {
    setBusyId(product.id);
    try {
      await ensureFirestoreSeeded();
      await deleteProductFromFirestore(product.id);
      setConfirmDeleteId(null);
      showFeedback(`${product.nome} excluído do cardápio.`);
    } catch (err) {
      showFeedback(
        err instanceof Error ? err.message : 'Erro ao excluir produto.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingForm) return;
    const nome = editingForm.nome.trim();
    const preco = parseFloat(editingForm.precoStr.replace(',', '.'));
    if (!nome || Number.isNaN(preco) || preco < 0) {
      showFeedback('Preencha nome e preço válidos.');
      return;
    }

    setSaving(true);
    try {
      await ensureFirestoreSeeded();
      const opcoesObrigatorias = editingForm.opcoesObrigatoriasText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const ingredientesRemoviveis = editingForm.ingredientesRemoviveisText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const productToSave: Product = {
        id: editingForm.id || slugifyProductId(nome),
        nome,
        descricao: editingForm.descricao.trim(),
        preco: Number(preco.toFixed(2)),
        categoria: editingForm.categoria,
        imagem: editingForm.imagem.trim() || LOCAL_IMAGE_GALLERY[0].path,
        etiqueta: editingForm.etiqueta || undefined,
        destaque: editingForm.destaque,
        ativo: editingForm.ativo,
        ordem: editingForm.ordem,
        permitePontoCarne: editingForm.permitePontoCarne,
        opcoesObrigatorias:
          opcoesObrigatorias.length > 0 ? opcoesObrigatorias : undefined,
        permiteAdicionais: editingForm.permiteAdicionais,
        adicionaisCustom:
          editingForm.adicionaisCustom.length > 0
            ? editingForm.adicionaisCustom
            : undefined,
        ingredientesRemoviveis,
      };

      await saveProductToFirestore(productToSave);
      setEditingForm(null);
      showFeedback(`Produto "${nome}" salvo em tempo real!`);
    } catch (err) {
      showFeedback(
        err instanceof Error ? err.message : 'Erro ao salvar produto.'
      );
    } finally {
      setSaving(false);
    }
  };

  const addCustomAddon = () => {
    if (!editingForm) return;
    const nome = newAddonName.trim();
    const preco = parseFloat(newAddonPrice.replace(',', '.'));
    if (!nome || Number.isNaN(preco) || preco < 0) return;

    const next: AddonOption = {
      id: `add-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      nome,
      preco: Number(preco.toFixed(2)),
    };
    setEditingForm({
      ...editingForm,
      permiteAdicionais: true,
      adicionaisCustom: [...editingForm.adicionaisCustom, next],
    });
    setNewAddonName('');
    setNewAddonPrice('');
  };

  const removeCustomAddon = (id: string) => {
    if (!editingForm) return;
    setEditingForm({
      ...editingForm,
      adicionaisCustom: editingForm.adicionaisCustom.filter((a) => a.id !== id),
    });
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.categoria !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return `${p.nome} ${p.descricao}`.toLowerCase().includes(q);
    });
  }, [products, search, categoryFilter]);

  const activeCount = products.filter((p) => p.ativo !== false).length;

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#181615] dark:text-[#F6F4F0]">
            Gerenciar Cardápio
          </h2>
          <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A8A29E] tabular-nums">
            {activeCount} ativos · {products.length - activeCount} pausados ·
            alterações refletem ao vivo para os clientes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isFromFirestore && (
            <button
              type="button"
              onClick={handleSeedClick}
              disabled={seeding}
              className="min-h-[42px] px-3.5 rounded-xl border border-black/[0.1] dark:border-white/[0.12] bg-white dark:bg-[#1B1918] text-xs font-semibold text-[#181615] dark:text-[#F6F4F0] inline-flex items-center gap-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
            >
              {seeding ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Database className="w-4 h-4" aria-hidden="true" />
              )}
              <span>Sincronizar base inicial</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setEditingForm(createEmptyForm(products.length))}
            className="min-h-[42px] px-4 rounded-xl text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-1.5 shadow-xs"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Novo produto</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2"
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto por nome ou descrição..."
            className="w-full min-h-[42px] pl-10 pr-3.5 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.09] dark:border-white/[0.1] text-sm text-[#181615] dark:text-[#F6F4F0] placeholder:text-[#8C857F] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </div>

        <select
          aria-label="Filtrar categoria"
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(e.target.value as 'all' | ProductCategory)
          }
          className="min-h-[42px] px-3.5 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.09] dark:border-white/[0.1] text-sm text-[#181615] dark:text-[#F6F4F0] focus:border-[var(--brand-primary)] focus:outline-none"
        >
          <option value="all">Todas as categorias</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredProducts.map((p) => {
          const isActive = p.ativo !== false;
          const isBusy = busyId === p.id;
          return (
            <div
              key={p.id}
              className={`p-3.5 rounded-2xl bg-white dark:bg-[#1B1918] border transition-colors flex gap-3.5 ${
                isActive
                  ? 'border-black/[0.08] dark:border-white/[0.08]'
                  : 'border-dashed border-black/20 dark:border-white/20 opacity-75'
              }`}
            >
              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                <FoodImage
                  src={p.imagem}
                  alt={p.nome}
                  className="w-full h-full"
                />
              </div>

              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-bold text-[#181615] dark:text-[#F6F4F0] truncate">
                      {p.nome}
                    </h3>
                    <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] capitalize">
                      {CATEGORY_OPTIONS.find((c) => c.id === p.categoria)
                        ?.label || p.categoria}
                      {p.destaque ? ' · Destaque' : ''}
                      {!isActive ? ' · Pausado' : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[#181615] dark:text-[#F6F4F0] tabular-nums whitespace-nowrap">
                    {formatBRL(p.preco)}
                  </span>
                </div>

                <p className="mt-1 text-xs text-[#57534E] dark:text-[#A8A29E] line-clamp-2 flex-1">
                  {p.descricao}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleToggleActive(p)}
                    className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 border transition-colors ${
                      isActive
                        ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                        : 'border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Ativo</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Pausado</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setEditingForm(productToForm(p))}
                    className="min-h-[34px] px-2.5 rounded-lg text-xs font-semibold border border-black/[0.09] dark:border-white/[0.1] bg-[#FAF9F7] dark:bg-[#141312] text-[#181615] dark:text-[#F6F4F0] inline-flex items-center gap-1 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Editar</span>
                  </button>

                  {confirmDeleteId === p.id ? (
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(p)}
                        className="min-h-[34px] px-2.5 rounded-lg text-xs font-bold bg-rose-600 text-white"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[34px] px-2 rounded-lg text-xs font-medium text-[#78716C]"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmDeleteId(p.id)}
                      aria-label={`Excluir ${p.nome}`}
                      className="min-h-[34px] px-2.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Excluir</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal */}
      {editingForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
          onClick={() => !saving && setEditingForm(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-product-modal-title"
        >
          <form
            onSubmit={handleSaveForm}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#FAF9F7] dark:bg-[#161514] rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 bg-white dark:bg-[#1B1918] border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between">
              <h3
                id="edit-product-modal-title"
                className="font-display text-lg font-bold text-[#181615] dark:text-[#F6F4F0]"
              >
                {editingForm.id ? 'Editar produto' : 'Novo produto'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingForm(null)}
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#57534E] dark:text-[#A8A29E] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8">
                  <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                    Nome do produto *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingForm.nome}
                    onChange={(e) =>
                      setEditingForm({ ...editingForm, nome: e.target.value })
                    }
                    placeholder="Ex: Smash Duplo Especial"
                    className="w-full min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-sm"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                    Preço (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="decimal"
                    value={editingForm.precoStr}
                    onChange={(e) =>
                      setEditingForm({
                        ...editingForm,
                        precoStr: e.target.value,
                      })
                    }
                    placeholder="32.90"
                    className="w-full min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                    Categoria
                  </label>
                  <select
                    value={editingForm.categoria}
                    onChange={(e) =>
                      setEditingForm({
                        ...editingForm,
                        categoria: e.target.value as ProductCategory,
                      })
                    }
                    className="w-full min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-sm"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                    Etiqueta (opcional)
                  </label>
                  <select
                    value={editingForm.etiqueta}
                    onChange={(e) =>
                      setEditingForm({
                        ...editingForm,
                        etiqueta: e.target.value as ProductBadge | '',
                      })
                    }
                    className="w-full min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-sm"
                  >
                    <option value="">Sem etiqueta</option>
                    <option value="Mais pedido">Mais pedido</option>
                    <option value="Novo">Novo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                  Descrição
                </label>
                <textarea
                  rows={2}
                  value={editingForm.descricao}
                  onChange={(e) =>
                    setEditingForm({
                      ...editingForm,
                      descricao: e.target.value,
                    })
                  }
                  placeholder="Descreva ingredientes, peso do blend e diferenciais..."
                  className="w-full p-3 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-sm resize-none"
                />
              </div>

              {/* Image Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1]">
                  Imagem do produto (galeria pronta ou URL)
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {LOCAL_IMAGE_GALLERY.map((img) => {
                    const selected = editingForm.imagem === img.path;
                    return (
                      <button
                        key={img.path}
                        type="button"
                        onClick={() =>
                          setEditingForm({ ...editingForm, imagem: img.path })
                        }
                        title={img.label}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          selected
                            ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary-soft)]'
                            : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                      >
                        <FoodImage
                          src={img.path}
                          alt={img.label}
                          className="w-full h-full"
                        />
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={editingForm.imagem}
                  onChange={(e) =>
                    setEditingForm({ ...editingForm, imagem: e.target.value })
                  }
                  placeholder="/src/assets/images/... ou https://..."
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-xs font-mono"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-black/[0.07] dark:border-white/[0.08]">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingForm.ativo}
                    onChange={(e) =>
                      setEditingForm({
                        ...editingForm,
                        ativo: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-[var(--brand-primary)]"
                  />
                  <span>Ativo no cardápio</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingForm.destaque}
                    onChange={(e) =>
                      setEditingForm({
                        ...editingForm,
                        destaque: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-[var(--brand-primary)]"
                  />
                  <span>Exibir em Destaques</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingForm.permitePontoCarne}
                    onChange={(e) =>
                      setEditingForm({
                        ...editingForm,
                        permitePontoCarne: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-[var(--brand-primary)]"
                  />
                  <span>Ponto da carne</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingForm.permiteAdicionais}
                    onChange={(e) =>
                      setEditingForm({
                        ...editingForm,
                        permiteAdicionais: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-[var(--brand-primary)]"
                  />
                  <span>Adicionais pagos</span>
                </label>
              </div>

              {/* Custom Required Options & Removable Ingredients */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-black/[0.07] dark:border-white/[0.08]">
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                    Opções obrigatórias custom (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    value={editingForm.opcoesObrigatoriasText}
                    onChange={(e) =>
                      setEditingForm({
                        ...editingForm,
                        opcoesObrigatoriasText: e.target.value,
                      })
                    }
                    placeholder="Ex: Mal passado, Ao ponto, Bem passado"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                    Ingredientes removíveis (separados por vírgula)
                  </label>
                  <input
                    type="text"
                    value={editingForm.ingredientesRemoviveisText}
                    onChange={(e) =>
                      setEditingForm({
                        ...editingForm,
                        ingredientesRemoviveisText: e.target.value,
                      })
                    }
                    placeholder="Ex: Cebola, Picles, Tomate"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-xs"
                  />
                </div>
              </div>

              {/* Custom Paid Add-ons Editor */}
              <div className="space-y-2 pt-2 border-t border-black/[0.07] dark:border-white/[0.08]">
                <p className="text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1]">
                  Adicionais personalizados deste produto (deixe vazio para usar
                  os adicionais padrão da loja)
                </p>

                {editingForm.adicionaisCustom.length > 0 && (
                  <div className="space-y-1.5">
                    {editingForm.adicionaisCustom.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] text-xs"
                      >
                        <span className="font-medium">{a.nome}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold tabular-nums">
                            + {formatBRL(a.preco)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCustomAddon(a.id)}
                            className="text-rose-600 hover:underline"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  <input
                    type="text"
                    value={newAddonName}
                    onChange={(e) => setNewAddonName(e.target.value)}
                    placeholder="Nome do adicional (ex: Bacon extra)"
                    className="flex-1 min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-xs"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newAddonPrice}
                    onChange={(e) => setNewAddonPrice(e.target.value)}
                    placeholder="5.50"
                    className="w-24 min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-xs tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={addCustomAddon}
                    className="min-h-[38px] px-3 rounded-xl bg-black/[0.06] dark:bg-white/[0.08] text-xs font-semibold hover:bg-black/[0.1]"
                  >
                    + Incluir
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 bg-white dark:bg-[#1B1918] border-t border-black/[0.08] dark:border-white/[0.08] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingForm(null)}
                className="min-h-[42px] px-4 rounded-xl text-xs sm:text-sm font-semibold text-[#57534E] dark:text-[#A8A29E] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] px-5 rounded-xl text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-2"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {saving && (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                )}
                <span>Salvar produto</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
