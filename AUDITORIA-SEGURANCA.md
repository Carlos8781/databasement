# Auditoria de segurança e cópia do Databasement

**Data:** 23 de setembro de 2026  
**Cópia criada:** [Carlos8781/databasement](https://github.com/Carlos8781/databasement)  
**Repositório de origem:** [David-Crty/databasement](https://github.com/David-Crty/databasement)

## Conclusão

A cópia foi criada com sucesso na conta `Carlos8781` e permanece **pública**, como o repositório de origem. O projeto contém controles relevantes, incluindo autenticação via Sanctum, autorização por políticas, validação de hosts para conexões externas e criptografia de credenciais armazenadas. Entretanto, **não é seguro publicar uma implantação de produção usando os arquivos padrão sem primeiro corrigir a configuração**.

A principal razão é que o repositório versiona um `.env` de desenvolvimento com `APP_DEBUG=true`, uma chave `APP_KEY` fixa e credenciais padrão de banco. O `docker-compose.yml` também contém senhas previsíveis para serviços de teste e usa várias imagens com a tag mutável `latest`. Esses valores parecem destinados ao desenvolvimento local, mas tornam-se um risco se o Compose for exposto à rede ou se a mesma configuração for reutilizada em produção.

Esta análise é uma revisão estática do repositório. Ela não substitui um teste de invasão, uma revisão do ambiente de execução ou uma auditoria das credenciais já utilizadas.

## Achados prioritários

| ID | Severidade | Achado | Evidência | Ação recomendada |
|---|---|---|---|---|
| SEC-01 | Crítica em caso de reutilização | `.env` versionado contém uma `APP_KEY` fixa e `APP_DEBUG=true`. | `.env:1-5` | Remover o `.env` do controle de versão, gerar uma nova chave por ambiente e usar `APP_DEBUG=false` em produção. Se esta chave foi usada em algum ambiente real, trate-a como comprometida e faça rotação. |
| SEC-02 | Alta | O Compose usa credenciais padrão previsíveis: `root/root`, `rustfsadmin/rustfsadmin`, `testuser/testpass`, entre outras. | `docker-compose.yml:45-183` | Usar arquivo `.env.local` ou secrets do Docker/Kubernetes. Alterar todas as senhas antes de qualquer exposição fora de `localhost`. |
| SEC-03 | Alta | A auditoria do `package-lock.json` reportou uma vulnerabilidade alta em `nanoid` abaixo de `3.3.18`. | `package-lock.json` e `npm audit --omit=dev --package-lock-only` | Atualizar a dependência transitiva para uma versão corrigida, revisar o diff e executar os testes. Não apliquei automaticamente a atualização na sua cópia para evitar mudanças não revisadas. |
| SEC-04 | Média | Imagens de container usam tags mutáveis como `latest`. | `docker-compose.yml:5-7, 28-30, 112-171` | Fixar versões ou, preferencialmente, digests SHA-256. Atualizar de forma controlada e fazer varredura das imagens no CI. |
| SEC-05 | Média | A rota `/adminer` exige autenticação e autorização, mas fornece uma interface administrativa sensível dentro da aplicação. | `routes/web.php:96-99` e `AdminerController.php:13-35` | Desabilitar Adminer em produção quando não for necessário. Se for necessário, restringir por função, rede privada e camada adicional de proxy. |
| SEC-06 | Média | O serviço de SSH de teste permite autenticação por senha e usa credenciais explícitas no Compose. | `docker-compose.yml:151-163` | Usar somente em ambiente local isolado; remover ou desabilitar em produção e preferir chaves SSH. |
| SEC-07 | Média | O relatório de dependências PHP não pôde ser executado porque `composer` não está instalado neste ambiente. | Verificação local | Executar `composer audit --locked` no CI e no ambiente de desenvolvimento antes do deploy. |

## Controles positivos observados

As rotas da API usam `auth:sanctum` e limitação de requisições na maior parte dos endpoints (`routes/api.php:14-60`). As rotas específicas de agente têm middleware próprio de autenticação e controle de falhas (`routes/api.php:62-75`). O código usa políticas e chamadas de autorização em componentes Livewire, o que reduz o risco de depender apenas da visibilidade da interface.

A regra `SafeHost` restringe hosts a caracteres compatíveis com nomes DNS, endereços IP e literais IPv6. Isso é uma defesa importante porque o sistema conecta em bancos e túneis SSH configurados pelo usuário. O controlador de Adminer também verifica a capacidade `adminer` antes de abrir a ferramenta e valida se o tipo de banco é compatível.

As credenciais de bancos e de SSH são tratadas por métodos de criptografia no modelo e não são preenchidas novamente nos formulários de edição. Ainda assim, a segurança efetiva depende de proteger a `APP_KEY`; se ela for perdida ou exposta, a confidencialidade dessas credenciais fica comprometida.

## Como preparar a sua cópia

### 1. Trabalhar no fork correto

A cópia já está disponível em:

```text
https://github.com/Carlos8781/databasement
```

Para trabalhar localmente:

```bash
git clone https://github.com/Carlos8781/databasement.git
cd databasement
git remote add upstream https://github.com/David-Crty/databasement.git
```

Para trazer atualizações futuras do projeto original:

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

### 2. Não usar o `.env` versionado em produção

O arquivo `.env` deve servir somente como referência local e não deve conter valores reais. Antes de colocar a aplicação em produção:

```bash
cp .env .env.local
# Edite .env.local e substitua todos os valores locais.
# Depois remova o .env versionado da sua cópia:
git rm .env
git commit -m "security: remove environment file from version control"
git push origin main
```

No ambiente de produção, configure pelo menos:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://seu-dominio.example
APP_KEY=base64:gere-uma-chave-exclusiva
DB_PASSWORD=uma-senha-longa-e-unica
SESSION_SECURE_COOKIE=true
```

Gere uma chave nova com o mecanismo oficial do Laravel, sem reutilizar a chave que está no repositório:

```bash
php artisan key:generate --show
```

Guarde a chave em um gerenciador de secrets, Docker Secrets, Kubernetes Secret ou variável protegida do provedor. Não a coloque em commits, issues, logs ou imagens Docker.

### 3. Corrigir as dependências

Depois de instalar Node.js e Composer, rode:

```bash
npm ci
npm audit
npm audit fix
composer install --no-interaction --prefer-dist --optimize-autoloader
composer audit --locked
php artisan test
```

Revise o `package-lock.json` após `npm audit fix`. Se a atualização mudar versões principais, teste a aplicação antes do commit. O objetivo mínimo é eliminar a ocorrência de `nanoid` abaixo de `3.3.18` apontada pela auditoria.

### 4. Endurecer o Docker Compose

Use um arquivo separado para valores locais ou secrets. Não exponha portas de MySQL, PostgreSQL, MongoDB, Redis, RustFS ou SSH à Internet. O Compose atual já limita várias portas a `127.0.0.1`, mas isso só é seguro enquanto o host estiver protegido e nenhum proxy publicar essas portas.

Substitua as senhas de teste e fixe as versões das imagens. Em produção, prefira um Compose próprio, menor, contendo apenas a aplicação, o banco de dados escolhido e o armazenamento necessário. Remova Adminer, SSH de teste, bancos de demonstração e serviços que não forem usados.

### 5. Configurar o GitHub com proteção básica

Na sua cópia, habilite branch protection para `main`, exija revisão antes de merge e mantenha os workflows com permissões mínimas. Ative Dependabot para Composer, npm, Actions e imagens Docker. Adicione secret scanning e push protection se estiverem disponíveis para a visibilidade do repositório.

Não coloque tokens de API, chaves de OAuth, senhas de banco, chaves privadas SSH ou tokens Sanctum no GitHub. Se algum segredo real já foi commitado, revogue-o no provedor e gere outro; apagar o arquivo em um commit posterior não remove o valor do histórico.

### 6. Checklist antes de publicar

```text
[ ] APP_DEBUG=false
[ ] APP_KEY nova e armazenada fora do Git
[ ] Nenhum .env ou segredo real versionado
[ ] Senhas padrão removidas
[ ] Dependências sem alertas críticos ou altos conhecidos
[ ] Imagens Docker fixadas por versão/digest
[ ] Adminer desabilitado ou restrito
[ ] Portas de banco e armazenamento não expostas à Internet
[ ] HTTPS obrigatório e cookies seguros
[ ] Backup criptografado e teste de restauração realizado
[ ] MFA habilitado para contas administrativas
[ ] Logs não exibem senhas, tokens ou chaves privadas
[ ] Branch main protegida e Dependabot ativo
```

## Próximos passos que exigem decisão sua

A cópia atual é um **fork público**. Se você quiser uma implantação privada, a opção mais segura é criar um repositório privado separado e copiar o código revisado para ele, porque a visibilidade de um fork pode ser limitada pelas regras do repositório pai. Também é necessário decidir onde a aplicação será executada — servidor próprio, Docker Compose, Kubernetes ou outro provedor — pois o procedimento de secrets, rede e backup muda conforme o ambiente.

## Referências

[1]: https://github.com/Carlos8781/databasement "Cópia do Databasement criada para o usuário"
[2]: https://github.com/David-Crty/databasement "Repositório original do Databasement"
[3]: https://github.com/advisories/GHSA-2v37-7h3g-55p8 "Aviso de segurança do nanoid"
[4]: https://laravel.com/docs/12.x/configuration "Documentação de configuração do Laravel"
[5]: https://docs.github.com/en/code-security "Documentação de segurança do GitHub"

---

**Autor:** Manus AI

*Este documento registra uma revisão estática realizada em 23/09/2026. A conclusão “não pronto para produção” refere-se à configuração encontrada no repositório, não a uma garantia de vulnerabilidade explorável em toda instalação.*
