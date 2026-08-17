# Cookie Vault — Amad3eu

Uma página estática, inspirada na simplicidade do GitHub Gist, para preservar e compartilhar um save do Cookie Clicker.

## O que a página faz

- Mostra o save em um bloco de código
- Copia o save com um clique
- Faz download em `.txt`
- Importa outro arquivo de save
- Exibe fotos, vídeos diretos e vídeos do YouTube
- Permite editar textos, perfil, save e galeria pelo navegador
- Funciona na Vercel sem backend ou banco de dados

## Abrir o painel de edição

Com a página aberta, pressione `Ctrl + Shift + A` (`Cmd + Shift + A` no macOS). Depois da credencial inicial, uma paisagem psicodélica com um identificador numérico é desenhada em tempo real em um `canvas`. Ela não existe como arquivo no repositório. Um comando administrativo separado habilita o campo de entrada da chave.

A senha inicial é `cookieclicker`. Ela não é armazenada literalmente: o navegador compara uma derivação PBKDF2-SHA-256 com 310.000 iterações e salt aleatório. O acesso dura somente enquanto a aba estiver aberta.

Isso protege apenas a interface. Como o projeto não tem backend, uma pessoa com conhecimento técnico ainda pode modificar o JavaScript localmente para mostrar o editor. As mudanças do painel também ficam no `localStorage` daquele navegador.

## Publicar alterações para todos

Para tornar uma alteração permanente para todos os visitantes, atualize os valores de `src/config.js` e os arquivos de mídia na pasta `public`, faça commit e um novo deploy. O painel possui **Exportar configuração** para criar um backup JSON dos valores editados e facilitar essa atualização.

URLs aceitas na galeria:

- Imagem: caminho de um arquivo em `public` (por exemplo `/foto-save.jpg`) ou URL pública
- Vídeo: URL pública de um `.mp4` ou link do YouTube

## Rodar localmente

```bash
npm install
npm run dev
```

## Publicar na Vercel

Importe o repositório na Vercel. Use:

- Build command: `npm run build`
- Output directory: `dist`

Não são necessárias variáveis de ambiente.
