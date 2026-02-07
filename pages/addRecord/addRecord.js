// pages/addRecord/addRecord.js
Page({
  data: {
    activeTab: 'weight', // 'weight' or 'symptoms'
    recordTime: '今天, 14:30',
    weight: '65.5',
    weightDiff: '-0.2',
    notes: '',
    symptoms: [
      { id: 'pain', name: '疼痛', icon: '🤕', materialIcon: 'personal_injury', color: 'primary', selected: true },
      { id: 'nausea', name: '恶心', icon: '🤢', materialIcon: 'sick', color: 'orange', selected: false },
      { id: 'fatigue', name: '疲劳', icon: '😫', materialIcon: 'bedtime', color: 'blue', selected: false },
      { id: 'fever', name: '发热', icon: '🤒', materialIcon: 'thermostat', color: 'red', selected: false },
      { id: 'dizzy', name: '头晕', icon: '😵', materialIcon: 'emergency', color: 'purple', selected: false },
      { id: 'other', name: '其他', icon: '❓', materialIcon: 'more_horiz', color: 'slate', selected: false }
    ]
  },

  onLoad(options) {
    // 设置当前时间
    this.setCurrentTime();
  },

  setCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.setData({
      recordTime: `今天, ${hours}:${minutes}`
    });
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
  },

  onSymptomTap(e) {
    const id = e.currentTarget.dataset.id;
    const symptoms = this.data.symptoms.map(s => {
      if (s.id === id) {
        return { ...s, selected: !s.selected };
      }
      return s;
    });
    this.setData({ symptoms });
  },

  onNoteInput(e) {
    this.setData({
      notes: e.detail.value
    });
  },

  onSave() {
    wx.showLoading({
      title: '正在保存...',
    });
    
    // 模拟保存操作
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000,
        success: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 2000);
        }
      });
    }, 1000);
  },

  onBack() {
    wx.navigateBack();
  },

  onSelectTime() {
    // 模拟时间选择器
    wx.showToast({
      title: '时间选择器',
      icon: 'none'
    });
  }
});
