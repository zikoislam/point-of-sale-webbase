import crypto from 'crypto';
import { Types } from 'mongoose';
import { LicenseKey, ILicenseKey, LicenseKeyStatus } from '../models/LicenseKey';
import { AppError } from '../utils/app-error';
import { subscriptionService, SubscriptionDescriptor } from './SubscriptionService';

// Unambiguous alphabet (no 0/O/1/I) for keys that get read aloud or typed.
const KEY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const KEY_BODY_LENGTH = 8;

function randomBody(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
  }
  return out;
}

export interface GenerateLicenseInput {
  orgId: string;
  days: number;
  plan?: string;
  note?: string;
  machineId?: string;
  expiresAt?: Date | string;
}

export class LicenseService {
  /** Issues a new single-use key for an organization. Returns the plaintext key once. */
  async generate(input: GenerateLicenseInput, actorId: string): Promise<ILicenseKey> {
    if (!Types.ObjectId.isValid(input.orgId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid organization ID');
    }
    if (!Number.isFinite(input.days) || input.days <= 0) {
      throw new AppError(422, 'INVALID_DURATION', 'License duration must be a positive number of days');
    }

    let key = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `POS-${randomBody(KEY_BODY_LENGTH)}-${input.days}D`;
      const clash = await LicenseKey.findOne({ key: candidate }).lean();
      if (!clash) {
        key = candidate;
        break;
      }
    }
    if (!key) {
      throw new AppError(500, 'LICENSE_KEY_GENERATION_FAILED', 'Could not allocate a unique license key. Please retry.');
    }

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;

    const license = await LicenseKey.create({
      key,
      orgId: new Types.ObjectId(input.orgId),
      days: input.days,
      plan: input.plan,
      status: 'ISSUED',
      issuedBy: new Types.ObjectId(actorId),
      issuedAt: new Date(),
      machineId: input.machineId,
      note: input.note,
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : undefined,
    });

    return license;
  }

  async list(orgId: string, status?: LicenseKeyStatus): Promise<any[]> {
    if (!Types.ObjectId.isValid(orgId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid organization ID');
    }
    const query: Record<string, any> = { orgId: new Types.ObjectId(orgId) };
    if (status) query.status = status;
    return LicenseKey.find(query).sort({ createdAt: -1 }).lean();
  }

  async revoke(keyId: string, actorId: string): Promise<ILicenseKey> {
    if (!Types.ObjectId.isValid(keyId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid license key ID');
    }
    const license = await LicenseKey.findById(keyId);
    if (!license) throw new AppError(404, 'LICENSE_KEY_NOT_FOUND', 'License key not found');
    if (license.status === 'REDEEMED') {
      throw new AppError(409, 'LICENSE_KEY_ALREADY_REDEEMED', 'A redeemed key cannot be revoked');
    }

    license.status = 'REVOKED';
    license.revokedBy = new Types.ObjectId(actorId);
    await license.save();
    return license;
  }

  /**
   * Redeems a key inside the caller's tenant scope. The org-scoping plugin
   * injects `orgId` into the lookup, so a user can never redeem another
   * organization's key — a cross-tenant attempt simply reads as "not found".
   */
  async redeem(
    rawKey: string,
    actorId: string,
    machineId?: string
  ): Promise<{ license: ILicenseKey; subscription: SubscriptionDescriptor }> {
    const key = (rawKey || '').trim().toUpperCase();
    if (!key) throw new AppError(422, 'INVALID_PAYLOAD', 'A license key is required');

    const license = await LicenseKey.findOne({ key });
    if (!license) {
      throw new AppError(404, 'LICENSE_KEY_NOT_FOUND', 'This license key is not valid for your organization');
    }
    if (license.status === 'REVOKED') {
      throw new AppError(410, 'LICENSE_KEY_REVOKED', 'This license key has been revoked');
    }
    if (license.status === 'REDEEMED') {
      throw new AppError(409, 'LICENSE_KEY_ALREADY_REDEEMED', 'This license key has already been used');
    }
    if (license.expiresAt && Date.now() > new Date(license.expiresAt).getTime()) {
      throw new AppError(422, 'LICENSE_KEY_EXPIRED', 'This license key has expired');
    }
    if (license.machineId && machineId && license.machineId !== machineId) {
      throw new AppError(422, 'LICENSE_KEY_MACHINE_MISMATCH', 'This license key is bound to a different machine');
    }

    const subscription = await subscriptionService.extend(
      String(license.orgId),
      license.days,
      actorId,
      { via: 'LICENSE_KEY', plan: license.plan, note: license.note }
    );

    license.status = 'REDEEMED';
    license.redeemedBy = new Types.ObjectId(actorId);
    license.redeemedAt = new Date();
    await license.save();

    return { license, subscription };
  }
}

export const licenseService = new LicenseService();
