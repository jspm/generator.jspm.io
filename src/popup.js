


export function popup (content, width = 500, height = 500) {
  const shim = Object.assign(document.createElement('div'), { className: 'shim' });
  const popup = Object.assign(document.createElement('div'), {
    className: 'popup-container',
    innerHTML: `<div class="popup"><div class="close"></div><div class="content">${content}</div></div>`
  });
  const popupInner = popup.querySelector('.popup');
  popupInner.style.width = width + 'px';
  popupInner.style.height = height + 'px';
  popupInner.style.marginLeft = -(width / 2) + 'px';
  popupInner.style.marginTop = -(height / 2) + 'px';
  shim.addEventListener('click', closePopup);
  popup.querySelector('.close').addEventListener('click', closePopup);

  function closePopup () {
    shim.removeEventListener('click', closePopup);
    popup.querySelector('.close').removeEventListener('click', closePopup);
    document.body.removeChild(shim);
    document.body.removeChild(popup);
  }

  document.body.appendChild(shim);
  document.body.appendChild(popup);

  setTimeout(() => shim.style.opacity = 0.7, 0);
  setTimeout(() => popup.style.display = 'block', 100);
}
