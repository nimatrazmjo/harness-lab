import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, buildAppConfig } from "./app-config";

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: buildAppConfig,
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
