import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import useDragAndDrop from "../useDragAndDrop";

describe("useDragAndDrop hook", () => {
  it("should initialize with isDragging as false", () => {
    const { result } = renderHook(() => useDragAndDrop());
    expect(result.current.isDragging).toBe(false);
  });

  it("should set isDragging to true on dragOver", () => {
    const { result } = renderHook(() => useDragAndDrop());

    act(() => {
      result.current.handlers.onDragOver({ preventDefault: vi.fn() });
    });

    expect(result.current.isDragging).toBe(true);
  });

  it("should set isDragging to false on dragLeave", () => {
    const { result } = renderHook(() => useDragAndDrop());

    act(() => {
      result.current.handlers.onDragOver({ preventDefault: vi.fn() });
    });
    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.handlers.onDragLeave({ preventDefault: vi.fn() });
    });

    expect(result.current.isDragging).toBe(false);
  });

  it("should set isDragging to false and call onDropCallback on drop", () => {
    const onDropCallback = vi.fn();
    const { result } = renderHook(() => useDragAndDrop(onDropCallback));

    act(() => {
      result.current.handlers.onDragOver({ preventDefault: vi.fn() });
    });

    const mockEvent = { preventDefault: vi.fn() };
    act(() => {
      result.current.handlers.onDrop(mockEvent);
    });

    expect(result.current.isDragging).toBe(false);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(onDropCallback).toHaveBeenCalledWith(mockEvent);
  });
});
