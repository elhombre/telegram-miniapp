import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { NotesController } from './notes.controller'
import { NotesService } from './notes.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [NotesController],
  providers: [NotesService, AccessTokenGuard, RolesGuard],
})
export class NotesModule {}
