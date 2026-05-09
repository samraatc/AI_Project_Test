import { IsUUID, IsOptional, IsString, IsNumber, Min } from 'class-validator';
export class CreateEstimationDto {
  @IsUUID() projectId: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() @Min(0) overheadPct?: number;
  @IsOptional() @IsNumber() @Min(0) taxPct?: number;
  @IsOptional() @IsNumber() @Min(0) profitMarginPct?: number;
}
