const { DataManager } = require('../../utils/data-manager');
const app = getApp();

Page({
  data: {
    currentTarget: {
      id: null,
      name: '',
      avatar: ''
    },
    reminderTypes: [
      { id: 1, name: '用药提醒', icon: '💊' },
      { id: 2, name: '喝水提醒', icon: '💧' },
      { id: 3, name: '运动提醒', icon: '🏃' },
      { id: 4, name: '测量提醒', icon: '📊' },
      { id: 5, name: '就医提醒', icon: '🏥' },
      { id: 6, name: '其他提醒', icon: '📝' }
    ],
    selectedTypeIndex: 0,
    selectedTime: '08:30',
    frequencyOptions: [
      { id: 1, name: '每天', value: 'daily' },
      { id: 2, name: '每周一次', value: 'weekly' },
      { id: 3, name: '自定义', value: 'custom' }
    ],
    selectedFreqIndex: 0,
    remark: ''
  },

  timers: [],

  onLoad(options) {
    this.loadCurrentFamily();
    
    if (options.familyId) {
      this.loadFamilyInfo(options.familyId);
    }
  },

  onUnload() {
    this.clearAllTimers();
  },

  clearAllTimers() {
    this.timers.forEach(timer => clearTimeout(timer));
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

  onSelectType() {
    const { reminderTypes } = this.data;
    const itemList = reminderTypes.map(item => `${item.icon} ${item.name}`);
    
    wx.showActionSheet({
      itemList,
      success: (res) => {
        this.setData({
          selectedTypeIndex: res.tapIndex
        });
      }
    });
  },

  onSelectTime() {
    const that = this;
    // 提供一些常用的时间选项
    const timeOptions = [
      '06:00', '07:00', '08:00', '09:00',
      '10:00', '11:00', '12:00', '13:00',
      '14:00', '15:00', '16:00', '17:00',
      '18:00', '19:00', '20:00', '21:00',
      '22:00', '23:00'
    ];
    
    wx.showActionSheet({
      itemList: timeOptions,
      success(res) {
        that.setData({
          selectedTime: timeOptions[res.tapIndex]
        });
      }
    });
  },

  onSelectFrequency() {
    const { frequencyOptions, selectedFreqIndex } = this.data;
    const itemList = frequencyOptions.map(item => item.name);
    
    wx.showActionSheet({
      itemList,
      success: (res) => {
        this.setData({
          selectedFreqIndex: res.tapIndex
        });
      }
    });
  },

  onFreqSelect(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      selectedFreqIndex: index
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
      date: DataManager.formatDate(new Date()),
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
