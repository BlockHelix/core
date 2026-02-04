import { Request, Response } from 'express';

export async function analyzeCode(req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented' });
}
