import type { Template } from "@scribe/shared-types";
import { api } from "./client";

export const templatesApi = {
  listActive: () => api.get<Template[]>("/templates"),
};
