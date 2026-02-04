export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if (typeof window !== 'undefined') {
    console.log(`[${type.toUpperCase()}]`, message);
    alert(message);
  }
}
