import { IsArray } from 'class-validator';
export class BulkUpdateItemsDto { @IsArray() items: any[]; }
