export type SupportedLang =
  | "ja"
  | "en";

type MessageKeys =
  | "close"
  | "edit"
  | "welcome"
  | "uploadSuccess"
  | "uploadError"
  | "enterBasicInfo"
  | "enterPassportImage"
  | "name"
  | "namePlaceholder"
  | "email"
  | "emailValidation"
  | "emailConsent"
  | "promoConsent"
  | "address"
  | "addressNotSet"
  | "addressLine1"
  | "addressLine1Placeholder"
  | "addressLine2"
  | "addressLine2Placeholder"
  | "city"
  | "state"
  | "country"
  | "countryPlaceholder"
  | "zipcode"
  | "phone"
  | "phoneValidation"
  | "occupation"
  | "occupationPlaceholder"
  | "nationality"
  | "nationalityPlaceholder"
  | "checkInOutDate"
  | "selectCheckInOutDate"
  | "checkInDate"
  | "checkOutDate";

type Messages = {
  [lang in SupportedLang]: {
    [key in MessageKeys]: string;
  }
};

const messages: Messages = {
  ja: {
    close: "閉じる",
    edit: "入力・編集",
    welcome: "ようこそ！Osaka Bay Wheel WebAppへ。",
    uploadSuccess: "登録が完了しました。",
    uploadError: "登録に失敗しました。もう一度お試しください。",
    enterBasicInfo: "基本情報を入力してください",
    enterPassportImage: "パスポート画像をアップロードしてください",
    name: "お名前",
    namePlaceholder: "山田太郎",
    email: "メールアドレス",
    emailValidation: "正しいメールアドレスを入力してください",
    emailConsent: "最新情報をメールで受け取る",
    promoConsent: "プロモーションや特別割引、近隣イベント情報などをお送りします。\n受取りをご希望されない場合はチェックは外したままにして下さい。",
    address: "住所",
    addressNotSet: "住所が設定されていません",
    addressLine1: "住所1",
    addressLine1Placeholder: "住所1（番地・丁目・号など）",
    addressLine2: "住所2",
    addressLine2Placeholder: "住所2（建物名・部屋番号など）",
    city: "市区町村",
    state: "都道府県",
    country: "国",
    countryPlaceholder: "国を選択してください",
    zipcode: "郵便番号",
    phone: "電話番号",
    phoneValidation: "正しい電話番号を入力してください",
    occupation: "職業",
    occupationPlaceholder: "会社員",
    nationality: "国籍",
    nationalityPlaceholder: "国籍を選択してください",
    checkInOutDate: "チェックイン・チェックアウト日",
    selectCheckInOutDate: "チェックイン・チェックアウト日を選択してください",
    checkInDate: "チェックイン日",
    checkOutDate: "チェックアウト日",
  },
  en: {
    close: "Close",
    edit: "Input / Edit",
    welcome: "Welcome to Osaka Bay Wheel WebApp.",
    uploadSuccess: "Registration completed.",
    uploadError: "Registration failed. Please try again.",
    enterBasicInfo: "Please enter your basic information.",
    enterPassportImage: "Please upload your passport image.",
    name: "Name",
    namePlaceholder: "John Doe",
    phoneValidation: "Please enter a valid phone number.",
    email: "Email",
    emailValidation: "Please enter a valid email address.",
    emailConsent: "Receive updates via email",
    promoConsent: "We will send you promotions, special discounts, and local event information. \nIf you do not wish to receive these, please leave the checkbox unchecked.",
    address: "Address",
    addressNotSet: "Address is not set",
    addressLine1: "Address Line 1",
    addressLine1Placeholder: "Address Line 1 (Street, Block, etc.)",
    addressLine2: "Address Line 2",
    addressLine2Placeholder: "Address Line 2 (Building Name, Room Number, etc.)",
    city: "City",
    state: "State/Province",
    country: "Country",
    countryPlaceholder: "Please select your country",
    zipcode: "Zip Code",
    phone: "Phone",
    occupation: "Occupation",
    occupationPlaceholder: "Office Worker",
    nationality: "Nationality",
    nationalityPlaceholder: "Please select your nationality.",
    checkInOutDate: "Check-in / Check-out Date",
    selectCheckInOutDate: "Please select your check-in and check-out dates.",
    checkInDate: "Check-in Date",
    checkOutDate: "Check-out Date",
  }
};

function getCurrentLang(): SupportedLang {
  const rawLang = localStorage.getItem("lang");
  if (rawLang === "ja" || rawLang === "en") return rawLang;
  return "en"; // デフォルト英語
}

export function getMessage(key: MessageKeys, lang?: SupportedLang) {
  const effectiveLang = lang ?? getCurrentLang();
  return messages[effectiveLang]?.[key] ?? messages["en"][key] ?? key;
}