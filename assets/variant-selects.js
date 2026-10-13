if (!customElements.get('variant-selects')) {
  customElements.define(
    'variant-selects',
    class VariantSelects extends HTMLElement {
      constructor() {
        super();
      }

      get selectedOptionValues() {
        return Array.from(
          this.querySelectorAll('select option:checked, select option[selected], fieldset input:checked, input[type="radio"]:checked')
        )
          .map(({ dataset }) => dataset?.optionValueId)
          .filter(Boolean);
      }

      getInputForEventTarget(target) {
        if (!target) return target;
        return target.tagName === 'SELECT' ? (target.selectedOptions?.[0] || target) : target;
      }

      connectedCallback() {
        if (this._hasChangeListener) {
          return;
        }

        this._hasChangeListener = true;

        this.addEventListener(
          'change',
          (event) => {
            // Check if target is inside this element
            const targetInThisElement = this.contains(event.target);

            // Check if there's a nested variant-selects between this and target
            let hasNestedVariantSelects = false;
            let currentElement = event.target;

            while (currentElement && currentElement !== document.body) {
              if (currentElement.tagName === 'VARIANT-SELECTS') {
                if (currentElement !== this) {
                  hasNestedVariantSelects = true;
                  break;
                } else {
                  break;
                }
              }
              currentElement = currentElement.parentElement;
            }

            // Ignore if target is not in this element or there's a nested variant-selects
            if (!targetInThisElement || hasNestedVariantSelects) {
              return;
            }

            const target = this.getInputForEventTarget(event.target);
            this.updateSelectedSwatchValue(event);
            FoxTheme.pubsub.publish(FoxTheme.pubsub.PUB_SUB_EVENTS.optionValueSelectionChange, {
              data: {
                event,
                target,
                selectedOptionValues: this.selectedOptionValues,
              },
            });
          },
          true
        ); // Use CAPTURE phase to catch events before they bubble
      }

      disconnectedCallback() {
        this._hasChangeListener = false;
      }

      updateSelectedSwatchValue({ target }) {
        if (!target) return;
        const { value, tagName } = target;

        if (tagName === 'SELECT' && target.selectedOptions?.length) {
          const previouslySelected = Array.from(target.options).find((option) => option.hasAttribute('selected'));
          if (previouslySelected) {
            previouslySelected.removeAttribute('selected');
          }
          if (target.selectedOptions[0]) {
            target.selectedOptions[0].setAttribute('selected', 'selected');
          }

          const selectedOption = target.selectedOptions[0];
          const swatchValue = selectedOption?.dataset?.optionSwatchValue;
          const productFormInput = target.closest('.product-form__input');
          const selectedDropdownSwatchValue = productFormInput?.querySelector('[data-selected-value] > .swatch');
          if (!selectedDropdownSwatchValue) return;
          if (swatchValue) {
            selectedDropdownSwatchValue.style.setProperty('--swatch--background', swatchValue);
            selectedDropdownSwatchValue.classList.remove('swatch--unavailable');
          } else {
            selectedDropdownSwatchValue.style.setProperty('--swatch--background', 'unset');
            selectedDropdownSwatchValue.classList.add('swatch--unavailable');
          }

          selectedDropdownSwatchValue.style.setProperty(
            '--swatch-focal-point',
            selectedOption?.dataset?.optionSwatchFocalPoint || 'unset'
          );
        } else if (tagName === 'INPUT' && target.type === 'radio') {
          const selectedSwatchValue = target.closest(`.product-form__input`)?.querySelector('[data-selected-value]');
          if (selectedSwatchValue) selectedSwatchValue.innerHTML = value;
        }
      }
    }
  );
}
