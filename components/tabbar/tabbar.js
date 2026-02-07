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
    // 内部状态可以放在这里
  },

  /**
   * 组件的方法列表
   */
  methods: {
    onTabChange(e) {
      const { tab, url } = e.currentTarget.dataset;
      
      if (tab === this.properties.activeTab) return;

      // 如果是中间的记录按钮，通常是跳转到添加页面
      if (tab === 'add') {
        wx.navigateTo({
          url: url
        });
        return;
      }

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
    }
  }
})