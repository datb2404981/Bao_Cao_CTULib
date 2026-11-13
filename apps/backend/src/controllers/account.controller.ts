import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { createStaffAccount, listAccounts, updateAccount } from '../services/account.service.js';

export const listAccountsController: RequestHandler = async (req, res, next) => {
  try { res.json({ status: 'success', data: await listAccounts(req.query) }); }
  catch (error) { next(error); }
};
export const createStaffAccountController: RequestHandler = async (req, res, next) => {
  try {
    const data = await createStaffAccount(req.body);
    res.status(201).json({ status: 'success', data });
  } catch (error) { next(error); }
};
export const updateAccountController: RequestHandler = async (req, res, next) => {
  try {
    const data = await updateAccount(req.params.id, req.body, (req as AuthenticatedRequest).user!.accountId);
    res.json({ status: 'success', data });
  } catch (error) { next(error); }
};
