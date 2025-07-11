export const handleSend = () => {
if (input.trim() === '') return
setMessages(prev => [
    ...prev,
    { text: input, personal: true, timestamp: getTimestamp() }
])
setInput('')
setTimeout(addFakeMessage, 1200 + Math.random() * 1000)
}

export const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
}
}