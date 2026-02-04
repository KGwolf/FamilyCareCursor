// index.js
Page({
  data: {
    // 页面数据
  },

  onLoad() {
    // 页面加载时执行
  },

  onShow() {
    // 页面显示时执行
  },

  // 添加家人按钮点击事件
  onAddFamily() {
    wx.navigateTo({ url: '/pages/home/home' })
    // 跳转到添加家人页面
    // wx.navigateTo({
    //   url: '/pages/add-family/add-family'
    // });
    
    // 或者显示一个提示
    // wx.showToast({
    //   title: '功能开发中',
    //   icon: 'none'
    // });
  }
});
