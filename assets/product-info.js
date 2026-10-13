if (!customElements.get('product-info')) {
  customElements.define(
    'product-info',
    class ProductInfo extends HTMLElement {
      abortController = undefined;
      onVariantChangeUnsubscriber = undefined;
      pendingRequestUrl = null;
      preProcessHtmlCallbacks = [];
      postProcessHtmlCallbacks = [];

      constructor() {
        super();
      }

      get variantSelectors() {
        return this.querySelector('variant-selects');
      }

      get productId() {
        return this.getAttribute('data-product-id');
      }

      get sectionId() {
        return this.dataset.originalSection || this.dataset.section;
      }

      get pickupAvailability() {
        return this.querySelector(`pickup-availability`);
      }

      get quantityInput() {
        return this.querySelector('quantity-input input');
      }

      get productMediaWrapper() {
        return (this._productMediaWrapper = this._productMediaWrapper || this.querySelector('.product__media-wrapper'));
      }

      connectedCallback() {
        this.initializeProductSwapUtility();

        this.onVariantChangeUnsubscriber = FoxTheme.pubsub.subscribe(
          FoxTheme.pubsub.PUB_SUB_EVENTS.optionValueSelectionChange,
          this.handleOptionValueChange.bind(this),
        );

        this.initQuantityHandlers();

        this.currentVariant = this.getSelectedVariant(this);
        if (this.currentVariant) {
          this.updateMedia(this.currentVariant);
        }

        if (this.productMediaWrapper) {
          this.blockPositionHandler = this.handleBlocksPosition.bind(this);
          this.handleBlocksPosition();
          document.addEventListener('matchMobile', this.blockPositionHandler);
          document.addEventListener('unmatchMobile', this.blockPositionHandler);
        }
      }

      handleBlocksPosition() {
        const isMobile = FoxTheme.config.mqlMobile;
        const blocks = this.querySelectorAll(`.product__block[data-show-below-media="true"]`);

        blocks.forEach((block) => {
          const blockId = block.dataset.blockId;
          const blockPlacement = this.productMediaWrapper.querySelector(`[data-block-id="${blockId}"]`);
          if (!blockPlacement) return;

          if (isMobile) {
            const isMoveToMedia = block.hasAttribute('data-moved-below-media');
            if (isMoveToMedia) {
              block.innerHTML = blockPlacement.innerHTML;
              blockPlacement.innerHTML = '';
              block.removeAttribute('data-moved-below-media');
            }
          } else {
            blockPlacement.innerHTML = block.innerHTML;
            block.innerHTML = '';
            block.setAttribute('data-moved-below-media', '');
          }
        });
      }

      disconnectedCallback() {
        this.onVariantChangeUnsubscriber?.();
        this.cartUpdateUnsubscriber?.();
        if (this.blockPositionHandler) {
          document.removeEventListener('matchMobile', this.blockPositionHandler);
          document.removeEventListener('unmatchMobile', this.blockPositionHandler);
        }
        if (this.timer) {
          clearInterval(this.timer);
        }
      }

      initializeProductSwapUtility() {
        this.postProcessHtmlCallbacks.push((newNode) => {
          window?.Shopify?.PaymentButton?.init();
          window?.ProductModel?.loadShopifyXR();
        });
      }

      handleOptionValueChange({ data: { event, target, selectedOptionValues } }) {
        if (!event?.target || !this.contains(event.target)) return;

        this.resetProductFormState();

        const productUrl = target?.dataset?.productUrl || this.pendingRequestUrl || this.dataset.url;
        const shouldSwapProduct = this.dataset.url !== productUrl;
        const shouldFetchFullPage = this.dataset.updateUrl === 'true' && shouldSwapProduct;
        const viewMode = this.dataset.viewMode || 'main-product';

        this.renderProductInfo({
          requestUrl: this.buildRequestUrlWithParams(productUrl, selectedOptionValues || [], shouldFetchFullPage),
          targetId: target?.id,
          callback: shouldSwapProduct
            ? this.handleSwapProduct(productUrl, shouldFetchFullPage, viewMode)
            : this.handleUpdateProductInfo(productUrl, viewMode),
        });
      }

      get productForm() {
        return this.querySelector('form[is="product-form"');
      }

      resetProductFormState() {
        const productForm = this.productForm;
        productForm?.resetFormState();
      }

      handleSwapProduct(productUrl, updateFullPage, viewMode) {
        return (html) => {
          if (!html) return;
          const selector = updateFullPage ? "product-info[id^='MainProduct']" : 'product-info';
          const targetNode = html.querySelector(selector) || html.querySelector('product-info');
          const variant = this.getSelectedVariant(targetNode);

          this.updateURL(productUrl, variant?.id);

          if (updateFullPage) {
            const newTitle = html.querySelector('head title');
            if (newTitle) {
              const headTitle = document.querySelector('head title');
              if (headTitle) headTitle.innerHTML = newTitle.innerHTML;
            }
            HTMLUpdateUtility.viewTransition(
              document.querySelector('main'),
              html.querySelector('main'),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks,
            );
            HTMLUpdateUtility.viewTransition(
              document.getElementById('shopify-section-sticky-atc-bar'),
              html.getElementById('shopify-section-sticky-atc-bar'),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks,
            );
          } else {
            HTMLUpdateUtility.viewTransition(
              this,
              targetNode,
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks,
            );
          }

          this.currentVariant = variant;
        };
      }

      handleUpdateProductInfo(productUrl, viewMode) {
        return (html) => {
          if (!html) return;
          const variant = this.getSelectedVariant(html);

          this.pickupAvailability?.update(variant);
          this.updateOptionValues(html);
          this.updateURL(productUrl, variant?.id);
          this.updateShareUrl(variant?.id);
          this.updateVariantInputs(variant?.id);

          this.currentVariant = variant;

          if (!variant) {
            this.setUnavailable();
            document.dispatchEvent(
              new CustomEvent('variant:changed', {
                detail: {
                  variant: null,
                },
              }),
            );
            FoxTheme.pubsub.publish(FoxTheme.pubsub.PUB_SUB_EVENTS.variantChange, {
              data: {
                sectionId: this.sectionId,
                html,
                variant: null,
              },
            });
            return;
          }

          this.updateMedia(variant);

          const updateSourceFromDestination = (id, shouldHide = (source) => false) => {
            const source = html.getElementById(`${id}-${this.sectionId}`);
            const destination = this.querySelector(`#${id}-${this.dataset.section}`) || this.querySelector(`#${id}-${this.sectionId}`);
            if (source && destination) {
              destination.innerHTML = source.innerHTML;
              destination.classList.toggle('hidden', shouldHide(source));
            }
          };

          updateSourceFromDestination('price');
          updateSourceFromDestination('Sku', (source) => source?.classList?.contains('hidden'));
          updateSourceFromDestination('Barcode', (source) => source?.classList?.contains('hidden'));
          updateSourceFromDestination('Inventory', (source) => source?.innerText === '');
          updateSourceFromDestination('Badges', (source) => source?.classList?.contains('hidden'));
          updateSourceFromDestination('PricePerItem', (source) => source?.classList?.contains('hidden'));
          updateSourceFromDestination('Volume');
          updateSourceFromDestination('ComingSoon', (source) => source?.classList?.contains('hidden'));
          updateSourceFromDestination('ProductFormButtons', (source) => source?.classList?.contains('hidden'));
          updateSourceFromDestination('QuantityForm', (source) => source?.classList?.contains('hidden'));

          const comingSoon = this.querySelector(`#ComingSoon-${this.dataset.section}`) || this.querySelector(`#ComingSoon-${this.sectionId}`);
          const formButtons = this.querySelector(`#ProductFormButtons-${this.dataset.section}`) || this.querySelector(`#ProductFormButtons-${this.sectionId}`);
          const qtyForm = this.querySelector(`#QuantityForm-${this.dataset.section}`) || this.querySelector(`#QuantityForm-${this.sectionId}`);
          if (comingSoon && comingSoon.dataset.hideBuyButtons === 'true') {
            const isSoldOut = !variant || !variant.available;
            comingSoon.classList.toggle('hidden', !isSoldOut);
            if (formButtons) formButtons.classList.toggle('hidden', isSoldOut);
            if (qtyForm) qtyForm.classList.toggle('hidden', isSoldOut);
          }

          this.updateQuantityRules(this.sectionId, this.productId, html);
          const quantityRules = this.querySelector(`#QuantityRules-${this.dataset.section}`) || this.querySelector(`#QuantityRules-${this.sectionId}`);
          quantityRules?.classList.remove('hidden');
          const volumeNote = this.querySelector(`#VolumeNote-${this.dataset.section}`) || this.querySelector(`#VolumeNote-${this.sectionId}`);
          volumeNote?.classList.remove('hidden');

          HTMLUpdateUtility.viewTransition(
            document.querySelector(`#SizeChart-${this.sectionId}`),
            html.querySelector(`#SizeChart-${this.sectionId}`),
            this.preProcessHtmlCallbacks,
            this.postProcessHtmlCallbacks,
          );

          const addButtonUpdated = html.getElementById(`ProductSubmitButton-${this.sectionId}`);
          this.toggleAddButton(
            addButtonUpdated ? addButtonUpdated.hasAttribute('disabled') : true,
            FoxTheme.variantStrings.soldOut,
          );

          document.dispatchEvent(
            new CustomEvent('variant:changed', {
              detail: {
                variant: this.currentVariant,
              },
            }),
          );

          FoxTheme.pubsub.publish(FoxTheme.pubsub.PUB_SUB_EVENTS.variantChange, {
            data: {
              sectionId: this.sectionId,
              html,
              variant,
            },
          });
        };
      }

      buildRequestUrlWithParams(url, optionValues, shouldFetchFullPage = false) {
        const params = [];

        !shouldFetchFullPage && params.push(`section_id=${this.sectionId}`);

        if (optionValues && optionValues.length) {
          const validValues = optionValues.filter(Boolean);
          if (validValues.length) {
            params.push(`option_values=${validValues.join(',')}`);
          }
        }

        return `${url}?${params.join('&')}`;
      }

      getSelectedVariant(productInfoNode) {
        if (!productInfoNode) return null;
        const selectedVariant = productInfoNode.querySelector('variant-selects [data-selected-variant]')?.innerHTML;
        try {
          return selectedVariant ? JSON.parse(selectedVariant) : null;
        } catch (e) {
          console.error('Error parsing variant JSON:', e);
          return null;
        }
      }

      renderProductInfo({ requestUrl, targetId, callback }) {
        this.abortController?.abort();
        this.abortController = new AbortController();

        fetch(requestUrl, { signal: this.abortController.signal })
          .then((response) => response.text())
          .then((responseText) => {
            this.pendingRequestUrl = null;
            const html = new DOMParser().parseFromString(responseText, 'text/html');
            callback(html);
          })
          .then(() => {
            // set focus to last clicked option value
            if (targetId) document.querySelector(`#${targetId}`)?.focus();
          })
          .catch((error) => {
            if (error.name === 'AbortError') {
              console.log('Fetch aborted by user');
            } else {
              console.error(error);
            }
          });
      }

      updateOptionValues(html) {
        const variantSelects = html?.querySelector('variant-selects');
        if (variantSelects && this.variantSelectors) {
          HTMLUpdateUtility.viewTransition(this.variantSelectors, variantSelects, this.preProcessHtmlCallbacks);
        }
      }

      updateURL(url, variantId) {
        if (this.dataset.updateUrl === 'false') return;
        window.history.replaceState({}, '', `${url}${variantId ? `?variant=${variantId}` : ''}`);
      }

      updateVariantInputs(variantId) {
        const forms = new Set([
          ...document.querySelectorAll(`#product-form-${this.sectionId}, #product-form-${this.dataset.section}, #product-form-installment-${this.sectionId}, #product-form-installment-${this.dataset.section}`),
          ...this.querySelectorAll('form[is="product-form"], form[action*="/cart/add"]')
        ]);

        forms.forEach((productForm) => {
          const input = productForm.querySelector('input[name="id"], select[name="id"]');
          if (input) {
            input.value = variantId ?? '';
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }

      updateMedia(variant) {
        if (!variant) return;
        const productMedia = this.querySelector(`[id^="MediaGallery-${this.dataset.section}"]`) || this.querySelector(`[id^="MediaGallery-${this.sectionId}"]`);
        if (!productMedia) return; // Early return if productMedia is not found

        const setActiveMedia = () => {
          if (typeof productMedia.setActiveMedia === 'function') {
            productMedia.init?.();
            productMedia.setActiveMedia(variant);
            return true; // Indicate success
          }
          return false; // Indicate failure
        };

        if (!setActiveMedia()) {
          this.timer = setInterval(() => {
            if (setActiveMedia()) {
              clearInterval(this.timer);
            }
          }, 100);
        }
      }

      updateShareUrl(variantId) {
        if (!variantId) return;
        const shareButton = document.getElementById(`ProductShare-${this.dataset.section}`) || document.getElementById(`ProductShare-${this.sectionId}`);
        if (!shareButton || !shareButton.updateUrl) return;
        shareButton.updateUrl(`${window.shopUrl}${this.dataset.url}?variant=${variantId}`);
      }

      toggleAddButton(disable = true, text, modifyClass = true) {
        const productForm =
          this.querySelector('form[is="product-form"]') ||
          document.getElementById(`product-form-${this.sectionId}`) ||
          document.getElementById(`product-form-${this.dataset.section}`);
        if (!productForm) return;
        const addButton = productForm.querySelector('[name="add"]');
        if (!addButton) return;
        const addButtonText =
          addButton.querySelector('.btn__text') ||
          addButton.querySelector('span') ||
          addButton;

        if (disable) {
          addButton.setAttribute('disabled', 'disabled');
          if (text && addButtonText) addButtonText.textContent = text;
        } else {
          addButton.removeAttribute('disabled');
          if (addButtonText) addButtonText.innerHTML = FoxTheme.variantStrings.addToCart;
        }

        if (!modifyClass) return;
      }

      setUnavailable() {
        this.toggleAddButton(true, FoxTheme.variantStrings.unavailable);
        const price = this.querySelector(`#price-${this.sectionId}`) || document.getElementById(`price-${this.dataset.section}`);
        const inventory = this.querySelector(`#Inventory-${this.sectionId}`) || document.getElementById(`Inventory-${this.dataset.section}`);
        const sku = this.querySelector(`#Sku-${this.sectionId}`) || document.getElementById(`Sku-${this.dataset.section}`);
        const comingSoon = this.querySelector(`#ComingSoon-${this.sectionId}`) || document.getElementById(`ComingSoon-${this.dataset.section}`);
        const formButtons = this.querySelector(`#ProductFormButtons-${this.sectionId}`) || document.getElementById(`ProductFormButtons-${this.dataset.section}`);
        const qtyForm = this.querySelector(`#QuantityForm-${this.sectionId}`) || document.getElementById(`QuantityForm-${this.dataset.section}`);

        if (price) price.classList.add('hidden');
        if (inventory) inventory.classList.add('hidden');
        if (sku) sku.classList.add('hidden');
        if (comingSoon && comingSoon.dataset.hideBuyButtons === 'true') {
          comingSoon.classList.remove('hidden');
          if (formButtons) formButtons.classList.add('hidden');
          if (qtyForm) qtyForm.classList.add('hidden');
        }
      }

      initQuantityHandlers() {
        if (!this.quantityInput) return;

        this.setQuantityBoundries();
        if (!this.hasAttribute('data-original-section')) {
          this.cartUpdateUnsubscriber = FoxTheme.pubsub.subscribe(
            FoxTheme.pubsub.PUB_SUB_EVENTS.cartUpdate,
            this.fetchQuantityRules.bind(this),
          );
        }
      }

      setQuantityBoundries() {
        FoxTheme.pubsub.publish(FoxTheme.pubsub.PUB_SUB_EVENTS.quantityBoundries, {
          data: {
            sectionId: this.sectionId,
            productId: this.productId,
          },
        });
      }

      fetchQuantityRules() {
        const currentVariantId = this.productForm?.productIdInput?.value;
        if (!currentVariantId) return;

        this.querySelector('.quantity__rules-cart')?.classList.add('btn--loading');

        fetch(`${this.getAttribute('data-url')}?variant=${currentVariantId}&section_id=${this.sectionId}`)
          .then((response) => response.text())
          .then((responseText) => {
            const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');
            this.updateQuantityRules(this.sectionId, this.productId, parsedHTML);
          })
          .catch((error) => {
            console.error(error);
          })
          .finally(() => {
            this.querySelector('.quantity__rules-cart')?.classList.remove('btn--loading');
          });
      }

      updateQuantityRules(sectionId, productId, parsedHTML) {
        if (!this.quantityInput) return;

        FoxTheme.pubsub.publish(FoxTheme.pubsub.PUB_SUB_EVENTS.quantityRules, {
          data: {
            sectionId,
            productId,
            parsedHTML,
          },
        });

        this.setQuantityBoundries();
      }
    },
  );
}

if (!customElements.get('product-promotion-alert')) {
  customElements.define(
    'product-promotion-alert',
    class ProductPromotionAlert extends HTMLElement {
      constructor() {
        super();

        this.abortController = new AbortController();
        this.buttonEl = this.querySelector('button');
        if (this.buttonEl) {
          this.buttonEl.addEventListener('click', this.onClick.bind(this), {
            signal: this.abortController.signal,
          });
        }
      }

      onClick(evt) {
        evt.preventDefault();

        const block = this.closest('.product__block');
        if (block) block.classList.add('hidden');
      }

      disconnectedCallback() {
        this.abortController?.abort();
      }
    },
  );
}
