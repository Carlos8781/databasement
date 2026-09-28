import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

/**
 * Databasement application container.
 *
 * The application remains the upstream Laravel/FrankenPHP image so that all
 * database dump clients (mysqldump, pg_dump, mongodump, etc.) keep working.
 * Secrets are Worker secrets and are injected only when the container starts.
 */
export class DatabasementContainer extends Container {
  defaultPort = 2226;
  requiredPorts = [2226];
  sleepAfter = "2h";
  enableInternet = true;
  pingEndpoint = "health";

  envVars = {
    APP_ENV: "production",
    APP_DEBUG: "false",
    LOG_CHANNEL: "stderr",
    LOG_LEVEL: "warning",
    APP_URL: env.APP_URL || "http://localhost",
    APP_KEY: env.APP_KEY || "",
    APP_LOCALE: env.APP_LOCALE || "en",
    APP_FALLBACK_LOCALE: env.APP_FALLBACK_LOCALE || "en",
    DB_CONNECTION: env.DB_CONNECTION || "mysql",
    DB_HOST: env.DB_HOST || "",
    DB_PORT: env.DB_PORT || "3306",
    DB_DATABASE: env.DB_DATABASE || "databasement",
    DB_USERNAME: env.DB_USERNAME || "",
    DB_PASSWORD: env.DB_PASSWORD || "",
    SESSION_DRIVER: env.SESSION_DRIVER || "database",
    SESSION_LIFETIME: env.SESSION_LIFETIME || "120",
    SESSION_ENCRYPT: env.SESSION_ENCRYPT || "true",
    SESSION_SECURE_COOKIE: env.SESSION_SECURE_COOKIE || "true",
    SESSION_DOMAIN: env.SESSION_DOMAIN || "",
    FILESYSTEM_DISK: env.FILESYSTEM_DISK || "s3",
    QUEUE_CONNECTION: env.QUEUE_CONNECTION || "database",
    CACHE_STORE: env.CACHE_STORE || "database",
    MAIL_MAILER: env.MAIL_MAILER || "log",
    MAIL_FROM_ADDRESS: env.MAIL_FROM_ADDRESS || "noreply@example.com",
    MAIL_FROM_NAME: env.MAIL_FROM_NAME || "Databasement",
    AWS_ACCESS_KEY_ID: env.AWS_ACCESS_KEY_ID || "",
    AWS_SECRET_ACCESS_KEY: env.AWS_SECRET_ACCESS_KEY || "",
    AWS_DEFAULT_REGION: env.AWS_DEFAULT_REGION || "auto",
    AWS_BUCKET: env.AWS_BUCKET || "",
    AWS_ENDPOINT: env.AWS_ENDPOINT || "",
    AWS_USE_PATH_STYLE_ENDPOINT: env.AWS_USE_PATH_STYLE_ENDPOINT || "true",
    BACKUP_ENCRYPTION_KEY: env.BACKUP_ENCRYPTION_KEY || "",
    ENABLE_QUEUE_WORKER: "true",
    ENABLE_DATABASE_MIGRATION: "true",
    TZ: "UTC",
  };

  onError(error) {
    console.error("Databasement container failed", error);
    throw error;
  }
}

export default {
  async fetch(request, workerEnv) {
    const container = getContainer(workerEnv.DATABASEMENT_CONTAINER, "production");
    return container.fetch(request);
  },

  // Keep the application container warm enough for Laravel's scheduler and
  // queue worker. The container itself still runs schedule:work and queue:work.
  async scheduled(_controller, workerEnv, _ctx) {
    const container = getContainer(workerEnv.DATABASEMENT_CONTAINER, "production");
    await container.fetch(new Request("https://internal/health"));
  },
};

export { DatabasementContainer as defaultContainer };
