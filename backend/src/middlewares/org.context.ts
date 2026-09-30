import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-scoped multi-tenant context.
 *
 * `requireOrg` opens the scope for the current request with the active
 * organization id taken from the JWT, and the Mongoose org-scope plugin reads
 * it on every query/create so all org data is transparently isolated.
 */
export interface OrgScope {
  orgId?: string;
  /** Active branch of the caller — new records are stamped with it (7.1). */
  branchId?: string;
  /** Platform-level work (super admin) must not be scoped — set skipScope. */
  skipScope?: boolean;
}

export const orgStorage = new AsyncLocalStorage<OrgScope>();

export function runWithOrg<T>(scope: OrgScope, fn: () => T): T {
  return orgStorage.run(scope, fn);
}

export function currentOrgId(): string | undefined {
  const store = orgStorage.getStore();
  if (!store || store.skipScope) return undefined;
  return store.orgId;
}

/** Branch of the current request, when the caller is attached to one. */
export function currentBranchId(): string | undefined {
  const store = orgStorage.getStore();
  if (!store || store.skipScope) return undefined;
  return store.branchId;
}

export function isScopeSkipped(): boolean {
  return !!orgStorage.getStore()?.skipScope;
}

/** Runs the callback with tenant scoping fully disabled (platform scripts, seeds). */
export function runWithoutScope<T>(fn: () => T): T {
  return orgStorage.run({ skipScope: true }, fn);
}
