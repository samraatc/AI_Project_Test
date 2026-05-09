import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';
export class CreateTenantDto {
  @IsString() name: string;
  @IsEmail() adminEmail: string;
  @IsString() @MinLength(8) adminPassword: string;
  @IsOptional() @IsString() adminFirstName?: string;
  @IsOptional() @IsString() adminLastName?:  string;
  @IsOptional() @IsString() plan?: string;
}
