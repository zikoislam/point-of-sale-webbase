import { Schema, Types } from 'mongoose';
import { currentOrgId, currentBranchId, isScopeSkipped } from './org.context';

/**
 * Mongoose plugin: transparent multi-tenant scoping.
 *
 * Applied to every organization-scoped schema (any schema that declares an
 * `orgId` path). While a request runs inside an org scope (see org.context),
 * this plugin:
 *
 *  - adds `orgId` to the filter of every query (find, findOne, count,
 *    distinct, updates, deletes) so no document of another organization can
 *    ever be read, changed or deleted by accident;
 *  - prepends an `$match` stage to every aggregation pipeline;
 *  - stamps `orgId` on every document created through save()/create()/
 *    insertMany();
 *  - upserts inherit the orgId through the injected filter equality.
 *
 * Queries executed with no scope (platform scripts, super-admin platform
 * routes) are left untouched.
 */
export function orgScopePlugin(schema: Schema): void {
  if (!schema.path('orgId')) return; // Only org-scoped models (e.g. User is global)

  const ORG_PATH = 'orgId';

  function scopedFilterAllows(filter: any): boolean {
    return filter && filter[ORG_PATH] !== undefined;
  }

  // ── Query filter injection ────────────────────────────────────────────────
  const injectFilter = function (this: any, next: () => void): void {
    const orgId = currentOrgId();
    if (orgId && !scopedFilterAllows(this.getFilter())) {
      this.where(ORG_PATH, new Types.ObjectId(orgId));
    }
    next();
  };

  schema.pre(
    [
      'find',
      'findOne',
      'countDocuments',
      'distinct',
      'updateOne',
      'updateMany',
      'replaceOne',
      'findOneAndUpdate',
      'findOneAndReplace',
      'findOneAndDelete',
      'deleteOne',
      'deleteMany',
    ],
    { query: true, document: false },
    injectFilter
  );

  // ── Aggregation pipeline guard ────────────────────────────────────────────
  schema.pre('aggregate', function (this: any, next: () => void): void {
    const orgId = currentOrgId();
    if (!orgId) return next();
    const pipeline = this.pipeline() as any[];
    const alreadyScoped = pipeline.some(
      (stage) => stage && stage.$match && stage.$match[ORG_PATH] !== undefined
    );
    if (!alreadyScoped) {
      pipeline.unshift({ $match: { [ORG_PATH]: new Types.ObjectId(orgId) } });
    }
    next();
  });

  // ── Document creation stamping ────────────────────────────────────────────
  const BRANCH_PATH = 'branchId';
  const hasBranchPath = !!schema.path(BRANCH_PATH);

  schema.pre('validate', function (this: any, next: () => void): void {
    const orgId = currentOrgId();
    if (orgId && !this.get(ORG_PATH)) {
      this.set(ORG_PATH, new Types.ObjectId(orgId));
    }
    // Branch attribution: records created by a branch user are tagged with it
    const branchId = currentBranchId();
    if (hasBranchPath && branchId && !this.get(BRANCH_PATH)) {
      this.set(BRANCH_PATH, new Types.ObjectId(branchId));
    }
    next();
  });

  schema.pre('insertMany', function (this: any, next: () => void, docs: any[]): void {
    const orgId = currentOrgId();
    const branchId = currentBranchId();
    for (const doc of docs) {
      if (orgId && doc && !doc[ORG_PATH]) doc[ORG_PATH] = new Types.ObjectId(orgId);
      if (hasBranchPath && branchId && doc && !doc[BRANCH_PATH]) {
        doc[BRANCH_PATH] = new Types.ObjectId(branchId);
      }
    }
    next();
  });
}
