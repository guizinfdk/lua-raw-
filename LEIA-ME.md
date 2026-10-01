# Lua Raw

Painel HTML, CSS e JavaScript com servidor Node.js, sem dependências externas. Permite criar, editar e excluir scripts Lua, gerar links raw e loadstrings e renovar a chave de cada script. O servidor armazena texto; não executa Lua.

## Rodar no Windows

1. Instale Node.js 22 ou superior, extraia este ZIP e abra o terminal na pasta que contém `server.mjs`.
2. Copie `.env.example` para `.env`. No PowerShell: `Copy-Item .env.example .env`.
3. Gere uma chave: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
4. Edite `.env` e substitua o valor de `ADMIN_KEY` pela chave gerada. Guarde-a: ela permite administrar todos os scripts. Não publique esse arquivo.
5. Execute `npm start`. Não é necessário executar `npm install`.
6. Abra `http://localhost:3000` no navegador e informe a chave administrativa.
7. Cole o Lua, dê um nome e clique em **Salvar e gerar link**. Copie o loadstring.

## Disponibilizar na internet

O projeto não está hospedado. Links localhost só funcionam no próprio computador enquanto o servidor estiver ligado. Em outro aparelho, localhost aponta para aquele aparelho.

Use um servidor compatível com Node.js e disco persistente. Configure `HOST=0.0.0.0`, a porta exigida pela hospedagem, `PUBLIC_URL=https://seu-dominio` (sem caminho) e uma `ADMIN_KEY` aleatória. Configure HTTPS no proxy/hospedagem e use `node server.mjs` quando as variáveis já forem fornecidas pela plataforma. Defina `DATA_DIR` para o volume persistente. Faça backup desse diretório: ele contém códigos e chaves.

Não funciona hospedando apenas a pasta `public` em um serviço de páginas estáticas. Execute uma única instância do servidor por diretório de dados; esta versão usa arquivos locais e não suporta réplicas concorrentes. Limite de 100 scripts de até 512 KB cada. Para uso público de alto tráfego, configure limite de requisições e proteção contra abuso no proxy.

## Proteção e limites reais

- O painel usa chave administrativa, guardada apenas na memória da aba. Atualizar a página exige entrar novamente.
- Cada script possui uma chave aleatória diferente. O endpoint raw exige essa chave.
- Navegações normais de navegador são recusadas por cabeçalhos HTTP (`Sec-Fetch-*` e `Accept`). Esses cabeçalhos podem ser imitados: esse filtro NÃO garante acesso exclusivo por executores.
- O loadstring simples leva a chave na URL para funcionar com `game:HttpGet`. Qualquer pessoa com esse loadstring pode recuperar e copiar o código, usando um cliente HTTP ou reproduzindo a requisição. A alternativa `request` envia a chave no cabeçalho, mas também não impede cópia por quem a possui.
- Configure a hospedagem/proxy para não registrar query strings nem cabeçalhos de autorização. O servidor incluído não registra requisições.
- Não há ofuscação, antidump ou proteção absoluta. Nunca coloque senhas ou segredos de serviços no Lua entregue ao cliente.
- Renovar a chave invalida os links antigos. Excluir o script também invalida seu link. Editar preserva o link e a chave.
- O código precisa ser compatível com o ambiente Lua de destino. Não foi testado dentro do Delta; o modelo simples exige `game:HttpGet` e `loadstring`, e a alternativa exige `request`.
- A chave administrativa e o filtro são verificados no servidor, não apenas no HTML. A pasta de dados não é servida como conteúdo estático.

## Arquivos

- `public/index.html`: interface HTML.
- `public/style.css`: visual responsivo.
- `public/app.js`: editor, cópia e comunicação com a API.
- `server.mjs`: autenticação, armazenamento e resposta raw.
- `.env.example`: configuração de exemplo.

O servidor retorna o conteúdo Lua exatamente como foi salvo, com `Content-Type: text/plain` e `Cache-Control: no-store`.
