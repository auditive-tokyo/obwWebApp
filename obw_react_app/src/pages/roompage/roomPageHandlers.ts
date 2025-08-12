import { saveGuestSession } from './sessionUtils'
import type { HandleNextParams, HandleRegisterParams } from './types'

/**
 * 基本情報登録処理
 * - 入力されたゲスト情報をGraphQL経由でDBに登録
 * - ローカルセッションを保存
 * - ステータスや画面ステップを更新
 */
export const handleNext = async (params: HandleNextParams) => {
  const {
    roomId,
    name,
    email,
    address,
    phone,
    occupation,
    nationality,
    checkInDate,
    checkOutDate,
    promoConsent,
    client,
    setMessage,
    setCurrentStep
  } = params

  setMessage("基本情報を登録中...")
  
  const query = `
    mutation CreateGuest($input: CreateGuestInput!) {
      createGuest(input: $input) {
        roomNumber
        guestName
      }
    }
  `

  const formatDate = (date: Date | null) =>
    date ? date.toISOString().slice(0, 10) : null;

  const variables = {
    input: {
      roomNumber: roomId,
      guestName: name,
      email,
      address,
      phone,
      occupation,
      nationality,
      passportImageUrl: "",
      checkInDate: formatDate(checkInDate),
      checkOutDate: formatDate(checkOutDate),
      promoConsent
    }
  }
  
  try {
    const res = await client.graphql({
      query,
      variables,
      authMode: 'iam'
    })

    // ローカルストレージにゲストセッションを保存
    saveGuestSession({
      roomNumber: roomId,
      guestName: name,
      phone,
      registrationDate: new Date().toISOString().split('T')[0],
      approvalStatus: 'waitingForPassportImage',
      lastUpdated: new Date().toISOString()
    })
    
    // setApprovalStatus('waitingForPassportImage')
    console.debug("基本情報登録完了:", res)
    setMessage("基本情報を登録しました。パスポート写真をアップロードしてください。")
    setCurrentStep('upload')
  } catch (e) {
    console.error("基本情報登録エラー:", e)
    setMessage("基本情報の登録に失敗しました")
  }
}

/**
 * パスポート画像登録処理
 * - アップロードされたパスポート画像URLをGraphQL経由でDBに登録
 * - ローカルセッションのステータスを更新
 * - ステータスや画面メッセージを更新
 */
export const handleRegister = async (params: HandleRegisterParams) => {
  const {
    roomId,
    name,
    passportImageUrl,
    client,
    setMessage,
    loadGuestSession,
    saveGuestSession
  } = params

  setMessage("パスポート画像を更新中...")

  // 署名付きURLからS3パス部分だけ抽出
  let s3Url = passportImageUrl
  if (passportImageUrl) {
    try {
      const url = new URL(passportImageUrl)
      s3Url = `${url.origin}${url.pathname}`
    } catch (e) {
      console.error("Invalid URL format:", passportImageUrl, e)
    }
  }
  
  const query = `
    mutation UpdateGuest($input: UpdateGuestInput!) {
      updateGuest(input: $input) {
        roomNumber
        guestName
        passportImageUrl
        approvalStatus
      }
    }
  `
  const variables = {
    input: {
      roomNumber: roomId,
      guestName: name,
      passportImageUrl: s3Url,
      approvalStatus: 'pending'
    }
  }
  
  try {
    const res = await client.graphql({
      query,
      variables,
      authMode: 'iam'
    })

    console.debug("パスポート画像更新完了:", res)

    // ローカルストレージのセッション情報を更新
    const session = loadGuestSession(roomId, name)
    if (session) {
      session.approvalStatus = 'pending'
      session.lastUpdated = new Date().toISOString()
      saveGuestSession(session)
    }

    setMessage("登録が完了しました！")
  } catch (e) {
    console.error("パスポート画像更新エラー:", e)
    setMessage("パスポート画像の更新に失敗しました")
  }
}