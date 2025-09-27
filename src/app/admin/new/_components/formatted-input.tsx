
'use client';

import { Input } from "@/components/ui/input";
import React from "react";

interface FormattedInputProps {
  value: string;
  onChange: (val: string) => void;
  // Accept any other input props
  [key: string]: any;
}

// Helper to format the number with spaces
const formatNumber = (numStr: string): string => {
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

// Helper to remove formatting
const unformatNumber = (formattedStr: string): string => {
  return formattedStr.replace(/\s/g, "");
};

export function FormattedInput({ value, onChange, ...props }: FormattedInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = unformatNumber(e.target.value);

    if (/^\d*$/.test(rawValue)) {
      onChange(rawValue);
    }
  };

  const displayValue = formatNumber(value);

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      {...props} // сюда попадёт disabled, placeholder и любые другие атрибуты
    />
  );
}