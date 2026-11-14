# Recepção Iforiti — PWA de Gestão de Senhas e Atendimentos do Terreiro

Sistema **Progressive Web App (PWA)** completo, Mobile-First e de **custo zero**, construído conforme a especificação técnica completa (Fases 1 a 4):

- **Check-in Público via QR Code (`/`)**: Retirada de senha sem login, máscara de WhatsApp, marcação de 1ª vez, bloqueio automático ao atingir limite (`ESGOTADO`), prevenção de duplicidade por telefone e aviso LGPD.
- **Comprovante Digital Offline (`/senha`)**: Salvo em `localStorage` para funcionar mesmo se o sinal cair no terreiro, com atualização ao vivo da fila, contador de pessoas na frente, vibração e alerta sonoro quando chamado (`EM_ATENDIMENTO`).
- **Painel do Cambono / Recepção (`/painel`)**: Fila em tempo real por entidade, botão `+ Manual` (RN02) para pessoas sem celular, chamada por voz opcional, modal de Ausência com escolha de manter ou liberar +1 vaga (RF10) e histórico recolhido.
- **Área Administrativa (`/admin/*`)**:
  - **Gestão da Gira (`/admin/gira`)**: Abertura de gira com escalas, QR Code da recepção com download em PNG e impressão de cartaz A4, ajuste dinâmico de limites/pausa em tempo real (RF04) e encerramento de gira convertendo pendentes para `NAO_ATENDIDO` (RN03).
  - **Cadastros Base (`/admin/cadastros`)**: Entidades, Médiuns e Cambonos (ativar/inativar).
  - **Relatórios Gerenciais (`/admin/relatorios`)**: Filtros por período, entidade, médium, status e busca, totalizadores e exportação em planilha Excel (`.xlsx`).

---

## Por que GitHub Pages + Supabase (Custo Zero Permanente)?

| Componente | Serviço Escolhido | Motivo do Custo Zero |
|---|---|---|
| **Frontend / PWA (HTTPS)** | **GitHub Pages** | Gratuito para repositórios públicos e gera HTTPS automático (obrigatório para PWA e câmera de QR Code). O deploy ocorre automaticamente via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). |
| **Banco + Auth + Tempo Real** | **Supabase (Plano Free)** | Plano gratuito permanente (PostgreSQL + Auth JWT + Realtime WebSockets + Políticas RLS) que conversa direto com o navegador sem precisar pagar um servidor intermediário. |
| **Observação sobre o Railway** | — | O Railway encerrou o plano gratuito permanente (o plano de avaliação expira após 30 dias / $5 de crédito, passando a exigir assinatura paga) e oferece apenas PostgreSQL TCP puro (que não pode ser acessado direto pelo navegador no GitHub Pages sem hospedar também um backend Node.js 24/7). Ainda assim, disponibilizamos [`supabase/schema_postgres_puro.sql`](supabase/schema_postgres_puro.sql) caso deseje migrar no futuro. |

---

## Como Testar Agora Mesmo no Computador (Sem Instalar Node.js)

1. Dê um duplo clique no arquivo **[`abrir-local.html`](abrir-local.html)** na pasta do projeto para abrir no navegador (Chrome/Edge).
2. O sistema inicia automaticamente em **Modo Local** (com banco salvo no `localStorage` e sincronização ao vivo entre abas do navegador).
3. Acesse **Área da Equipe** e entre com um dos acessos de demonstração (senha `123456`):
   - **Administrador:** `admin@terreiro.org`
   - **Cambono / Recepção:** `cambono@terreiro.org`

---

## Passo a Passo para Colocar no Ar (GitHub Pages + Supabase — R$ 0,00)

### 1. Configurar o Banco no Supabase (Gratuito)
1. Crie uma conta gratuita em **supabase.com** e clique em **New Project**.
2. No menu lateral, acesse **SQL Editor** → **New query**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Acesse **Authentication → Users → Add user** e crie seu usuário Administrador (e os dos Cambonos).
4. Copie o **UUID** do usuário criado e execute no **SQL Editor**:
   ```sql
   INSERT INTO perfis_acesso (id, nome, email, perfil, ativo)
   VALUES ('COLE-O-UUID-AQUI', 'Administrador', 'seu@email.com', 'ADMIN', true);
   ```
5. Em **Project Settings → API**, copie a **Project URL** (`VITE_SUPABASE_URL`) e a chave **anon public** (`VITE_SUPABASE_ANON_KEY`).

### 2. Publicar no GitHub Pages (Gratuito)
1. Crie um repositório **público** no GitHub e envie os arquivos desta pasta (via **GitHub Desktop** ou `git push`).
2. No repositório no GitHub, vá em **Settings → Secrets and variables → Actions** e adicione as duas variáveis/secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Em **Settings → Pages → Build and deployment**, selecione **Source: GitHub Actions**.
4. Aguarde cerca de 1 minuto na aba **Actions**. O GitHub compilará o projeto React/Vite/PWA automaticamente na nuvem e disponibilizará o link `https://seu-usuario.github.io/nome-do-repo/`.

---

## Desenvolvimento Local (Opcional — caso instale Node.js 20+)

```bash
cp .env.example .env.local
# Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local
npm install
npm run dev
```

