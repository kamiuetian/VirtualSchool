import { Module } from "@nestjs/common";
import { TeacherSessionsController } from "./teacher-sessions.controller";
import { TeacherSessionsService } from "./teacher-sessions.service";

@Module({ controllers: [TeacherSessionsController], providers: [TeacherSessionsService] })
export class TeacherSessionsModule {}
