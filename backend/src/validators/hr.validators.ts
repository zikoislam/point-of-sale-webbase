import { z } from 'zod';

export const createEmployeeSchema = z.object({
  employeeCode: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(30),
  designation: z.string().trim().max(80).optional(),
  department: z.string().trim().max(80).optional(),
  joinDate: z.string().optional(),
  salaryBasic: z.coerce.number().min(0).default(0),
  allowances: z.array(z.object({ label: z.string().min(1), amount: z.coerce.number().min(0) })).optional(),
  deductions: z.array(z.object({ label: z.string().min(1), amount: z.coerce.number().min(0) })).optional(),
  bankOrMfsAccount: z.string().trim().max(60).optional(),
  address: z.string().trim().max(300).optional(),
  isActive: z.boolean().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const markAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  entries: z
    .array(
      z.object({
        employeeId: z.string().min(1),
        status: z.enum(['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY', 'LATE']),
        checkIn: z.string().datetime().optional(),
        checkOut: z.string().datetime().optional(),
        notes: z.string().trim().max(200).optional(),
      })
    )
    .min(1),
});

export const createAdvanceSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.coerce.number().positive('Advance must be greater than zero'),
  reason: z.string().trim().max(300).optional(),
  accountId: z.string().optional(),
});

export const generatePayrollSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
});

export const payPayrollSchema = z.object({
  accountId: z.string().min(1, 'Select the wallet salaries are paid from'),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type CreateAdvanceInput = z.infer<typeof createAdvanceSchema>;
