# Metal Daily — Now Playing

PWA pessoal para acompanhar lançamentos e notícias de metal, rock e música em geral. Pode ser instalada no iPhone sem App Store e continua a abrir offline.

## Funcionalidades

- Pastas para lançamentos, Fresh Singles, Alterportal, mainstream, futuro, notícias, bandas, Portugal, metalcore, reviews, digest e estatísticas.
- Pesquisa e filtros por subgénero.
- Favoritos, ouvidos, bandas seguidas e watchlist guardados no dispositivo.
- Capas, biografias e discografias através de fontes públicas.
- Pesquisa no Spotify, Tidal, Apple Music, YouTube Music, Bandcamp e Qobuz.
- Criação de playlists no Spotify e Tidal através de OAuth PKCE.
- Histórico diário, notificações OneSignal e exportação de lançamentos para calendário.
- Pull-to-refresh, service worker e instalação PWA.

## Estrutura

- `index.html` — estrutura e acessibilidade da página.
- `styles.css` — apresentação responsiva.
- `app.js` — estado, renderização e integrações.
- `data.json` — edição de conteúdos consumida pela aplicação.
- `bands.json` — bandas seguidas por predefinição.
- `manifest.webmanifest`, `sw.js`, `icon-*.png` — instalação e funcionamento offline.
- `update_data.py` — atualização diária defensiva das notícias e metadados.

O atualizador preserva a última edição válida quando uma fonte externa falha ou devolve poucos resultados. A timeline futura é curada e não é substituída por cabeçalhos vazios.

## Atualização

A aplicação procura um `data.json` novo quando abre, volta ao primeiro plano ou recebe um pull-to-refresh. O GitHub Actions executa o atualizador diariamente às 09:00 UTC e também pode ser iniciado manualmente.

## Instalação no iPhone

1. Ativa o GitHub Pages para a branch publicada.
2. Abre `https://bjxm20-max.github.io/metal-daily/` no Safari.
3. Escolhe **Partilhar → Adicionar ao ecrã principal**.

Abrir diretamente o `index.html` por `file://` não funciona porque o navegador bloqueia o carregamento de `data.json`. A aplicação deve ser servida por HTTPS.
