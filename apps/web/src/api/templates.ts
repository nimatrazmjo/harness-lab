import type { CreateTemplateRequest, Template, UpdateTemplateRequest } from "@scribe/shared-types";
import { api } from "./client";

export const templatesApi = {
  listActive: () => api.get<Template[]>("/templates"),
  create: (body: CreateTemplateRequest) => api.post<Template>("/templates", body),
  update: (id: string, body: UpdateTemplateRequest) => api.patch<Template>(`/templates/${id}`, body),
  remove: (id: string) => api.delete<{ ok: true }>(`/templates/${id}`),
};
