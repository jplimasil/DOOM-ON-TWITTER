# Freedoom no X

O DOOM (motor Chocolate Doom compilado para WebAssembly, com os mapas livres do Freedoom) rodando **dentro de um post do X**, usando um *Player Card*. Quem abre o post clica no ▶ e joga ali mesmo.

Tudo é estático: não tem servidor nem custo, e só a Vercel hospeda.

## Como funciona

```
Post no X ──(meta tags twitter:player em index.html)──► iframe /embed.html
                                                         ├─ doom/doom.wasm   (Chocolate Doom, 2,2 MB)
                                                         └─ doom/freedoom1.wad.gz (10 MB, descompactado no navegador)
```

- `web/index.html`: a URL que você posta. Contém as meta tags do Player Card e também funciona como página normal.
- `web/embed.html` + `embed.js` + `embed.css`: o que roda dentro do post (download com barra de progresso, botão "Clique para jogar" e "Abrir em nova aba").
- `web/touch.js`: controles de toque para celular (joystick, ATIRAR, USAR, ARMA, menu ☰). Eles aparecem só em telas de toque e disparam eventos de teclado, então o motor não muda.
- `web/doom/doom.cfg`: controles do teclado (WASD andar, ←→ virar, Espaço atirar, E usar, Q trocar arma, Shift correr).
- `build/`: scripts que baixam e compilam tudo. Não precisam de autotools, WSL nem Docker.

## Publicar (Vercel)

1. Faça o deploy da pasta `web`:
   ```
   npm run deploy
   ```
   Na primeira vez a Vercel pede login e o nome do projeto. O endereço final vai ser algo como `https://seu-projeto.vercel.app`.
2. Coloque esse endereço (e o seu @ do X) nas meta tags e publique de novo:
   ```
   npm run set-url -- https://seu-projeto.vercel.app @SeuPerfil
   npm run deploy
   ```
3. Poste o link `https://seu-projeto.vercel.app` no X. O cartão aparece com a miniatura e o ▶.

> Alternativa sem a CLI: suba o projeto no GitHub e importe na Vercel com **Root Directory = `web`** (sem build command).

## Compilar do zero

Só precisa de Node 18+, Git e Python 3:

```
npm run setup    # baixa doom-wasm (commit fixo), Emscripten 3.1.74 e Freedoom 0.13.0 em vendor/ e aplica os patches
npm run build    # compila 156 arquivos C -> web/doom/doom.js + doom.wasm
npm run serve    # http://localhost:8787
```

### Patches no doom-wasm (`build/patches/`)

- **`boolean` com tamanho errado**: os headers do Emscripten mais novos incluem `<stdbool.h>`, e o `doomtype.h` passava a usar `bool` (1 byte) em alguns arquivos e enum (4 bytes) em outros. Isso corrompia a memória: o jogo começava em "deathmatch" com jogadores fantasmas e o chão sumia.
- **Atalhos de letra no menu**: no DOOM, apertar uma letra pula para a opção que começa com ela ("S" vai para Save Game). Isso agora é ignorado para teclas de controle (WASD, E, Q...), para o joystick e o botão USAR navegarem o menu direito.
- **Página congelando com música**: o `OPL_Delay` esperava num laço por um callback de áudio que, no navegador, roda na mesma thread. Agora ele cede a vez com `emscripten_sleep`, e a música original (emulação AdLib/OPL) funciona.

## Limitações

- No celular os controles de toque funcionam, mas sem mira fina como num mouse. Segurar o celular deitado ou usar "Abrir em nova aba" dá mais espaço.
- Dentro do post o mouse pode não ficar "preso": se o iframe do X não liberar *pointer lock*, a mira pelo mouse não funciona (o teclado continua funcionando). Para jogar com mouse, use "Abrir em nova aba".
- O X decide sozinho onde o player toca. No X web (desktop) roda dentro do post; nos apps de celular ele pode abrir o link no navegador.

## Licenças

- Chocolate Doom e doom-wasm: GPL-2.0 (`LICENSES/CHOCOLATE-DOOM-GPL2.md`). Por isso, ao publicar o jogo, o código-fonte (este repositório, incluindo os patches) precisa ficar disponível publicamente.
- Freedoom: BSD (`LICENSES/FREEDOOM-COPYING.txt`).
- Nenhum arquivo do DOOM comercial é usado. Projeto de fã, sem afiliação com id Software ou Bethesda.
