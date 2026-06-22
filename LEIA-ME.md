# Metal Daily — app para iPhone (PWA)

App à medida com as novas releases de metal e rock. Funciona como app no iPhone 11
(ecrã inteiro, ícone próprio, offline), sem App Store e sem custos.

## O que tem
- 3 separadores: **Fontes**, **Alterportal**, **Future** (timeline).
- **Filtros por subgénero** (as bolinhas coloridas no topo — tocar para filtrar).
- **Pesquisa** por banda, editora ou álbum.
- **Favoritos** (❤) e **marcar como ouvido** (✓) — fica guardado no telemóvel.
- Barra inferior: Tudo · Favoritos · Por ouvir.
- Botão **Abrir no Spotify** em cada release.

## Como se atualiza
A app vai buscar o `data.json` mais recente em 3 momentos:
- **ao abrir** a app;
- **sempre que voltas a ela** (sais e regressas);
- com **pull-to-refresh** (puxar a lista para baixo).

Mostra "Atualizado às HH:MM" no canto e avisa com "⚡ Novas releases!" quando há novidades.
Importante: só aparece conteúdo novo depois de a tarefa agendada gerar e publicar um
`data.json` novo (uma vez por dia) — a app não pesquisa as fontes sozinha.

## Ficheiros
- `index.html` — a app
- `data.json` — os dados (é este que se atualiza todos os dias)
- `manifest.webmanifest`, `sw.js`, `icon-*.png` — instalação e modo offline

## Como pôr no iPhone (recomendado: GitHub Pages, gratuito)
1. Cria um repositório no GitHub e ativa **Pages** (Settings → Pages → Branch: main).
2. Faz upload de todos os ficheiros desta pasta.
3. Abre o link `https://<utilizador>.github.io/<repo>/` no **Safari** do iPhone.
4. Botão Partilhar → **Adicionar ao ecrã principal**.
5. Para atualizar diariamente, basta substituir o `data.json` no repositório
   (a tarefa agendada pode fazer isto automaticamente — é só pedir para configurar).

> Nota: abrir o `index.html` direto do Ficheiros (file://) bloqueia o `data.json` por
> segurança do Safari. A app tem de ser servida por http/https (ex.: GitHub Pages).
