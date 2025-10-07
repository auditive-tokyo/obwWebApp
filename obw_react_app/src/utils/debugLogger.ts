export const dbg = (...args: unknown[]): void => {
  if (!import.meta.env.DEV) return
  // スタックトレースから呼び出し元ファイル名を抽出
  const stack = new Error().stack
  let file = 'App'
  if (stack) {
    const match = stack.match(/\/([^/]+)\.(tsx?|js):\d+:\d+/)
    if (match) file = match[1]
  }
  // console.debug accepts any; passing unknown[] is fine at runtime
  // Use a type-safe spread by asserting as unknown[] to keep TS happy without `any`.
  console.debug(`[${file}]`, ...(args as unknown[]))
}