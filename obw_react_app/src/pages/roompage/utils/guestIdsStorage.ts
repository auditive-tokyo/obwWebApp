import { dbg } from '@/utils/debugLogger'

export const getGuestIds = (): string[] => {
  const raw = typeof window !== 'undefined' ? localStorage.getItem('guestIds') : null
  dbg('getGuestIds raw =', raw)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr
    dbg('guestIds value is not an array:', arr)
    return []
  } catch (e) {
    dbg('guestIds JSON parse error:', e)
    return []
  }
}
export const setGuestIds = (ids: string[]) => {
  if (typeof window === 'undefined') return
  dbg('setGuestIds ->', ids)
  localStorage.setItem('guestIds', JSON.stringify(ids))
}

// 追加: guestIds に一件追加するヘルパー
export const addGuestId = (id: string) => {
  const ids = getGuestIds()
  if (ids.includes(id)) {
    dbg('addGuestId: already included', id)
    return
  }
  const next = [...ids, id]
  dbg('addGuestId ->', next)
  setGuestIds(next)
}

export const ensureGuestIdsContains = (id: string | null) => {
  if (!id) return
  const ids = getGuestIds()
  if (!ids.includes(id)) {
    const next = [...ids, id]
    dbg('ensureGuestIdsContains: add', id, '->', next)
    setGuestIds(next)
  } else {
    dbg('ensureGuestIdsContains: already included', id)
  }
}