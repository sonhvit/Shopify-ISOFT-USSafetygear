if (!customElements.get('klaviyo-back-in-stock')) {
  customElements.define(
    'klaviyo-back-in-stock',
    class KlaviyoBackInStock extends HTMLElement {
      constructor() {
        super();
        this.handleVariantChange = this.handleVariantChange.bind(this);
      }

      connectedCallback() {
        this.trigger = this.querySelector('.klaviyo-bis-trigger');
        this.modal = this.querySelector('basic-modal');

        document.addEventListener('variant:changed', this.handleVariantChange);
        if (window.FoxTheme && window.FoxTheme.pubsub) {
          this.unsubscriber = window.FoxTheme.pubsub.subscribe(
            window.FoxTheme.pubsub.PUB_SUB_EVENTS.variantChange,
            (event) => {
              if (event?.data?.variant) {
                this.updateState(event.data.variant);
              }
            }
          );
        }
      }

      disconnectedCallback() {
        document.removeEventListener('variant:changed', this.handleVariantChange);
        if (this.unsubscriber) {
          this.unsubscriber();
        }
      }

      handleVariantChange(event) {
        const variant = event.detail?.variant;
        if (variant) {
          this.updateState(variant);
        }
      }

      updateState(variant) {
        this.dataset.variantId = variant.id;
        if (variant.available) {
          this.classList.add('hidden');
          if (this.modal && typeof this.modal.hide === 'function') {
            this.modal.hide();
          }
        } else {
          this.classList.remove('hidden');
        }
      }

      openModal() {
        if (this.trigger) {
          this.trigger.click();
        } else if (this.modal && typeof this.modal.show === 'function') {
          this.modal.show();
        }
      }
    }
  );
}
