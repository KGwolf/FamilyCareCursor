const { DataManager } = require('../../utils/data-manager');
const app = getApp();

Page({
  data: {
    darkMode: false,
    currentYear: 2023,
    currentMonth: 10,
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],
    selectedDate: '',
    todayDateStr: '',
    currentFamilyId: null,
    familyMembers: [],
    tasks: [],
    firstDayOfWeek: 0
  },

  onLoad() {
    this.loadIcons();
    this.initCalendar();
    this.loadFamilyData();
  },

  loadIcons() {
    wx.loadFontFace({
      family: 'Material Icons',
      source: 'url("https://fonts.gstatic.com/s/materialicons/v140/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2")',
    });
  },

  initCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    this.setData({
      currentYear: year,
      currentMonth: month
    });
    this.generateCalendar(year, month);
  },

  loadFamilyData() {
    const familyMembers = app.globalData.familyMembers;
    const currentFamilyId = app.globalData.currentFamilyId;
    
    if (familyMembers.length === 0) {
      wx.reLaunch({
        url: '/pages/index/index'
      });
      return;
    }

    let currentFamilyIdToUse = currentFamilyId;
    if (!currentFamilyIdToUse) {
      currentFamilyIdToUse = familyMembers[0].id;
      app.setCurrentFamily(currentFamilyIdToUse);
    }

    const now = new Date();
    const todayStr = DataManager.formatDate(now);
    const todayDateStr = `${now.toLocaleString('en-US', { month: 'short' })} ${now.getDate()}, ${now.toLocaleString('en-US', { weekday: 'short' })}`;

    this.setData({
      familyMembers,
      currentFamilyId: currentFamilyIdToUse,
      selectedDate: todayStr,
      todayDateStr
    });

    this.loadTasksForDate(todayStr);
  },

  generateCalendar(year, month) {
    const days = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const firstDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    const reminders = DataManager.getReminders();
    const eventDays = new Set();
    reminders.forEach(r => {
      const date = new Date(r.date);
      if (date.getFullYear() === year && date.getMonth() + 1 === month) {
        eventDays.add(date.getDate());
      }
      if (r.frequency === 'daily' || r.frequency === 'weekly') {
        eventDays.add(date.getDate());
      }
    });
    
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      days.push({
        day: d,
        fullDate: `${prevYear}-${prevMonth.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`,
        currentMonth: false,
        isToday: false,
        hasEvent: false
      });
    }

    const today = new Date();
    for (let i = 1; i <= totalDays; i++) {
      const fullDate = `${year}-${month.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === i;
      days.push({
        day: i,
        fullDate: fullDate,
        currentMonth: true,
        isToday: isToday,
        hasEvent: eventDays.has(i)
      });
    }

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        fullDate: `${nextYear}-${nextMonth.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`,
        currentMonth: false,
        isToday: false,
        hasEvent: false
      });
    }

    this.setData({
      calendarDays: days,
      firstDayOfWeek: firstDayOfWeek
    });
  },

  switchFamily(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      currentFamilyId: id
    });
    app.setCurrentFamily(id);
    this.loadTasksForDate(this.data.selectedDate);
  },

  addFamily() {
    wx.navigateTo({
      url: '/pages/addFamily/addFamily'
    });
  },

  selectDate(e) {
    const date = e.currentTarget.dataset.date;
    this.setData({
      selectedDate: date
    });
    this.loadTasksForDate(date);
  },

  loadTasksForDate(dateStr) {
    const { currentFamilyId } = this.data;
    const reminders = DataManager.getRemindersByDate(dateStr);
    const familyReminders = reminders.filter(r => r.familyId === currentFamilyId);
    
    const tasks = familyReminders.map(r => ({
      id: r.id,
      time: r.time,
      label: r.type.name,
      title: r.remark || r.type.name,
      desc: r.frequency === 'daily' ? '每天重复' : r.frequency === 'weekly' ? '每周重复' : '单次提醒',
      completed: r.completed
    }));

    this.setData({
      tasks
    });
  },

  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 1) {
      currentYear--;
      currentMonth = 12;
    } else {
      currentMonth--;
    }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar(currentYear, currentMonth);
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentYear++;
      currentMonth = 1;
    } else {
      currentMonth++;
    }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar(currentYear, currentMonth);
  },

  toggleTask(e) {
    const id = e.currentTarget.dataset.id;
    const { tasks } = this.data;
    const taskIndex = tasks.findIndex(t => t.id === id);
    
    if (taskIndex !== -1) {
      const task = tasks[taskIndex];
      const newCompleted = !task.completed;
      const updatedTasks = [...tasks];
      updatedTasks[taskIndex] = { ...task, completed: newCompleted };
      
      this.setData({ tasks: updatedTasks });
      DataManager.updateReminder(id, { completed: newCompleted });
    }
  },

  goToGreet() {
    wx.showToast({
      title: '正在前往问候...',
      icon: 'none'
    });
  },

  onAddClick() {
    wx.navigateTo({
      url: '/pages/addReminder/addReminder'
    });
  },

  navTo(e) {
    const page = e.currentTarget.dataset.page;
    if (page === 'home') {
      wx.redirectTo({
        url: '/pages/home/home'
      });
    }
  }
});
