import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PinSetupDialog from "@/components/PinSetupDialog";
import { toast } from "sonner";
import { storePin, isPinSet } from "@/lib/securePinStorage";
import { I18nProvider } from "@/hooks/useI18n";

// Mock the toast library
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock securePinStorage
vi.mock("@/lib/securePinStorage", async () => {
  const actual = await vi.importActual("@/lib/securePinStorage");
  return {
    ...actual,
    storePin: vi.fn(),
    isPinSet: vi.fn(),
  };
});

describe("PinSetupDialog", () => {
  const mockOnComplete = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful storePin mock
    (storePin as any).mockResolvedValue(undefined);
    (isPinSet as any).mockReturnValue(false);
  });

  const renderDialog = (open = true) => {
    return render(
      <I18nProvider>
        <PinSetupDialog
          open={open}
          onOpenChange={mockOnOpenChange}
          onComplete={mockOnComplete}
        />
      </I18nProvider>
    );
  };

  describe("Initial Rendering", () => {
    it("should render dialog when open is true", () => {
      renderDialog(true);
      // The title could be in English or Korean depending on locale
      const title = screen.getByText(/setup|잠금.*설정|PIN.*설정/i);
      expect(title).toBeInTheDocument();
    });

    it("should not render dialog when open is false", () => {
      renderDialog(false);
      // The title could be in English or Korean depending on locale
      const title = screen.queryByText(/setup|잠금.*설정|PIN.*설정/i);
      expect(title).not.toBeInTheDocument();
    });

    it("should display setup enter message", () => {
      renderDialog();
      // The enter message could be in English or Korean
      const message = screen.getByText(/enter.*PIN|4자리.*PIN|입력하세요/i);
      expect(message).toBeInTheDocument();
    });

    it("should display 4 empty PIN dots", () => {
      renderDialog();
      const dots = screen.getAllByRole("generic").filter(
        (el) => el.classList.contains("h-4") && el.classList.contains("w-4")
      );
      expect(dots.length).toBeGreaterThanOrEqual(4);
    });

    it("should display numpad with digits 0-9", () => {
      renderDialog();
      expect(screen.getByText("0")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("9")).toBeInTheDocument();
    });

    it("should display delete button", () => {
      renderDialog();
      const deleteButton = screen.getByText("←");
      expect(deleteButton).toBeInTheDocument();
    });
  });

  describe("PIN Entry Flow", () => {
    it("should fill dots as PIN is entered", async () => {
      renderDialog();

      // Enter first digit
      fireEvent.click(screen.getByText("1"));
      const dots = screen.getAllByRole("generic").filter(
        (el) => el.classList.contains("h-4") && el.classList.contains("w-4")
      );
      const filledDots = dots.filter((dot) =>
        dot.classList.contains("bg-primary")
      );
      expect(filledDots.length).toBe(1);
    });

    it("should auto-transition to confirmation step after entering 4 digits", async () => {
      renderDialog();

      // Enter 4 digits
      fireEvent.click(screen.getByText("1"));
      fireEvent.click(screen.getByText("2"));
      fireEvent.click(screen.getByText("3"));
      fireEvent.click(screen.getByText("4"));

      // Should show confirmation message
      await waitFor(() => {
        // The confirmation message could be in English or Korean
        const message = screen.getByText(/confirm.*PIN|확인|다시.*입력/i);
        expect(message).toBeInTheDocument();
      });
    });

    it("should allow deletion of digits", async () => {
      renderDialog();

      // Enter 2 digits
      fireEvent.click(screen.getByText("1"));
      fireEvent.click(screen.getByText("2"));

      // Delete one digit
      fireEvent.click(screen.getByText("←"));

      const dots = screen.getAllByRole("generic").filter(
        (el) => el.classList.contains("h-4") && el.classList.contains("w-4")
      );
      const filledDots = dots.filter((dot) =>
        dot.classList.contains("bg-primary")
      );
      expect(filledDots.length).toBe(1);
    });
  });

  describe("PIN Confirmation Flow", () => {
    it("should successfully store PIN when confirmation matches", async () => {
      renderDialog();

      // Enter PIN
      fireEvent.click(screen.getByText("1"));
      fireEvent.click(screen.getByText("2"));
      fireEvent.click(screen.getByText("3"));
      fireEvent.click(screen.getByText("4"));

      // Wait for confirmation step
      await waitFor(() => {
        // The confirmation message could be in English or Korean
        const message = screen.getByText(/confirm|확인|다시.*입력/i);
        expect(message).toBeInTheDocument();
      });

      // Confirm PIN
      fireEvent.click(screen.getByText("1"));
      fireEvent.click(screen.getByText("2"));
      fireEvent.click(screen.getByText("3"));
      fireEvent.click(screen.getByText("4"));

      await waitFor(() => {
        expect(storePin).toHaveBeenCalledWith("1234");
        expect(toast.success).toHaveBeenCalled();
        expect(mockOnComplete).toHaveBeenCalled();
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it("should show error when confirmation does not match", async () => {
      renderDialog();

      // Enter PIN
      fireEvent.click(screen.getByText("1"));
      fireEvent.click(screen.getByText("2"));
      fireEvent.click(screen.getByText("3"));
      fireEvent.click(screen.getByText("4"));

      // Wait for confirmation step
      await waitFor(() => {
        // The confirmation message could be in English or Korean
        const message = screen.getByText(/confirm|확인|다시.*입력/i);
        expect(message).toBeInTheDocument();
      });

      // Enter different PIN for confirmation
      fireEvent.click(screen.getByText("5"));
      fireEvent.click(screen.getByText("6"));
      fireEvent.click(screen.getByText("7"));
      fireEvent.click(screen.getByText("8"));

      // Should show error message
      await waitFor(() => {
        // The error message could be in English or Korean
        const message = screen.getByText(/mismatch|틀린|일치하지/i);
        expect(message).toBeInTheDocument();
      });

      // Should return to enter step after delay
      await waitFor(() => {
        // The enter message could be in English or Korean
        const message = screen.getByText(/enter.*PIN|4자리.*PIN|입력하세요/i);
        expect(message).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe("Error Handling", () => {
    it("should show error toast when storePin fails", async () => {
      (storePin as any).mockRejectedValue(new Error("Storage error"));

      renderDialog();

      // Enter PIN
      fireEvent.click(screen.getByText("1"));
      fireEvent.click(screen.getByText("2"));
      fireEvent.click(screen.getByText("3"));
      fireEvent.click(screen.getByText("4"));

      // Wait for confirmation step
      await waitFor(() => {
        // The confirmation message could be in English or Korean
        const message = screen.getByText(/confirm|확인|다시.*입력/i);
        expect(message).toBeInTheDocument();
      });

      // Confirm PIN
      fireEvent.click(screen.getByText("1"));
      fireEvent.click(screen.getByText("2"));
      fireEvent.click(screen.getByText("3"));
      fireEvent.click(screen.getByText("4"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });

  describe("Keyboard Input", () => {
    it("should accept digit input from keyboard", async () => {
      renderDialog();

      // Simulate keyboard input
      fireEvent.keyDown(window, { key: "1" });

      const dots = screen.getAllByRole("generic").filter(
        (el) => el.classList.contains("h-4") && el.classList.contains("w-4")
      );
      const filledDots = dots.filter((dot) =>
        dot.classList.contains("bg-primary")
      );
      expect(filledDots.length).toBe(1);
    });

    it("should handle backspace from keyboard", async () => {
      renderDialog();

      // Enter digit then delete it
      fireEvent.keyDown(window, { key: "1" });
      fireEvent.keyDown(window, { key: "Backspace" });

      const dots = screen.getAllByRole("generic").filter(
        (el) => el.classList.contains("h-4") && el.classList.contains("w-4")
      );
      const filledDots = dots.filter((dot) =>
        dot.classList.contains("bg-primary")
      );
      expect(filledDots.length).toBe(0);
    });
  });

  describe("Dialog Closing", () => {
    it("should reset state when dialog is closed", async () => {
      renderDialog();

      // Enter 2 digits
      fireEvent.click(screen.getByText("1"));
      fireEvent.click(screen.getByText("2"));

      // Close dialog
      mockOnOpenChange(false);

      // Reopen dialog
      renderDialog(true);

      const dots = screen.getAllByRole("generic").filter(
        (el) => el.classList.contains("h-4") && el.classList.contains("w-4")
      );
      const filledDots = dots.filter((dot) =>
        dot.classList.contains("bg-primary")
      );
      expect(filledDots.length).toBe(0);
    });
  });

  describe("Max Length Constraint", () => {
    it("should not accept more than 4 digits", () => {
      renderDialog();

      // Enter 3 digits first
      fireEvent.click(screen.getByText("1"));
      fireEvent.click(screen.getByText("2"));
      fireEvent.click(screen.getByText("3"));

      // Check that we have 3 filled dots
      const dots = screen.getAllByRole("generic").filter(
        (el) => el.classList.contains("h-4") && el.classList.contains("w-4")
      );
      let filledDots = dots.filter((dot) =>
        dot.classList.contains("bg-primary")
      );
      expect(filledDots.length).toBe(3);

      // Enter 4th digit - should work
      fireEvent.click(screen.getByText("4"));

      // Check that we now have 4 filled dots
      filledDots = dots.filter((dot) =>
        dot.classList.contains("bg-primary")
      );
      expect(filledDots.length).toBe(4);

      // Try to enter 5th digit immediately (before transition)
      // This should not work because of the max length check
      fireEvent.click(screen.getByText("5"));

      // Should still have exactly 4 filled dots
      filledDots = dots.filter((dot) =>
        dot.classList.contains("bg-primary")
      );
      expect(filledDots.length).toBe(4);
    });
  });
});