import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Power,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { extrairMensagemErro } from '../../lib/format';
import {
  alternarEntidadeAtiva,
  alternarMembroAtivo,
  atualizarEntidade,
  atualizarMembroEquipe,
  criarEntidade,
  criarMembroEquipe,
  excluirEntidade,
  excluirMembroEquipe,
  listarEntidades,
  listarEquipeEspiritual,
} from '../../services/dataService';
import type { Entidade, EquipeEspiritual, TipoMembro } from '../../types/database';

export function AdminCadastrosPage() {
  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [equipe, setEquipe] = useState<EquipeEspiritual[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [nomeEntidade, setNomeEntidade] = useState('');
  const [linhaEntidade, setLinhaEntidade] = useState('');
  const [salvandoEntidade, setSalvandoEntidade] = useState(false);

  const [editandoEntidadeId, setEditandoEntidadeId] = useState<string | null>(null);
  const [editNomeEntidade, setEditNomeEntidade] = useState('');
  const [editLinhaEntidade, setEditLinhaEntidade] = useState('');
  const [salvandoEdicaoEntidade, setSalvandoEdicaoEntidade] = useState(false);

  const [nomeMembro, setNomeMembro] = useState('');
  const [tipoMembro, setTipoMembro] = useState<TipoMembro>('MEDIUM');
  const [salvandoMembro, setSalvandoMembro] = useState(false);

  const [editandoMembroId, setEditandoMembroId] = useState<string | null>(null);
  const [editNomeMembro, setEditNomeMembro] = useState('');
  const [editTipoMembro, setEditTipoMembro] = useState<TipoMembro>('MEDIUM');
  const [salvandoEdicaoMembro, setSalvandoEdicaoMembro] = useState(false);

  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const [ents, eq] = await Promise.all([
        listarEntidades(),
        listarEquipeEspiritual(),
      ]);
      setEntidades(ents);
      setEquipe(eq);
    } catch (err) {
      setErro(extrairMensagemErro(err, 'Erro ao carregar cadastros base.'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleAdicionarEntidade(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeEntidade.trim()) return;
    setSalvandoEntidade(true);
    try {
      await criarEntidade(nomeEntidade, linhaEntidade);
      setNomeEntidade('');
      setLinhaEntidade('');
      await carregar();
    } catch (err) {
      setErro(extrairMensagemErro(err));
    } finally {
      setSalvandoEntidade(false);
    }
  }

  async function handleAdicionarMembro(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeMembro.trim()) return;
    setSalvandoMembro(true);
    try {
      await criarMembroEquipe(nomeMembro, tipoMembro);
      setNomeMembro('');
      await carregar();
    } catch (err) {
      setErro(extrairMensagemErro(err));
    } finally {
      setSalvandoMembro(false);
    }
  }

  return (
    <AdminLayout>
      {carregando ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-terreiro-700 animate-spin mb-2" />
          <p className="text-sm text-slate-600">Carregando cadastros base...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm font-semibold">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cadastro de Entidades */}
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-terreiro-100 text-terreiro-800 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Entidades</h2>
                  <p className="text-xs text-slate-500">
                    Guias disponíveis para atendimento nas giras
                  </p>
                </div>
              </div>

              <form onSubmit={handleAdicionarEntidade} className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={nomeEntidade}
                    onChange={(e) => setNomeEntidade(e.target.value)}
                    placeholder="Nome (ex: Caboclo Sete Flechas)"
                    className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                  <input
                    type="text"
                    value={linhaEntidade}
                    onChange={(e) => setLinhaEntidade(e.target.value)}
                    placeholder="Linha (ex: Caboclos, Pretos Velhos)"
                    className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={salvandoEntidade}
                  className="w-full min-h-[44px] rounded-xl bg-terreiro-700 hover:bg-terreiro-800 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 transition"
                >
                  {salvandoEntidade ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>Cadastrar Entidade</span>
                </button>
              </form>

              <div className="divide-y divide-slate-100">
                {entidades.map((ent) => {
                  const emEdicao = editandoEntidadeId === ent.id;
                  return (
                    <div
                      key={ent.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {emEdicao ? (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            setErro(null);
                            setSalvandoEdicaoEntidade(true);
                            try {
                              await atualizarEntidade(
                                ent.id,
                                editNomeEntidade,
                                editLinhaEntidade
                              );
                              setEditandoEntidadeId(null);
                              await carregar();
                            } catch (err) {
                              setErro(
                                extrairMensagemErro(err, 'Erro ao atualizar entidade.')
                              );
                            } finally {
                              setSalvandoEdicaoEntidade(false);
                            }
                          }}
                          className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                        >
                          <input
                            type="text"
                            required
                            value={editNomeEntidade}
                            onChange={(e) => setEditNomeEntidade(e.target.value)}
                            placeholder="Nome da entidade"
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                          <input
                            type="text"
                            value={editLinhaEntidade}
                            onChange={(e) => setEditLinhaEntidade(e.target.value)}
                            placeholder="Linha (opcional)"
                            className="sm:w-44 px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="submit"
                              disabled={salvandoEdicaoEntidade}
                              className="px-3 min-h-[36px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1 transition disabled:opacity-50"
                            >
                              {salvandoEdicaoEntidade ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Salvar</span>
                            </button>
                            <button
                              type="button"
                              disabled={salvandoEdicaoEntidade}
                              onClick={() => setEditandoEntidadeId(null)}
                              className="px-2.5 min-h-[36px] rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold inline-flex items-center gap-1 transition"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Cancelar</span>
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="min-w-0">
                            <p
                              className={`font-bold text-sm truncate ${
                                ent.ativo ? 'text-slate-900' : 'text-slate-400 line-through'
                              }`}
                            >
                              {ent.nome_entidade}
                            </p>
                            {ent.linha && (
                              <p className="text-xs text-slate-500">Linha: {ent.linha}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                            <button
                              type="button"
                              onClick={async () => {
                                setErro(null);
                                try {
                                  await alternarEntidadeAtiva(ent.id, !ent.ativo);
                                  await carregar();
                                } catch (err) {
                                  setErro(
                                    extrairMensagemErro(
                                      err,
                                      'Erro ao alterar status da entidade.'
                                    )
                                  );
                                }
                              }}
                              className={`px-3 min-h-[36px] rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition ${
                                ent.ativo
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {ent.ativo ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Ativa</span>
                                </>
                              ) : (
                                <>
                                  <Power className="w-3.5 h-3.5" />
                                  <span>Inativa</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditandoEntidadeId(ent.id);
                                setEditNomeEntidade(ent.nome_entidade);
                                setEditLinhaEntidade(ent.linha ?? '');
                              }}
                              title="Editar entidade"
                              className="px-2.5 min-h-[36px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1 transition"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              disabled={excluindoId === ent.id}
                              onClick={async () => {
                                const confirmou = window.confirm(
                                  `Excluir a entidade "${ent.nome_entidade}"?\n\nAtenção: escalas e atendimentos vinculados diretamente a ela em giras também serão removidos.`
                                );
                                if (!confirmou) return;
                                setErro(null);
                                setExcluindoId(ent.id);
                                try {
                                  await excluirEntidade(ent.id);
                                  await carregar();
                                } catch (err) {
                                  setErro(
                                    extrairMensagemErro(err, 'Erro ao excluir entidade.')
                                  );
                                } finally {
                                  setExcluindoId(null);
                                }
                              }}
                              title="Excluir entidade"
                              className="px-2.5 min-h-[36px] rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold inline-flex items-center gap-1 transition disabled:opacity-50"
                            >
                              {excluindoId === ent.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>Excluir</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Cadastro de Equipe Espiritual */}
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Equipe Espiritual
                  </h2>
                  <p className="text-xs text-slate-500">
                    Cadastro de Médiuns e Cambonos da casa
                  </p>
                </div>
              </div>

              <form onSubmit={handleAdicionarMembro} className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    value={nomeMembro}
                    onChange={(e) => setNomeMembro(e.target.value)}
                    placeholder="Nome (ex: Pai João)"
                    className="sm:col-span-2 min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                  <select
                    value={tipoMembro}
                    onChange={(e) => setTipoMembro(e.target.value as TipoMembro)}
                    className="min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold"
                  >
                    <option value="MEDIUM">Médium</option>
                    <option value="CAMBONO">Cambono</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={salvandoMembro}
                  className="w-full min-h-[44px] rounded-xl bg-terreiro-700 hover:bg-terreiro-800 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 transition"
                >
                  {salvandoMembro ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>Cadastrar Membro</span>
                </button>
              </form>

              <div className="divide-y divide-slate-100">
                {equipe.map((m) => {
                  const emEdicao = editandoMembroId === m.id;
                  return (
                    <div
                      key={m.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {emEdicao ? (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            setErro(null);
                            setSalvandoEdicaoMembro(true);
                            try {
                              await atualizarMembroEquipe(
                                m.id,
                                editNomeMembro,
                                editTipoMembro
                              );
                              setEditandoMembroId(null);
                              await carregar();
                            } catch (err) {
                              setErro(
                                extrairMensagemErro(err, 'Erro ao atualizar integrante.')
                              );
                            } finally {
                              setSalvandoEdicaoMembro(false);
                            }
                          }}
                          className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                        >
                          <select
                            value={editTipoMembro}
                            onChange={(e) => setEditTipoMembro(e.target.value as TipoMembro)}
                            className="sm:w-36 px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          >
                            <option value="MEDIUM">Médium</option>
                            <option value="CAMBONO">Cambono</option>
                          </select>
                          <input
                            type="text"
                            required
                            value={editNomeMembro}
                            onChange={(e) => setEditNomeMembro(e.target.value)}
                            placeholder="Nome do integrante"
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="submit"
                              disabled={salvandoEdicaoMembro}
                              className="px-3 min-h-[36px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1 transition disabled:opacity-50"
                            >
                              {salvandoEdicaoMembro ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Salvar</span>
                            </button>
                            <button
                              type="button"
                              disabled={salvandoEdicaoMembro}
                              onClick={() => setEditandoMembroId(null)}
                              className="px-2.5 min-h-[36px] rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold inline-flex items-center gap-1 transition"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Cancelar</span>
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                                m.tipo === 'MEDIUM'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {m.tipo === 'MEDIUM' ? 'Médium' : 'Cambono'}
                            </span>
                            <p
                              className={`font-bold text-sm truncate ${
                                m.ativo ? 'text-slate-900' : 'text-slate-400 line-through'
                              }`}
                            >
                              {m.nome}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                            <button
                              type="button"
                              onClick={async () => {
                                setErro(null);
                                try {
                                  await alternarMembroAtivo(m.id, !m.ativo);
                                  await carregar();
                                } catch (err) {
                                  setErro(
                                    extrairMensagemErro(
                                      err,
                                      'Erro ao alterar status do integrante.'
                                    )
                                  );
                                }
                              }}
                              className={`px-3 min-h-[36px] rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition ${
                                m.ativo
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {m.ativo ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Ativo</span>
                                </>
                              ) : (
                                <>
                                  <Power className="w-3.5 h-3.5" />
                                  <span>Inativo</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditandoMembroId(m.id);
                                setEditNomeMembro(m.nome);
                                setEditTipoMembro(m.tipo);
                              }}
                              title="Editar integrante"
                              className="px-2.5 min-h-[36px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1 transition"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              disabled={excluindoId === m.id}
                              onClick={async () => {
                                const papel = m.tipo === 'MEDIUM' ? 'médium' : 'cambono';
                                const aviso =
                                  m.tipo === 'MEDIUM'
                                    ? `Excluir o ${papel} "${m.nome}"?\n\nAtenção: escalas e atendimentos em que atuou como médium também serão removidos.`
                                    : `Excluir o ${papel} "${m.nome}"?\n\nAs escalas em que atuou como cambono serão desvinculadas mantendo os atendimentos.`;
                                if (!window.confirm(aviso)) return;
                                setErro(null);
                                setExcluindoId(m.id);
                                try {
                                  await excluirMembroEquipe(m.id);
                                  await carregar();
                                } catch (err) {
                                  setErro(
                                    extrairMensagemErro(err, 'Erro ao excluir integrante.')
                                  );
                                } finally {
                                  setExcluindoId(null);
                                }
                              }}
                              title="Excluir integrante"
                              className="px-2.5 min-h-[36px] rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold inline-flex items-center gap-1 transition disabled:opacity-50"
                            >
                              {excluindoId === m.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>Excluir</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

