import { useEffect, useState } from "react";
import CountrySelect from "./CountrySelect";
import { getMessage } from "@/i18n/messages";

export interface StructuredAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidityChange?: (valid: boolean) => void;
  isAdmin?: boolean; // Admin編集時は必須マークを非表示にする
  readOnly?: boolean; // 読み取り専用モード
}

const computeValid = (d: {
  addressLine1?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
}) =>
  [d.addressLine1, d.city, d.state, d.country, d.zipcode].every(
    (v) => (v || "").trim() !== ""
  );

export function StructuredAddressInput({
  value,
  onChange,
  onValidityChange,
  isAdmin = false,
  readOnly = false,
}: StructuredAddressInputProps) {
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateProv, setStateProv] = useState("");
  const [country, setCountry] = useState("");
  const [zipcode, setZipcode] = useState("");

  // readOnlyモード用の共通inputクラス
  const inputBaseClass =
    "w-full px-4 py-3 border border-gray-300 rounded-lg transition-colors";
  const inputEditableClass = `${inputBaseClass} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`;
  const inputReadOnlyClass = `${inputBaseClass} bg-gray-100 text-gray-600 cursor-not-allowed`;

  // props.value -> local fields
  useEffect(() => {
    if (!value) {
      setAddressLine1("");
      setAddressLine2("");
      setCity("");
      setStateProv("");
      setCountry("");
      setZipcode("");
      onValidityChange?.(false);
      return;
    }
    try {
      const obj = JSON.parse(value);
      setAddressLine1(obj.addressLine1 ?? obj.line1 ?? "");
      setAddressLine2(obj.addressLine2 ?? obj.line2 ?? "");
      setCity(obj.city ?? "");
      setStateProv(obj.state ?? obj.province ?? "");
      setCountry(obj.country ?? obj.countryCode ?? "");
      setZipcode(obj.zipcode ?? obj.postalCode ?? "");
      onValidityChange?.(
        computeValid({
          addressLine1: obj.addressLine1 ?? obj.line1 ?? "",
          city: obj.city ?? "",
          state: obj.state ?? obj.province ?? "",
          country: obj.country ?? obj.countryCode ?? "",
          zipcode: obj.zipcode ?? obj.postalCode ?? "",
        })
      );
    } catch {
      // fallback: treat plain text as line1
      setAddressLine1(value);
      setAddressLine2("");
      setCity("");
      setStateProv("");
      setCountry("");
      setZipcode("");
      onValidityChange?.(
        computeValid({
          addressLine1: value,
          city: "",
          state: "",
          country: "",
          zipcode: "",
        })
      );
    }
  }, [value, onValidityChange]);

  const buildAndSetAddress = (
    override?: Partial<{
      addressLine1: string;
      addressLine2: string;
      city: string;
      stateProv: string;
      country: string;
      zipcode: string;
    }>
  ) => {
    type Merged = Partial<
      Record<
        | "addressLine1"
        | "addressLine2"
        | "city"
        | "stateProv"
        | "country"
        | "zipcode",
        string
      >
    >;

    const merged: Merged = {
      addressLine1,
      addressLine2,
      city,
      stateProv,
      country,
      zipcode,
      ...(override || {}),
    };

    // Normalize into the canonical shape we store as JSON
    const data = {
      addressLine1: merged.addressLine1 ?? "",
      addressLine2: merged.addressLine2 ?? "",
      city: merged.city ?? "",
      state: merged.stateProv ?? stateProv,
      country: merged.country ?? "",
      zipcode: merged.zipcode ?? "",
    };

    const valid = computeValid(data);

    onChange(JSON.stringify(data));
    onValidityChange?.(valid);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="address-line1" className="text-sm text-gray-700">
          {getMessage("addressLine1")}
          {!isAdmin && !readOnly && <span className="text-red-500">*</span>}
        </label>
        <input
          id="address-line1"
          type="text"
          required={!isAdmin && !readOnly}
          value={addressLine1}
          onChange={(e) => {
            const v = e.target.value;
            setAddressLine1(v);
            buildAndSetAddress({ addressLine1: v });
          }}
          disabled={readOnly}
          className={readOnly ? inputReadOnlyClass : inputEditableClass}
          placeholder={getMessage("addressLine1Placeholder") as string}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="address-line2" className="text-sm text-gray-700">
          {getMessage("addressLine2")}
        </label>
        <input
          id="address-line2"
          type="text"
          value={addressLine2}
          onChange={(e) => {
            const v = e.target.value;
            setAddressLine2(v);
            buildAndSetAddress({ addressLine2: v });
          }}
          disabled={readOnly}
          className={readOnly ? inputReadOnlyClass : inputEditableClass}
          placeholder={getMessage("addressLine2Placeholder") as string}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="address-city" className="text-sm text-gray-700">
            {getMessage("city")}
            {!isAdmin && !readOnly && <span className="text-red-500">*</span>}
          </label>
          <input
            id="address-city"
            type="text"
            required={!isAdmin && !readOnly}
            value={city}
            onChange={(e) => {
              const v = e.target.value;
              setCity(v);
              buildAndSetAddress({ city: v });
            }}
            disabled={readOnly}
            className={readOnly ? inputReadOnlyClass : inputEditableClass}
            placeholder={getMessage("city") as string}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="address-state" className="text-sm text-gray-700">
            {getMessage("state")}
            {!isAdmin && !readOnly && <span className="text-red-500">*</span>}
          </label>
          <input
            id="address-state"
            type="text"
            required={!isAdmin && !readOnly}
            value={stateProv}
            onChange={(e) => {
              const v = e.target.value;
              setStateProv(v);
              buildAndSetAddress({ stateProv: v });
            }}
            disabled={readOnly}
            className={readOnly ? inputReadOnlyClass : inputEditableClass}
            placeholder={getMessage("state") as string}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm text-gray-700">
            {getMessage("country")}
            {!isAdmin && !readOnly && <span className="text-red-500">*</span>}
          </label>
          <CountrySelect
            value={country}
            onChange={(label) => {
              setCountry(label);
              buildAndSetAddress({ country: label });
            }}
            placeholder={getMessage("countryPlaceholder") as string}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="address-zipcode" className="text-sm text-gray-700">
            {getMessage("zipcode")}
            {!isAdmin && !readOnly && <span className="text-red-500">*</span>}
          </label>
          <input
            id="address-zipcode"
            type="text"
            required={!isAdmin && !readOnly}
            value={zipcode}
            onChange={(e) => {
              const v = e.target.value;
              setZipcode(v);
              buildAndSetAddress({ zipcode: v });
            }}
            disabled={readOnly}
            className={readOnly ? inputReadOnlyClass : inputEditableClass}
            placeholder={getMessage("zipcode") as string}
          />
        </div>
      </div>
    </div>
  );
}

export default StructuredAddressInput;
