import React, { useEffect, useState } from 'react';
import {
  Award,
  Building2,
  Check,
  FileDown,
  FileText,
  History,
  Loader2,
  MessageCircle,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  extrairMensagemErro,
  formatarDataBR,
  formatarSenha,
  formatarTelefone,
  gerarMensagemWhatsAppOrientacoes,
  limparDigitos,
  STATUS_ATENDIMENTO_LABEL,
} from '../lib/format';
import { exportarFichaConsulentePDF } from '../lib/pdfExport';
import {
  buscarHistoricoConsulente,
  excluirAtendimento,
  salvarFichaConsulente,
} from '../services/dataService';
import type { Atendimento, AtendimentoDetalhado } from '../types/database';

interface FichaConsulenteModalProps {
  atendimento: Atendimento;
  nomeEntidade?: string;
  mediumNome?: string;
  cambonoNome?: string | null;
  giraTitulo?: string;
  dataGira?: string;
  onClose: () => void;
  onSalvo: () => void | Promise<void>;
}

const MODELOS_ORIENTACAO = [
  {
    rotulo: '+ Banho de Ervas',
    texto: 'Banho de ervas recomendado: ',
  },
  {
    rotulo: '+ Vela de 7 Dias',
    texto: 'Acender vela de 7 dias com firmeza/oração: ',
  },
  {
    rotulo: '+ Oferenda / Elemento',
    texto: 'Entrega / oferenda orientada: ',
  },
  {
    rotulo: '+ Retorno na próxima gira',
    texto: 'Orientado(a) a retornar na próxima gira de atendimento.',
  },
  {
    rotulo: '+ Corrente de Oração',
    texto: 'Incluir nome nas orações / firmezas da casa.',
  },
];

export function FichaConsulenteModal({
  atendimento,
  nomeEntidade,
  mediumNome,
  cambonoNome,
  giraTitulo,
  dataGira,
  onClose,
  onSalvo,
}: FichaConsulenteModalProps) {
  const { perfil } = useAuth();
  const isAdmin = perfil?.perfil === 'ADMIN';

  const [nome, setNome] = useState(atendimento.consulente_nome);
  const [telefone, setTelefone] = useState(atendimento.consulente_telefone ?? '');
  const [idade, setIdade] = useState(
    atendimento.idade !== undefined && atendimento.idade !== null ? String(atendimento.idade) : ''
  );
  const [outroTerreiro, setOutroTerreiro] = useState(Boolean(atendimento.outro_terreiro));
  const [nomeOutroTerreiro, setNomeOutroTerreiro] = useState(
    atendimento.nome_outro_terreiro ?? ''
  );
  const [primeiraVez, setPrimeiraVez] = useState(atendimento.primeira_vez);
  const [orientacoes, setOrientacoes] = useState(atendimento.orientacoes ?? '');

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [historico, setHistorico] = useState<AtendimentoDetalhado[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);

  async function handleExcluir() {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir permanentemente a ficha de atendimento de "${atendimento.consulente_nome}" (Senha ${formatarSenha(atendimento.numero_senha)})?\n\nEsta ação apagará a ficha e o registro do atendimento e não poderá ser desfeita.`
      )
    ) {
      return;
    }
    setExcluindo(true);
    setErro(null);
    try {
      await excluirAtendimento(atendimento.id);
      await onSalvo();
      onClose();
    } catch (err) {
      setErro(extrairMensagemErro(err, 'Erro ao excluir atendimento.'));
    } finally {
      setExcluindo(false);
    }
  }

  useEffect(() => {
    setNome(atendimento.consulente_nome);
    setTelefone(atendimento.consulente_telefone ?? '');
    setIdade(
      atendimento.idade !== undefined && atendimento.idade !== null ? String(atendimento.idade) : ''
    );
    setOutroTerreiro(Boolean(atendimento.outro_terreiro));
    setNomeOutroTerreiro(atendimento.nome_outro_terreiro ?? '');
    setPrimeiraVez(atendimento.primeira_vez);
    setOrientacoes(atendimento.orientacoes ?? '');
    setErro(null);
  }, [atendimento]);

  useEffect(() => {
    let ativo = true;
    setCarregandoHistorico(true);
    buscarHistoricoConsulente({
      telefone: atendimento.consulente_telefone,
      nome: atendimento.consulente_nome,
      ignorarAtendimentoId: atendimento.id,
    })
      .then((lista) => {
        if (ativo) setHistorico(lista);
      })
      .catch(() => {
        if (ativo) setHistorico([]);
      })
      .finally(() => {
        if (ativo) setCarregandoHistorico(false);
      });

    return () => {
      ativo = false;
    };
  }, [atendimento.id, atendimento.consulente_nome, atendimento.consulente_telefone]);

  function inserirModelo(textoModelo: string) {
    setOrientacoes((atual) => {
      const base = atual.trim();
      return base ? `${base}\n• ${textoModelo}` : `• ${textoModelo}`;
    });
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (nome.trim().length < 2) {
      setErro('Informe o nome completo do consulente.');
      return;
    }

    if (outroTerreiro && !nomeOutroTerreiro.trim()) {
      setErro('Informe o nome da outra casa espiritual ou terreiro.');
      return;
    }

    const idadeNum = idade.trim() ? parseInt(idade, 10) : null;
    const ehIdoso = idadeNum !== null && !Number.isNaN(idadeNum) && idadeNum >= 60;

    setSalvando(true);
    try {
      await salvarFichaConsulente({
        atendimentoId: atendimento.id,
        nome: nome.trim(),
        telefone: telefone.trim() || null,
        primeiraVez,
        orientacoes: orientacoes.trim() || null,
        idade: idadeNum,
        preferencial: ehIdoso,
        outroTerreiro,
        nomeOutroTerreiro: outroTerreiro ? nomeOutroTerreiro.trim() : null,
      });
      await onSalvo();
      onClose();
    } catch (err) {
      setErro(extrairMensagemErro(err, 'Não foi possível salvar os dados do cliente.'));
    } finally {
      setSalvando(false);
    }
  }

  const digitosTel = limparDigitos(telefone);
  const entidadeExibida =
    nomeEntidade ||
    (atendimento as Partial<AtendimentoDetalhado>).nome_entidade ||
    'Entidade de Atendimento';
  const mediumExibido =
    mediumNome || (atendimento as Partial<AtendimentoDetalhado>).medium_nome || '';
  const dataExibida =
    dataGira || (atendimento as Partial<AtendimentoDetalhado>).data_gira || atendimento.criado_em;
  const giraExibida =
    giraTitulo || (atendimento as Partial<AtendimentoDetalhado>).gira_titulo || '';

  const mensagemWhatsApp = gerarMensagemWhatsAppOrientacoes({
    consulenteNome: nome.trim() || atendimento.consulente_nome,
    numeroSenha: atendimento.numero_senha,
    nomeEntidade: entidadeExibida,
    mediumNome: mediumExibido,
    dataGira: dataExibida,
    giraTitulo: giraExibida,
    orientacoes: orientacoes.trim() || null,
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Cabeçalho */}
        <div className="bg-terreiro-900 text-white px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-white/20 text-xs font-black">
                {formatarSenha(atendimento.numero_senha)}
              </span>
              <h3 className="text-base sm:text-lg font-extrabold truncate">
                Ficha e Orientações do Consulente
              </h3>
            </div>
            <p className="text-xs text-terreiro-200 mt-1">
              {entidadeExibida}
              {mediumExibido ? ` • Médium: ${mediumExibido}` : ''}
              {cambonoNome ? ` • Cambono: ${cambonoNome}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="overflow-y-auto p-5 space-y-5">
          <form id="form-ficha-consulente" onSubmit={handleSalvar} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Nome Completo do Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border-2 border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:border-terreiro-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  WhatsApp / Telefone
                </label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                  placeholder="(65) 99999-9999"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border-2 border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:border-terreiro-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Idade e Outro Terreiro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Idade (anos)
                  </label>
                  {idade.trim() && parseInt(idade, 10) >= 60 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                      <Award className="w-3 h-3 text-amber-700" />
                      Idoso (60+) • Prioridade
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={idade}
                  onChange={(e) => setIdade(e.target.value)}
                  placeholder="Ex: 68"
                  className={`w-full min-h-[44px] px-3.5 rounded-xl border-2 ${
                    idade.trim() && parseInt(idade, 10) >= 60
                      ? 'border-amber-400 bg-amber-50/30'
                      : 'border-slate-300'
                  } bg-white text-sm font-semibold text-slate-900 focus:border-terreiro-600 focus:outline-none`}
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2.5 min-h-[44px] px-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={outroTerreiro}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setOutroTerreiro(checked);
                      if (!checked) setNomeOutroTerreiro('');
                    }}
                    className="w-4 h-4 rounded text-terreiro-700"
                  />
                  <Building2 className="w-4 h-4 text-terreiro-700" />
                  <span className="text-xs font-bold uppercase text-slate-700">
                    É de outro terreiro / casa?
                  </span>
                </label>

                {outroTerreiro && (
                  <div className="p-2.5 rounded-xl bg-terreiro-50/70 border border-terreiro-200 space-y-1">
                    <label className="block text-[11px] font-bold uppercase text-terreiro-900">
                      Nome da outra casa espiritual *
                    </label>
                    <input
                      type="text"
                      value={nomeOutroTerreiro}
                      onChange={(e) => setNomeOutroTerreiro(e.target.value)}
                      placeholder="Ex: Ilé Àṣẹ..."
                      className="w-full min-h-[40px] px-3 rounded-lg border border-terreiro-300 bg-white text-xs font-semibold focus:border-terreiro-600 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2.5 min-h-[44px] px-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={primeiraVez}
                onChange={(e) => setPrimeiraVez(e.target.checked)}
                className="w-4 h-4 rounded text-terreiro-700"
              />
              <UserCheck className="w-4 h-4 text-terreiro-700" />
              <span className="text-sm font-semibold text-slate-800">
                Primeira vez no terreiro
              </span>
            </label>

            {/* Orientações */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-terreiro-800">
                  <FileText className="w-4 h-4" />
                  <span>Orientações da Entidade / Observações no Cadastro</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {MODELOS_ORIENTACAO.map((m) => (
                  <button
                    key={m.rotulo}
                    type="button"
                    onClick={() => inserirModelo(m.texto)}
                    className="px-2.5 py-1 rounded-lg bg-terreiro-50 hover:bg-terreiro-100 border border-terreiro-200 text-terreiro-800 text-xs font-bold transition"
                  >
                    {m.rotulo}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                value={orientacoes}
                onChange={(e) => setOrientacoes(e.target.value)}
                placeholder="Anote aqui as orientações passadas pela entidade (banhos de ervas, velas, firmezas, recados, retornos ou observações importantes do cadastro do cliente)..."
                className="w-full p-3.5 rounded-2xl border-2 border-slate-300 bg-white text-sm text-slate-900 focus:border-terreiro-600 focus:outline-none resize-y"
              />
            </div>

            {erro && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
                {erro}
              </div>
            )}
          </form>

          {/* Histórico Anterior */}
          <section className="border-t border-slate-200 pt-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-600">
              <History className="w-4 h-4 text-terreiro-700" />
              <span>Histórico Anterior deste Consulente ({historico.length})</span>
            </div>

            {carregandoHistorico ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-terreiro-700" />
                <span>Buscando atendimentos anteriores...</span>
              </div>
            ) : historico.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
                Nenhum atendimento anterior localizado para este nome ou telefone.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {historico.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-extrabold text-slate-900 inline-flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-terreiro-700" />
                        {formatarDataBR(h.data_gira)} • {h.nome_entidade}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-bold text-[11px] text-slate-700">
                        {STATUS_ATENDIMENTO_LABEL[h.status]}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      {h.gira_titulo} • Médium: {h.medium_nome}
                      {h.cambono_nome ? ` • Cambono: ${h.cambono_nome}` : ''}
                    </p>
                    {h.orientacoes ? (
                      <p className="text-slate-800 bg-white border border-terreiro-100 rounded-lg p-2 whitespace-pre-line font-medium">
                        {h.orientacoes}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">Sem orientações registradas nesta visita.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Rodapé Ações */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const idadeNum = idade.trim() ? parseInt(idade, 10) : null;
                const ehIdoso = idadeNum !== null && !Number.isNaN(idadeNum) && idadeNum >= 60;
                exportarFichaConsulentePDF({
                  numeroSenha: atendimento.numero_senha,
                  nome: nome.trim() || atendimento.consulente_nome,
                  telefone: telefone.trim() || null,
                  idade: idadeNum,
                  preferencial: ehIdoso,
                  outroTerreiro,
                  nomeOutroTerreiro: outroTerreiro ? nomeOutroTerreiro.trim() : null,
                  primeiraVez,
                  entidade: entidadeExibida,
                  medium: mediumExibido,
                  cambono: cambonoNome ?? (atendimento as Partial<AtendimentoDetalhado>).cambono_nome,
                  giraTitulo: giraExibida,
                  dataGira: dataExibida,
                  status: atendimento.status,
                  orientacoes: orientacoes.trim() || null,
                  historico,
                });
              }}
              className="min-h-[44px] px-3.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 transition"
            >
              <FileDown className="w-4 h-4" />
              <span>Extrair PDF</span>
            </button>

            {digitosTel.length >= 10 && (
              <a
                href={`https://wa.me/55${digitosTel}?text=${encodeURIComponent(mensagemWhatsApp)}`}
                target="_blank"
                rel="noreferrer"
                className="min-h-[44px] px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {isAdmin && (
              <button
                type="button"
                onClick={handleExcluir}
                disabled={excluindo || salvando}
                className="min-h-[44px] px-3.5 rounded-xl bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 text-red-700 font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 transition"
                title="Excluir ficha e atendimento permanentemente"
              >
                {excluindo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Excluir Ficha</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={excluindo || salvando}
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-ficha-consulente"
              disabled={excluindo || salvando}
              className="min-h-[44px] px-5 rounded-xl bg-terreiro-700 hover:bg-terreiro-800 disabled:bg-slate-400 text-white font-extrabold text-sm inline-flex items-center gap-2 shadow-sm transition"
            >
              {salvando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Salvar Ficha</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

