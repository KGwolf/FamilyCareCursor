const STORAGE_KEYS = {
  USER_INFO: 'userInfo',
  FAMILY_MEMBERS: 'familyMembers',
  REMINDERS: 'reminders',
  REMINDER_HISTORY: 'reminderHistory',
  HEALTH_RECORDS: 'healthRecords',
  SETTINGS: 'settings',
  CURRENT_FAMILY_ID: 'currentFamilyId',
  REMINDER_TYPES: 'reminderTypes'
};

const DEFAULT_REMINDER_TYPES = [
  { id: 1, name: '日常事项', icon: 'event_note', isKey: false, canDelete: false },
  { id: 2, name: '用药提醒', icon: 'medication', isKey: true, canDelete: false },
  { id: 3, name: '预约就诊', icon: 'event_available', isKey: true, canDelete: false },
  { id: 4, name: '其它', icon: 'more_horiz', isKey: false, canDelete: false }
];

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
    const history = this.getReminderHistory();
    const targetDateStr = this.formatDate(date);
    const targetDate = this.parseLocalDate(targetDateStr);
    
    // 获取当天的历史记录
    const dateHistory = history[targetDateStr] || {};
    
    return reminders.filter(r => {
      // 1. 优先检查历史记录
      if (dateHistory.hasOwnProperty(r.id) || dateHistory.hasOwnProperty(String(r.id))) {
        return true;
      }

      // 2. 检查指定日期的单次提醒
      if (r.date === targetDateStr) return true;

      // 3. 频率逻辑判断
      if (r.frequency === 'daily') {
        if (r.createTime) {
          const createDate = new Date(r.createTime);
          const createDateStr = this.formatDate(createDate);
          if (createDateStr > targetDateStr) return false;
        }
        return true;
      }

      if (r.frequency === 'weekly' || r.frequency === 'custom_weekly') {
        if (r.createTime) {
          const createDate = new Date(r.createTime);
          const createDateStr = this.formatDate(createDate);
          if (createDateStr > targetDateStr) return false;
        }
        const reminderDate = this.parseLocalDate(r.date || r.createTime);
        return reminderDate.getDay() === targetDate.getDay();
      }
      
      return false;
    }).map(r => {
      const completed = (dateHistory[r.id] === true || dateHistory[String(r.id)] === true);
      return { ...r, completed };
    });
  },

  getReminderHistory() {
    return this.get(STORAGE_KEYS.REMINDER_HISTORY, {});
  },

  toggleReminderCompletion(reminderId, date, status) {
    const history = this.getReminderHistory();
    if (!history[date]) {
      history[date] = {};
    }
    history[date][reminderId] = status;
    
    // 同时更新提醒本身的最后完成状态（如果是今天）
    if (this.isToday(date)) {
      this.updateReminder(reminderId, { 
        completed: status,
        lastCompletedDate: status ? date : null
      });
    }
    
    return this.set(STORAGE_KEYS.REMINDER_HISTORY, history);
  },

  getReminderCompletionStatus(reminderId, date) {
    const history = this.getReminderHistory();
    const dateHistory = history[date] || {};
    return dateHistory[reminderId] || false;
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

  getReminderTypes() {
    const storedTypes = this.get(STORAGE_KEYS.REMINDER_TYPES, []);
    
    // 确保默认的 4 个类型始终存在且不可删除
    const types = [...DEFAULT_REMINDER_TYPES];
    
    // 合并存储的自定义类型（排除掉与默认类型 ID 重复的，虽然 ID 是时间戳应该不会重复）
    if (Array.isArray(storedTypes)) {
      storedTypes.forEach(st => {
        if (!types.find(t => t.id === st.id || t.name === st.name)) {
          types.push(st);
        }
      });
    }
    
    return types;
  },

  setReminderTypes(types) {
    // 只存储自定义类型（可以被删除的类型）
    const customTypes = types.filter(t => t.canDelete);
    return this.set(STORAGE_KEYS.REMINDER_TYPES, customTypes);
  },

  addReminderType(type) {
    const storedTypes = this.get(STORAGE_KEYS.REMINDER_TYPES, []);
    const newType = {
      ...type,
      id: Date.now(),
      canDelete: true
    };
    storedTypes.push(newType);
    return this.set(STORAGE_KEYS.REMINDER_TYPES, storedTypes);
  },

  deleteReminderType(id) {
    const storedTypes = this.get(STORAGE_KEYS.REMINDER_TYPES, []);
    const filtered = storedTypes.filter(t => t.id !== id);
    return this.set(STORAGE_KEYS.REMINDER_TYPES, filtered);
  },

  hasFamilyMembers() {
    const members = this.getFamilyMembers();
    return members.length > 0;
  },

  formatDate(date) {
    if (!date) return '';
    
    // 如果已经是 YYYY-MM-DD 格式，直接返回
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 安全地解析 YYYY-MM-DD 字符串为本地日期的 Date 对象，避免时区偏移
  parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return dateStr;
    
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateStr);
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
    // 如果已经是 YYYY-MM-DD 格式的字符串，直接比较
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr === today;
    }
    return this.formatDate(dateStr) === today;
  }
};

module.exports = {
  STORAGE_KEYS,
  DataManager
};
