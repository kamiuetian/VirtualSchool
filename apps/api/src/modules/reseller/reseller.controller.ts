import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import {
  CreateResellerPartnerDto,
  ProvisionResellerTenantDto,
  UpdateResellerCustomerDto,
} from "./reseller.dto";
import { ResellerService } from "./reseller.service";

@ApiTags("reseller-portfolio")
@Controller("resellers")
@RequirePermissions("tenant:update")
export class ResellerController {
  constructor(
    @Inject(ResellerService) private readonly service: ResellerService,
  ) {}
  @Post()
  @RequirePermissions("tenant:create")
  create(
    @Body() body: CreateResellerPartnerDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createPartner(body, req.user?.subject);
  }
  @Get(":partnerId/portfolio") portfolio(
    @Param("partnerId") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.portfolio(id, req.user?.subject);
  }
  @Post(":partnerId/customers") provision(
    @Param("partnerId") id: string,
    @Body() body: ProvisionResellerTenantDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.provision(id, body, req.user?.subject);
  }
  @Patch(":partnerId/customers/:customerId") update(
    @Param("partnerId") id: string,
    @Param("customerId") customerId: string,
    @Body() body: UpdateResellerCustomerDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateCustomer(id, customerId, body, req.user?.subject);
  }
}
