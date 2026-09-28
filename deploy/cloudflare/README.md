# Databasement behind Cloudflare Tunnel

Cloudflare Pages/Workers cannot execute this Laravel/PHP application or its Docker workers. This deployment keeps Databasement on a Docker host and publishes only its HTTP endpoint through a Cloudflare Tunnel; no inbound port needs to be opened.

## Requirements

- A Docker host with persistent disk and Docker Compose v2.
- A Cloudflare account with a domain/hostname.
- A named Cloudflare Tunnel created in **Zero Trust → Networks → Tunnels**.
- A public hostname on that tunnel pointing to `http://databasement:2226`.

## Deploy

```bash
cd deploy/cloudflare
cp .env.example .env
# Edit .env. Generate APP_KEY with:
# docker run --rm davidcrty/databasement:latest php artisan key:generate --show
# Generate a separate BACKUP_ENCRYPTION_KEY with:
# docker run --rm davidcrty/databasement:latest php artisan key:generate --show
docker compose up -d

docker compose ps
docker compose logs -f --tail=100 databasement cloudflared
```

Set the Cloudflare Tunnel public hostname to the exact value used in `APP_URL`. Keep the tunnel token and application keys only in `.env` or a secret manager.

## Cloudflare Pages vs Databasement

The `FreeDomain` repository is the static site and is deployed to Cloudflare Pages by the GitHub Actions workflow in that repository. Databasement is stateful and requires Docker, persistent storage, database/queue workers and backup tooling, so it is intentionally deployed on a Docker host behind the tunnel instead of being forced into Pages/Workers.
