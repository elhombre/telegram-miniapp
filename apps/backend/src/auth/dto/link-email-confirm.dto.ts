import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator'

export class LinkEmailConfirmDto {
  @IsString()
  @MinLength(16)
  linkToken!: string

  @IsEmail()
  email!: string

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string
}
