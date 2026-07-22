# Metal Daily — Now Playing

PWA pessoal para acompanhar lançamentos e notícias de metal, rock e música em geral. Pode ser instalada no iPhone sem App Store e continua a abrir offline.

## Funcionalidades

- Pastas para lançamentos, Radar Geral/Spotify, Alterportal, mainstream, futuro, notícias, Buzz, bandas dedicadas, Portugal, CORE, reviews, digest e estatísticas.
- Notícias e Buzz separados entre informação confirmada e rumores, com nível de confiança e indicação de última hora.
- Pesquisa global e filtros por subgénero, incluindo um arquivo pesquisável de seis meses.
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
- `update_data.py` — recolha defensiva de lançamentos, notícias, rumores, reviews e tendências em fontes mundiais e portuguesas.
- `archive/` — arquivo mensal pesquisável, limitado aos últimos seis meses.

O atualizador preserva a última edição válida quando uma fonte externa falha, consolida repetições e só publica quando encontra conteúdo novo ou alterado. O Alterportal é usado apenas como fonte de metadados e ligação para o post; a aplicação não extrai ligações de download.

O Radar Spotify usa OAuth PKCE no navegador. Cada utilizador pode indicar o próprio Client ID; a sessão, artistas seguidos e resultados pessoais ficam no respetivo dispositivo. O sino do Spotify não é exposto pela Web API e, por isso, existe uma ligação separada para o abrir no Spotify Web Player.

## Atualização

A aplicação procura um `data.json` novo quando abre, volta ao primeiro plano ou recebe um pull-to-refresh. O GitHub Actions executa o atualizador cinco vezes por dia — aproximadamente às 07:00, 10:00, 13:00, 17:00 e 21:00 em Lisboa durante o horário de verão — e também pode ser iniciado manualmente.

## Instalação no iPhone

1. Ativa o GitHub Pages para a branch publicada.
2. Abre `https://bjxm20-max.github.io/metal-daily/` no Safari.
3. Escolhe **Partilhar → Adicionar ao ecrã principal**.

Abrir diretamente o `index.html` por `file://` não funciona porque o navegador bloqueia o carregamento de `data.json`. A aplicação deve ser servida por HTTPS.
