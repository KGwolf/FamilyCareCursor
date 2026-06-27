const { DataManager } = require('../../utils/data-manager');
const app = getApp();

const getCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

Page({
  data: {
    activeTab: 'weight',
    weight: '',
    weightDiff: '0',
    notes: '',
    occurrenceDate: DataManager.formatDate(new Date()),
    occurrenceTime: getCurrentTime(),
    fromOnboarding: false,
    symptoms: [
      { id: 'diarrhea', name: '腹泻', icon: '🚽', materialIcon: 'water_drop', color: 'orange', selected: false },
      { id: 'hoarse', name: '声音嘶哑', icon: '🗣️', materialIcon: 'record_voice_over', color: 'purple', selected: false },
      { id: 'pain', name: '疼痛', icon: '🤕', materialIcon: 'personal_injury', color: 'primary', selected: false },
      { id: 'nausea', name: '恶心', icon: '🤢', materialIcon: 'sick', color: 'orange', selected: false },
      { id: 'fatigue', name: '疲劳', icon: '😫', materialIcon: 'bedtime', color: 'blue', selected: false },
      { id: 'fever', name: '发热', icon: '🤒', materialIcon: 'thermostat', color: 'red', selected: false },
      { id: 'cold', name: '感冒', icon: '🤧', materialIcon: 'coronavirus', color: 'blue', selected: false },
      { id: 'dizzy', name: '头晕', icon: '😵', materialIcon: 'emergency', color: 'purple', selected: false },
      { id: 'other', name: '其他', icon: '❓', materialIcon: 'more_horiz', color: 'slate', selected: false }
    ]
  },

  timers: [],

  onLoad(options) {
    this.setData({
      activeTab: options.tab || this.data.activeTab,
      fromOnboarding: options.from === 'onboarding',
      occurrenceDate: DataManager.formatDate(new Date()),
      occurrenceTime: getCurrentTime()
    });
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

  onWeightInput(e) {
    const weight = e.detail.value;
    let weightDiff = '0';
    const currentFamily = app.globalData.currentFamily;
    if (currentFamily && weight !== '' && !isNaN(parseFloat(weight))) {
      const previous = DataManager.getWeightRecords(currentFamily.id, 1);
      if (previous.length > 0) {
        weightDiff = (parseFloat(weight) - previous[0].weight).toFixed(1);
      }
    }
    this.setData({
      weight,
      weightDiff
    });
  },

  onOccurrenceDateChange(e) {
    this.setData({ occurrenceDate: e.detail.value });
  },

  onOccurrenceTimeChange(e) {
    this.setData({ occurrenceTime: e.detail.value });
  },

  onSave() {
    const { activeTab, weight, notes, symptoms } = this.data;
    const currentFamily = app.globalData.currentFamily;
    
    if (!currentFamily) {
      wx.showToast({
        title: '请先添加家人',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '正在保存...',
    });

    if (activeTab === 'weight') {
      this.saveWeightRecord(currentFamily.id, weight, notes);
    } else if (activeTab === 'symptoms') {
      this.saveSymptomRecord(currentFamily.id, symptoms, notes);
    }
  },

  saveWeightRecord(familyId, weight, notes) {
    if (!weight || isNaN(parseFloat(weight))) {
      wx.hideLoading();
      wx.showToast({
        title: '请输入有效体重',
        icon: 'none'
      });
      return;
    }

    const weightValue = parseFloat(weight);
    const weightRecords = DataManager.getWeightRecords(familyId, 1);
    const previousWeight = weightRecords.length > 0 ? weightRecords[0].weight : weightValue;
    const weightDiff = (weightValue - previousWeight).toFixed(1);

    const record = {
      id: Date.now(),
      familyId: familyId,
      type: 'weight',
      weight: weightValue,
      weightDiff: parseFloat(weightDiff),
      note: notes,
      recordTime: new Date().toISOString()
    };

    const success = DataManager.addHealthRecord(record);

    wx.hideLoading();
    if (success) {
      wx.showToast({ title: '体重已记录', icon: 'success', duration: 900 });
      this.setTimeout(() => this.finishRecording(), 900);
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  saveSymptomRecord(familyId, symptoms, notes) {
    const selectedSymptoms = symptoms.filter(s => s.selected);
    
    if (selectedSymptoms.length === 0) {
      wx.hideLoading();
      wx.showToast({
        title: '请至少选择一个症状',
        icon: 'none'
      });
      return;
    }

    const localRecordTime = new Date(`${this.data.occurrenceDate}T${this.data.occurrenceTime}:00`);
    const record = {
      id: Date.now(),
      familyId: familyId,
      type: 'symptoms',
      symptoms: selectedSymptoms.map(s => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
        color: s.color
      })),
      note: notes,
      recordTime: isNaN(localRecordTime.getTime()) ? new Date().toISOString() : localRecordTime.toISOString()
    };

    const success = DataManager.addHealthRecord(record);

    wx.hideLoading();
    if (success) {
      wx.showToast({ title: '身体状态已记录', icon: 'success', duration: 900 });
      this.setTimeout(() => this.finishRecording(), 900);
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  onBack() {
    this.finishRecording();
  },

  finishRecording() {
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
