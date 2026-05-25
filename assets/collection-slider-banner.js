if (!customElements.get('collection-banner-slider')) {
  customElements.define(
    'collection-banner-slider',
    class CollectionBannerSlider extends HTMLElement {
      constructor() {
        super();
      }

      connectedCallback() {
        this.selectors = {
          sliderWrapper: '.collection-banner__items',
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
          pagination: '.swiper-pagination',
        };

        this.classes = {
          grid: 'f-grid',
          swiper: 'swiper',
          swiperWrapper: 'swiper-wrapper',
        };

        this.sectionId = this.dataset.sectionId;
        this.sectionEl = this.closest(`.section-${this.sectionId}`);
        this.sliderWrapper = this.querySelector(this.selectors.sliderWrapper);
        this.paginationEl = this.sectionEl.querySelector(this.selectors.pagination);
        this.items = parseInt(this.dataset.items || '4', 10);
        this.tabletItems = parseInt(this.dataset.tabletItems || '2', 10);
        this.mobileItems = parseInt(this.dataset.mobileItems || '1', 10);
        this.sliderInstance = false;

        const mql = window.matchMedia(FoxTheme.config.mediaQueryMobile);
        mql.onchange = this.init.bind(this);
        this.init();
      }

      init() {
        if (FoxTheme.config.mqlMobile) {
          this.initSlider();
        } else {
          this.initSlider();
        }
      }

      initSlider() {
        if (typeof this.sliderInstance === 'object') return;

        const columnGap = window.getComputedStyle(this.sliderWrapper).getPropertyValue('--f-column-gap');
        const spaceBetween = parseFloat(columnGap.replace('rem', '')) * 10 || 10;

        this.sliderOptions = {
          slidesPerView: this.mobileItems,
          spaceBetween: spaceBetween,
          navigation: {
            nextEl: this.sectionEl.querySelector(this.selectors.nextEl),
            prevEl: this.sectionEl.querySelector(this.selectors.prevEl),
          },
          pagination: {
            el: this.paginationEl,
            clickable: true,
          },
          breakpoints: {
            768: {
              slidesPerView: this.tabletItems,
            },
            1280: {
              slidesPerView: this.items,
            },
          },
          loop: false,
          threshold: 2,
          mousewheel: {
            enabled: true,
            forceToAxis: true,
          },
        };

        this.classList.add(this.classes.swiper);
        this.sliderWrapper.classList.remove(this.classes.grid);
        this.sliderWrapper.classList.add(this.classes.swiperWrapper);

        this.sliderInstance = new window.FoxTheme.Carousel(this, this.sliderOptions, [FoxTheme.Swiper.Mousewheel]);
        this.sliderInstance.init();

        if (Shopify.designMode) {
          document.addEventListener('shopify:block:select', (e) => {
            if (e.detail.sectionId != this.sectionId) return;
            const index = Number(e.target.dataset.index);
            this.sliderInstance.slider.slideTo(index);
          });
        }
      }
    }
  );
}