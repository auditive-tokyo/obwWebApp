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
  | "completeBasicInfoFirst"
  | "familyRegistrationMessage"
  | "familyQuestionTitle"
  | "familyQuestionDescription"
  | "no"
  | "yes"
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
  | "securityInfo"
  | "chatInstructionAfterApproved"
  | "whyWeAsk"
  | "securityIntro"
  | "currentLocation"
  | "syncLocation"
  | "unsyncLocation"
  | "locationInfo"
  | "locationShareTitle"
  | "locationResyncTitle"
  | "locationShareMessage"
  | "resync"
  | "share"
  | "updatedAt"
  | "locationSyncSuccess"
  | "locationSyncError"
  | "locationDeleteSuccess"
  | "locationDeleteError"
  | "pleaseRetryLater";

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
    completeBasicInfoFirst: string;
    familyRegistrationMessage: string;
    familyQuestionTitle: string;
    familyQuestionDescription: string;
    no: string;
    yes: string;
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
    chatInstructionAfterApproved: string;
    whyWeAsk: string;
    securityIntro: string;
    currentLocation: string;
    syncLocation: string;
    unsyncLocation: string;
    locationInfo: string;
    locationShareTitle: string;
    locationResyncTitle: string;
    locationShareMessage: string;
    resync: string;
    share: string;
    updatedAt: string;
    locationSyncSuccess: string;
    locationSyncError: string;
    locationDeleteSuccess: string;
    locationDeleteError: string;
    pleaseRetryLater: string;
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
    basicInfoSaved: "基本情報を登録しました。ID写真をアップロードしてください。",
    uploadingPassportImage: "ID画像を更新中...",
    uploadSuccess: "ID画像のアップロードが完了しました！",
    uploadError: "ID画像のアップロードに失敗しました。もう一度お試しください。",
    enterBasicInfo: "基本情報を入力してください",
    enterPassportImage: "ID画像をアップロードしてください",
    statusPending: "現在承認待ちです。",
    statusApproved: "承認されました。",
    statusRejected: "承認されませんでした。",
    noRegistrationYet: "現在、この部屋の登録はありません。",
    selectGuestOrAddNew: "お客様の情報を入力してください。上のリストから対象の方を選択するか、「新規追加」を押してください。",
    completeBasicInfoFirst: "新しいゲストを追加する前に基本情報の登録を完了してください。",
    familyRegistrationMessage: "代表者のご家族として登録します。お名前のみ入力してID写真アップロードへお進みください。",
    familyQuestionTitle: "代表者のご家族ですか？",
    familyQuestionDescription: "代表者のご家族の場合は、お名前のみの入力で登録できます。",
    no: "いいえ",
    yes: "はい",
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
    proceedToPassportImageUpload: "ID画像アップロードへ進む",
    aboutPassport: "身分証明書について",
    aboutSecurity: "セキュリティについて",
    lawInfoShort: "旅館業法により、宿泊者の身元確認・記録保持が義務付けられています。身分証画像の複写・保管が必要です。",
    lawInfo: [
      "旅館業法により、宿泊事業者は宿泊者の身元確認および記録保持が法的に義務付けられています。身分証画像詳細の複写と一定期間の保管が必要となります。",
      "この情報は必要に応じて政府機関から要請される場合があるため、法令遵守のためファイルに保管させていただきます。ご理解とご協力をお願いいたします。"
    ],
    securityInfoShort: "個人情報はAWS KMSで保護、通信はSSL暗号化、国際基準に準拠しています。",
    securityInfo: [
      "お客様の個人情報はAWS KMS（暗号化サービス）により高度に保護されています。",
      "通信は全てSSL暗号化により安全に送信されます。",
      "データの保管・管理は国際的なセキュリティ基準に準拠しています。"
    ],
    chatInstructionAfterApproved:
      "部屋の鍵の暗証番号などの情報にアクセスできる様になりました。右下のチャットボットに質問してください。",
    whyWeAsk: "この情報をお願いする理由",
    securityIntro: "法令遵守と安全確保のため最小限の身元情報を収集し安全に保管します。詳細は下のカードをご覧ください。",
    currentLocation: "現在地",
    syncLocation: "現在地を同期",
    unsyncLocation: "同期解除",
    locationInfo: "現在地情報",
    locationShareTitle: "現在地の共有",
    locationResyncTitle: "現在地の再同期",
    locationShareMessage: "お客様の現在地をサポートに通知できます。お客様の位置情報はサポートの目的においてのみ使用されます。",
    resync: "再同期",
    share: "共有する",
    updatedAt: "更新日時",
    locationSyncSuccess: "位置情報の同期が完了しました。",
    locationSyncError: "位置情報の同期に失敗しました。",
    locationDeleteSuccess: "位置情報を削除しました。",
    locationDeleteError: "位置情報の削除に失敗しました。",
    pleaseRetryLater: "少し時間をおいてから再度お試しください。"
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
    basicInfoSaved: "Basic information saved. Please upload your ID image.",
    uploadingPassportImage: "Updating ID image...",
    uploadSuccess: "ID image upload completed!",
    uploadError: "ID image upload failed. Please try again.",
    enterBasicInfo: "Please enter your basic information.",
    enterPassportImage: "Please upload your ID image.",
    statusPending: "Currently pending approval.",
    statusApproved: "Approved.",
    statusRejected: "Rejected.",
    noRegistrationYet: "There are currently no registrations for this room.",
    selectGuestOrAddNew: "Please enter your information. Select a person from the list above or press 'Add Guest'.",
    completeBasicInfoFirst: "Please complete the basic information registration before adding a new guest.",
    familyRegistrationMessage: "Registering as a family member of the representative. Please enter only your name and proceed to ID image upload.",
    familyQuestionTitle: "Are you a family member of the representative?",
    familyQuestionDescription: "Family members of the representative can register with only their name.",
    no: "No",
    yes: "Yes",
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
    proceedToPassportImageUpload: "Proceed to ID Image Upload",
    aboutPassport: "About ID Documents",
    aboutSecurity: "About Security",
    lawInfoShort: "According to the Hotel Business Act, accommodation providers must verify guest identity and keep records. An image copy of the ID document must be taken and retained for a certain period.",
    lawInfo: [
      "According to the Hotel Business Act, accommodation providers are legally required to verify guest identity and keep records. An image of the ID document must be copied and stored for a certain period.",
      "This information may be requested by government agencies as needed, so we will keep it on file for legal compliance. We appreciate your understanding and cooperation."
    ],
    securityInfoShort: "Personal information is protected by AWS KMS, communication is SSL encrypted, and complies with international standards.",
    securityInfo: [
      "Your personal information is highly protected by AWS KMS (encryption service).",
      "All communications are securely transmitted via SSL encryption.",
      "Data storage and management comply with international security standards."
    ],
    chatInstructionAfterApproved:
      "You can now access information such as the room door code. Please ask the chatbot at the bottom right.",
    whyWeAsk: "Why we ask for this information",
    securityIntro: "We collect only minimal identity information for legal compliance and guest safety. See the cards below for details.",
    currentLocation: "Current Location",
    syncLocation: "Sync Location",
    unsyncLocation: "Unsync",
    locationInfo: "Location Information",
    locationShareTitle: "Share Current Location",
    locationResyncTitle: "Re-sync Current Location",
    locationShareMessage: "We can notify support of your current location. Your location information will only be used for support purposes.",
    resync: "Re-sync",
    share: "Share",
    updatedAt: "Updated",
    locationSyncSuccess: "Location sync completed successfully.",
    locationSyncError: "Location sync failed.",
    locationDeleteSuccess: "Location information deleted.",
    locationDeleteError: "Failed to delete location information.",
    pleaseRetryLater: "Please wait a moment and try again."
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