import mongoose, { Types } from 'mongoose';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { AppError } from '../utils/app-error';
import { CreateUserInput, UpdateUserInput } from '../validators/user.validators';

export interface UserListItem {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: { id: string; name: string; displayName: string };
  isActive: boolean;
  terminalLocked: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface PaginatedUsers {
  users: UserListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class UserService {
  async listUsers(options: {
    page?: number;
    limit?: number;
    search?: string;
    roleId?: string;
    isActive?: boolean;
  }): Promise<PaginatedUsers> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (options.search) {
      const regex = new RegExp(options.search, 'i');
      filter.$or = [{ username: regex }, { fullName: regex }, { email: regex }, { phone: regex }];
    }
    if (options.roleId) filter.roleId = options.roleId;
    if (options.isActive !== undefined) filter.isActive = options.isActive;

    const [users, total] = await Promise.all([
      User.find(filter)
        .populate<{ roleId: any }>('roleId', 'name displayName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const formatted: UserListItem[] = users.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      role: {
        id: u.roleId?._id?.toString() || '',
        name: u.roleId?.name || '',
        displayName: u.roleId?.displayName || '',
      },
      isActive: u.isActive,
      terminalLocked: u.terminalLocked,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));

    return {
      users: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createUser(data: CreateUserInput): Promise<UserListItem> {
    // Check for existing username, email, phone
    const exists = await User.findOne({
      $or: [{ username: data.username.toLowerCase() }, { email: data.email.toLowerCase() }, { phone: data.phone }],
    });
    if (exists) {
      const field =
        exists.username === data.username.toLowerCase()
          ? 'Username'
          : exists.email === data.email.toLowerCase()
          ? 'Email'
          : 'Phone';
      throw new AppError(409, 'DUPLICATE_USER', `${field} already exists`);
    }

    const role = await Role.findById(data.roleId);
    if (!role) throw new AppError(404, 'ROLE_NOT_FOUND', 'Assigned role not found');

    const user = new User({
      username: data.username.toLowerCase(),
      fullName: data.fullName,
      email: data.email.toLowerCase(),
      phone: data.phone,
      passwordHash: data.password, // bcrypt pre-save hook handles hashing
      pinHash: data.pin,           // bcrypt pre-save hook handles hashing
      roleId: role._id,
      isActive: true,
      terminalLocked: false,
    });

    await user.save();

    return {
      id: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: { id: role._id.toString(), name: role.name, displayName: role.displayName },
      isActive: user.isActive,
      terminalLocked: user.terminalLocked,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  async getUserById(id: string): Promise<UserListItem> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid user ID');

    const user = await User.findById(id).populate<{ roleId: any }>('roleId', 'name displayName');
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    return {
      id: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: {
        id: user.roleId?._id?.toString() || '',
        name: user.roleId?.name || '',
        displayName: user.roleId?.displayName || '',
      },
      isActive: user.isActive,
      terminalLocked: user.terminalLocked,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  async updateUser(id: string, data: UpdateUserInput, requestingUserId: string): Promise<UserListItem> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid user ID');

    const user = await User.findById(id);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    if (data.roleId) {
      const role = await Role.findById(data.roleId);
      if (!role) throw new AppError(404, 'ROLE_NOT_FOUND', 'Assigned role not found');
      user.roleId = role._id as Types.ObjectId;
    }

    if (data.fullName) user.fullName = data.fullName;
    if (data.email) user.email = data.email.toLowerCase();
    if (data.phone) user.phone = data.phone;
    if (data.isActive !== undefined) user.isActive = data.isActive;
    if (data.password) user.passwordHash = data.password; // Pre-save hook re-hashes

    await user.save();
    return this.getUserById(id);
  }

  async deactivateUser(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid user ID');
    const result = await User.findByIdAndUpdate(id, { isActive: false });
    if (!result) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  async updatePin(id: string, pin: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid user ID');
    const user = await User.findById(id);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    user.pinHash = pin; // Pre-save hook re-hashes
    await user.save();
  }
}

export const userService = new UserService();
