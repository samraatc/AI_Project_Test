import { IsOptional, IsString, IsNumber, IsUUID, IsBoolean, Min } from 'class-validator';
export class UpsertLineItemDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() category: string;
  @IsOptional() @IsString() code?: string;
  @IsString() description: string;
  @IsOptional() @IsString() specification?: string;
  @IsNumber() @Min(0) quantity: number;
  @IsString() unit: string;
  @IsNumber() @Min(0) unitRate: number;
  @IsOptional() @IsNumber() @Min(0) discountPct?: number;
  @IsOptional() @IsBoolean() isFlagged?: boolean;
  @IsOptional() @IsString() flagReason?: string;
  @IsOptional() @IsString() notes?: string;
}
