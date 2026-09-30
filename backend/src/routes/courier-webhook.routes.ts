import { Router } from 'express';
import { courierController } from '../controllers/CourierController';

/**
 * Courier webhooks — deliberately NOT behind the org wrapper: Pathao / RedX
 * call this without a JWT. Authentication is a shared secret
 * (COURIER_WEBHOOK_SECRET), and the order is resolved across organizations
 * inside the service before any update happens.
 */
const router = Router();

router.post('/:provider', (req, res, next) => courierController.webhook(req, res, next));

export default router;
