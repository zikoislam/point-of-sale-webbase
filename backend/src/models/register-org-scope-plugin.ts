import mongoose from 'mongoose';
import { orgScopePlugin } from '../middlewares/org-scope.plugin';

/**
 * Registers the tenant-scoping plugin as a GLOBAL Mongoose plugin.
 *
 * Imported first (before every model module below) so that when each schema
 * is constructed it immediately picks up the plugin. Schemas without an
 * `orgId` path (User, Role templates, Counter, SyncState, TokenBlacklist,
 * Organization) are ignored by the plugin itself.
 */
mongoose.plugin(orgScopePlugin);
