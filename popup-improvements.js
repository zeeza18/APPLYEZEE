// Toast notification system
let _toastContainer = null;

function showToast(message, type = 'info', duration = 4000) {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    Object.assign(_toastContainer.style, {
      position: 'fixed',
      top: '14px',
      right: '14px',
      left: '14px',
      zIndex: '10000',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
    });
    document.body.appendChild(_toastContainer);
  }

  const colors = { success:'#10b981', error:'#ef4444', warning:'#f59e0b', info:'#06b6d4' };
  const icons  = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
  const color  = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: white;
    padding: 11px 14px;
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 10px;
    border-left: 4px solid ${color};
    animation: _toastIn 0.25s ease-out;
    font-family: 'Space Grotesk', sans-serif;
    pointer-events: all;
  `;

  toast.innerHTML = `
    <div style="width:20px;height:20px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;flex-shrink:0">${icons[type]}</div>
    <span style="flex:1;font-size:13px;color:#1e293b;line-height:1.4">${message}</span>
    <button class="_tx" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;padding:0;line-height:1;flex-shrink:0">×</button>
  `;

  toast.querySelector('._tx').addEventListener('click', () => toast.remove());
  _toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = '_toastOut 0.25s ease-out forwards';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// Animation styles
const _toastStyle = document.createElement('style');
_toastStyle.textContent = `
  @keyframes _toastIn  { from { transform:translateY(-12px); opacity:0 } to { transform:translateY(0); opacity:1 } }
  @keyframes _toastOut { from { transform:translateY(0); opacity:1 } to { transform:translateY(-12px); opacity:0 } }
`;
document.head.appendChild(_toastStyle);

window.showToast = showToast;
