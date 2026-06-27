const { DataManager } = require('../../utils/data-manager');
const NotificationService = require('../../utils/notification-service');
const { BAAS_CONFIG } = require('../../utils/baas-config');
const app = getApp();

const CHANNEL_OPTIONS = [
  { label: '微信订阅消息', value: 'wechat_subscribe' },
  { label: '企业微信长期提醒', value: 'wecom_external' }
];

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
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    dailyPushLimit: 8,
    subscriptionRenewalPromptLimit: 2,
    subscriptionRenewalPromptCount: 0,
    notificationChannel: 'wechat_subscribe',
    channelOptions: CHANNEL_OPTIONS,
    channelIndex: 0,
    pushStatusText: '未开启',
    bindingStatusText: '未检查',
    version: '1.0.0'
  },

  onLoad() {
    this.loadSettings();
  },

  onShow() {
    this.loadSettings();
  },

  onBack() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pages/home/home' })
    });
  },

  loadSettings() {
    const userInfo = app.globalData.userInfo;
    const familyMembers = app.globalData.familyMembers;
    const settings = {
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      dailyPushLimit: 8,
      subscriptionRenewalPromptLimit: 2,
      notificationChannel: 'wechat_subscribe',
      ...app.globalData.settings
    };
    const channelIndex = Math.max(0, CHANNEL_OPTIONS.findIndex(item => item.value === settings.notificationChannel));
    const renewalStats = NotificationService.getSubscriptionRenewalStats();

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
      warningEnabled: settings.warningEnabled,
      quietHoursEnabled: settings.quietHoursEnabled,
      quietHoursStart: settings.quietHoursStart,
      quietHoursEnd: settings.quietHoursEnd,
      dailyPushLimit: settings.dailyPushLimit,
      subscriptionRenewalPromptLimit: settings.subscriptionRenewalPromptLimit,
      subscriptionRenewalPromptCount: renewalStats.promptCount,
      notificationChannel: settings.notificationChannel,
      channelIndex,
      pushStatusText: settings.remindEnabled === false ? '已关闭' : '已开启',
      bindingStatusText: settings.notificationChannel === 'wecom_external' ? '企业微信通道' : '微信订阅通道'
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
    this.setData({
      remindEnabled,
      pushStatusText: remindEnabled ? '已开启' : '已关闭'
    });
    
    const settings = DataManager.getSettings();
    settings.remindEnabled = remindEnabled;
    DataManager.setSettings(settings);
    app.refreshSettings();
  },

  onQuietHoursChange(e) {
    const quietHoursEnabled = e.detail.value;
    this.saveNotificationSettings({ quietHoursEnabled });
  },

  onQuietStartChange(e) {
    this.saveNotificationSettings({ quietHoursStart: e.detail.value });
  },

  onQuietEndChange(e) {
    this.saveNotificationSettings({ quietHoursEnd: e.detail.value });
  },

  onDailyLimitChange(e) {
    const value = Math.min(Math.max(parseInt(e.detail.value, 10) || 8, 1), 100);
    this.saveNotificationSettings({ dailyPushLimit: value });
  },

  onRenewalPromptLimitChange(e) {
    const rawValue = parseInt(e.detail.value, 10);
    const value = Number.isFinite(rawValue) ? Math.max(rawValue, 0) : 2;
    this.saveNotificationSettings({ subscriptionRenewalPromptLimit: value });
  },

  onChannelChange(e) {
    const channelIndex = Number(e.detail.value) || 0;
    const option = CHANNEL_OPTIONS[channelIndex] || CHANNEL_OPTIONS[0];
    this.saveNotificationSettings({
      notificationChannel: option.value
    });
  },

  onBindWecom() {
    if (!BAAS_CONFIG.wecomBindUrl) {
      wx.showModal({
        title: '暂未配置绑定入口',
        content: '企业微信长期提醒需要先配置企业微信 OAuth 回调地址和 SCF HTTP 绑定函数。当前不会影响微信订阅消息。',
        showCancel: false
      });
      return;
    }

    wx.setClipboardData({
      data: BAAS_CONFIG.wecomBindUrl,
      success: () => {
        wx.showToast({ title: '绑定链接已复制', icon: 'success' });
      }
    });
  },

  saveNotificationSettings(patch) {
    const settings = {
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      dailyPushLimit: 8,
      subscriptionRenewalPromptLimit: 2,
      notificationChannel: 'wechat_subscribe',
      ...DataManager.getSettings(),
      ...patch
    };
    DataManager.setSettings(settings);
    app.refreshSettings();
    this.loadSettings();
  },

  onRevokeCloudNotifications() {
    wx.showModal({
      title: '关闭云端提醒',
      content: '关闭后，将停止云端推送并解除当前通知授权记录。本地提醒和家人资料不会被删除，以后如需接收通知需要重新授权。',
      confirmText: '确认关闭',
      confirmColor: '#EA4335',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中' });
        NotificationService.revokeCloudNotificationBindings()
          .then(() => {
            app.refreshSettings();
            this.loadSettings();
            wx.showToast({ title: '已关闭云端提醒', icon: 'success' });
          })
          .catch(error => {
            console.error('关闭云端提醒失败', error);
            wx.showToast({ title: '关闭失败，请重试', icon: 'none' });
          })
          .finally(() => wx.hideLoading());
      }
    });
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
      content: '家人照护记用于记录家人的日常安排、身体状态、体重变化和重要日期，方便随时查看与回顾。当前数据仅保存在本机。',
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
