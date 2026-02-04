import { Request, Response } from 'express';

export async function generatePatch(req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented' });
}
