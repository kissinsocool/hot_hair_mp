Component({
  data: {
    hidden: false,
    initialized: false,
    selected: 0,
    list: [
      {
        pagePath: 'pages/home/home',
        text: '探店',
        iconPath: '/assets/icons/storefront_outlined.png',
        selectedIconPath: '/assets/icons/storefront.png'
      },
      {
        pagePath: 'pages/favorites/favorites',
        text: '收藏',
        iconPath: '/assets/icons/favorite_border.png',
        selectedIconPath: '/assets/icons/favorite.png'
      },
      {
        pagePath: 'pages/orders/orders',
        text: '订单',
        iconPath: '/assets/icons/receipt_long_outline.png',
        selectedIconPath: '/assets/icons/receipt_long.png'
      },
      {
        pagePath: 'pages/profile/profile',
        text: '我',
        iconPath: '/assets/icons/person_outline.png',
        selectedIconPath: '/assets/icons/person.png'
      }
    ]
  },

  lifetimes: {
    attached() {
      this.syncSelected();
    },
    ready() {
      this.syncSelected();
    }
  },

  pageLifetimes: {
    show() {
      this.syncSelected();
      if (this.data.hidden) this.setData({ hidden: false });
    }
  },

  methods: {
    syncSelected() {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const selectedByRoute = current
        ? this.data.list.findIndex((item) => item.pagePath === current.route)
        : -1;
      if (selectedByRoute >= 0) this.select(selectedByRoute);
    },

    switchTab(e) {
      const selected = Number(e.currentTarget.dataset.index);
      const item = this.data.list[selected];
      if (!item) return;
      if (selected === this.data.selected) return;
      wx.switchTab({ url: `/${item.pagePath}` });
    },

    select(selected) {
      if (this.data.initialized && selected === this.data.selected && this.data.list[selected] && this.data.list[selected].selected) return;
      this.setData({
        initialized: true,
        selected,
        list: this.data.list.map((item, index) => ({
          ...item,
          selected: index === selected
        }))
      });
    },

    hide() {
      if (this.data.hidden) return;
      this.setData({ hidden: true });
    },

    show() {
      this.syncSelected();
      if (!this.data.hidden) return;
      this.setData({ hidden: false });
    }
  }
});
