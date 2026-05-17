import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [UsersController],
  exports: [UsersService],
  imports: [PrismaModule],
  providers: [UsersService],
})
export class UsersModule {}
