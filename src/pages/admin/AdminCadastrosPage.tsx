import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Plus,
  Power,
  Sparkles,
  Users,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { extrairMensagemErro } from '../../lib/format';
import {
  alternarEntidadeAtiva,
  alternarMembroAtivo,
  criarEntidade,
  criarMembroEquipe,
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

  const [nomeMembro, setNomeMembro] = useState('');
  const [tipoMembro, setTipoMembro] = useState<TipoMembro>('MEDIUM');
  const [salvandoMembro, setSalvandoMembro] = useState(false);

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
                {entidades.map((ent) => (
                  <div
                    key={ent.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p
                        className={`font-bold text-sm ${
                          ent.ativo ? 'text-slate-900' : 'text-slate-400 line-through'
                        }`}
                      >
                        {ent.nome_entidade}
                      </p>
                      {ent.linha && (
                        <p className="text-xs text-slate-500">Linha: {ent.linha}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        await alternarEntidadeAtiva(ent.id, !ent.ativo);
                        await carregar();
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
                  </div>
                ))}
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
                {equipe.map((m) => (
                  <div
                    key={m.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                          m.tipo === 'MEDIUM'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {m.tipo === 'MEDIUM' ? 'Médium' : 'Cambono'}
                      </span>
                      <p
                        className={`font-bold text-sm ${
                          m.ativo ? 'text-slate-900' : 'text-slate-400 line-through'
                        }`}
                      >
                        {m.nome}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        await alternarMembroAtivo(m.id, !m.ativo);
                        await carregar();
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
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

