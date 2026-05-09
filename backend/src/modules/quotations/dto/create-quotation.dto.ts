import { IsUUID, IsOptional, IsString, IsInt, Min } from 'class-validator';
export class CreateQuotationDto { @IsUUID() estimationId: string; @IsOptional() @IsString() title?: string; @IsOptional() @IsInt() @Min(7) validityDays?: number; }
