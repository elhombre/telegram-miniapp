import { IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export enum LinkProviderDto {
  telegram = 'telegram',
  google = 'google',
  email = 'email',
}

export class LinkConfirmDto {
  @IsString()
  @MinLength(16)
  linkToken!: string

  @IsEnum(LinkProviderDto)
  provider!: LinkProviderDto

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  providerUserId?: string

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
