import { Injectable } from '@nestjs/common'

export interface HealthResponse {
  status: 'ok'
  service: 'backend'
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'backend',
    }
  }
}
