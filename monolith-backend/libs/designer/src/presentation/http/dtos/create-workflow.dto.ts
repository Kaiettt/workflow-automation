import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkflowDto {
  @ApiProperty({ description: 'The name of the workflow' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'The ID of the owner user', required: false })
  @IsString()
  @IsOptional()
  ownerId?: string;
}
