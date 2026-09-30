import { Router } from 'express';
import { hrController } from '../controllers/HRController';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  markAttendanceSchema,
  createAdvanceSchema,
  generatePayrollSchema,
  payPayrollSchema,
} from '../validators/hr.validators';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

// ── employees ──────────────────────────────────────────────────────────────
router.get('/employees', requirePermissions('hr:view'), (req, res, next) => hrController.listEmployees(req, res, next));
router.post('/employees', requirePermissions('hr:manage'), validate(createEmployeeSchema), (req, res, next) => hrController.createEmployee(req, res, next));
router.put('/employees/:id', requirePermissions('hr:manage'), validate(updateEmployeeSchema), (req, res, next) => hrController.updateEmployee(req, res, next));

// ── attendance ─────────────────────────────────────────────────────────────
router.get('/attendance', requirePermissions('hr:view'), (req, res, next) => hrController.listAttendance(req, res, next));
router.post('/attendance', requirePermissions('hr:attendance'), validate(markAttendanceSchema), (req, res, next) => hrController.markAttendance(req, res, next));

// ── advances ───────────────────────────────────────────────────────────────
router.get('/advances', requirePermissions('hr:view'), (req, res, next) => hrController.listAdvances(req, res, next));
router.post('/advances', requirePermissions('hr:manage'), validate(createAdvanceSchema), (req, res, next) => hrController.createAdvance(req, res, next));

// ── payroll ────────────────────────────────────────────────────────────────
router.get('/payroll', requirePermissions('hr:view'), (req, res, next) => hrController.listPayrollRuns(req, res, next));
router.get('/payroll/:id', requirePermissions('hr:view'), (req, res, next) => hrController.getPayrollRun(req, res, next));
router.post('/payroll/generate', requirePermissions('hr:payroll'), validate(generatePayrollSchema), (req, res, next) => hrController.generatePayroll(req, res, next));
router.patch('/payroll/:id/approve', requirePermissions('hr:payroll'), (req, res, next) => hrController.approvePayroll(req, res, next));
router.patch('/payroll/:id/cancel', requirePermissions('hr:payroll'), (req, res, next) => hrController.cancelPayroll(req, res, next));
router.post('/payroll/:id/pay', requirePermissions('hr:payroll'), validate(payPayrollSchema), (req, res, next) => hrController.payPayroll(req, res, next));

export default router;
