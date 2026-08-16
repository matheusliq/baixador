---
name: youtube_downloader_architecture
description: Padrões arquiteturais para o ecossistema Baixador de Músicas (Proxy de Streaming de Áudio sem Python, Proxy de Thumbnails anti-preta, Cookie SOCS Consent Bypass, Fallback de Player Híbrido, Upsert de Fila Supabase, PWA Next.js, Build PyInstaller e Fallbacks de Prerender na Vercel).
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

## 2. Proxy de Streaming de Áudio (`/api/audio/[id]`) com Autenticação de Cookie SOCS
- **Problema:** Na Vercel (ambiente Serverless Node.js), `ytdl.getInfo()` sem cookies de consentimento retornava erro 403 Forbidden / 502 Bad Gateway no CDN do YouTube (`.googlevideo.com`).
- **Solução:** A rota `/api/audio/[id]` utiliza a biblioteca `@distube/ytdl-core` injetando o cabeçalho `Cookie: SOCS=CAESEwgDEgk2OTcyMTY5MzAaAmVuIAEaBgiA_L20Bg; CONSENT=YES...`. Isso garante a extração do stream de áudio em 100% JavaScript sem precisar de Python e sem tomar 403 da CDN do YouTube.

## 3. Player de Prévia Híbrido com Fallback Automático (`src/app/page.tsx`)
- **Problema:** Caso a CDN do YouTube altere as chaves de assinatura do player em algum momento, o elemento `<audio>` HTML5 nativo poderia falhar ao reproduzir a prévia.
- **Solução:** O aplicativo mobile escuta o evento `onError` do elemento `<audio>`. Caso ocorra qualquer falha de carregamento, ativa automaticamente um player embutido fallback (`https://www.youtube-nocookie.com/embed/${song.id}?autoplay=1`), garantindo que o usuário ouça a prévia 100% das vezes.

## 4. Inserção Resiliente na Fila Supabase (`.upsert()`)
- **Problema:** Ao tentar adicionar uma música que já constava na tabela (ex: baixada anteriormente ou excluída), o método `.insert()` falhava por conflito de chave primária (Primary Key Conflict), fazendo a música "sumir" da fila no celular.
- **Solução:** Substituído o `.insert()` por `.upsert([{ id, title, thumbnail, status: 'pendente' }], { onConflict: 'id' })`. Dessa forma, músicas novas ou previamente baixadas são movidas para a fila ativa de forma 100% garantida.

## 5. Deploy Vercel Monorepo
- Como o projeto possui uma estrutura de monorepo (`mobile/` e `desktop/`), a Vercel exige a configuração de **Root Directory** definida como `mobile` nas configurações do projeto.

## 6. Build Desktop Standalone (PyInstaller)
- O aplicativo Python é compilado através do script `desktop/build.py` com a flag `PYTHONUTF8=1` no Windows.
- O executável `.exe` gerado em `desktop/dist/BaixadorMusicas.exe` inclui todas as dependências (CustomTkinter, Supabase, yt-dlp) e salva o arquivo de configuração de forma persistente no diretório do binário compilado.

## 7. Prevenção de Erros no Prerender da Vercel (`supabaseUrl is required`)
- **Problema:** Durante a fase `next build` (prerendering estático da Vercel), se as variáveis `NEXT_PUBLIC_SUPABASE_URL` não estiverem presentes no momento da compilação, o `createClient` do Supabase lança `Error: supabaseUrl is required.` abortando o processo de build.
- **Solução:** O arquivo `src/lib/supabase.ts` utiliza fallbacks seguros (`https://placeholder.supabase.co` e `placeholder-key`). Dessa forma o `next build` conclui com sucesso de primeira, e em tempo de execução o cliente lê as credenciais reais configuradas no painel da Vercel.

## 8. Bypass da Tela de Consentimento do Google (`SOCS` Cookie) na Busca (`/api/search`)
- **Problema:** Requisições de busca originadas de datacenters de nuvem da Vercel (ex: US `iad1`) são redirecionadas pelo Google para `https://consent.youtube.com` (tela de consentimento de cookies da UE/US), fazendo requisições de raspagem retornarem HTML sem resultados e causando busca vazia ou erro 500.
- **Solução:** Adicionado o cabeçalho `"Cookie": "SOCS=CAESEwgDEgk2OTcyMTY5MzAaAmVuIAEaBgiA_L20Bg; CONSENT=YES+cb.20210328-17-p0.en+FX+417"` nas requisições do servidor. Isso força o YouTube a ignorar a tela de consentimento e entregar os resultados reais `ytInitialData` de forma 100% consistente na Vercel.
