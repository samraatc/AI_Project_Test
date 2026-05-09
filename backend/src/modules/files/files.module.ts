import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { ProjectFile } from './entities/project-file.entity';
import { Project } from '../projects/entities/project.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectFile, Project]), BullModule.registerQueue({ name: 'ai-document-processing' }), AiModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
