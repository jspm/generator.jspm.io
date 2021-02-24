import { popup } from './popup.js';

document.querySelector('.help').addEventListener('click', () => {
  popup(`<p>There is no help!</p>`, 800, 600);
});
