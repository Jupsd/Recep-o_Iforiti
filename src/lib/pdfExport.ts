import {
  formatarDataBR,
  formatarHoraBR,
  formatarSenha,
  LOGO_TERREIRO_URL,
  STATUS_ATENDIMENTO_LABEL,
  TERREIRO_NOME,
  TERREIRO_SUBTITULO,
} from './format';
import type { AtendimentoDetalhado, StatusAtendimento } from '../types/database';

export interface ResumoRelatorioPDF {
  total: number;
  atendidos: number;
  comOrientacoes: number;
  primeiraVez: number;
}

export interface FichaConsulentePDFParams {
  numeroSenha: number;
  nome: string;
  telefone?: string | null;
  primeiraVez: boolean;
  entidade: string;
  medium?: string;
  cambono?: string | null;
  giraTitulo?: string;
  dataGira: string;
  status: StatusAtendimento;
  orientacoes?: string | null;
  historico?: AtendimentoDetalhado[];
}

function escapeHtml(texto?: string | null): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getLogoAbsolutoUrl(): string {
  if (typeof window === 'undefined') return LOGO_TERREIRO_URL;
  return new URL(LOGO_TERREIRO_URL, window.location.origin).href;
}

function abrirDocumentoParaPDF(titulo: string, corpoHtml: string): void {
  const docHtml = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(titulo)}</title>
    <style>
      @page {
        size: A4;
        margin: 12mm;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 20px;
        font-family: 'Segoe UI', Arial, sans-serif;
        color: #0f172a;
        background: #ffffff;
        font-size: 12px;
        line-height: 1.45;
      }
      .no-print {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        justify-content: space-between;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 12px;
        padding: 12px 16px;
        margin-bottom: 18px;
      }
      .no-print p {
        margin: 0;
        font-size: 12px;
        color: #166534;
        font-weight: 600;
      }
      .no-print .actions {
        display: flex;
        gap: 8px;
      }
      .btn-print {
        background: #0f5132;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 9px 14px;
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
      }
      .btn-close {
        background: #ffffff;
        color: #334155;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 9px 14px;
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
      }
      .doc-header {
        display: flex;
        align-items: center;
        gap: 14px;
        border-bottom: 2px solid #0f5132;
        padding-bottom: 12px;
        margin-bottom: 14px;
      }
      .doc-header img {
        width: 58px;
        height: 58px;
        object-fit: contain;
        border-radius: 10px;
      }
      .doc-header h1 {
        margin: 0;
        font-size: 16px;
        color: #0f5132;
      }
      .doc-header p {
        margin: 2px 0 0;
        font-size: 11px;
        color: #475569;
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 14px;
      }
      .kpi {
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 8px 10px;
        background: #f8fafc;
      }
      .kpi-label {
        font-size: 10px;
        text-transform: uppercase;
        color: #64748b;
        font-weight: 700;
      }
      .kpi-val {
        font-size: 18px;
        font-weight: 800;
        color: #0f172a;
        margin-top: 2px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      th, td {
        border: 1px solid #cbd5e1;
        padding: 6px 7px;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #f1f5f9;
        font-weight: 800;
        text-transform: uppercase;
        font-size: 10px;
        color: #334155;
      }
      .badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 700;
        background: #e2e8f0;
        color: #1e293b;
      }
      .box {
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        padding: 12px 14px;
        margin-bottom: 12px;
        background: #ffffff;
      }
      .box-orientacoes {
        border: 1px solid #86efac;
        background: #f0fdf4;
        border-radius: 12px;
        padding: 12px 14px;
        margin-bottom: 12px;
        white-space: pre-line;
      }
      .section-title {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        color: #0f5132;
        margin: 0 0 6px;
      }
      .footer-note {
        margin-top: 14px;
        font-size: 10px;
        color: #64748b;
        text-align: right;
      }
      @media print {
        body {
          padding: 0;
        }
        .no-print {
          display: none !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="no-print">
      <p>Na janela de impressão que abrir, escolha <strong>"Salvar como PDF"</strong> no destino.</p>
      <div class="actions">
        <button type="button" class="btn-print" onclick="window.print()">Salvar como PDF / Imprimir</button>
        <button type="button" class="btn-close" onclick="window.close()">Fechar</button>
      </div>
    </div>
    ${corpoHtml}
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () {
          window.focus();
          window.print();
        }, 350);
      });
    </script>
  </body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(docHtml);
    win.document.close();
    return;
  }

  // Fallback quando bloqueador de pop-up impedir nova aba
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const frameDoc = iframe.contentWindow?.document;
  if (frameDoc) {
    frameDoc.open();
    frameDoc.write(docHtml);
    frameDoc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }, 350);
  }
}

export function exportarRelatorioAtendimentosPDF(
  registros: AtendimentoDetalhado[],
  resumo: ResumoRelatorioPDF
): void {
  if (registros.length === 0) return;

  const logoUrl = escapeHtml(getLogoAbsolutoUrl());
  const emitidoEm = new Date().toLocaleString('pt-BR');

  const linhas = registros
    .map((r) => {
      const obs = r.orientacoes ? escapeHtml(r.orientacoes).replace(/\n/g, '<br/>') : '<span style="color:#94a3b8">—</span>';
      return `<tr>
        <td><strong>${escapeHtml(formatarDataBR(r.data_gira))}</strong><br/><span style="color:#64748b">${escapeHtml(r.gira_titulo)}</span></td>
        <td><strong>${escapeHtml(formatarSenha(r.numero_senha))}</strong></td>
        <td><strong>${escapeHtml(r.consulente_nome)}</strong>${r.primeira_vez ? ' <span class="badge">1ª Vez</span>' : ''}<br/><span style="color:#475569">${escapeHtml(r.consulente_telefone || 'Sem telefone')}</span></td>
        <td><strong>${escapeHtml(r.nome_entidade)}</strong><br/>Médium: ${escapeHtml(r.medium_nome)}${r.cambono_nome ? `<br/>Cambono: ${escapeHtml(r.cambono_nome)}` : ''}</td>
        <td><span class="badge">${escapeHtml(STATUS_ATENDIMENTO_LABEL[r.status])}</span><br/><span style="color:#64748b">Check-in: ${escapeHtml(formatarHoraBR(r.criado_em))}</span></td>
        <td>${obs}</td>
      </tr>`;
    })
    .join('');

  const corpo = `
    <div class="doc-header">
      <img src="${logoUrl}" alt="${escapeHtml(TERREIRO_NOME)}" />
      <div>
        <h1>${escapeHtml(TERREIRO_NOME)} — ${escapeHtml(TERREIRO_SUBTITULO)}</h1>
        <p>Relatório de Atendimentos, Históricos e Orientações • Emitido em ${escapeHtml(emitidoEm)}</p>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Registros</div><div class="kpi-val">${resumo.total}</div></div>
      <div class="kpi"><div class="kpi-label">Atendidos</div><div class="kpi-val">${resumo.atendidos}</div></div>
      <div class="kpi"><div class="kpi-label">Com Orientações</div><div class="kpi-val">${resumo.comOrientacoes}</div></div>
      <div class="kpi"><div class="kpi-label">Visitantes 1ª Vez</div><div class="kpi-val">${resumo.primeiraVez}</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:14%">Data / Gira</th>
          <th style="width:7%">Senha</th>
          <th style="width:20%">Consulente</th>
          <th style="width:20%">Entidade / Equipe</th>
          <th style="width:13%">Status</th>
          <th style="width:26%">Orientações / Observações</th>
        </tr>
      </thead>
      <tbody>
        ${linhas}
      </tbody>
    </table>

    <p class="footer-note">Documento gerado pelo Sistema Recepção Iforiti • Total de ${registros.length} registro(s).</p>
  `;

  abrirDocumentoParaPDF(`Relatório de Atendimentos - ${TERREIRO_NOME}`, corpo);
}

export function exportarFichaConsulentePDF(params: FichaConsulentePDFParams): void {
  const logoUrl = escapeHtml(getLogoAbsolutoUrl());
  const emitidoEm = new Date().toLocaleString('pt-BR');
  const historico = params.historico ?? [];

  const historicoHtml =
    historico.length === 0
      ? '<p style="margin:0;color:#64748b">Nenhum atendimento anterior registrado.</p>'
      : historico
          .map(
            (h) => `
          <div style="border-bottom:1px solid #e2e8f0;padding:8px 0;">
            <p style="margin:0 0 3px;"><strong>${escapeHtml(formatarDataBR(h.data_gira))}</strong> • ${escapeHtml(h.nome_entidade)} (${escapeHtml(h.medium_nome)}${h.cambono_nome ? ` • Cambono: ${escapeHtml(h.cambono_nome)}` : ''}) — <span class="badge">${escapeHtml(STATUS_ATENDIMENTO_LABEL[h.status])}</span></p>
            <p style="margin:0;color:#334155;white-space:pre-line;">${h.orientacoes ? escapeHtml(h.orientacoes) : 'Sem orientações registradas.'}</p>
          </div>`
          )
          .join('');

  const corpo = `
    <div class="doc-header">
      <img src="${logoUrl}" alt="${escapeHtml(TERREIRO_NOME)}" />
      <div>
        <h1>${escapeHtml(TERREIRO_NOME)} — ${escapeHtml(TERREIRO_SUBTITULO)}</h1>
        <p>Ficha Individual do Consulente e Orientações • Senha ${escapeHtml(formatarSenha(params.numeroSenha))}</p>
      </div>
    </div>

    <div class="box">
      <p class="section-title">Dados do Consulente</p>
      <p style="margin:2px 0;"><strong>Nome:</strong> ${escapeHtml(params.nome)} ${params.primeiraVez ? '<span class="badge">1ª Vez no Terreiro</span>' : ''}</p>
      <p style="margin:2px 0;"><strong>WhatsApp / Telefone:</strong> ${escapeHtml(params.telefone || 'Não informado')}</p>
      <p style="margin:2px 0;"><strong>Data / Gira:</strong> ${escapeHtml(formatarDataBR(params.dataGira))}${params.giraTitulo ? ` • ${escapeHtml(params.giraTitulo)}` : ''}</p>
      <p style="margin:2px 0;"><strong>Entidade:</strong> ${escapeHtml(params.entidade)}${params.medium ? ` • <strong>Médium:</strong> ${escapeHtml(params.medium)}` : ''}${params.cambono ? ` • <strong>Cambono:</strong> ${escapeHtml(params.cambono)}` : ''}</p>
      <p style="margin:2px 0;"><strong>Status:</strong> <span class="badge">${escapeHtml(STATUS_ATENDIMENTO_LABEL[params.status])}</span></p>
    </div>

    <div class="box-orientacoes">
      <p class="section-title">Orientações da Entidade / Observações</p>
      <div>${params.orientacoes?.trim() ? escapeHtml(params.orientacoes.trim()) : 'Nenhuma orientação registrada para este atendimento.'}</div>
    </div>

    <div class="box">
      <p class="section-title">Histórico Anterior (${historico.length})</p>
      ${historicoHtml}
    </div>

    <p class="footer-note">Ficha emitida em ${escapeHtml(emitidoEm)} • ${escapeHtml(TERREIRO_NOME)}</p>
  `;

  abrirDocumentoParaPDF(`Ficha - ${params.nome} - ${TERREIRO_NOME}`, corpo);
}
