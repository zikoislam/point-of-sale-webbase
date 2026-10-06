import { Router } from 'express';
import { searchController } from '../controllers/SearchController';

const router = Router();

// Global "jump to anything" search — scoped to the caller's organization and
// filtered by module permission inside the service.
router.get('/', (req, res, next) => searchController.search(req, res, next));

export default router;
