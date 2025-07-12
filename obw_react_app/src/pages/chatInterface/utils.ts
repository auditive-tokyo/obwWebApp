export const getTimestamp = () => {
  const d = new Date()
  return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
}

export const scrollToBottom = () => {
  const messages = document.querySelector('.messages');
  if (messages) {
    messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
  }
};