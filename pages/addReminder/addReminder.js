const { DataManager } = require('../../utils/data-manager');
const app = getApp();

Page({
  data: {
    currentTarget: {
      id: null,
      name: '',
      avatar: ''
    },
    reminderTypes: [],
    selectedTypeIndex: 0,
    selectedTime: '08:30',
    frequencyOptions: [
      { id: 1, name: '每天', value: 'daily' },
      { id: 2, name: '自定义', value: 'custom' }
    ],
    selectedFreqIndex: 0,
    selectedDate: new Date().toISOString().split('T')[0], // 初始化为今天
    remark: ''
  },

  onLoad(options) {
    this.timers = [];
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
      this.setData({
        reminderTypes: types
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

  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  onSubmit() {
    const { currentTarget, reminderTypes, selectedTypeIndex, selectedTime, frequencyOptions, selectedFreqIndex, remark } = this.data;
    
    if (!currentTarget.id) {
      wx.showToast({
        title: '请选择提醒对象',
        icon: 'none'
      });
      return;
    }

    const reminderData = {
      id: Date.now(),
      familyId: currentTarget.id,
      targetName: currentTarget.name,
      type: reminderTypes[selectedTypeIndex],
      time: selectedTime,
      frequency: frequencyOptions[selectedFreqIndex].value,
      date: frequencyOptions[selectedFreqIndex].value === 'custom' ? this.data.selectedDate : DataManager.formatDate(new Date()),
      remark: remark,
      completed: false,
      createTime: new Date().toISOString()
    };

    const success = DataManager.addReminder(reminderData);

    if (success) {
      wx.showToast({
        title: '添加成功',
        icon: 'success',
        duration: 1500,
        success: () => {
          this.setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
    } else {
      wx.showToast({
        title: '添加失败，请重试',
        icon: 'none'
      });
    }
  }
});
