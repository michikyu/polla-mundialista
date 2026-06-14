import { Router } from 'express';
import { computeStandings } from '../standingsCalc';

export const standingsRouter = Router();

standingsRouter.get('/', async (_req, res) => {
  res.json(await computeStandings());
});
