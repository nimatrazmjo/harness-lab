import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Icd10SearchWidget } from "../Icd10SearchWidget";

const RESULTS = [{ code: "M54.5", description: "Low back pain", similarity: 0.91 }];

async function searchAndGetResult(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/icd-10 search/i), "back pain");
  await user.click(screen.getByRole("button", { name: /search/i }));
  await waitFor(() => expect(screen.getByText("M54.5")).toBeInTheDocument());
}

describe("Icd10SearchWidget: append to assessment", () => {
  it("clicking Add calls onAppend with the code and description", async () => {
    const user = userEvent.setup();
    const onAppend = vi.fn();
    render(<Icd10SearchWidget onAppend={onAppend} appendedCodes={[]} search={vi.fn().mockResolvedValue(RESULTS)} />);

    await searchAndGetResult(user);
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onAppend).toHaveBeenCalledWith({ code: "M54.5", description: "Low back pain" });
  });

  it("shows 'Added' and disables the button for a code already on the note", async () => {
    const user = userEvent.setup();
    render(
      <Icd10SearchWidget
        onAppend={vi.fn()}
        appendedCodes={[{ code: "M54.5", description: "Low back pain" }]}
        search={vi.fn().mockResolvedValue(RESULTS)}
      />,
    );

    await searchAndGetResult(user);
    const addedButton = screen.getByRole("button", { name: "Added" });
    expect(addedButton).toBeDisabled();
  });

  it("clicking Add on the same result twice does not fire onAppend twice for a disabled button", async () => {
    const user = userEvent.setup();
    const onAppend = vi.fn();
    // Simulate parent re-render after first append: appendedCodes now includes M54.5.
    const { rerender } = render(
      <Icd10SearchWidget onAppend={onAppend} appendedCodes={[]} search={vi.fn().mockResolvedValue(RESULTS)} />,
    );
    await searchAndGetResult(user);
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onAppend).toHaveBeenCalledTimes(1);

    rerender(
      <Icd10SearchWidget
        onAppend={onAppend}
        appendedCodes={[{ code: "M54.5", description: "Low back pain" }]}
        search={vi.fn().mockResolvedValue(RESULTS)}
      />,
    );
    const nowDisabled = screen.getByRole("button", { name: "Added" });
    expect(nowDisabled).toBeDisabled();
    await user.click(nowDisabled);
    expect(onAppend).toHaveBeenCalledTimes(1); // unchanged — click on a disabled button is a no-op
  });
});
