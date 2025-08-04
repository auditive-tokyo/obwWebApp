import { saveGuestSession, loadGuestSession, type ApprovalStatus } from './sessionUtils'

interface HandleNextParams {
  roomId: string
  name: string
  address: string
  phone: string
  occupation: string
  nationality: string
  checkInDate: string
  checkOutDate: string
  promoConsent: boolean
  client: any
  setMessage: (message: string) => void
  setApprovalStatus: (status: ApprovalStatus) => void
  setCurrentStep: (step: 'info' | 'upload') => void
}

interface HandleRegisterParams {
  roomId: string
  name: string
  passportImageUrl: string
  client: any
  setMessage: (message: string) => void
  setApprovalStatus: (status: ApprovalStatus) => void
  loadGuestSession: typeof loadGuestSession
  saveGuestSession: typeof saveGuestSession
}

export const handleNext = async (params: HandleNextParams) => {
  const {
    roomId,
    name,
    address,
    phone,
    occupation,
    nationality,
    checkInDate,
    checkOutDate,
    promoConsent,
    client,
    setMessage,
    setApprovalStatus,
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
  const variables = {
    input: {
      roomNumber: roomId,
      guestName: name,
      address,
      phone,
      occupation,
      nationality,
      passportImageUrl: "",
      checkInDate,
      checkOutDate,
      promoConsent
    }
  }
  
  try {
    const res = await client.graphql({
      query,
      variables,
      authMode: 'iam'
    })

    saveGuestSession({
      roomNumber: roomId,
      guestName: name,
      phone,
      registrationDate: new Date().toISOString().split('T')[0],
      approvalStatus: 'waitingForPassportImage',
      lastUpdated: new Date().toISOString()
    })
    
    setApprovalStatus('waitingForPassportImage')
    console.debug("基本情報登録完了:", res)
    setMessage("基本情報を登録しました。パスポート写真をアップロードしてください。")
    setCurrentStep('upload')
  } catch (e) {
    console.error("基本情報登録エラー:", e)
    setMessage("基本情報の登録に失敗しました")
  }
}

export const handleRegister = async (params: HandleRegisterParams) => {
  const {
    roomId,
    name,
    passportImageUrl,
    client,
    setMessage,
    setApprovalStatus,
    loadGuestSession,
    saveGuestSession
  } = params

  setMessage("パスポート画像を更新中...")

  // 署名付きURLからパス部分だけ抽出
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

    // LocalStorage更新
    const session = loadGuestSession(roomId, name)
    if (session) {
      session.approvalStatus = 'pending'
      session.lastUpdated = new Date().toISOString()
      saveGuestSession(session)
    }
    
    setApprovalStatus('pending')
    setMessage("登録が完了しました！")
  } catch (e) {
    console.error("パスポート画像更新エラー:", e)
    setMessage("パスポート画像の更新に失敗しました")
  }
}