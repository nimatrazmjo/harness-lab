import type { CreateEncounterRequest, DraftResponse, Encounter, NoteVersion, SoapNote } from "@scribe/shared-types";
import { api } from "./client";

export const encountersApi = {
  list: () => api.get<Encounter[]>("/encounters"),
  create: (body: CreateEncounterRequest) => api.post<Encounter>("/encounters", body),
  get: (id: string) => api.get<Encounter>(`/encounters/${id}`),
  updateInput: (id: string, transcript: string, templateId?: string) =>
    api.patch<Encounter>(`/encounters/${id}/input`, { transcript, templateId }),
  saveNote: (id: string, note: SoapNote) => api.post<NoteVersion>(`/encounters/${id}/notes`, { note }),
  history: (id: string) => api.get<NoteVersion[]>(`/encounters/${id}/notes`),
  getDraft: (id: string) => api.get<DraftResponse>(`/encounters/${id}/draft`),
  saveDraft: (id: string, note: SoapNote) => api.put<{ ok: true }>(`/encounters/${id}/draft`, { note }),
};
