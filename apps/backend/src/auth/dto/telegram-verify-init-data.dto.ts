import { IsString, MinLength } from 'class-validator'

export class TelegramVerifyInitDataDto {
  @IsString()
  @MinLength(1)
  initDataRaw!: string
}
