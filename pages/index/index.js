const { DataManager } = require('../../utils/data-manager');

Page({
  data: {
    hasFamily: false
  },

  onLoad() {
    this.checkFamilyMembers();
  },

  onShow() {
    this.checkFamilyMembers();
  },

  checkFamilyMembers() {
    const hasFamily = DataManager.hasFamilyMembers();
    this.setData({ hasFamily });

    if (hasFamily) {
      wx.reLaunch({
        url: '/pages/home/home'
      });
    }
  },

  onAddFamily() {
    wx.navigateTo({
      url: '/pages/addFamily/addFamily'
    });
  }
});
