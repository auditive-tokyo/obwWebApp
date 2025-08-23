export type SupportedLang =
  | "ja"
  | "en";

type MessageKeys =
  | "close"
  | "preview"
  | "edit"
  | "uploading"
  | "upload"
  | "unfilled"
  | "unselect"
  | "addNewPerson"
  | "roomStatus"
  | "welcome"
  | "registeringBasicInfo"
  | "basicInfoError"
  | "basicInfoSaved"
  | "uploadingPassportImage"
  | "uploadSuccess"
  | "uploadError"
  | "enterBasicInfo"
  | "enterPassportImage"
  | "statusPending"
  | "statusApproved"
  | "statusRejected"
  | "noRegistrationYet"
  | "selectGuestOrAddNew"
  | "accessRequest"
  | "nameRequired"
  | "linkDeliveryMethod"
  | "receiveByEmail"
  | "receiveBySMS"
  | "submitting"
  | "sendLink"
  | "allFieldsRequired"
  | "sendFailed"
  | "emailLinkSent"
  | "smsLinkSent"
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
  | "checkOutDate"
  | "editBasicInfo"
  | "proceedToPassportImageUpload"
  | "aboutPassport"
  | "aboutSecurity"
  | "lawInfoShort"
  | "lawInfo"
  | "securityInfoShort"
  | "securityInfo";

type Messages = {
  [lang in SupportedLang]: {
    close: string;
    preview: string;
    edit: string;
    uploading: string;
    upload: string;
    unfilled: string;
    unselect: string;
    addNewPerson: string;
    roomStatus: string;
    welcome: string;
    registeringBasicInfo: string;
    basicInfoError: string;
    basicInfoSaved: string;
    uploadingPassportImage: string;
    uploadSuccess: string;
    uploadError: string;
    enterBasicInfo: string;
    enterPassportImage: string;
    statusPending: string;
    statusApproved: string;
    statusRejected: string;
    noRegistrationYet: string;
    selectGuestOrAddNew: string;
    accessRequest: string;
    nameRequired: string;
    linkDeliveryMethod: string;
    receiveByEmail: string;
    receiveBySMS: string;
    submitting: string;
    sendLink: string;
    allFieldsRequired: string;
    sendFailed: string;
    emailLinkSent: string;
    smsLinkSent: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailValidation: string;
    emailConsent: string;
    promoConsent: string;
    address: string;
    addressNotSet: string;
    addressLine1: string;
    addressLine1Placeholder: string;
    addressLine2: string;
    addressLine2Placeholder: string;
    city: string;
    state: string;
    country: string;
    countryPlaceholder: string;
    zipcode: string;
    phone: string;
    phoneValidation: string;
    occupation: string;
    occupationPlaceholder: string;
    nationality: string;
    nationalityPlaceholder: string;
    checkInOutDate: string;
    selectCheckInOutDate: string;
    checkInDate: string;
    checkOutDate: string;
    editBasicInfo: string;
    proceedToPassportImageUpload: string;
    aboutPassport: string;
    aboutSecurity: string;
    lawInfoShort: string;
    lawInfo: string[];
    securityInfoShort: string;
    securityInfo: string[];
  }
};

const messages: Messages = {
  ja: {
    close: "閉じる",
    preview: "この写真をアップロードしようとしています",
    edit: "入力・編集",
    uploading: "アップロード中...",
    upload: "アップロード",
    unfilled: "(未入力)",
    unselect: "選択を解除する",
    addNewPerson: "+ ゲストを追加する",
    roomStatus: "この部屋の申請状況",
    welcome: "ようこそ！Osaka Bay Wheel WebAppへ。",
    registeringBasicInfo: "基本情報を登録中...",
    basicInfoError: "基本情報の登録に失敗しました",
    basicInfoSaved: "基本情報を登録しました。パスポート写真をアップロードしてください。",
    uploadingPassportImage: "パスポート画像を更新中...",
    uploadSuccess: "パスポート画像のアップロードが完了しました！",
    uploadError: "パスポート画像のアップロードに失敗しました。もう一度お試しください。",
    enterBasicInfo: "基本情報を入力してください",
    enterPassportImage: "パスポート画像をアップロードしてください",
    statusPending: "現在承認待ちです。",
    statusApproved: "承認されました。",
    statusRejected: "承認されませんでした。",
    noRegistrationYet: "現在、この部屋の登録はありません。",
    selectGuestOrAddNew: "お客様の情報を入力してください。上のリストから対象の方を選択するか、「新規追加」を押してください。",
    accessRequest: "アクセス申請",
    nameRequired: "お名前",
    linkDeliveryMethod: "リンクの受け取り方法",
    receiveByEmail: "メールで受け取る",
    receiveBySMS: "SMSで受け取る",
    submitting: "送信中…",
    sendLink: "リンクを送信",
    allFieldsRequired: "お名前・Email・電話番号はすべて必須です",
    sendFailed: "送信に失敗しました",
    emailLinkSent: "メールにアクセスリンクを送信しました。ご確認ください。",
    smsLinkSent: "SMSにアクセスリンクを送信しました。ご確認ください。",
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
    editBasicInfo: "基本情報を編集",
    proceedToPassportImageUpload: "パスポート画像アップロードへ進む",
    aboutPassport: "パスポート情報について",
    aboutSecurity: "セキュリティについて",
    lawInfoShort: "旅館業法により、宿泊者の身元確認・記録保持が義務付けられています。外国人宿泊者はパスポート詳細の複写・保管が必要です。",
    lawInfo: [
      "旅館業法により、宿泊事業者は宿泊者の身元確認および記録保持が法的に義務付けられています。外国人宿泊者の場合、パスポート詳細の複写と一定期間の保管が必要となります。",
      "この情報は必要に応じて政府機関から要請される場合があるため、法令遵守のためファイルに保管させていただきます。ご理解とご協力をお願いいたします。"
    ],
    securityInfoShort: "個人情報はAWS KMSで保護、通信はSSL暗号化、国際基準に準拠しています。",
    securityInfo: [
      "お客様の個人情報はAWS KMS（暗号化サービス）により高度に保護されています。",
      "通信は全てSSL暗号化により安全に送信されます。",
      "データの保管・管理は国際的なセキュリティ基準に準拠しています。"
    ]
  },
  en: {
    close: "Close",
    preview: "This photo is about to be uploaded",
    edit: "Input / Edit",
    uploading: "Uploading...",
    upload: "Upload",
    unfilled: "(Unfilled)",
    unselect: "Unselect",
    addNewPerson: "+ Add Guest",
    roomStatus: "Room Status",
    welcome: "Welcome to Osaka Bay Wheel WebApp.",
    registeringBasicInfo: "Registering basic information...",
    basicInfoError: "Failed to register basic information.",
    basicInfoSaved: "Basic information saved. Please upload your passport image.",
    uploadingPassportImage: "Updating passport image...",
    uploadSuccess: "Passport image upload completed!",
    uploadError: "Passport image upload failed. Please try again.",
    enterBasicInfo: "Please enter your basic information.",
    enterPassportImage: "Please upload your passport image.",
    statusPending: "Currently pending approval.",
    statusApproved: "Approved.",
    statusRejected: "Rejected.",
    noRegistrationYet: "There are currently no registrations for this room.",
    selectGuestOrAddNew: "Please enter your information. Select a person from the list above or press 'Add Guest'.",
    accessRequest: "Access Request",
    nameRequired: "Name",
    linkDeliveryMethod: "Link Delivery Method",
    receiveByEmail: "Receive by Email",
    receiveBySMS: "Receive by SMS",
    submitting: "Submitting...",
    sendLink: "Send Link",
    allFieldsRequired: "Name, Email, and Phone number are all required",
    sendFailed: "Failed to send",
    emailLinkSent: "Access link sent to your email. Please check your inbox.",
    smsLinkSent: "Access link sent to your SMS. Please check your messages.",
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
    editBasicInfo: "Edit Information",
    proceedToPassportImageUpload: "Proceed to Passport Image Upload",
    aboutPassport: "About Passport Information",
    aboutSecurity: "About Security",
    lawInfoShort: "According to the Hotel Business Law, accommodation providers are legally required to verify and record the identity of guests. For foreign guests, a copy of the passport details must be taken and stored for a certain period.",
    lawInfo: [
      "According to the Hotel Business Law, accommodation providers are legally required to verify and record the identity of guests. For foreign guests, a copy of the passport details must be taken and stored for a certain period.",
      "This information may be requested by government agencies as needed, so we will keep it on file for legal compliance. We appreciate your understanding and cooperation."
    ],
    securityInfoShort: "Personal information is protected by AWS KMS, communication is SSL encrypted, and complies with international standards.",
    securityInfo: [
      "Your personal information is highly protected by AWS KMS (encryption service).",
      "All communications are securely transmitted via SSL encryption.",
      "Data storage and management comply with international security standards."
    ]
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