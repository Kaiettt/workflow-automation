import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import type { SubscriptionPlanModel } from '@app/subscription';
import {
  SubscriptionLifecycleService,
  SubscriptionLifecycleError,
  GetCurrentSubscriptionQuery,
  CurrentSubscriptionDto,
} from '@app/subscription';
import { CreateCheckoutDto } from './dtos/create-checkout.dto';
import { ScheduleDowngradeDto } from './dtos/schedule-downgrade.dto';
import {
  CreateCheckoutCommand,
  CheckoutResultDto,
} from '../../application/commands/create-checkout.command';
import {
  HandleVNPayIpnCommand,
  VNPayIpnResponse,
} from '../../application/commands/handle-vnpay-ipn.command';
import {
  VerifyVNPayReturnCommand,
  VerifyReturnResult,
} from '../../application/commands/verify-vnpay-return.command';
import {
  GetPaymentOrderQuery,
  GetPaymentHistoryQuery,
  PaymentOrderDto,
} from '../../application/queries/get-payment-order.query';
import { GetPlansQuery } from '../../application/queries/get-plans.query';
import { getVNPayConfig } from '../../infrastructure/payment/vnpay/vnpay.config';

@Controller('api/billing')
export class PaymentController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly subscriptionLifecycle: SubscriptionLifecycleService,
  ) {}

  @Get('plans')
  async getPlans() {
    const plans = await this.queryBus.execute<
      GetPlansQuery,
      SubscriptionPlanModel[]
    >(new GetPlansQuery());
    return {
      success: true,
      data: plans,
    };
  }

  @Get('subscription/me')
  @UseGuards(JwtAuthGuard)
  async getCurrentSubscription(@Req() req: Request & { user: { id: string } }) {
    const subscription = await this.queryBus.execute<
      GetCurrentSubscriptionQuery,
      CurrentSubscriptionDto | null
    >(new GetCurrentSubscriptionQuery(req.user.id));
    return {
      success: true,
      data: subscription,
    };
  }

  @Get('payments/history')
  @UseGuards(JwtAuthGuard)
  async getPaymentHistory(@Req() req: Request & { user: { id: string } }) {
    const orders = await this.queryBus.execute<
      GetPaymentHistoryQuery,
      PaymentOrderDto[]
    >(new GetPaymentHistoryQuery(req.user.id));
    return { success: true, data: orders };
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(
    @Body() dto: CreateCheckoutDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    const result = await this.commandBus.execute<
      CreateCheckoutCommand,
      CheckoutResultDto
    >(
      new CreateCheckoutCommand(req.user.id, dto.planId, req.ip || '127.0.0.1'),
    );
    return {
      success: true,
      data: result,
    };
  }

  @Post('subscription/downgrade')
  @UseGuards(JwtAuthGuard)
  async downgrade(
    @Body() dto: ScheduleDowngradeDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.runLifecycleAction(
      () =>
        this.subscriptionLifecycle.scheduleDowngrade(
          req.user.id,
          dto.targetPlanCode,
        ),
      'Downgrade scheduled for next cycle',
    );
  }

  @Post('subscription/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelRenewal(@Req() req: Request & { user: { id: string } }) {
    return this.runLifecycleAction(
      () => this.subscriptionLifecycle.cancelRenewal(req.user.id),
      'Renewal cancelled for current cycle end',
    );
  }

  @Post('subscription/switch-to-free')
  @UseGuards(JwtAuthGuard)
  async switchToFree(@Req() req: Request & { user: { id: string } }) {
    return this.runLifecycleAction(
      () => this.subscriptionLifecycle.switchToFree(req.user.id),
      'Switched to Free plan successfully',
    );
  }

  @Get('vnpay/ipn')
  async ipn(
    @Query() params: Record<string, string>,
  ): Promise<VNPayIpnResponse> {
    return this.commandBus.execute<HandleVNPayIpnCommand, VNPayIpnResponse>(
      new HandleVNPayIpnCommand(params),
    );
  }

  @Get('vnpay/return')
  async paymentReturn(
    @Query() params: Record<string, string>,
    @Res() res: Response,
  ) {
    const result = await this.commandBus.execute<
      VerifyVNPayReturnCommand,
      VerifyReturnResult
    >(new VerifyVNPayReturnCommand(params));
    const frontendUrl = getVNPayConfig().frontendUrl;
    return res.redirect(
      `${frontendUrl}/billing/payment-result?txnRef=${encodeURIComponent(
        result.transactionReference,
      )}`,
    );
  }

  @Get('payment-orders/:txnRef')
  @UseGuards(JwtAuthGuard)
  async getPaymentOrder(
    @Param('txnRef') txnRef: string,
    @Req() req: Request & { user: { id: string } },
  ) {
    const order = await this.queryBus.execute<
      GetPaymentOrderQuery,
      PaymentOrderDto
    >(new GetPaymentOrderQuery(req.user.id, txnRef));
    return {
      success: true,
      data: order,
    };
  }

  private async runLifecycleAction(
    action: () => Promise<void>,
    message: string,
  ) {
    try {
      await action();
    } catch (error) {
      if (error instanceof SubscriptionLifecycleError) {
        throw new BadRequestException({
          error: 'SUBSCRIPTION_LIFECYCLE_INVALID',
          message: error.message,
        });
      }
      throw error;
    }
    return { success: true, message };
  }
}
