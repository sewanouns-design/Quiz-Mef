"use client";

import { useState } from "react";
import {
  PHONE_COUNTRIES,
  isValidLocalNumber,
  splitPhoneValue,
  type PhoneCountry,
} from "@/lib/phone-countries";

export default function PhoneInput({
  initialValue,
  onChange,
  id,
}: {
  initialValue: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const initial = splitPhoneValue(initialValue);
  const [country, setCountry] = useState<PhoneCountry>(initial.country);
  const [local, setLocal] = useState(initial.local);

  function emit(nextCountry: PhoneCountry, nextLocal: string) {
    onChange(nextLocal ? `${nextCountry.code}${nextLocal}` : "");
  }

  function handleCountryChange(code: string) {
    const next = PHONE_COUNTRIES.find((c) => c.code === code) ?? PHONE_COUNTRIES[0];
    setCountry(next);
    emit(next, local);
  }

  function handleLocalChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, country.maxLocalDigits);
    setLocal(digits);
    emit(country, digits);
  }

  const valid = isValidLocalNumber(country, local);

  return (
    <div>
      <div className="flex gap-2">
        <select
          value={country.code}
          onChange={(e) => handleCountryChange(e.target.value)}
          aria-label="Indicatif du pays"
          className="input-field w-[90px] shrink-0 px-1 text-center text-sm"
        >
          {PHONE_COUNTRIES.map((c) => (
            <option key={`${c.code}-${c.name}`} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          className="input-field flex-1"
          value={country.formatLocal ? country.formatLocal(local) : local}
          onChange={(e) => handleLocalChange(e.target.value)}
          placeholder={country.placeholder}
        />
      </div>
      {local.length > 0 && !valid && (
        <p className="mt-1 text-xs font-medium text-red-500">
          Format attendu : {country.placeholder}
        </p>
      )}
    </div>
  );
}
