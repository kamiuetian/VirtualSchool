import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RemoteCommandsController } from "./remote-commands.controller";
import { RemoteCommandsService } from "./remote-commands.service";

@Module({
  controllers: [RemoteCommandsController],
  exports: [RemoteCommandsService],
  imports: [PrismaModule],
  providers: [RemoteCommandsService],
})
export class RemoteCommandsModule {}
