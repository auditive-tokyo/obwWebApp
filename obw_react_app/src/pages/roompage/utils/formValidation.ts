/**
 * 住所JSONの必須項目がすべて入力されているかチェック
 * StructuredAddressInputのcomputeValid関数と同じロジック
 */
function validateAddressFields(addressJson: string): boolean {
  if (!addressJson.trim()) return false
  
  try {
    const obj = JSON.parse(addressJson)
    const addressLine1 = obj.addressLine1 ?? obj.line1 ?? ""
    const city = obj.city ?? ""
    const state = obj.state ?? obj.province ?? ""
    const country = obj.country ?? obj.countryCode ?? ""
    const zipcode = obj.zipcode ?? obj.postalCode ?? ""
    
    return [addressLine1, city, state, country, zipcode].every((v) => (v || '').trim() !== '')
  } catch {
    // JSONパースに失敗した場合（プレーンテキスト）
    return false
  }
}

/**
 * ゲスト情報の入力完了判定
 * ゲスト数に応じて必須項目を変える
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
  guestCount
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
}): boolean {
  const isFirstGuest = guestCount <= 1
  
  if (isFirstGuest) {
    // 一人目：BasicInfoFormの必須項目全てをチェック
    return (
      name.trim().length > 0 &&
      email.trim().length > 0 &&
      validateAddressFields(address) &&
      phone.trim().length > 0 &&
      occupation.trim().length > 0 &&
      nationality.trim().length > 0 &&
      Boolean(checkInDate) &&
      Boolean(checkOutDate)
    )
  } else {
    // 二人目以降：名前のみ必須
    return name.trim().length > 0
  }
}