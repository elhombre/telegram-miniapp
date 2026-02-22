import { IsEmail, IsString, MinLength } from 'class-validator'

export class LinkEmailRequestDto {
  @IsString()
  @MinLength(16)
  linkToken!: string

  @IsEmail()
  email!: string
}
