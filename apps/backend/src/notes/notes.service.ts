import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { getEnv } from '../config/env.schema'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { PrismaService } from '../prisma/prisma.service'
import type { CreateNoteDto } from './dto/create-note.dto'

@Injectable()
export class NotesService {
  private readonly env = getEnv()

  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const items = await this.prisma.note.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        text: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return {
      maxLength: this.env.NOTES_MAX_LENGTH,
      items,
    }
  }

  async createForUser(userId: string, dto: CreateNoteDto) {
    const text = dto.text.trim()
    if (!text) {
      throw new BadRequestException({
        code: 'NOTE_TEXT_EMPTY',
        message: 'Note text cannot be empty',
      })
    }

    if (text.length > this.env.NOTES_MAX_LENGTH) {
      throw new BadRequestException({
        code: 'NOTE_TEXT_TOO_LONG',
        message: `Note text exceeds ${this.env.NOTES_MAX_LENGTH} characters`,
      })
    }

    const item = await this.prisma.note.create({
      data: {
        userId,
        text,
      },
      select: {
        id: true,
        text: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return {
      item,
    }
  }

  async deleteForUser(userId: string, noteId: string) {
    const normalizedNoteId = noteId.trim()
    if (!normalizedNoteId) {
      throw new BadRequestException({
        code: 'NOTE_ID_INVALID',
        message: 'Note id is required',
      })
    }

    const existingNote = await this.prisma.note.findFirst({
      where: {
        id: normalizedNoteId,
        userId,
      },
      select: {
        id: true,
      },
    })

    if (!existingNote) {
      throw new NotFoundException({
        code: 'NOTE_NOT_FOUND',
        message: 'Note not found',
      })
    }

    await this.prisma.note.delete({
      where: {
        id: normalizedNoteId,
      },
    })

    return {
      id: normalizedNoteId,
      deleted: true,
    }
  }
}
