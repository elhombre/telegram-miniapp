import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { ApiExceptionFilter } from './common/http/api-exception.filter'
import { RequestLoggingInterceptor } from './common/http/request-logging.interceptor'
import { getEnv } from './config/env.schema'
import { AppModule } from './app.module'

async function bootstrap() {
  const env = getEnv()
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix(env.API_PREFIX)
  app.useGlobalInterceptors(new RequestLoggingInterceptor())
  app.useGlobalFilters(new ApiExceptionFilter())

  if (env.FRONTEND_ORIGIN) {
    app.enableCors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    })
  }

  await app.listen(env.PORT)

  Logger.log(
    JSON.stringify({
      event: 'backend_started',
      port: env.PORT,
      apiPrefix: env.API_PREFIX,
      nodeEnv: env.NODE_ENV,
    }),
    'Bootstrap',
  )
}
void bootstrap()
