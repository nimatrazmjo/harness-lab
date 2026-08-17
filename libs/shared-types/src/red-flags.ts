import { z } from "zod";

export const RedFlagSchema = z.object({
  id: z.string(),
  term: z.string(),
  message: z.string(),
});
export type RedFlag = z.infer<typeof RedFlagSchema>;
