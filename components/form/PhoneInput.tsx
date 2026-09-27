"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { normalizePhone } from "@/lib/phone";

type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  onChange?: (value: string) => void;
};

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { onChange, value, ...props },
  ref
) {
  return (
    <input
      {...props}
      ref={ref}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      value={typeof value === "string" && value ? value : "+7"}
      onFocus={(event) => {
        if (!event.currentTarget.value) onChange?.("+7");
      }}
      onChange={(event) => onChange?.(normalizePhone(event.target.value))}
      onPaste={(event) => {
        event.preventDefault();
        onChange?.(normalizePhone(event.clipboardData.getData("text")));
      }}
    />
  );
});
