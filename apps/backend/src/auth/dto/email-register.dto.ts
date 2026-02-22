import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

export class EmailRegisterDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string
}
