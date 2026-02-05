export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if (typeof window !== 'undefined') {
    console.log(`[${type.toUpperCase()}]`, message);

    const container = getOrCreateToastContainer();
    const toastEl = createToastElement(message, type);
    container.appendChild(toastEl);

    setTimeout(() => {
      toastEl.classList.add('toast-exit');
      setTimeout(() => toastEl.remove(), 300);
    }, 5000);
  }
}

function getOrCreateToastContainer(): HTMLElement {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 420px;
    `;
    document.body.appendChild(container);
  }
  return container;
}

function createToastElement(message: string, type: string): HTMLElement {
  const toast = document.createElement('div');
  toast.className = 'toast-item toast-enter';

  const bgColors = {
    success: 'rgba(16, 185, 129, 0.1)',
    error: 'rgba(248, 113, 113, 0.1)',
    info: 'rgba(34, 211, 238, 0.1)',
  };

  const borderColors = {
    success: 'rgba(16, 185, 129, 0.3)',
    error: 'rgba(248, 113, 113, 0.3)',
    info: 'rgba(34, 211, 238, 0.3)',
  };

  const textColors = {
    success: '#10b981',
    error: '#f87171',
    info: '#22d3ee',
  };

  toast.style.cssText = `
    background: ${bgColors[type as keyof typeof bgColors]};
    border: 1px solid ${borderColors[type as keyof typeof borderColors]};
    padding: 16px 20px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: ${textColors[type as keyof typeof textColors]};
    backdrop-filter: blur(8px);
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
    transition: all 0.3s ease;
  `;

  toast.textContent = message;
  return toast;
}

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .toast-enter {
      opacity: 0;
      transform: translateX(100px);
      animation: toastSlideIn 0.3s ease forwards;
    }

    .toast-exit {
      opacity: 0;
      transform: translateX(100px);
    }

    @keyframes toastSlideIn {
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `;
  document.head.appendChild(style);
}
