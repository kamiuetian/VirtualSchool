import { Injectable } from "@nestjs/common";
import type {
  MdmCommandDispatchInput,
  MdmCommandDispatchResult,
  MdmConnector,
} from "./mdm-connector.types";

@Injectable()
export class StubMdmConnector implements MdmConnector {
  readonly key = "STUB" as const;

  async dispatchCommand(
    input: MdmCommandDispatchInput,
  ): Promise<MdmCommandDispatchResult> {
    return {
      accepted: true,
      connector: this.key,
      connectorCommandId: `stub:${input.command.id}`,
      operationName: `stub:${input.command.id}`,
      request: {
        commandId: input.command.id,
        deviceId: input.device.id,
        type: input.command.type,
      },
      response: {
        acceptedAt: new Date().toISOString(),
        mode: "stub",
      },
    };
  }
}
