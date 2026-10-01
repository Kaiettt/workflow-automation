import { IsUUID } from 'class-validator';

export class StartExecutionDto {
  @IsUUID()
  workflow_version_id: string;
}
