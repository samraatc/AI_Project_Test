import { IsEmail, IsOptional, IsString } from 'class-validator';
export class SendQuotationDto { @IsEmail() recipientEmail: string; @IsOptional() @IsString() subject?: string; @IsOptional() @IsString() message?: string; @IsOptional() @IsString() senderName?: string; }
