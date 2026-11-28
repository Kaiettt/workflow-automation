import { IsEnum } from 'class-validator';
import { PlanCode } from '@prisma/client';

export class ScheduleDowngradeDto {
  @IsEnum(PlanCode)
  targetPlanCode!: PlanCode;
}
