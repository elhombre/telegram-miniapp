import { IsString, MinLength } from 'class-validator'

export class LinkTelegramStatusDto {
  @IsString()
  @MinLength(16)
  linkToken!: string
}
