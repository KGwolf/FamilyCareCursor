const { DataManager } = require('../../utils/data-manager');
const app = getApp();

Page({
  data: {
    userInfo: {
      name: '',
      role: '主照护人',
      phone: ''
    },
    familyList: [],
    remindEnabled: true,
    warningEnabled: true,
    version: '2.2.0'
  },

  onLoad() {
    this.loadSettings();
  },

  onShow() {
    this.loadSettings();
  },

  loadSettings() {
    const userInfo = app.globalData.userInfo;
    const familyMembers = app.globalData.familyMembers;
    const settings = app.globalData.settings;

    const familyList = familyMembers.map(m => ({
      id: m.id,
      name: m.name,
      relation: m.relationLabel,
      relationColor: this.getRelationColor(m.relation)
    }));

    this.setData({
      userInfo,
      familyList,
      remindEnabled: settings.remindEnabled,
      warningEnabled: settings.warningEnabled
    });
  },

  getRelationColor(relation) {
    const colors = {
      'father': '#ecb613',
      'mother': '#60a5fa',
      'spouse': '#f472b6',
      'other': '#94a3b8'
    };
    return colors[relation] || '#94a3b8';
  },

  onAddFamily() {
    wx.navigateTo({
      url: '/pages/addFamily/addFamily'
    });
  },

  onRemindChange(e) {
    const remindEnabled = e.detail.value;
    this.setData({ remindEnabled });
    
    const settings = DataManager.getSettings();
    settings.remindEnabled = remindEnabled;
    DataManager.setSettings(settings);
    app.refreshSettings();
  },

  onWarningChange(e) {
    const warningEnabled = e.detail.value;
    this.setData({ warningEnabled });
    
    const settings = DataManager.getSettings();
    settings.warningEnabled = warningEnabled;
    DataManager.setSettings(settings);
    app.refreshSettings();
  },

  onAboutUs() {
    wx.showModal({
      title: '关于我们',
      content: '家庭照护助手是一款专注于家庭健康管理的应用，帮助您更好地照顾家人的健康。',
      showCancel: false
    });
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.reLaunch({
            url: '/pages/index/index'
          });
        }
      }
    });
  }
});