import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { NodeTypePolicyError } from '../../domain/node-type-policy';

@Catch(NodeTypePolicyError)
export class NodeTypePolicyExceptionFilter implements ExceptionFilter<NodeTypePolicyError> {
  catch(error: NodeTypePolicyError, host: ArgumentsHost): void {
    const status =
      error.code === 'STALE_REVISION'
        ? 409
        : error.code === 'NODE_TYPE_NOT_FOUND'
          ? 404
          : 400;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, code: error.code, message: error.message });
  }
}
