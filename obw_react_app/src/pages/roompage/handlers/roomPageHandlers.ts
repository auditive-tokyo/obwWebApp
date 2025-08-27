import type { HandleNextParams, HandleRegisterParams } from '../types'
import { getMessage } from '@/i18n/messages'
import{ dbg } from '@/utils/debugLogger'

// Cognito IdentityId など Amplify/SDK のローカルキャッシュを削除
function clearCognitoIdentityCache() {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      // 代表的なキー: com.amplify.Cognito.<region>:<identityPoolId>.identityId
      if (
        k.startsWith('com.amplify.Cognito') ||
        (k.includes('Cognito') && k.endsWith('.identityId')) ||
        k.startsWith('aws-amplify-federatedInfo')
      ) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
  } catch {}
}

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
    bookingId,
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
          bookingId
        }
      }
    `
    : `
      mutation CreateGuest($input: CreateGuestInput!) {
        createGuest(input: $input) {
          roomNumber
          guestId
          guestName
          bookingId
        }
      }
    `

  // 共通入力
  const baseInput: any = {
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
    promoConsent,
    approvalStatus: getNextApprovalStatus(selectedGuest?.approvalStatus, 'updateBasicInfo'),
    bookingId,
  }

  // update のときだけ guestId を含める
  const input = isUpdate ? { ...baseInput, guestId } : { ...baseInput }
  const variables = { input }

  dbg("mutation input:", variables.input)

  try {
    await client.graphql({
      query: mutation,
      variables,
      authMode: 'iam'
    })

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

    dbg("Passport image update completed:", res)

    setMessage(getMessage("uploadSuccess") as string)
  } catch (e) {
    console.error("Passport image update error:", e)
    setMessage(getMessage("uploadError") as string)
  }
}

/**
 * ページロード時の認証チェック処理
 * - localStorageからguestIdとtokenを取得
 * - GraphQL経由で認証トークンを検証
 * - 認証状態を更新し、無効な場合はlocalStorageをクリア
 */
export async function verifyOnLoad({ roomId, client, setSessionChecked, setSessionValid }: {
  roomId: string
  client: any
  setSessionChecked: (b: boolean) => void
  setSessionValid: (b: boolean) => void
}) {
  dbg('verifyOnLoad start: roomId=', roomId)
  
  if (!roomId) {
    setSessionChecked(true)
    setSessionValid(false)
    dbg('no roomId')
    return
  }
  
  const gid = typeof window !== 'undefined' ? localStorage.getItem('guestId') : null
  const tok = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  dbg('verifyOnLoad localStorage -> guestId=', gid, 'token exists =', !!tok)
  
  if (!gid || !tok) {
    setSessionChecked(true)
    setSessionValid(false)
    dbg('missing gid or token')
    return
  }
  
  try {
    const query = `
      mutation VerifyAccessToken($roomNumber: String!, $guestId: String!, $token: String!) {
        verifyAccessToken(roomNumber: $roomNumber, guestId: $guestId, token: $token) {
          success
          guest { guestId bookingId }
        }
      }
    `
    const res = await client.graphql({
      query,
      variables: { roomNumber: roomId, guestId: gid, token: tok },
      authMode: 'iam'
    })
    const ok = 'data' in res && res.data?.verifyAccessToken?.success
    dbg('verifyOnLoad result ok =', ok)
    
    if (!ok) {
      localStorage.removeItem('guestId')
      localStorage.removeItem('token')
      localStorage.removeItem('bookingId')
      clearCognitoIdentityCache()
      setSessionValid(false)
    } else {
      setSessionValid(true)
    }
  } catch (e) {
    localStorage.removeItem('guestId')
    localStorage.removeItem('token')
    localStorage.removeItem('bookingId')
    clearCognitoIdentityCache()
    console.error('verify on load failed:', e)
    setSessionValid(false)
  } finally {
    setSessionChecked(true)
    dbg('verifyOnLoad finished')
  }
}