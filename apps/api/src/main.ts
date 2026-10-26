import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const config = app.get(ConfigService);

  app.setGlobalPrefix("api");

  // Auth is a Bearer header (Supabase access_token carried in the NextAuth
  // session), never cookies — keep CORS credential-free.
  const isProd = config.get<string>("nodeEnv") === "production";
  const origins = config.get<string[]>("corsOrigins");
  app.enableCors({
    origin: origins && origins.length > 0 ? origins : (isProd ? false : true),
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const swaggerCfg = new DocumentBuilder()
    .setTitle("tally-api")
    .setDescription(
      "Tally backend — merchant POS/inventory + Q Vision console. Auth: paste your Supabase access_token below.",
    )
    .setVersion("0.0.1")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "bearer",
    )
    .build();

  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerCfg), {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>("port", 4100);

  await app.listen(port);
  new Logger("Bootstrap").log(`Tally API listening on http://localhost:${port}/api`);
  new Logger("Bootstrap").log(`Swagger UI: http://localhost:${port}/docs`);
}

bootstrap().catch((err) => {
  new Logger("Bootstrap").error("Fatal boot error", err);
  process.exit(1);
});
