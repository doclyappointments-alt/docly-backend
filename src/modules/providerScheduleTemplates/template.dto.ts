// src/modules/providerScheduleTemplates/template.dto.ts

export interface CreateScheduleTemplateDTO {
  dayOfWeek: string;       // "MONDAY"
  startTime: string;       // "09:00"
  endTime: string;         // "17:00"
  slotDurationMinutes: number;
  isActive?: boolean;
}

export interface UpdateScheduleTemplateDTO {
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  slotDurationMinutes?: number;
  isActive?: boolean;
}
