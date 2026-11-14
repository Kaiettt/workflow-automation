import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkflowRepository } from '../domain/repositories/workflow.repository';

@Injectable()
export class WorkflowOwnershipGuard implements CanActivate {
  constructor(private readonly workflows: WorkflowRepository) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ params: { id?: string }; user?: { id: string } }>();
    const id = request.params.id;
    if (!id) return true;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      throw new BadRequestException('Invalid workflow ID');
    const workflow = await this.workflows.findById(id);
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.ownerId !== request.user?.id)
      throw new ForbiddenException('Workflow access denied');
    return true;
  }
}
