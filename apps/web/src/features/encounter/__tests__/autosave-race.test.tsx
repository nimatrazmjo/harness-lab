import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Encounter } from "@scribe/shared-types";
import { EncounterWorkspacePage } from "../EncounterWorkspacePage";

const mockGet = vi.fn();
const mockUpdateInput = vi.fn();
const mockGetRedFlags = vi.fn();
const mockGetDraft = vi.fn();
const mockHistory = vi.fn();
const mockSaveDraft = vi.fn();

vi.mock("../../../api/encounters", () => ({
  encountersApi: {
    get: (...args: unknown[]) => mockGet(...args),
    updateInput: (...args: unknown[]) => mockUpdateInput(...args),
    getRedFlags: (...args: unknown[]) => mockGetRedFlags(...args),
    getDraft: (...args: unknown[]) => mockGetDraft(...args),
    history: (...args: unknown[]) => mockHistory(...args),
    saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
    saveNote: vi.fn(),
  },
}));

vi.mock("../../../api/templates", () => ({
  templatesApi: { listActive: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../api/scribe-stream", () => ({
  streamScribeGeneration: vi.fn(),
}));

const ENCOUNTER: Encounter = {
  id: "e1",
  providerId: "p1",
  patientId: "pt1",
  templateId: null,
  status: "draft",
  transcript: "",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={["/encounters/e1"]}>
      <Routes>
        <Route path="/encounters/:encounterId" element={<EncounterWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("EncounterWorkspacePage autosave race guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGet.mockResolvedValue(ENCOUNTER);
    mockGetDraft.mockResolvedValue({ note: null });
    mockHistory.mockResolvedValue([]);
    mockSaveDraft.mockResolvedValue({ ok: true });
    mockUpdateInput.mockReset();
    mockGetRedFlags.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never sends a second /input PATCH until the first one has settled", async () => {
    mockGetRedFlags.mockResolvedValue([]); // mount-time call
    let resolveFirst: (() => void) | undefined;
    mockUpdateInput.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = () => resolve(ENCOUNTER);
        }),
    );
    mockUpdateInput.mockResolvedValueOnce(ENCOUNTER);

    renderWorkspace();
    await flush();

    const textarea = screen.getByLabelText(/encounter transcript/i);

    fireEvent.change(textarea, { target: { value: "A" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(mockUpdateInput).toHaveBeenCalledTimes(1);

    // Second edit, debounced again — its timer fires while the first PATCH is still pending.
    fireEvent.change(textarea, { target: { value: "AB" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    // The second call must NOT have been dispatched yet — only one PATCH may be in flight.
    expect(mockUpdateInput).toHaveBeenCalledTimes(1);

    // Settle the first PATCH; the queued second one should now go out.
    await act(async () => {
      resolveFirst?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockUpdateInput).toHaveBeenCalledTimes(2);
    expect(mockUpdateInput.mock.calls[0][1]).toBe("A");
    expect(mockUpdateInput.mock.calls[1][1]).toBe("AB");
  });

  it("never lets a stale red-flags response overwrite a fresher one", async () => {
    mockGetRedFlags.mockResolvedValueOnce([]); // mount-time call
    mockUpdateInput.mockResolvedValue(ENCOUNTER);

    let resolveStale: ((v: unknown) => void) | undefined;
    let resolveFresh: ((v: unknown) => void) | undefined;
    mockGetRedFlags.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
    );
    mockGetRedFlags.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFresh = resolve;
        }),
    );

    renderWorkspace();
    await flush();

    const textarea = screen.getByLabelText(/encounter transcript/i);

    fireEvent.change(textarea, { target: { value: "A" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    fireEvent.change(textarea, { target: { value: "AB" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    // Both /input PATCHes (and thus both getRedFlags calls) have now been queued/sent in order.
    // Resolve the FRESH (second) red-flags response first, then the STALE (first) one late —
    // simulating a slow first response arriving after a fast second one.
    await act(async () => {
      resolveFresh?.([{ id: "fresh", term: "fresh", message: "fresh flag" }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("fresh flag")).toBeInTheDocument();

    await act(async () => {
      resolveStale?.([{ id: "stale", term: "stale", message: "stale flag" }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    // The stale response must be ignored — the banner still shows only the fresh flag.
    expect(screen.queryByText("stale flag")).not.toBeInTheDocument();
    expect(screen.getByText("fresh flag")).toBeInTheDocument();
  });

  it("never lets a slow mount-time red-flags fetch overwrite a fresher edit-triggered one", async () => {
    let resolveMount: ((v: unknown) => void) | undefined;
    mockGetRedFlags.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMount = resolve;
        }),
    );
    mockGetRedFlags.mockResolvedValueOnce([{ id: "edit", term: "edit", message: "edit flag" }]);
    mockUpdateInput.mockResolvedValue(ENCOUNTER);

    renderWorkspace();
    await flush();

    const textarea = screen.getByLabelText(/encounter transcript/i);
    fireEvent.change(textarea, { target: { value: "A" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    // The edit-triggered fetch (seq 1) has resolved and rendered its flag.
    expect(screen.getByText("edit flag")).toBeInTheDocument();

    // The slow mount fetch (seq 0) finally resolves — it must not clobber the newer state.
    await act(async () => {
      resolveMount?.([{ id: "mount", term: "mount", message: "mount flag" }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByText("mount flag")).not.toBeInTheDocument();
    expect(screen.getByText("edit flag")).toBeInTheDocument();
  });
});
