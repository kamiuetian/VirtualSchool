import { PartialType } from "@nestjs/swagger";
import { CreateSupportNoteDto } from "./create-support-note.dto";

export class UpdateSupportNoteDto extends PartialType(CreateSupportNoteDto) {}
