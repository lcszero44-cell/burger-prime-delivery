import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  KeyRound,
  Loader2,
  MapPin,
  Plus,
  Power,
  Printer,
  QrCode,
  RotateCcw,
  Save,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import {
  resetTestOrdersAndCounter,
  saveStoreSettings,
  updateAdminPassword,
} from '../../services/orderService';
import type { LiveStoreSettings, NeighborhoodFee } from '../../types/order';

interface AdminSettingsTabProps {
  settings: LiveStoreSettings;
}

export function AdminSettingsTab({ settings }: AdminSettingsTabProps) {
  const [draft, setDraft] = useState<LiveStoreSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New neighborhood inputs
  const [newBairroNome, setNewBairroNome] = useState('');
  const [newBairroTaxa, setNewBairroTaxa] = useState('5.00');
  const [newBairroCombinar, setNewBairroCombinar] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Discreet double-confirmation reset test orders state
  const [resetModalStep, setResetModalStep] = useState<0 | 1 | 2>(0);
  const [resetConfirmWord, setResetConfirmWord] = useState('');
  const [resettingData, setResettingData] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3200);
  };

  const handleQuickToggleOpen = async () => {
    setTogglingOpen(true);
    try {
      const next = { ...draft, abertoManual: !draft.abertoManual };
      setDraft(next);
      await saveStoreSettings(next);
      showFeedback(
        next.abertoManual
          ? 'Loja ABERTA em tempo real! Clientes já podem fazer pedidos.'
          : 'Loja FECHADA em tempo real! Novos pedidos foram bloqueados.'
      );
    } catch (err) {
      showFeedback(
        err instanceof Error ? err.message : 'Erro ao alterar status da loja.'
      );
    } finally {
      setTogglingOpen(false);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cidadeTrimmed = draft.cidadeUf.trim();
      const nextToSave: LiveStoreSettings = {
        ...draft,
        cidadeUf: cidadeTrimmed,
        pixCidadeRecebedor:
          draft.pixCidadeRecebedor.trim() ||
          cidadeTrimmed.split(',')[0]?.split('-')[0]?.trim() ||
          draft.pixCidadeRecebedor,
      };
      setDraft(nextToSave);
      await saveStoreSettings(nextToSave);
      showFeedback('Configurações da loja salvas e sincronizadas em tempo real!');
    } catch (err) {
      showFeedback(
        err instanceof Error ? err.message : 'Erro ao salvar configurações.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddNeighborhood = () => {
    const nome = newBairroNome.trim();
    if (!nome) return;
    const taxaNum = parseFloat(newBairroTaxa.replace(',', '.'));
    const entry: NeighborhoodFee = {
      id: `bairro-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      nome,
      taxa: newBairroCombinar || Number.isNaN(taxaNum) ? null : Math.max(0, taxaNum),
      aCombinar: newBairroCombinar,
    };
    setDraft({
      ...draft,
      bairrosEntrega: [...draft.bairrosEntrega, entry],
    });
    setNewBairroNome('');
    setNewBairroTaxa('5.00');
    setNewBairroCombinar(false);
  };

  const handleUpdateNeighborhoodFee = (id: string, rawTaxa: string) => {
    const val = parseFloat(rawTaxa.replace(',', '.'));
    setDraft({
      ...draft,
      bairrosEntrega: draft.bairrosEntrega.map((b) =>
        b.id === id
          ? {
              ...b,
              taxa: Number.isNaN(val) ? 0 : Math.max(0, val),
              aCombinar: false,
            }
          : b
      ),
    });
  };

  const handleRemoveNeighborhood = (id: string) => {
    setDraft({
      ...draft,
      bairrosEntrega: draft.bairrosEntrega.filter((b) => b.id !== id),
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);
    if (newPassword.trim().length < 4) {
      setPasswordFeedback({
        type: 'err',
        text: 'A nova senha deve ter pelo menos 4 caracteres.',
      });
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setPasswordFeedback({
        type: 'err',
        text: 'As senhas digitadas não conferem.',
      });
      return;
    }
    setPasswordSaving(true);
    try {
      await updateAdminPassword(newPassword.trim());
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFeedback({
        type: 'ok',
        text: 'Senha do Painel Admin atualizada com sucesso!',
      });
    } catch (err) {
      setPasswordFeedback({
        type: 'err',
        text:
          err instanceof Error ? err.message : 'Erro ao atualizar a senha.',
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleOpenResetModal = () => {
    setResetFeedback(null);
    setResetConfirmWord('');
    setResetModalStep(1);
  };

  const handleCloseResetModal = () => {
    if (resettingData) return;
    setResetModalStep(0);
    setResetConfirmWord('');
  };

  const handleConfirmResetTestData = async () => {
    if (resetConfirmWord.trim().toUpperCase() !== 'ZERAR') return;
    setResettingData(true);
    setResetFeedback(null);
    try {
      const { deletedCount } = await resetTestOrdersAndCounter();
      setResetModalStep(0);
      setResetConfirmWord('');
      setResetFeedback({
        type: 'ok',
        text:
          deletedCount > 0
            ? `${deletedCount} pedido(s) de teste apagado(s) e numeração reiniciada para #0001.`
            : 'Nenhum pedido encontrado. Numeração reiniciada para #0001.',
      });
    } catch (err) {
      setResetModalStep(0);
      setResetFeedback({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Não foi possível zerar os dados de teste.',
      });
    } finally {
      setResettingData(false);
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

  return (
    <div className="space-y-6">
      {/* Prominent Quick Open / Close Store Toggle */}
      <section className="p-5 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              draft.abertoManual
                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400'
            }`}
          >
            <Power className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
              Status ao vivo da loja
            </p>
            <h2 className="font-display text-xl font-bold text-[#181615] dark:text-[#F6F4F0]">
              {draft.abertoManual
                ? 'Loja Aberta — Recebendo pedidos'
                : 'Loja Fechada — Pedidos bloqueados'}
            </h2>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">
              A alteração aparece na hora no topo do cardápio de todos os
              clientes.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleQuickToggleOpen}
          disabled={togglingOpen}
          className={`min-h-[48px] px-5 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2 shrink-0 transition-colors ${
            draft.abertoManual
              ? 'bg-rose-600 hover:bg-rose-700'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {togglingOpen ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Power className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{draft.abertoManual ? 'Fechar loja agora' : 'Abrir loja agora'}</span>
        </button>
      </section>

      {feedback && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2"
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Store Basic Info */}
        <section className="p-5 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#181615] dark:text-[#F6F4F0]">
            <Store className="w-4 h-4" aria-hidden="true" />
            <h3>Informações gerais da loja</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                Nome da loja
              </label>
              <input
                type="text"
                value={draft.nome}
                onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                WhatsApp da loja (com 55 + DDD)
              </label>
              <input
                type="text"
                value={draft.whatsapp}
                onChange={(e) =>
                  setDraft({ ...draft, whatsapp: e.target.value })
                }
                placeholder="5534991029433"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="settings-cidade-uf"
                className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1"
              >
                Cidade / UF
              </label>
              <input
                id="settings-cidade-uf"
                type="text"
                value={draft.cidadeUf}
                onChange={(e) =>
                  setDraft({ ...draft, cidadeUf: e.target.value })
                }
                placeholder="Ex: Uberlândia, MG"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
              />
              <p className="mt-1 text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                Exibida no cabeçalho da loja e usada como base para o QR Code Pix.
              </p>
            </div>

            <div>
              <label
                htmlFor="settings-slogan"
                className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1"
              >
                Slogan / subtítulo
              </label>
              <input
                id="settings-slogan"
                type="text"
                value={draft.slogan}
                onChange={(e) => setDraft({ ...draft, slogan: e.target.value })}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                Pedido mínimo (R$)
              </label>
              <input
                type="number"
                min={0}
                step="0.50"
                value={draft.pedidoMinimo}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    pedidoMinimo: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                Resumo de horários
              </label>
              <input
                type="text"
                value={draft.resumoHorario}
                onChange={(e) =>
                  setDraft({ ...draft, resumoHorario: e.target.value })
                }
                placeholder="Ter a Dom · 18h às 23h30"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                Tempo estimado de entrega
              </label>
              <input
                type="text"
                value={draft.tempoEstimadoEntrega}
                onChange={(e) =>
                  setDraft({ ...draft, tempoEstimadoEntrega: e.target.value })
                }
                placeholder="35–50 min"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                Tempo estimado de retirada
              </label>
              <input
                type="text"
                value={draft.tempoEstimadoRetirada}
                onChange={(e) =>
                  setDraft({ ...draft, tempoEstimadoRetirada: e.target.value })
                }
                placeholder="20–30 min"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                Endereço para retirada no balcão
              </label>
              <input
                type="text"
                value={draft.enderecoRetirada}
                onChange={(e) =>
                  setDraft({ ...draft, enderecoRetirada: e.target.value })
                }
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
              />
            </div>
          </div>
        </section>

        {/* Pix Config */}
        <section className="p-5 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#181615] dark:text-[#F6F4F0]">
            <QrCode className="w-4 h-4" aria-hidden="true" />
            <h3>Chave Pix para pagamentos</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                Chave Pix
              </label>
              <input
                type="text"
                value={draft.pixChave}
                onChange={(e) =>
                  setDraft({ ...draft, pixChave: e.target.value })
                }
                placeholder="CPF, CNPJ, e-mail, telefone ou aleatória"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                Nome do recebedor
              </label>
              <input
                type="text"
                value={draft.pixNomeRecebedor}
                onChange={(e) =>
                  setDraft({ ...draft, pixNomeRecebedor: e.target.value })
                }
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                Cidade do recebedor
              </label>
              <input
                type="text"
                value={draft.pixCidadeRecebedor}
                onChange={(e) =>
                  setDraft({ ...draft, pixCidadeRecebedor: e.target.value })
                }
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
              />
            </div>
          </div>
        </section>

        {/* Neighborhoods & Delivery Fees */}
        <section className="p-5 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#181615] dark:text-[#F6F4F0]">
            <MapPin className="w-4 h-4" aria-hidden="true" />
            <h3>Bairros e taxas de entrega</h3>
          </div>

          <div className="space-y-2">
            {draft.bairrosEntrega.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.07] dark:border-white/[0.08]"
              >
                <span className="text-sm font-medium text-[#181615] dark:text-[#F6F4F0] truncate">
                  {b.nome}
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  {b.aCombinar || b.taxa === null ? (
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      Taxa a combinar
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#78716C]">R$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.50"
                        aria-label={`Taxa de entrega para ${b.nome}`}
                        value={b.taxa}
                        onChange={(e) =>
                          handleUpdateNeighborhoodFee(b.id, e.target.value)
                        }
                        className="w-20 min-h-[34px] px-2 rounded-lg bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.12] text-xs font-bold tabular-nums text-right"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveNeighborhood(b.id)}
                    aria-label={`Remover bairro ${b.nome}`}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-black/[0.07] dark:border-white/[0.08] flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
            <input
              type="text"
              value={newBairroNome}
              onChange={(e) => setNewBairroNome(e.target.value)}
              placeholder="Nome do novo bairro"
              className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
            />
            {!newBairroCombinar && (
              <input
                type="text"
                inputMode="decimal"
                value={newBairroTaxa}
                onChange={(e) => setNewBairroTaxa(e.target.value)}
                placeholder="Taxa (ex: 6.00)"
                className="w-full sm:w-28 min-h-[40px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm tabular-nums"
              />
            )}
            <label className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={newBairroCombinar}
                onChange={(e) => setNewBairroCombinar(e.target.checked)}
                className="w-4 h-4 accent-[var(--brand-primary)]"
              />
              <span>A combinar</span>
            </label>
            <button
              type="button"
              onClick={handleAddNeighborhood}
              className="min-h-[40px] px-4 rounded-xl bg-black/[0.07] dark:bg-white/[0.1] text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-black/[0.12]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Adicionar bairro</span>
            </button>
          </div>
        </section>

        {/* Thermal Printer Settings */}
        <section className="p-5 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-bold text-[#181615] dark:text-[#F6F4F0]">
              <Printer className="w-4 h-4" aria-hidden="true" />
              <h3>Impressora Térmica (80mm / 58mm)</h3>
            </div>
            <button
              type="button"
              onClick={handleDownloadAutoPrintBat}
              className="min-h-[38px] px-3.5 rounded-xl border border-black/[0.1] dark:border-white/[0.12] bg-[#FAF9F7] dark:bg-[#141312] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-black/[0.04]"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Baixar atalho Windows (--kiosk-printing)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                Largura da bobina
              </label>
              <select
                value={draft.paperWidth}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    paperWidth: e.target.value === '58mm' ? '58mm' : '80mm',
                  })
                }
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
              >
                <option value="80mm">80mm (padrão cozinha)</option>
                <option value="58mm">58mm (compacta)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                Vias por pedido
              </label>
              <select
                value={draft.copies}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    copies: Number(e.target.value) === 2 ? 2 : 1,
                  })
                }
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
              >
                <option value={1}>1 via (Cozinha)</option>
                <option value={2}>2 vias (Cozinha + Entrega)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
                Mensagem no rodapé do cupom
              </label>
              <input
                type="text"
                value={draft.storeFooterNote}
                onChange={(e) =>
                  setDraft({ ...draft, storeFooterNote: e.target.value })
                }
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={draft.autoPrintPendingPix}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    autoPrintPendingPix: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-[var(--brand-primary)]"
              />
              <span>
                Imprimir pedidos Pix automaticamente mesmo antes de confirmar
                comprovante
              </span>
            </label>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[48px] px-6 rounded-xl text-sm font-bold text-white inline-flex items-center gap-2 shadow-sm"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="w-4 h-4" aria-hidden="true" />
            )}
            <span>Salvar todas as configurações</span>
          </button>
        </div>
      </form>

      {/* Change Admin Password Section */}
      <form
        onSubmit={handleChangePassword}
        className="p-5 rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.08] dark:border-white/[0.08] space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-[#181615] dark:text-[#F6F4F0]">
          <KeyRound className="w-4 h-4" aria-hidden="true" />
          <h3>Alterar senha do Painel Admin</h3>
        </div>
        <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
          A senha padrão inicial é <strong className="font-mono">1234</strong>.
          Defina uma senha pessoal para proteger suas comandas, cardápio e
          financeiro.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
              Nova senha (mín. 4 caracteres)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••"
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1">
              Confirmar nova senha
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••"
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.1] dark:border-white/[0.12] text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={passwordSaving}
            className="min-h-[42px] px-4 rounded-xl bg-[#181615] dark:bg-[#F6F4F0] text-white dark:text-[#181615] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            {passwordSaving && (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
            <span>Atualizar senha</span>
          </button>
        </div>

        {passwordFeedback && (
          <p
            className={`text-xs font-semibold ${
              passwordFeedback.type === 'ok'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {passwordFeedback.text}
          </p>
        )}
      </form>

      {/* Discreet Reset Test Data / Restart Numbering Section */}
      <section className="pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
        <div className="p-4 rounded-2xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.07] dark:border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#57534E] dark:text-[#A8A29E]">
              Limpeza antes da entrega ao restaurante
            </p>
            <p className="text-[11px] text-[#78716C] dark:text-[#8C857F] mt-0.5">
              Apaga todos os pedidos registrados e reinicia a sequência de
              comandas para <strong className="font-mono">#0001</strong>.
              Cardápio, bairros, Pix e configurações permanecem intactos.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenResetModal}
            className="min-h-[38px] px-3.5 rounded-xl border border-rose-300/80 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Zerar Dados de Teste / Reiniciar Numeração</span>
          </button>
        </div>

        {resetFeedback && (
          <p
            role="status"
            className={`mt-2.5 text-xs font-semibold ${
              resetFeedback.type === 'ok'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {resetFeedback.text}
          </p>
        )}
      </section>

      {/* Double Confirmation Modal for Resetting Test Orders */}
      {resetModalStep > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
          onClick={handleCloseResetModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-orders-modal-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1B1918] border border-black/[0.1] dark:border-white/[0.1] shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
                <h3
                  id="reset-orders-modal-title"
                  className="font-display text-base font-bold text-[#181615] dark:text-[#F6F4F0]"
                >
                  {resetModalStep === 1
                    ? 'Confirmar limpeza de pedidos (1/2)'
                    : 'Confirmação final obrigatória (2/2)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseResetModal}
                disabled={resettingData}
                aria-label="Cancelar"
                className="p-1.5 rounded-lg text-[#78716C] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {resetModalStep === 1 ? (
              <div className="p-5 space-y-4">
                <p className="text-xs sm:text-sm text-[#44403C] dark:text-[#D6D3D1] leading-relaxed">
                  Esta ação vai{' '}
                  <strong className="text-rose-700 dark:text-rose-400">
                    apagar permanentemente todos os pedidos
                  </strong>{' '}
                  da coleção de pedidos (cozinha e histórico financeiro) e
                  reiniciar o contador sequencial para{' '}
                  <strong className="font-mono">#0001</strong>.
                </p>

                <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.07] dark:border-white/[0.08] text-xs text-[#57534E] dark:text-[#A8A29E] space-y-1">
                  <p className="font-semibold text-[#181615] dark:text-[#F6F4F0]">
                    O que NÃO será apagado:
                  </p>
                  <p>
                    Produtos do cardápio, bairros/taxas, chave Pix,
                    configurações da loja e senha do painel.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCloseResetModal}
                    className="min-h-[40px] px-4 rounded-xl text-xs font-semibold text-[#57534E] dark:text-[#A8A29E] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetModalStep(2)}
                    className="min-h-[40px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                  >
                    Continuar para confirmação final
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <p className="text-xs sm:text-sm text-[#44403C] dark:text-[#D6D3D1] leading-relaxed">
                  Para confirmar que deseja zerar todos os pedidos e reiniciar a
                  numeração para <strong className="font-mono">#0001</strong>,
                  digite <strong className="font-mono">ZERAR</strong> no campo
                  abaixo:
                </p>

                <div>
                  <label
                    htmlFor="confirm-reset-word"
                    className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3D1] mb-1"
                  >
                    Digite ZERAR para liberar o botão
                  </label>
                  <input
                    id="confirm-reset-word"
                    type="text"
                    autoFocus
                    value={resetConfirmWord}
                    onChange={(e) => setResetConfirmWord(e.target.value)}
                    placeholder="ZERAR"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141312] border border-black/[0.12] dark:border-white/[0.14] text-sm font-mono uppercase tracking-wider focus:border-rose-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setResetConfirmWord('');
                      setResetModalStep(1);
                    }}
                    disabled={resettingData}
                    className="min-h-[40px] px-4 rounded-xl text-xs font-semibold text-[#57534E] dark:text-[#A8A29E] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={
                      resettingData ||
                      resetConfirmWord.trim().toUpperCase() !== 'ZERAR'
                    }
                    onClick={handleConfirmResetTestData}
                    className="min-h-[40px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    {resettingData ? (
                      <Loader2
                        className="w-4 h-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    )}
                    <span>Apagar pedidos e reiniciar #0001</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
