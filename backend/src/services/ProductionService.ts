import { Types } from 'mongoose';
import { Bom, IBom } from '../models/Bom';
import { ProductionRun, IProductionRun, IProductionMaterialIssue } from '../models/ProductionRun';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { AppError } from '../utils/app-error';
import { roundMoney } from '../utils/helpers';
import { generateJournalNo } from './SequenceService';
import {
  CreateBomInput,
  UpdateBomInput,
  CreateRunInput,
} from '../validators/production.validators';

export class ProductionService {
  // ── BOMs ─────────────────────────────────────────────────────────────────
  async listBoms(): Promise<Array<any>> {
    return Bom.find({}).populate('productId', 'name variants').sort({ createdAt: -1 }).lean();
  }

  async createBom(data: CreateBomInput): Promise<IBom> {
    if (!Types.ObjectId.isValid(data.productId)) throw new AppError(400, 'INVALID_ID', 'Invalid finished-good product');
    for (const item of data.items) {
      if (!Types.ObjectId.isValid(item.productId)) throw new AppError(400, 'INVALID_ID', 'Invalid component product');
    }
    const latest = await Bom.findOne({ productId: data.productId }).sort({ version: -1 }).lean();
    const bom = await Bom.create({
      name: data.name,
      productId: new Types.ObjectId(data.productId),
      outputQty: data.outputQty,
      version: (latest?.version || 0) + 1,
      items: data.items.map((i) => ({
        componentProductId: new Types.ObjectId(i.productId),
        quantity: i.quantity,
        wastagePercent: i.wastagePercent,
      })),
      laborCost: data.laborCost,
      overheadCost: data.overheadCost,
      isActive: data.isActive ?? true,
    });
    return bom.toObject() as unknown as IBom;
  }

  async updateBom(id: string, data: UpdateBomInput): Promise<IBom> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid BOM ID');
    const bom = await Bom.findById(id);
    if (!bom) throw new AppError(404, 'BOM_NOT_FOUND', 'BOM not found');
    if (data.name !== undefined) bom.name = data.name;
    if (data.outputQty !== undefined) bom.outputQty = data.outputQty;
    if (data.laborCost !== undefined) bom.laborCost = data.laborCost;
    if (data.overheadCost !== undefined) bom.overheadCost = data.overheadCost;
    if (data.isActive !== undefined) bom.isActive = data.isActive;
    if (data.items) {
      // Material changes create a new recipe version instead of rewriting history
      for (const item of data.items) {
        if (!Types.ObjectId.isValid(item.productId)) throw new AppError(400, 'INVALID_ID', 'Invalid component product');
      }
      const cloned = await Bom.create({
        orgId: bom.orgId,
        name: bom.name,
        productId: bom.productId,
        outputQty: data.outputQty ?? bom.outputQty,
        version: bom.version + 1,
        items: data.items.map((i) => ({
          componentProductId: new Types.ObjectId(i.productId),
          quantity: i.quantity,
          wastagePercent: i.wastagePercent,
        })),
        laborCost: data.laborCost ?? bom.laborCost,
        overheadCost: data.overheadCost ?? bom.overheadCost,
        isActive: true,
      });
      bom.isActive = false;
      await bom.save();
      return cloned.toObject() as unknown as IBom;
    }
    await bom.save();
    return bom.toObject() as unknown as IBom;
  }

  // ── runs ─────────────────────────────────────────────────────────────────
  async listRuns(): Promise<Array<any>> {
    return ProductionRun.find({})
      .populate('bomId', 'name version')
      .populate('productId', 'name variants')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }

  async getRun(id: string): Promise<IProductionRun> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid run ID');
    const run = await ProductionRun.findById(id).lean();
    if (!run) throw new AppError(404, 'RUN_NOT_FOUND', 'Production run not found');
    return run as unknown as IProductionRun;
  }

  /** Plans a run: scales the BOM to the planned quantity and checks stock. */
  async createRun(data: CreateRunInput, actorId: string): Promise<IProductionRun> {
    if (!Types.ObjectId.isValid(data.bomId)) throw new AppError(400, 'INVALID_ID', 'Invalid BOM ID');
    const bom: any = await Bom.findById(data.bomId).lean();
    if (!bom || !bom.isActive) throw new AppError(404, 'BOM_NOT_FOUND', 'Active BOM not found');

    const scale = data.plannedQty / bom.outputQty;

    // Stock availability preview (first variant of each component product)
    const shortages: string[] = [];
    for (const item of bom.items) {
      const comp: any = await Product.findById(item.componentProductId).lean();
      if (!comp) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'A component product no longer exists');
      const variant: any = comp.variants?.[0];
      if (!variant) throw new AppError(400, 'NO_VARIANT', `${comp.name} has no variant to issue stock from`);
      const needed = roundMoney(item.quantity * scale * (1 + (item.wastagePercent || 0) / 100));
      if (variant.currentStock < needed) {
        shortages.push(`${comp.name}: need ${needed}, have ${variant.currentStock}`);
      }
    }
    if (shortages.length > 0) {
      throw new AppError(422, 'INSUFFICIENT_MATERIALS', `Not enough materials — ${shortages.join('; ')}`);
    }

    const run = await ProductionRun.create({
      runNo: `PR-${Date.now().toString(36).toUpperCase()}`,
      bomId: bom._id,
      productId: bom.productId,
      plannedQty: data.plannedQty,
      laborCost: roundMoney(bom.laborCost * scale),
      overheadCost: roundMoney(bom.overheadCost * scale),
      status: 'PLANNED',
      notes: data.notes,
      createdById: new Types.ObjectId(actorId),
    });
    return run.toObject() as unknown as IProductionRun;
  }

  /** Starts the run and issues (consumes) the component materials at WAC. */
  async startRun(id: string, actorId: string): Promise<IProductionRun> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid run ID');
    const run = await ProductionRun.findById(id);
    if (!run) throw new AppError(404, 'RUN_NOT_FOUND', 'Production run not found');
    if (run.status !== 'PLANNED') throw new AppError(409, 'RUN_NOT_PLANNED', 'Only planned runs can be started');

    const bom: any = await Bom.findById(run.bomId).lean();
    if (!bom) throw new AppError(404, 'BOM_NOT_FOUND', 'BOM not found');

    const scale = run.plannedQty / bom.outputQty;
    const issues: IProductionMaterialIssue[] = [];
    let materialCost = 0;

    for (const item of bom.items) {
      const comp: any = await Product.findById(item.componentProductId);
      if (!comp) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'A component product no longer exists');
      const variant: any = comp.variants?.[0];
      if (!variant) throw new AppError(400, 'NO_VARIANT', `${comp.name} has no variant to issue stock from`);

      const needed = roundMoney(item.quantity * scale * (1 + (item.wastagePercent || 0) / 100));
      if (variant.currentStock < needed) {
        throw new AppError(422, 'INSUFFICIENT_MATERIALS', `Not enough stock for ${comp.name} — have ${variant.currentStock}, need ${needed}`);
      }

      const stockBefore = variant.currentStock;
      variant.currentStock = roundMoney(variant.currentStock - needed);
      await comp.save();

      const lineCost = roundMoney(needed * variant.costPrice);
      materialCost = roundMoney(materialCost + lineCost);

      await StockMovement.create({
        productId: comp._id,
        variantId: variant._id,
        type: 'OUT',
        quantity: needed,
        stockBefore,
        stockAfter: variant.currentStock,
        unitCost: variant.costPrice,
        referenceType: 'MANUAL',
        referenceId: run._id,
        reason: `Production run ${run.runNo}`,
        userId: new Types.ObjectId(actorId),
      });

      issues.push({
        productId: comp._id,
        variantId: variant._id,
        variantSku: variant.sku,
        productName: comp.name,
        quantity: needed,
        unitCost: variant.costPrice,
        lineCost,
      });
    }

    run.status = 'IN_PROGRESS';
    run.issues = issues;
    run.materialCost = materialCost;
    run.laborCost = roundMoney(bom.laborCost * scale);
    run.overheadCost = roundMoney(bom.overheadCost * scale);
    run.startedById = new Types.ObjectId(actorId);
    run.startedAt = new Date();
    await run.save();
    return run.toObject() as unknown as IProductionRun;
  }

  /** Completes the run: finished goods in at cost, WAC recomputed. */
  async completeRun(id: string, producedQty: number, actorId: string): Promise<IProductionRun> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid run ID');
    const run = await ProductionRun.findById(id);
    if (!run) throw new AppError(404, 'RUN_NOT_FOUND', 'Production run not found');
    if (run.status !== 'IN_PROGRESS') throw new AppError(409, 'RUN_NOT_IN_PROGRESS', 'Start the run before completing it');
    if (!Number.isFinite(producedQty) || producedQty <= 0) {
      throw new AppError(400, 'INVALID_QUANTITY', 'Produced quantity must be greater than zero');
    }

    const product: any = await Product.findById(run.productId);
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Finished-good product not found');
    if (!product.variants?.length) throw new AppError(400, 'NO_VARIANT', 'Finished good has no variant to receive stock');

    const totalCost = roundMoney(run.materialCost + run.laborCost + run.overheadCost);
    const unitCost = roundMoney(totalCost / producedQty);

    for (const variant of product.variants) {
      const stockBefore = variant.currentStock;
      variant.currentStock = roundMoney(variant.currentStock + producedQty);
      // Weighted average cost recomputation
      const oldTotal = stockBefore * variant.costPrice;
      const newTotal = oldTotal + totalCost;
      variant.costPrice = variant.currentStock > 0 ? roundMoney(newTotal / variant.currentStock) : unitCost;
      await product.save();

      await StockMovement.create({
        productId: product._id,
        variantId: variant._id,
        type: 'IN',
        quantity: producedQty,
        stockBefore,
        stockAfter: variant.currentStock,
        unitCost: variant.costPrice,
        referenceType: 'MANUAL',
        referenceId: run._id,
        reason: `Production output ${run.runNo}`,
        userId: new Types.ObjectId(actorId),
      });
    }

    run.producedQty = producedQty;
    run.unitCost = unitCost;
    run.status = 'COMPLETED';
    run.completedById = new Types.ObjectId(actorId);
    run.completedAt = new Date();
    await run.save();

    // Numbering warms the per-org counter so reports stay sequential
    await generateJournalNo();
    return run.toObject() as unknown as IProductionRun;
  }

  async cancelRun(id: string): Promise<IProductionRun> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid run ID');
    const run = await ProductionRun.findById(id);
    if (!run) throw new AppError(404, 'RUN_NOT_FOUND', 'Production run not found');
    if (run.status === 'COMPLETED') throw new AppError(409, 'RUN_COMPLETED', 'A completed run cannot be cancelled');
    if (run.status === 'IN_PROGRESS') throw new AppError(409, 'RUN_IN_PROGRESS', 'Materials already issued — reverse manually or complete the run');
    run.status = 'CANCELLED';
    await run.save();
    return run.toObject() as unknown as IProductionRun;
  }
}

export const productionService = new ProductionService();
