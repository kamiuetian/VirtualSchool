import { Inject, Injectable } from "@nestjs/common";
import { AndroidManagementConnector } from "./android-management.connector";
import type { MdmConnector } from "./mdm-connector.types";

@Injectable()
export class MdmConnectorRegistry {
  constructor(
    @Inject(AndroidManagementConnector)
    private readonly androidManagementConnector: AndroidManagementConnector,
  ) {}

  getActiveConnector(): MdmConnector {
    if (process.env.MDM_CONNECTOR_MODE !== "android-management") {
      throw new Error(
        "MDM_CONNECTOR_MODE must be explicitly set to android-management",
      );
    }

    return this.androidManagementConnector;
  }
}
