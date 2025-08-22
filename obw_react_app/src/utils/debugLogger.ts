export const dbg = (...args: any[]) => {
  if (!import.meta.env.DEV) return
  // スタックトレースから呼び出し元ファイル名を抽出
  const stack = new Error().stack
  let file = 'App'
  if (stack) {
    const match = stack.match(/\/([^\/]+)\.(tsx?|js):\d+:\d+/)
    if (match) file = match[1]
  }
  console.debug(`[${file}]`, ...args)
}