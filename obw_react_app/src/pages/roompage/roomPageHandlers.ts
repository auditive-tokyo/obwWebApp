import { saveGuestSession } from './sessionUtils'
import type { HandleNextParams, HandleRegisterParams } from './types'
import { getMessage } from '../../i18n/messages'

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

  setMessage(getMessage("registeringBasicInfo") as string)

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
    console.debug("Basic info registration completed:", res)
    setMessage(getMessage("basicInfoSaved") as string)
    setCurrentStep('upload')
  } catch (e) {
    console.error("Basic info registration error:", e)
    setMessage(getMessage("basicInfoError") as string)
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

  setMessage(getMessage("uploadingPassportImage") as string)

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

    console.debug("Passport image update completed:", res)

    // ローカルストレージのセッション情報を更新
    const session = loadGuestSession(roomId, name)
    if (session) {
      session.approvalStatus = 'pending'
      session.lastUpdated = new Date().toISOString()
      saveGuestSession(session)
    }

    setMessage(getMessage("uploadSuccess") as string)
  } catch (e) {
    console.error("Passport image update error:", e)
    setMessage(getMessage("uploadError") as string)
  }
}