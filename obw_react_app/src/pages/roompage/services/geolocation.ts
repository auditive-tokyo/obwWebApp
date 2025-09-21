import { saveGuestLocation } from './apiCalls'

type GeoFix = { lat: number; lng: number; accuracy?: number; ts: number }
type SimplePlace = { country?: string; state?: string; city?: string; district?: string; fullText: string }
type SyncGeoResult = { fix: GeoFix; addressText: string }

function getCurrentPositionOnce(opts?: PositionOptions): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Geolocation unsupported'))
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          ts: Date.now(),
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...opts }
    )
  })
}

// Nominatim で逆ジオ（ブラウザでは User-Agent ヘッダは付けない）
async function reverseGeocode(lat: number, lng: number): Promise<SimplePlace> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ja,en&addressdetails=1&zoom=14`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`reverseGeocode failed: ${res.status}`)
  const data = await res.json()
  const a = data?.address || {}
  const city = a.city || a.town || a.village || a.municipality || a.suburb
  const state = a.state || a.region || a.province || a.county
  const country = a.country
  const district = a.neighbourhood || a.city_district
  const postcode = a.postcode
  const parts = [district, city, country, postcode ? `〒${postcode}` : null].filter(Boolean)
  const fullText = parts.join(', ') || data?.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  return { country, state, city, district, fullText }
}

async function getCurrentPositionWithFallback(): Promise<GeoFix> {
  // 高精度で試行
  try {
    return await getCurrentPositionOnce({
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000,
    })
  } catch (highAccuracyError) {
    console.warn('[geo] high accuracy failed, trying low accuracy')

    // 低精度で再試行
    return await getCurrentPositionOnce({
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000,
    })
  }
}

export async function syncGeoAndResolveAddress(params: {
  client: any
  roomId: string
  guestId: string
}): Promise<SyncGeoResult> {
  const { client, roomId, guestId } = params
  const fix = await getCurrentPositionWithFallback()
  const place = await reverseGeocode(fix.lat, fix.lng)

  // 日本時間のISO文字列を生成
  const japanTime = new Date(fix.ts).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  // 現在地@時間の形式で保存用文字列を作成
  const currentLocationText = `${place.fullText}@${japanTime}`

  try {
    await saveGuestLocation({
      client,
      roomId,
      guestId,
      lat: fix.lat,
      lng: fix.lng,
      accuracy: fix.accuracy,
      ts: fix.ts,
      currentLocation: currentLocationText
    })
  } catch (e) {
    console.warn('saveGuestLocation failed', e)
  }

  return { fix, addressText: place.fullText }
}