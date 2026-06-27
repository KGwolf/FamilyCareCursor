const { DataManager } = require('../../utils/data-manager');
const NotificationService = require('../../utils/notification-service');
const app = getApp();

function currentTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

Page({
  data: {
    pageTitle: '新建事项',
    fromOnboarding: false,
    isImportant: false,
    presetSchedule: false,
    currentTarget: {
      id: null,
      name: '',
      avatar: ''
    },
    reminderTypes: [],
    selectedTypeIndex: 0,
    selectedTime: currentTimeValue(),
    frequencyOptions: [
      { id: 1, name: '仅一次', value: 'custom' },
      { id: 2, name: '每天重复', value: 'daily' }
    ],
    selectedFreqIndex: 0,
    selectedDate: DataManager.formatDate(new Date()),
    remark: '',
    isSubmitting: false
  },

  onLoad(options) {
    this.timers = [];
    const presetSchedule = options.mode === 'schedule';
    this.setData({
      fromOnboarding: options.from === 'onboarding',
      presetSchedule,
      isImportant: presetSchedule,
      selectedTime: currentTimeValue()
    });
    this.loadCurrentFamily();

    if (options.familyId) {
      this.loadFamilyInfo(options.familyId);
    }
  },

  onShow() {
    this.loadReminderTypes();
  },

  onUnload() {
    this.clearAllTimers();
  },

  clearAllTimers() {
    if (this.timers && Array.isArray(this.timers)) {
      this.timers.forEach(timer => clearTimeout(timer));
    }
    this.timers = [];
  },

  setTimeout(callback, delay) {
    const timer = setTimeout(() => {
      callback();
      this.timers = this.timers.filter(t => t !== timer);
    }, delay);
    this.timers.push(timer);
    return timer;
  },

  loadCurrentFamily() {
    const currentFamily = app.globalData.currentFamily;
    if (currentFamily) {
      this.setData({
        'currentTarget.id': currentFamily.id,
        'currentTarget.name': currentFamily.name,
        'currentTarget.avatar': currentFamily.avatar
      });
    }
  },

  loadFamilyInfo(familyId) {
    const familyMembers = app.globalData.familyMembers;
    const family = familyMembers.find(m => m.id === familyId);
    if (family) {
      this.setData({
        'currentTarget.id': family.id,
        'currentTarget.name': family.name,
        'currentTarget.avatar': family.avatar
      });
    }
  },

  loadReminderTypes() {
    if (DataManager && typeof DataManager.getReminderTypes === 'function') {
      const types = DataManager.getReminderTypes();
      const reviewIndex = types.findIndex(type => type.name === '复查');
      this.setData({
        reminderTypes: types,
        selectedTypeIndex: this.data.presetSchedule && reviewIndex >= 0 ? reviewIndex : this.data.selectedTypeIndex
      });
    }
  },

  onSwitchTarget() {
    const familyMembers = app.globalData.familyMembers;
    if (familyMembers.length === 0) {
      wx.showToast({
        title: '暂无家人',
        icon: 'none'
      });
      return;
    }
    
    const names = familyMembers.map(m => m.name);
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const selected = familyMembers[res.tapIndex];
        this.setData({
          'currentTarget.id': selected.id,
          'currentTarget.name': selected.name,
          'currentTarget.avatar': selected.avatar
        });
      }
    });
  },

  onSelectType(e) {
    this.setData({
      selectedTypeIndex: e.detail.value
    });
  },

  onFreqSelect(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      selectedFreqIndex: index
    });
  },

  onDateChange(e) {
    this.setData({
      selectedDate: e.detail.value
    });
  },

  onTimeChange(e) {
    this.setData({
      selectedTime: e.detail.value
    });
  },

  onImportantChange(e) {
    this.setData({ isImportant: e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  onSubmit() {
    if (this.isSubmitting || this.data.isSubmitting) return;
    this.isSubmitting = true;
    this.setData({ isSubmitting: true });
    const { currentTarget, reminderTypes, selectedTypeIndex, selectedTime, frequencyOptions, selectedFreqIndex, remark, isImportant } = this.data;
    
    if (!currentTarget.id) {
      this.isSubmitting = false;
      this.setData({ isSubmitting: false });
      wx.showToast({
        title: '请选择提醒对象',
        icon: 'none'
      });
      return;
    }

    const reminderType = { ...reminderTypes[selectedTypeIndex] };
    delete reminderType.isKey;

    const reminderData = {
      id: Date.now(),
      familyId: currentTarget.id,
      targetName: currentTarget.name,
      type: reminderType,
      important: isImportant,
      time: selectedTime,
      frequency: frequencyOptions[selectedFreqIndex].value,
      date: frequencyOptions[selectedFreqIndex].value === 'custom' ? this.data.selectedDate : DataManager.formatDate(new Date()),
      remark: remark,
      completed: false,
      category: 'item',
      createTime: new Date().toISOString()
    };

    const success = DataManager.addReminder(reminderData);

    if (success) {
      const finishSave = () => this.showSaveSuccess();
      NotificationService.requestReminderSubscription({ countAsPrompt: false }).then(result => {
        if (result && result.accepted) {
          NotificationService.markReminderSubscriptionGranted(reminderData);
        }
        finishSave();
      }, error => {
        console.error('订阅消息授权记录失败', error);
        finishSave();
      });
    } else {
      this.isSubmitting = false;
      this.setData({ isSubmitting: false });
      wx.showToast({
        title: '添加失败，请重试',
        icon: 'none'
      });
    }
  },

  showSaveSuccess() {
    wx.showToast({
      title: '事项已保存',
      icon: 'success',
      duration: 1500,
      success: () => {
        this.setTimeout(() => {
          this.finishEditing();
        }, 1500);
      }
    });
  },

  onBack() {
    this.finishEditing();
  },

  finishEditing() {
    if (this.isFinishing) return;
    this.isFinishing = true;
    if (this.data.fromOnboarding) {
      wx.reLaunch({
        url: '/pages/home/home',
        fail: () => { this.isFinishing = false; }
      });
    } else {
      wx.navigateBack({
        fail: () => { this.isFinishing = false; }
      });
    }
  }
});
