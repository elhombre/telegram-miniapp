import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import { UserRole } from '../generated/prisma/client'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import type { AuthUser } from '../auth/types/auth-user.type'
// biome-ignore lint/style/useImportType: Nest validation metadata requires DTO runtime class reference.
import { CreateNoteDto } from './dto/create-note.dto'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { NotesService } from './notes.service'

@Controller('notes')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.ADMIN)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  async getMyNotes(@CurrentUser() user: AuthUser) {
    return this.notesService.listForUser(user.userId)
  }

  @Post()
  async createNote(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto) {
    return this.notesService.createForUser(user.userId, dto)
  }

  @Delete(':noteId')
  async deleteNote(@CurrentUser() user: AuthUser, @Param('noteId') noteId: string) {
    return this.notesService.deleteForUser(user.userId, noteId)
  }
}
