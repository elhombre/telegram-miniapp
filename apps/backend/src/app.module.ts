import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { RequestIdMiddleware } from './common/http/request-id.middleware'
import { PrismaModule } from './prisma/prisma.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*path')
  }
}
