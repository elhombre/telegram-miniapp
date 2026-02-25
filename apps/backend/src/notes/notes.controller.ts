import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '../generated/prisma/client'
import type { Request } from 'express'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import type { AuthUser } from '../auth/types/auth-user.type'
import { AUTH_RATE_LIMIT_POLICIES } from '../common/rate-limit/policies/auth-rate-limit.policies'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { RateLimitService } from '../common/rate-limit/rate-limit.service'
// biome-ignore lint/style/useImportType: Nest validation metadata requires DTO runtime class reference.
import { CreateNoteDto } from './dto/create-note.dto'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { NotesService } from './notes.service'

@Controller('notes')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.ADMIN)
export class NotesController {
  constructor(
    private readonly notesService: NotesService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Get()
  async getMyNotes(@CurrentUser() user: AuthUser, @Req() request: Request) {
    await this.rateLimitService.assert(AUTH_RATE_LIMIT_POLICIES.NOTES_LIST, {
      request,
      userId: user.userId,
    })
    return this.notesService.listForUser(user.userId)
  }

  @Post()
  async createNote(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto, @Req() request: Request) {
    await this.rateLimitService.assert(AUTH_RATE_LIMIT_POLICIES.NOTES_CREATE, {
      request,
      userId: user.userId,
    })
    return this.notesService.createForUser(user.userId, dto)
  }

  @Delete(':noteId')
  async deleteNote(@CurrentUser() user: AuthUser, @Param('noteId') noteId: string, @Req() request: Request) {
    await this.rateLimitService.assert(AUTH_RATE_LIMIT_POLICIES.NOTES_DELETE, {
      request,
      userId: user.userId,
    })
    return this.notesService.deleteForUser(user.userId, noteId)
  }
}
