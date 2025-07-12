import { getTimestamp } from './utils'

export const handleSend = (
  input: string,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>,
  setInput: React.Dispatch<React.SetStateAction<string>>,
  addFakeMessage: () => void
) => {
  if (input.trim() === '') return
  setMessages(prev => [
    ...prev,
    { text: input, personal: true, timestamp: getTimestamp() }
  ])
  setInput('')
  setTimeout(addFakeMessage, 500)
}

export const handleInputKeyDown = (
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  handleSend: () => void
) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}