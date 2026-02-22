import { IsString, MinLength } from 'class-validator'

export class GoogleCallbackDto {
  @IsString()
  @MinLength(10)
  idToken!: string
}
