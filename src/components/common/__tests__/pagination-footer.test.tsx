import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaginationFooter } from "../pagination-footer";

const renderFooter = (overrides = {}) => {
  const setRowsPerPage = vi.fn();
  const setPage = vi.fn();

  render(
    <PaginationFooter
      page={1}
      pageCount={5}
      rowsPerPage={25}
      setRowsPerPage={setRowsPerPage}
      setPage={setPage}
      {...overrides}
    />
  );

  return { setRowsPerPage, setPage };
};

describe("PaginationFooter", () => {
  it("disables first and previous page controls on the first page", () => {
    renderFooter();

    expect(screen.getByLabelText("Go to first page")).toBeDisabled();
    expect(screen.getByLabelText("Go to previous page")).toBeDisabled();
    expect(screen.getByLabelText("Go to next page")).toBeEnabled();
    expect(screen.getByLabelText("Go to last page")).toBeEnabled();
  });

  it("navigates to the next and last pages", () => {
    const { setPage } = renderFooter({ page: 2, pageCount: 5 });

    fireEvent.click(screen.getByLabelText("Go to next page"));
    expect(setPage).toHaveBeenLastCalledWith(3);

    fireEvent.click(screen.getByLabelText("Go to last page"));
    expect(setPage).toHaveBeenLastCalledWith(5);
  });

  it("navigates to the previous and first pages", () => {
    const { setPage } = renderFooter({ page: 4, pageCount: 5 });

    fireEvent.click(screen.getByLabelText("Go to previous page"));
    expect(setPage).toHaveBeenLastCalledWith(3);

    fireEvent.click(screen.getByLabelText("Go to first page"));
    expect(setPage).toHaveBeenLastCalledWith(1);
  });

  it("disables next and last page controls on the final page", () => {
    renderFooter({ page: 5, pageCount: 5 });

    expect(screen.getByLabelText("Go to next page")).toBeDisabled();
    expect(screen.getByLabelText("Go to last page")).toBeDisabled();
  });
});
