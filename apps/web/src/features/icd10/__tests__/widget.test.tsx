import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Icd10SearchWidget } from "../Icd10SearchWidget";

const RESULTS = [
  { code: "M54.5", description: "Low back pain", similarity: 0.91 },
  { code: "M54.2", description: "Cervicalgia", similarity: 0.62 },
];

describe("Icd10SearchWidget", () => {
  it("accepts plain-English input and shows ranked results with code + description", async () => {
    const user = userEvent.setup();
    const search = vi.fn().mockResolvedValue(RESULTS);
    render(<Icd10SearchWidget onAppend={vi.fn()} appendedCodes={[]} search={search} />);

    await user.type(screen.getByLabelText(/icd-10 search/i), "low back pain");
    await user.click(screen.getByRole("button", { name: /search/i }));

    expect(search).toHaveBeenCalledWith("low back pain");
    await waitFor(() => expect(screen.getByText("M54.5")).toBeInTheDocument());
    expect(screen.getByText("Low back pain")).toBeInTheDocument();
    expect(screen.getByText("M54.2")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    const search = vi.fn().mockResolvedValue([]);
    render(<Icd10SearchWidget onAppend={vi.fn()} appendedCodes={[]} search={search} />);

    await user.type(screen.getByLabelText(/icd-10 search/i), "xyzzy nonsense query");
    await user.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() => expect(screen.getByText(/no matches found/i)).toBeInTheDocument());
  });

  it("does not search on an empty/whitespace-only query", async () => {
    const user = userEvent.setup();
    const search = vi.fn();
    render(<Icd10SearchWidget onAppend={vi.fn()} appendedCodes={[]} search={search} />);

    await user.type(screen.getByLabelText(/icd-10 search/i), "   ");
    expect(screen.getByRole("button", { name: /search/i })).toBeDisabled();
    expect(search).not.toHaveBeenCalled();
  });

  it("shows a graceful error if the search fails", async () => {
    const user = userEvent.setup();
    const search = vi.fn().mockRejectedValue(new Error("network error"));
    render(<Icd10SearchWidget onAppend={vi.fn()} appendedCodes={[]} search={search} />);

    await user.type(screen.getByLabelText(/icd-10 search/i), "back pain");
    await user.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/search failed/i));
  });
});
