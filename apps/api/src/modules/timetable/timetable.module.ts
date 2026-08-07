import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { TimetableController } from "./timetable.controller";
import { TimetableService } from "./timetable.service";
import { CalendarExceptionsController } from "./calendar-exceptions.controller";
import { AcademicCalendarService } from "./calendar-exceptions.service";

@Module({
  controllers: [TimetableController, CalendarExceptionsController],
  imports: [PrismaModule],
  providers: [TimetableService, AcademicCalendarService],
})
export class TimetableModule {}
