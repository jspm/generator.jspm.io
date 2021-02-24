class SelectBox extends HTMLElement {
  constructor () {
    super();

    this.open = false;
    this.$selected = this.querySelector('.selected');
    this.$options = this.querySelector('.options');
    this.addEventListener('click', () => {
      if (this.open)
        this.hide();
      else
        this.show();
    });
    this.click = e => {
      const event = new CustomEvent('change', {
        detail: {
          new: e.target.innerHTML,
          old: this.$selected.querySelector('span').innerHTML
        },
        bubbles: true
      });
      this.$selected.innerHTML = '<span>' + e.target.innerHTML + '</span>';
      this.dispatchEvent(event);
    };
    // custom blur event
    window.addEventListener('click', e => {
      if (e.target !== this && e.target.parentNode !== this && e.target.parentNode && e.target.parentNode.parentNode !== this && this.open)
        this.hide();
    });
    window.addEventListener('keydown', e => {
      if (this.open && e.code === 'Escape')
        this.hide();
    });
  }

  set (option) {
    this.$selected.innerHTML = '<span>' + option + '</span>';
  }

  get baseClassName () {
    return this.className.split(' ').filter(name => name !== 'expanded').join(' ');
  }

  hide () {
    this.className = this.baseClassName;
    this.open = false;
    document.body.removeChild(this.$optionsClone);
    this.$optionsClone.removeEventListener('click', this.click);
  }

  show () {
    const classNames = this.className.split(' ');
    if (classNames.includes('loading'))
      return;
    const rect = this.getBoundingClientRect();
    this.$optionsClone = this.$options.cloneNode(true);
    document.body.appendChild(this.$optionsClone);
    if (classNames.includes('up')) {
      const optionsRect = this.$options.getBoundingClientRect();
      this.$optionsClone.style.top = (rect.top - optionsRect.height - 3) + 'px';
      this.$optionsClone.style.left = rect.left + 'px';
      this.$optionsClone.addEventListener('click', this.click);
    }
    else {
      this.$optionsClone.style.top = (rect.bottom + 3) + 'px';
      this.$optionsClone.style.left = rect.left + 'px';
      this.$optionsClone.addEventListener('click', this.click);
    }
    this.className = this.baseClassName + ' expanded';
    this.open = true;
  }
}

customElements.define('select-box', SelectBox);
