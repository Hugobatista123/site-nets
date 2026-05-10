# Manual Netshoes V2 — Sistema de Processos

Aplicação web estática para organizar **processos de atendimento** em **sessões personalizadas**, com **contador diário de atendimentos**, busca, filtros, múltiplos modos de visualização e backup local.

Construída em HTML, CSS e JavaScript puro — sem build, sem framework, sem servidor. Basta abrir `main.html` no navegador.

---

## Visão geral

O Manual Netshoes V2 foi pensado para agentes de pós-vendas e LGPD da Netshoes que precisam consultar rapidamente um catálogo de processos durante o atendimento. Em vez de depender de planilhas dispersas ou documentos longos, o usuário tem:

- Um **catálogo navegável** de processos, agrupados em sessões coloridas.
- Uma **busca instantânea** por título, conteúdo ou tag (com normalização de acentos e caracteres especiais).
- Um **contador de atendimentos** fixo no topo da tela para acompanhar produtividade diária por canal (Chat / E-mail).
- **Persistência 100% local**, via `localStorage` — nada sai do navegador.
- **Export/import em JSON** para backup ou migração entre máquinas.

---

## Funcionalidades

### Sessões
- Criar, editar e excluir sessões.
- Cor personalizada por sessão (color picker).
- Descrição livre para contexto.
- Cada sessão exibe contagem dos processos relacionados.

### Processos
- Cadastro com título, descrição/conteúdo, sessão, cor e tags.
- Edição inline e exclusão com confirmação.
- **Três modos de visualização**: cards, lista compacta e tabela.
- **Busca em tempo real** (com debounce) por título, conteúdo ou tag.
- **Filtros avançados**:
  - Filtro por sessão.
  - Filtro por múltiplas tags (modo AND — todas as selecionadas precisam estar presentes).
  - Ordenação: mais recentes, mais antigos, A–Z, Z–A.
- Paginação configurável.
- Modal de detalhe para leitura confortável de processos longos.

### Contador de atendimentos
- Barra fixa no topo da página com contagem do dia atual.
- Categorias separadas: **Chat** e **E-mail**.
- Histórico diário acumulado (modal "Histórico de Atendimentos").
- Dados armazenados em `localStorage["attendance_v1"]` no formato:
  ```json
  {
    "2026-05-10": { "chat": 12, "email": 5 },
    "2026-05-09": { "chat": 9,  "email": 7 }
  }
  ```

### Backup e migração
- **Exportar** todos os dados, apenas sessões ou apenas processos em JSON.
- **Importar** JSON exportado anteriormente (substitui os dados atuais).
- **Pré-visualização JSON** integrada para inspeção rápida.
- **Bundle oficial**: `processos-data.js` contém o snapshot validado dos processos da Netshoes — é sincronizado automaticamente no `load()` para garantir que toda instalação tenha o conteúdo base, sem apagar processos que o usuário tenha criado localmente.
- Botão "Limpar Todos os Dados" para reset completo (com confirmação).

### Conveniências de UX
- Atalho `Ctrl + K` para focar a busca.
- Botão "Voltar ao topo".
- Notificações visuais (sucesso, erro, aviso) auto-descartáveis.
- Modais de confirmação para ações destrutivas.
- Preferências de visualização persistidas (modo cards/lista/tabela, ordenação, itens por página).

---

## Estrutura do projeto

```
site-nets/
├── main.html             Página única — entrada da aplicação
├── style.css             Estilos completos (paleta roxa, responsivo)
├── app.js                Lógica principal: sessões, processos, filtros, views, export/import
├── storage.js            Camada de acesso ao localStorage (AppData + UIPrefs)
├── contador.js           Contador de atendimentos diários e histórico
├── processos-data.js     Bundle auto-gerado dos processos oficiais Netshoes
├── script.js             Stub legado (mantém compatibilidade com a estrutura antiga)
└── README.md             Este arquivo
```

### Ordem de carregamento dos scripts

Em `main.html`, ao final do `<body>`:

```html
<script src="processos-data.js"></script>
<script src="storage.js"></script>
<script src="contador.js"></script>
<script src="app.js"></script>
```

A ordem importa: `app.js` depende de `AppData`/`UIPrefs` (definidos em `storage.js`) e do `Counter` (definido em `contador.js`). O `processos-data.js` precisa estar disponível antes do `storage.js` para que o `syncFromBundle()` consiga popular os processos oficiais no primeiro acesso.

---

## Como executar

Por ser uma aplicação 100% estática, **não há instalação nem build**:

1. Clone o repositório:
   ```bash
   git clone https://github.com/Hugobatista123/site-nets.git
   cd site-nets
   ```
2. Abra `main.html` diretamente no navegador (duplo clique ou arraste para uma aba).

### Servindo via servidor local (opcional)

Alguns navegadores bloqueiam recursos quando a página é aberta via `file://`. Se aparecerem problemas (raros neste projeto, já que tudo é local), sirva via HTTP:

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve .
```

Depois acesse `http://localhost:8000/main.html`.

---

## Como usar

### Primeiro acesso
Ao abrir a página pela primeira vez, o `processos-data.js` é sincronizado automaticamente para o `localStorage`, populando as sessões oficiais (Pós Vendas, Links Úteis, LGPD NETS) e os processos correspondentes.

### Criando uma sessão
1. Aba **Sessões** → botão **Nova Sessão**.
2. Preencha nome, descrição e cor.
3. **Salvar Sessão**.

### Adicionando um processo
1. Aba **Processos**.
2. No formulário, defina título, sessão, cor e descrição.
3. (Opcional) adicione tags separadas por vírgula — viram filtros automáticos depois.
4. **Adicionar Processo**.

### Filtrando e buscando
- Caixa de busca no topo da listagem (atalho `Ctrl + K`).
- Seletor de sessão à direita.
- **Filtros Avançados** (recolhidos por padrão) para combinar tags e ordenação.
- Botão da borracha limpa todos os filtros de uma vez.

### Trocando o modo de visualização
Use os três botões à direita da toolbar:
- **Cards** — visão completa, ideal para navegação.
- **Lista compacta** — denso, ótimo para escanear muitos itens.
- **Tabela** — tabular, útil para comparar/ordenar.

A escolha é salva em `localStorage` (`ui_prefs_v1`) e restaurada na próxima visita.

### Contador de atendimentos
- Clique nos botões **Chat** ou **E-mail** na barra superior para incrementar.
- O total do dia atualiza em tempo real.
- Botão de **histórico** abre um modal com os atendimentos dos dias anteriores.

### Backup
- Aba **Exportar** → escolha o escopo (tudo / sessões / processos) → arquivo JSON é baixado.
- Para restaurar: **Escolher Arquivo** → selecione o JSON → **Importar**.
- A importação **substitui** os dados atuais, então faça um export antes se quiser mesclar manualmente.

---

## Persistência (`localStorage`)

| Chave              | Conteúdo                                              |
|--------------------|-------------------------------------------------------|
| `sessions`         | Array de sessões (id, name, description, color, datas)|
| `processes`        | Array de processos (id, title, description, sessionId, color, tags, datas) |
| `attendance_v1`    | Mapa `data → { chat, email }` com contagem diária     |
| `ui_prefs_v1`      | Modo de visualização, ordenação, itens por página     |

IDs são gerados em runtime via `Date.now().toString(36) + Math.random().toString(36)` (ver `AppData.generateId()` em `storage.js`).

---

## Atalhos de teclado

| Atalho      | Ação                       |
|-------------|----------------------------|
| `Ctrl + K`  | Foca a caixa de busca      |
| `Esc`       | Fecha modais abertos       |

---

## Stack

- **HTML5** semântico
- **CSS3** com variáveis customizadas (paleta primária `#6a1bb1`, secundária `#3b82f6`)
- **JavaScript** vanilla (ES6+)
- **Google Fonts** — Inter (400/500/600/700/800)
- **Font Awesome 6.4** — ícones
- Sem dependências NPM, sem bundler, sem framework

---

## Compatibilidade

Testado em versões recentes de Chrome, Edge e Firefox. Requer suporte a:
- `localStorage`
- `String.prototype.normalize('NFD')` (busca sem acentos)
- CSS custom properties

---

## Roadmap / ideias futuras

- Sincronização opcional via API (multi-dispositivo).
- Exportação para Markdown/PDF.
- Edição rica (negrito, listas, links) na descrição do processo.
- Modo escuro.
- Histórico do contador com gráficos.

---

## Autoria

Projeto pessoal mantido por [Hugo Batista](https://github.com/Hugobatista123).
