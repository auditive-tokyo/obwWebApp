/**
 * 住所JSONをパースして個別フィールドを取得
 */
export interface ParsedAddress {
  addressLine1: string
  city: string
  state: string
  country: string
  zipcode: string
}

export function parseAddressFields(addressJson: string): ParsedAddress | null {
  if (!addressJson.trim()) return null
  
  try {
    const obj = JSON.parse(addressJson)
    return {
      addressLine1: obj.addressLine1 ?? obj.line1 ?? "",
      city: obj.city ?? "",
      state: obj.state ?? obj.province ?? "",
      country: obj.country ?? obj.countryCode ?? "",
      zipcode: obj.zipcode ?? obj.postalCode ?? ""
    }
  } catch {
    return null
  }
}

/**
 * 住所JSONの必須項目がすべて入力されているかチェック
 * StructuredAddressInputのcomputeValid関数と同じロジック
 */
export function validateAddressFields(addressJson: string): boolean {
  const parsed = parseAddressFields(addressJson)
  if (!parsed) return false
  
  return [parsed.addressLine1, parsed.city, parsed.state, parsed.country, parsed.zipcode]
    .every((v) => v.trim() !== '')
}

/**
 * ゲスト情報の入力完了判定
 * 家族かどうか、ゲスト数に応じて必須項目を変える
 */
export function checkFormCompletion({
  name,
  email,
  address,
  phone,
  occupation,
  nationality,
  checkInDate,
  checkOutDate,
  isRepresentativeFamily,
  hasRoomCheckDates
}: {
  name: string
  email: string
  address: string
  phone: string
  occupation: string
  nationality: string
  checkInDate: Date | null
  checkOutDate: Date | null
  guestCount: number
  isRepresentativeFamily: boolean
  hasRoomCheckDates: boolean
}): boolean {
  if (isRepresentativeFamily) {
    // 代表者の家族の場合：名前のみ必須
    return name.trim().length > 0
  }

  // 家族以外：部屋としてチェックイン/アウト日が既に設定済みなら、本人入力は不要
  const needDates = !hasRoomCheckDates
  return (
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    validateAddressFields(address) &&
    phone.trim().length > 0 &&
    occupation.trim().length > 0 &&
    nationality.trim().length > 0 &&
    (!needDates || (Boolean(checkInDate) && Boolean(checkOutDate)))
  )
}