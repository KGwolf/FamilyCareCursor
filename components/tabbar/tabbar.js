// components/tabbar/tabbar.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    activeTab: {
      type: String,
      value: 'home'
    },
    isDark: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    showAddModal: false
  },

  /**
   * 组件的方法列表
   */
  methods: {
    onTabChange(e) {
      const { tab, url } = e.currentTarget.dataset;
      
      if (tab === this.properties.activeTab) return;

      // 其他标签使用 switchTab 或 reLaunch
      // 这里根据项目实际路由类型选择，通常底部导航使用 switchTab
      // 但如果页面不是 tabbar 页面，则使用 redirectTo 或 navigateTo
      wx.reLaunch({
        url: url,
        fail: () => {
          wx.navigateTo({
            url: url
          });
        }
      });

      this.triggerEvent('change', { tab });
    },

    // Modal functions
    showAddModal() {
      this.setData({
        showAddModal: true
      });
    },

    hideAddModal() {
      this.setData({
        showAddModal: false
      });
    },

    // Navigation functions
    navigateToReminder() {
      this.hideAddModal();
      wx.navigateTo({
        url: '/pages/addReminder/addReminder'
      });
    },

    navigateToWeight() {
      this.hideAddModal();
      wx.navigateTo({
        url: '/pages/addRecord/addRecord?tab=weight'
      });
    },

    navigateToSymptoms() {
      this.hideAddModal();
      wx.navigateTo({
        url: '/pages/addRecord/addRecord?tab=symptoms'
      });
    },

    // Empty function to prevent event bubbling
    noop() {
      // Do nothing
    }
  }
})