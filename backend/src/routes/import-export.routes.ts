import { Router } from 'express';
import { importExportController } from '../controllers/ImportExportController';
import { requirePermissions } from '../middlewares/rbac.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

// Reports first (they must not be shadowed by /:id)
router.get('/reports/lc-status', requirePermissions('reports:purchases'), (req, res, next) =>
  importExportController.lcStatusReport(req, res, next)
);
router.get('/reports/landed-cost', requirePermissions('reports:purchases'), (req, res, next) =>
  importExportController.landedCostAnalysis(req, res, next)
);
router.get('/agents/payables', requirePermissions('reports:payables'), (req, res, next) =>
  importExportController.agentPayables(req, res, next)
);

// Letters of credit
router.get('/lc', (req, res, next) => importExportController.listLcs(req, res, next));
router.post('/lc', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.createLc(req, res, next)
);
router.get('/lc/:id', (req, res, next) => importExportController.getLc(req, res, next));
router.put('/lc/:id', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.updateLc(req, res, next)
);
router.put('/lc/:id/status', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.updateLcStatus(req, res, next)
);
router.put('/lc/:id/documents', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.addLcDocument(req, res, next)
);
router.delete('/lc/:id', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.removeLc(req, res, next)
);

// Proforma invoices
router.get('/pi', (req, res, next) => importExportController.listPis(req, res, next));
router.post('/pi', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.createPi(req, res, next)
);
router.get('/pi/:id', (req, res, next) => importExportController.getPi(req, res, next));
router.put('/pi/:id/status', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.updatePiStatus(req, res, next)
);
router.put('/pi/:id/link-lc', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.linkPiToLc(req, res, next)
);

// Commercial invoices
router.get('/ci', (req, res, next) => importExportController.listCis(req, res, next));
router.post('/ci', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.createCi(req, res, next)
);
router.get('/ci/:id', (req, res, next) => importExportController.getCi(req, res, next));
router.put('/ci/:id/status', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.updateCiStatus(req, res, next)
);
router.post('/ci/:id/clear', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.clearCi(req, res, next)
);

// C&F / freight agents
router.get('/agents', (req, res, next) => importExportController.listAgents(req, res, next));
router.post('/agents', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.createAgent(req, res, next)
);
router.put('/agents/:id', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.updateAgent(req, res, next)
);
router.get('/agents/:id/ledger', (req, res, next) => importExportController.agentLedger(req, res, next));
router.post('/agents/:id/transactions', requirePermissions('procurement:manage'), (req, res, next) =>
  importExportController.agentTransaction(req, res, next)
);

export default router;
