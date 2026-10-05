import { useRef, useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "@/components/ui/sheet";
import { SupportBadge, TrendIndicator } from "@/components/common/domain";
import { DataTable } from "@/components/common/DataTable";
import { supportLabels } from "@/lib/labels";
import type { SupportLevel } from "@/types/api";

describe("Accessible shared components", () => {
  it.each(Object.entries(supportLabels))(
    "labels %s with text instead of color alone",
    (level, text) => {
      render(<SupportBadge level={level as SupportLevel} />);
      expect(screen.getByText(text)).toBeVisible();
    },
  );
  it("describes insufficient trend history without implying stability", () => {
    render(<TrendIndicator trend="insufficient_history" />);
    expect(screen.getByText("More history needed")).toBeVisible();
    expect(screen.queryByText("Stable")).not.toBeInTheDocument();
  });
  it("opens an accessible navigation dialog and closes on Escape", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const trigger = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={trigger} onClick={() => setOpen(true)}>
            Open navigation
          </button>
          <Sheet open={open} onOpenChange={setOpen} returnFocusRef={trigger}>
            <a href="/teacher/classes">My classes</a>
          </Sheet>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(
      screen.getByRole("dialog", { name: "Workspace navigation" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Close navigation" }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toHaveFocus();
  });
  it("paginates the roster without dropping rows", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        data={Array.from({ length: 12 }, (_, id) => ({
          name: `Student ${id + 1}`,
        }))}
        columns={[{ accessorKey: "name", header: "Student" }]}
        caption="Test roster"
      />,
    );
    expect(screen.getByText("Student 1")).toBeVisible();
    expect(screen.queryByText("Student 11")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Student 12")).toBeVisible();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("Student 1")).toBeVisible();
  });
});
