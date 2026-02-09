const STORAGE_KEYS = {
  USER_INFO: 'userInfo',
  FAMILY_MEMBERS: 'familyMembers',
  REMINDERS: 'reminders',
  HEALTH_RECORDS: 'healthRecords',
  SETTINGS: 'settings',
  CURRENT_FAMILY_ID: 'currentFamilyId'
};

const DataManager = {
  get(key, defaultValue = null) {
    try {
      const value = wx.getStorageSync(key);
      return value !== '' ? value : defaultValue;
    } catch (err) {
      console.error('获取数据失败:', err);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      wx.setStorageSync(key, value);
      return true;
    } catch (err) {
      console.error('保存数据失败:', err);
      return false;
    }
  },

  remove(key) {
    try {
      wx.removeStorageSync(key);
      return true;
    } catch (err) {
      console.error('删除数据失败:', err);
      return false;
    }
  },

  clear() {
    try {
      wx.clearStorageSync();
      return true;
    } catch (err) {
      console.error('清空数据失败:', err);
      return false;
    }
  },

  getUserInfo() {
    return this.get(STORAGE_KEYS.USER_INFO, {
      name: '',
      role: '主照护人',
      phone: ''
    });
  },

  setUserInfo(userInfo) {
    return this.set(STORAGE_KEYS.USER_INFO, userInfo);
  },

  getFamilyMembers() {
    return this.get(STORAGE_KEYS.FAMILY_MEMBERS, []);
  },

  addFamilyMember(member) {
    const members = this.getFamilyMembers();
    members.push(member);
    return this.set(STORAGE_KEYS.FAMILY_MEMBERS, members);
  },

  updateFamilyMember(id, updates) {
    const members = this.getFamilyMembers();
    const index = members.findIndex(m => m.id === id);
    if (index !== -1) {
      members[index] = { ...members[index], ...updates };
      return this.set(STORAGE_KEYS.FAMILY_MEMBERS, members);
    }
    return false;
  },

  deleteFamilyMember(id) {
    const members = this.getFamilyMembers();
    const filtered = members.filter(m => m.id !== id);
    return this.set(STORAGE_KEYS.FAMILY_MEMBERS, filtered);
  },

  getReminders() {
    return this.get(STORAGE_KEYS.REMINDERS, []);
  },

  addReminder(reminder) {
    const reminders = this.getReminders();
    reminders.push(reminder);
    return this.set(STORAGE_KEYS.REMINDERS, reminders);
  },

  updateReminder(id, updates) {
    const reminders = this.getReminders();
    const index = reminders.findIndex(r => r.id === id);
    if (index !== -1) {
      reminders[index] = { ...reminders[index], ...updates };
      return this.set(STORAGE_KEYS.REMINDERS, reminders);
    }
    return false;
  },

  deleteReminder(id) {
    const reminders = this.getReminders();
    const filtered = reminders.filter(r => r.id !== id);
    return this.set(STORAGE_KEYS.REMINDERS, filtered);
  },

  getRemindersByFamilyId(familyId) {
    const reminders = this.getReminders();
    return reminders.filter(r => r.familyId === familyId);
  },

  getRemindersByDate(date) {
    const reminders = this.getReminders();
    return reminders.filter(r => {
      if (r.frequency === 'daily') return true;
      if (r.frequency === 'weekly') {
        const reminderDate = new Date(r.date);
        const targetDate = new Date(date);
        return reminderDate.getDay() === targetDate.getDay();
      }
      return r.date === date;
    });
  },

  getHealthRecords() {
    return this.get(STORAGE_KEYS.HEALTH_RECORDS, []);
  },

  addHealthRecord(record) {
    const records = this.getHealthRecords();
    records.push(record);
    return this.set(STORAGE_KEYS.HEALTH_RECORDS, records);
  },

  getHealthRecordsByFamilyId(familyId) {
    const records = this.getHealthRecords();
    return records.filter(r => r.familyId === familyId);
  },

  getWeightRecords(familyId, limit = 7) {
    const records = this.getHealthRecordsByFamilyId(familyId);
    const weightRecords = records
      .filter(r => r.type === 'weight')
      .sort((a, b) => new Date(b.recordTime) - new Date(a.recordTime))
      .slice(0, limit);
    return weightRecords.reverse();
  },

  getSymptomRecords(familyId, limit = 10) {
    const records = this.getHealthRecordsByFamilyId(familyId);
    const symptomRecords = records
      .filter(r => r.type === 'symptoms')
      .sort((a, b) => new Date(b.recordTime) - new Date(a.recordTime))
      .slice(0, limit);
    return symptomRecords;
  },

  getSettings() {
    return this.get(STORAGE_KEYS.SETTINGS, {
      remindEnabled: true,
      warningEnabled: true
    });
  },

  setSettings(settings) {
    return this.set(STORAGE_KEYS.SETTINGS, settings);
  },

  getCurrentFamilyId() {
    return this.get(STORAGE_KEYS.CURRENT_FAMILY_ID, null);
  },

  setCurrentFamilyId(id) {
    return this.set(STORAGE_KEYS.CURRENT_FAMILY_ID, id);
  },

  hasFamilyMembers() {
    const members = this.getFamilyMembers();
    return members.length > 0;
  },

  formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  formatDateTime(date) {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}月${day}日 ${hours}:${minutes}`;
  },

  isToday(dateStr) {
    const today = this.formatDate(new Date());
    return this.formatDate(dateStr) === today;
  }
};

module.exports = {
  STORAGE_KEYS,
  DataManager
};
