# Databasement no Cloudflare

Esta variante usa **Cloudflare Workers + Containers** para executar o Laravel/FrankenPHP do projeto. O Worker encaminha a aplicação inteira para um único container, preservando os binários de backup (`mysqldump`, `pg_dump`, `mongodump`, `redis-cli`, Firebird e SQL Server).

## O que é necessário antes do deploy

1. Ativar **Cloudflare Containers** na conta.
2. Ativar **R2** na conta e criar um bucket para os backups.
3. Ter um banco SQL acessível pelo container. Para produção, use MySQL/MariaDB/PostgreSQL externo (ou um serviço gerenciado conectado ao Cloudflare Hyperdrive). **D1 não é compatível diretamente com o Eloquent/PDO deste Laravel** e não substitui o banco da aplicação sem uma reescrita.
4. Ter Docker local em execução: o `wrangler deploy` constrói a imagem do `Dockerfile`.
5. Configurar um domínio em `wrangler.toml` e, depois do deploy, associar o Worker à rota/domínio no painel Cloudflare.

## Configuração do R2

Crie o bucket:

```bash
npx wrangler r2 bucket create databasement-backups
```

Crie uma API token do R2 com acesso ao bucket e defina:

```bash
npx wrangler secret put AWS_ACCESS_KEY_ID
npx wrangler secret put AWS_SECRET_ACCESS_KEY
```

No `wrangler.toml`, defina `AWS_BUCKET` e `AWS_ENDPOINT` como variáveis (o endpoint usa o account ID):

```toml
[vars]
AWS_BUCKET = "databasement-backups"
AWS_ENDPOINT = "https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
```

O R2 é usado como armazenamento S3-compatible para volumes de backup. Não use SQLite sobre um mount de objeto para dados transacionais.

## Banco e secrets

Exemplo para MySQL/MariaDB:

```bash
npx wrangler secret put APP_KEY
npx wrangler secret put DB_HOST
npx wrangler secret put DB_USERNAME
npx wrangler secret put DB_PASSWORD
npx wrangler secret put BACKUP_ENCRYPTION_KEY
```

Se o banco estiver privado, use um endpoint acessível pelo Cloudflare (por exemplo, um banco gerenciado com Hyperdrive ou rede configurada). Os servidores que o Databasement irá **gerenciar/backup** continuam sendo cadastrados dentro da interface e podem estar em outras redes, desde que o container tenha conectividade de saída ou usem um agente remoto.

## Deploy

```bash
npm install
npx wrangler login
npx wrangler deploy
npx wrangler containers list
```

A primeira inicialização pode levar alguns minutos enquanto a imagem é construída e o container é provisionado.

## Verificação

```bash
curl https://SEU-WORKER.workers.dev/health
npx wrangler tail
```

Depois de confirmar o `health`, acesse a URL no navegador e crie o primeiro usuário. Migrações são executadas no startup pelo entrypoint original.

## Limitações importantes

- O disco local do Cloudflare Container é temporário. Por isso, os backups devem usar R2/S3; não dependa de `/data` para dados permanentes.
- O banco interno do Laravel não deve ser SQLite em produção nessa arquitetura. Use MySQL/MariaDB/PostgreSQL acessível pela aplicação.
- `schedule:work` e `queue:work` são mantidos dentro do container; o Cron do Worker desperta a instância a cada 5 minutos.
- A configuração `max_instances = 1` é intencional: filas e armazenamento local temporário não estão preparados aqui para múltiplas instâncias concorrentes.
- Recursos que dependem de conectividade de entrada (por exemplo, alguns bastions SSH) podem exigir agentes remotos ou Cloudflare Tunnel; conexões de saída iniciadas pelo container continuam disponíveis.

## Arquivos adicionados

- `src/index.js`: Worker e classe Container.
- `wrangler.toml`: configuração de Container, Durable Object e Cron.
- `CLOUDFLARE.md`: checklist de ativação, secrets, R2, banco e deploy.
