import { Controller, Get } from '@nestjs/common'
import type { HealthResponse } from './app.service'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { AppService } from './app.service'

@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(): HealthResponse {
    return this.appService.getHealth()
  }
}
