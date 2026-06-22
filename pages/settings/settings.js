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
    version: '1.0.0'
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
    return '#2F80ED';
  },

  onAddFamily() {
    wx.navigateTo({
      url: '/pages/addFamily/addFamily'
    });
  },

  onEditFamily(e) {
    const familyId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/editFamily/editFamily?id='+familyId
    });
  },

  onManageReminderTypes() {
    wx.navigateTo({
      url: '/pages/reminder-types/reminder-types'
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
      content: '关爱家人小助手是一款专注于家人提醒、记录基础健康信息的应用，帮助您更好地照顾家人。',
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