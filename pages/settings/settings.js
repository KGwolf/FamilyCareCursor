Page({
  data: {
    userInfo: {
      name: '张三',
      role: '主照护人',
      phone: '138****0000'
    },
    familyList: [
      { id: 1, name: '王建国', relation: '父亲', relationColor: '#ecb613' },
      { id: 2, name: '李美芳', relation: '母亲', relationColor: '#60a5fa' }
    ],
    remindEnabled: true,
    warningEnabled: true,
    version: '2.2.0'
  },

  onLoad() {
    // 可以在这里获取用户信息等
  },

  onAddFamily() {
    wx.navigateTo({
      url: '/pages/addFamily/addFamily'
    });
  },

  onRemindChange(e) {
    this.setData({
      remindEnabled: e.detail.value
    });
  },

  onWarningChange(e) {
    this.setData({
      warningEnabled: e.detail.value
    });
  },

  onAboutUs() {
    wx.showToast({
      title: '关于我们',
      icon: 'none'
    });
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 处理退出登录逻辑
          wx.reLaunch({
            url: '/pages/index/index'
          });
        }
      }
    });
  }
});