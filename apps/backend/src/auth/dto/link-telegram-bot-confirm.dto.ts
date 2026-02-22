import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class LinkTelegramBotConfirmDto {
  @IsString()
  @MinLength(16)
  linkToken!: string

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  telegramUserId!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  firstName?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  lastName?: string

  @IsOptional()
  @IsString()
  @MaxLength(32)
  languageCode?: string
}
