import { getMessage } from "@/i18n/messages";
import StructuredAddressInput from "@/pages/components/StructuredAddressInput";
import type { InputHTMLAttributes } from "react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { parseAddressFields } from "../roompage/utils/formValidation";
import { BasicCheckInOutDate } from "./BasicCheckInOutDate";
import CountrySelect from "./CountrySelect";

type BasicInfoFormProps = {
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  occupation: string;
  setOccupation: (v: string) => void;
  nationality: string;
  setNationality: (v: string) => void;
  checkInDate: Date | null;
  setCheckInDate: (v: Date | null) => void;
  checkOutDate: Date | null;
  setCheckOutDate: (v: Date | null) => void;
  promoConsent: boolean;
  setPromoConsent: (v: boolean) => void;
  isInfoComplete: boolean;
  onNext: () => void;
  isRepresentativeFamily?: boolean;
  hasRoomCheckDates?: boolean;
  isAdmin?: boolean; // Admin編集時は必須項目チェックをスキップし、必須マークを非表示にする
  readOnly?: boolean; // 読み取り専用モード（pending/approved/rejected時）
  statusMessage?: string; // ステータスメッセージ（readOnly時に表示）
};

function CustomPhoneInput(
  props: Readonly<InputHTMLAttributes<HTMLInputElement>>,
) {
  return (
    <input
      {...props}
      className="w-full px-2 py-2 border-none focus:ring-0 focus:outline-none text-base"
      style={{ fontSize: "inherit", height: "auto" }}
    />
  );
}

/**
 * 住所の不足フィールドを取得
 */
function getAddressMissingFields(address: string): string[] {
  const fields: string[] = [];
  const parsedAddress = parseAddressFields(address);

  if (!parsedAddress) {
    fields.push(
      getMessage("addressLine1") as string,
      getMessage("city") as string,
      getMessage("state") as string,
      getMessage("country") as string,
      getMessage("zipcode") as string,
    );
    return fields;
  }

  if (!parsedAddress.addressLine1.trim()) {
    fields.push(getMessage("addressLine1") as string);
  }
  if (!parsedAddress.city.trim()) {
    fields.push(getMessage("city") as string);
  }
  if (!parsedAddress.state.trim()) {
    fields.push(getMessage("state") as string);
  }
  if (!parsedAddress.country.trim()) {
    fields.push(getMessage("country") as string);
  }
  if (!parsedAddress.zipcode.trim()) {
    fields.push(getMessage("zipcode") as string);
  }

  return fields;
}

/**
 * 不足フィールドを計算
 */
type ComputeMissingFieldsParams = {
  isRepresentativeFamily: boolean;
  name: string;
  email: string;
  address: string;
  phone: string;
  occupation: string;
  nationality: string;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  hasRoomCheckDates: boolean;
};

function computeMissingFields({
  isRepresentativeFamily,
  name,
  email,
  address,
  phone,
  occupation,
  nationality,
  checkInDate,
  checkOutDate,
  hasRoomCheckDates,
}: ComputeMissingFieldsParams): string[] {
  if (isRepresentativeFamily) {
    return name.trim() ? [] : [getMessage("name") as string];
  }

  const fields: string[] = [];
  if (!name.trim()) fields.push(getMessage("name") as string);
  if (!email.trim()) fields.push(getMessage("email") as string);
  fields.push(...getAddressMissingFields(address));
  if (!phone.trim()) fields.push(getMessage("phone") as string);
  if (!occupation.trim()) fields.push(getMessage("occupation") as string);
  if (!nationality.trim()) fields.push(getMessage("nationality") as string);
  if (!hasRoomCheckDates) {
    if (!checkInDate) fields.push(getMessage("checkInDate") as string);
    if (!checkOutDate) fields.push(getMessage("checkOutDate") as string);
  }
  return fields;
}

/**
 * 必須マーク表示用コンポーネント
 */
function RequiredMark({ show }: Readonly<{ show: boolean }>) {
  if (!show) return null;
  return <span className="text-red-500">*</span>;
}

export default function BasicInfoForm(props: Readonly<BasicInfoFormProps>) {
  const {
    name,
    setName,
    email,
    setEmail,
    address,
    setAddress,
    phone,
    setPhone,
    occupation,
    setOccupation,
    nationality,
    setNationality,
    checkInDate,
    setCheckInDate,
    checkOutDate,
    setCheckOutDate,
    promoConsent,
    setPromoConsent,
    isInfoComplete,
    onNext,
    isRepresentativeFamily = false,
    hasRoomCheckDates = false,
    isAdmin = false,
    readOnly = false,
    statusMessage,
  } = props;

  const phoneError =
    phone && !isValidPhoneNumber(phone) ? getMessage("phoneValidation") : "";
  const emailError =
    email && !/^[^\s@]{1,255}@[^\s@]{1,255}\.[^\s@]{1,255}$/.test(email)
      ? getMessage("emailValidation")
      : "";

  // 不足している項目のリスト
  const missingFields = computeMissingFields({
    isRepresentativeFamily,
    name,
    email,
    address,
    phone,
    occupation,
    nationality,
    checkInDate,
    checkOutDate,
    hasRoomCheckDates,
  });

  // 条件の事前計算
  const isEditable = !isAdmin && !readOnly;
  const showRequiredMark = isEditable;
  const showHeader = !isAdmin && !readOnly;
  const showStatusMessage = readOnly && statusMessage;
  const showFamilyMessage = isRepresentativeFamily && !readOnly;
  const showPromoConsent = !isAdmin && !readOnly;
  const showNonFamilyFields = !isRepresentativeFamily;
  const showDateFields = !hasRoomCheckDates;
  const showNextButton = !isAdmin && !readOnly;
  const showMissingFields = !isInfoComplete && missingFields.length > 0;

  // readOnlyモード用の共通inputクラス
  const inputBaseClass =
    "w-full px-4 py-3 border border-gray-300 rounded-lg transition-colors";
  const inputEditableClass = `${inputBaseClass} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`;
  const inputReadOnlyClass = `${inputBaseClass} bg-gray-100 text-gray-600 cursor-not-allowed`;
  const inputClass = readOnly ? inputReadOnlyClass : inputEditableClass;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {showHeader && (
        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          {getMessage("enterBasicInfo")}
        </h2>
      )}

      {/* readOnlyモード時のステータスメッセージ */}
      {showStatusMessage && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-medium text-yellow-800">{statusMessage}</p>
        </div>
      )}

      {/* 家族の場合は案内メッセージを表示 */}
      {showFamilyMessage && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            {getMessage("familyRegistrationMessage")}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* 名前 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getMessage("name")}
            <RequiredMark show={showRequiredMark} />
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={readOnly}
            className={inputClass}
            placeholder={getMessage("namePlaceholder") as string}
          />
        </div>

        {/* 代表者の家族でない場合のみ、以下の項目を表示 */}
        {showNonFamilyFields && (
          <>
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getMessage("email")}
                <RequiredMark show={showRequiredMark} />
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={readOnly}
                className={inputClass}
                placeholder="sample@example.com"
                required={isEditable}
              />
              {!readOnly && emailError && (
                <p className="mt-2 text-sm text-red-600">{emailError}</p>
              )}
            </div>

            {/* プロモーション同意（isAdminがfalseかつreadOnlyがfalseの場合のみ表示） */}
            {showPromoConsent && (
              <div
                className={
                  `rounded-md border border-gray-200 px-3 py-2 ` +
                  (promoConsent ? "bg-green-50" : "bg-gray-50")
                }
              >
                <label
                  className="flex items-start gap-3 cursor-pointer select-none"
                  aria-label={getMessage("emailConsent") as string}
                >
                  <input
                    type="checkbox"
                    checked={promoConsent}
                    onChange={(e) => setPromoConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    aria-describedby="promo-consent-help"
                  />
                  <div className="text-xs text-gray-700">
                    <div className="font-medium flex items-center gap-1">
                      <span role="img" aria-label="mail">
                        📩
                      </span>
                      {getMessage("emailConsent")}
                    </div>
                    <p
                      id="promo-consent-help"
                      className="mt-1 text-[10px] text-gray-500 leading-snug"
                    >
                      {(getMessage("promoConsent") as string)
                        .split("\n")
                        .map((line) => (
                          <span key={line}>
                            {line}
                            <br />
                          </span>
                        ))}
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* 住所 */}
            <div>
              <StructuredAddressInput
                value={address}
                onChange={setAddress}
                isAdmin={isAdmin}
                readOnly={readOnly}
              />
            </div>

            {/* 電話番号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getMessage("phone")}
                <RequiredMark show={showRequiredMark} />
              </label>
              <PhoneInput
                international
                defaultCountry="JP"
                value={phone}
                onChange={(value) => setPhone(value || "")}
                disabled={readOnly}
                className={
                  readOnly
                    ? "w-full px-4 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                    : "w-full px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                }
                inputComponent={CustomPhoneInput}
                style={
                  {
                    "--PhoneInputCountryFlag-height": "1.2em",
                    "--PhoneInput-color--focus": "#3B82F6",
                  } as React.CSSProperties
                }
              />
              {!readOnly && phoneError && (
                <p className="mt-2 text-sm text-red-600">{phoneError}</p>
              )}
            </div>

            {/* 職業 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getMessage("occupation")}
                <RequiredMark show={showRequiredMark} />
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                disabled={readOnly}
                className={inputClass}
                placeholder={getMessage("occupationPlaceholder") as string}
              />
            </div>

            {/* 国籍 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getMessage("nationality")}
                <RequiredMark show={showRequiredMark} />
              </label>
              <CountrySelect
                value={nationality}
                onChange={setNationality}
                placeholder={getMessage("nationalityPlaceholder") as string}
                disabled={readOnly}
              />
            </div>

            {/* チェックイン・アウト日（非家族 かつ 部屋日付未設定のときのみ表示、readOnly時も表示） */}
            {showDateFields && (
              <BasicCheckInOutDate
                checkInDate={checkInDate}
                setCheckInDate={setCheckInDate}
                checkOutDate={checkOutDate}
                setCheckOutDate={setCheckOutDate}
                readOnly={readOnly}
              />
            )}
          </>
        )}

        {/* 次へボタン（AdminモードまたはreadOnlyモード時は非表示） */}
        {showNextButton && (
          <div className="pt-4">
            <button
              onClick={onNext}
              disabled={!isInfoComplete}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
            >
              {getMessage("proceedToPassportImageUpload")}
            </button>

            {/* 不足項目リスト */}
            {showMissingFields && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700 mb-2">
                  {getMessage("missingFieldsPrompt")}
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {missingFields.map((field) => (
                    <li key={field} className="text-sm text-red-600">
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
