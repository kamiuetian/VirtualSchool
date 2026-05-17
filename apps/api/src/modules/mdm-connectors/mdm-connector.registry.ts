import { Inject, Injectable } from "@nestjs/common";
import { AndroidManagementConnector } from "./android-management.connector";
import type { MdmConnector } from "./mdm-connector.types";
import { StubMdmConnector } from "./stub-mdm.connector";

@Injectable()
export class MdmConnectorRegistry {
  constructor(
    @Inject(AndroidManagementConnector)
    private readonly androidManagementConnector: AndroidManagementConnector,
    @Inject(StubMdmConnector)
    private readonly stubMdmConnector: StubMdmConnector,
  ) {}

  getActiveConnector(): MdmConnector {
    return process.env.MDM_CONNECTOR_MODE === "android-management"
      ? this.androidManagementConnector
      : this.stubMdmConnector;
  }
}
