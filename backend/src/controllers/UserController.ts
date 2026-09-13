import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/UserService';
import { sendSuccess } from '../utils/api-response';

export class UserController {
  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, search, roleId, isActive } = req.query;
      const result = await userService.listUsers({
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        search: search as string | undefined,
        roleId: roleId as string | undefined,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
      });

      sendSuccess(res, 200, 'Users retrieved successfully', result.users, {
        page: result.page,
        limit: result.limit,
        totalItems: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.createUser(req.body);
      sendSuccess(res, 201, 'User created successfully', user);
    } catch (error) {
      next(error);
    }
  }

  async getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getUserById(req.user!.userId);
      sendSuccess(res, 200, 'Profile retrieved successfully', user);
    } catch (error) {
      next(error);
    }
  }

  async updateMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fullName, avatarUrl } = req.body;
      const user = await userService.updateOwnProfile(req.user!.userId, { fullName, avatarUrl });
      sendSuccess(res, 200, 'Profile updated successfully', user);
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getUserById(req.params.id);
      sendSuccess(res, 200, 'User retrieved successfully', user);
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.updateUser(req.params.id, req.body, req.user!.userId);
      sendSuccess(res, 200, 'User updated successfully', user);
    } catch (error) {
      next(error);
    }
  }

  async deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.deactivateUser(req.params.id);
      sendSuccess(res, 200, 'User deactivated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updatePin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.updatePin(req.params.id, req.body.pin);
      sendSuccess(res, 200, 'Cashier PIN updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
