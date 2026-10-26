Component({
  properties: {
    content: { type: String, value: '' }
  },

  data: {
    expanded: false,
    canExpand: false
  },

  observers: {
    content(content) {
      if (!this.contentReady || content === this.measuredContent) return;
      this.measuredContent = content;
      this.setData({ expanded: false, canExpand: false }, () => this.measureContent());
    }
  },

  lifetimes: {
    ready() {
      this.contentReady = true;
      this.measuredContent = this.data.content;
      this.measureContent();
    },
    detached() {
      this.contentReady = false;
    }
  },

  pageLifetimes: {
    resize() {
      this.measureContent();
    }
  },

  methods: {
    measureContent() {
      if (!this.contentReady) return;
      const version = this.measureVersion = (this.measureVersion || 0) + 1;
      const content = this.data.content;
      this.createSelectorQuery()
        .select('.review-content-measure').boundingClientRect()
        .select('.review-content-line').boundingClientRect()
        .exec(([full, line]) => {
          if (!this.contentReady || version !== this.measureVersion || content !== this.data.content) return;
          if (!full || !line || !line.height) return;
          this.setData({ canExpand: full.height > line.height * 4 + 1 });
        });
    },

    toggleExpanded() {
      this.setData({ expanded: !this.data.expanded });
    }
  }
});
