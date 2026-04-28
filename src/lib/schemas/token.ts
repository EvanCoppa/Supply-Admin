import { z } from 'zod';
import { optionalTrimmed } from './helpers';

export const tokenCreateSchema = z.object({
  label: optionalTrimmed
});
