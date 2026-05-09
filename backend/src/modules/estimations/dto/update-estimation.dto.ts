import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
export class UpdateEstimationDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsNumber() @Min(0) overheadPct?: number;
  @IsOptional() @IsNumber() @Min(0) taxPct?: number;
  @IsOptional() @IsNumber() @Min(0) profitMarginPct?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() status?: string;
}
