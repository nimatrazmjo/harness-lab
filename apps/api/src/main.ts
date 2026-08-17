import "reflect-metadata";
import "./config/load-dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { APP_CONFIG, AppConfig } from "./config/app-config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const config = app.get<AppConfig>(APP_CONFIG);
  // Prod: loopback only — nginx (infra/nginx.conf) is the only process on 80/443, and proxies
  // here over localhost. Dev/test: 0.0.0.0 so it's reachable from outside a docker container.
  const host = process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0";
  await app.listen(config.port, host);
}

bootstrap();
