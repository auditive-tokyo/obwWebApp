import type { HandleNextParams, HandleRegisterParams } from '../types'
import { getMessage } from '@/i18n/messages'

const getNextApprovalStatus = (currentStatus: string | undefined, action: 'updateBasicInfo' | 'uploadPassport'): string => {
  switch (`${currentStatus}-${action}`) {
    case 'waitingForBasicInfo-updateBasicInfo':
      return 'waitingForPassportImage'
    case 'waitingForPassportImage-uploadPassport':
      return 'pending'
    case 'undefined-updateBasicInfo': // 新規作成時
      return 'waitingForPassportImage'
    default:
      return currentStatus || 'waitingForBasicInfo'
  }
}

/**
 * 基本情報登録処理
 * - 入力されたゲスト情報をGraphQL経由でDBに登録
 * - ローカルセッションを保存
 * - ステータスや画面ステップを更新
 */
export const handleNextAction = async (params: HandleNextParams) => {
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
    guestId,
    selectedGuest,
  } = params

  setMessage(getMessage("registeringBasicInfo") as string)

  const formatDate = (date: Date | null) =>
    date ? date.toISOString().slice(0, 10) : null

  // guestIdがあればupdate、なければcreate
  const isUpdate = !!guestId

  const mutation = isUpdate
    ? `
      mutation UpdateGuest($input: UpdateGuestInput!) {
        updateGuest(input: $input) {
          roomNumber
          guestId
          guestName
        }
      }
    `
    : `
      mutation CreateGuest($input: CreateGuestInput!) {
        createGuest(input: $input) {
          roomNumber
          guestId
          guestName
        }
      }
    `

  const variables = {
    input: {
      roomNumber: roomId,
      guestId: guestId, // update時のみ必要
      guestName: name,
      email,
      address,
      phone,
      occupation,
      nationality,
      passportImageUrl: "",
      checkInDate: formatDate(checkInDate),
      checkOutDate: formatDate(checkOutDate),
      promoConsent,
      approvalStatus: getNextApprovalStatus(selectedGuest?.approvalStatus, 'updateBasicInfo'),
    }
  }

  console.debug("mutation input:", variables.input)

  try {
    const res = await client.graphql({
      query: mutation,
      variables,
      authMode: 'iam'
    })

    // ローカルストレージにはguestIdsのみ追加
    const newGuestId = guestId || res.data.createGuest.guestId
    const guestIdsRaw = localStorage.getItem('guestIds')
    let guestIds: string[] = []
    try {
      guestIds = guestIdsRaw ? JSON.parse(guestIdsRaw) : []
    } catch {}
    if (!guestIds.includes(newGuestId)) {
      guestIds.push(newGuestId)
      localStorage.setItem('guestIds', JSON.stringify(guestIds))
    }

    setMessage(getMessage("basicInfoSaved") as string)
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
export const handleRegisterAction = async (params: HandleRegisterParams) => {
  const {
    roomId,
    guestId,
    passportImageUrl,
    client,
    setMessage,
  } = params

  setMessage(getMessage("uploadingPassportImage") as string)
  
  const query = `
    mutation UpdateGuest($input: UpdateGuestInput!) {
      updateGuest(input: $input) {
        roomNumber
        guestId
        guestName
        passportImageUrl
        approvalStatus
      }
    }
  `
  const variables = {
    input: {
      roomNumber: roomId,
      guestId: guestId,  // ← guestNameではなくguestIdを使用
      passportImageUrl: passportImageUrl,  // ← 既にbaseUrlなのでそのまま使用
      approvalStatus: getNextApprovalStatus('waitingForPassportImage', 'uploadPassport')
    }
  }
  
  try {
    const res = await client.graphql({
      query,
      variables,
      authMode: 'iam'
    })

    console.debug("Passport image update completed:", res)

    setMessage(getMessage("uploadSuccess") as string)
  } catch (e) {
    console.error("Passport image update error:", e)
    setMessage(getMessage("uploadError") as string)
  }
}