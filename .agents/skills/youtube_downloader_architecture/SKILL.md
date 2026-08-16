---
name: youtube_downloader_architecture
description: Padrões arquiteturais para o ecossistema Baixador de Músicas (Proxy de Streaming de Áudio, Proxy de Thumbnails anti-preta, PWA Next.js e Build PyInstaller sem dependências).
---

# Padrões Arquiteturais - Baixador de Músicas

Este documento registra as soluções definitivas adotadas para o projeto **Baixador de Músicas** (Mobile Next.js + Desktop Python).

## 1. Proxy de Thumbnails (`/api/thumbnail/[id]`)
- **Problema:** Imagens de capas do YouTube (`img.youtube.com` ou `i.ytimg.com`) sofriam bloqueios de CORS, políticas de Referrer do navegador, ou retornavam imagens 120x90 com bordas pretas para determinados vídeos.
- **Solução:** Criada uma rota de backend em Next.js (`/api/thumbnail/[id]/route.ts`) que atua como proxy interno.
- **Funcionamento:**
  - O servidor Node.js faz a requisição para os candidatos de capas (`hqdefault`, `0.jpg`, `mqdefault`, `sddefault`).
  - O servidor valida o tamanho em bytes da resposta (`byteLength > 1000`) para filtrar imagens pretas de erro do YouTube.
  - Retorna a imagem original com o cabeçalho `Cache-Control: public, max-age=86400`, eliminando requisições repetidas e bloqueios de Referrer/AdBlock no cliente.

## 2. Proxy de Streaming de Áudio (`/api/audio/[id]`)
- **Problema:** Redirecionar o elemento `<audio>` diretamente para URLs do YouTube gerava erros de expiração de token, bloqueio de Cross-Origin e falhas por conta de avisos em `stderr` emitidos pelo `yt-dlp`.
- **Solução:** A rota `/api/audio/[id]` executa o `yt-dlp` via `child_process.spawn` (ignorando `stderr`) e faz o proxy do stream de bytes via `fetch` repassando o cabeçalho `Range` para o cliente.

## 3. Gestão de Histórico e Exclusão Simultânea
- Exclusão de itens do Supabase remove a faixa da fila (`status = "pendente"`) e do histórico (`status = "baixado"`), permitindo ao usuário re-adicionar faixas apagadas para download posterior.

## 4. Deploy Vercel Monorepo
- Como o projeto possui uma estrutura de monorepo (`mobile/` e `desktop/`), a Vercel exige a configuração de **Root Directory** definida como `mobile` nas configurações do projeto.

## 5. Build Desktop Standalone (PyInstaller)
- O aplicativo Python é compilado através do script `desktop/build.py` com a flag `PYTHONUTF8=1` no Windows.
- O executável `.exe` gerado em `desktop/dist/BaixadorMusicas.exe` inclui todas as dependências (CustomTkinter, Supabase, yt-dlp) e salva o arquivo de configuração de forma persistente no diretório do binário compilado.
