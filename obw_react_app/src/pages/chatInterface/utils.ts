  export const getTimestamp = () => {
    const d = new Date()
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
  }