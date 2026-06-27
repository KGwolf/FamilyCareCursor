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
    currentFamilyRelation: '',
    familyMembers: [],
    tasks: [],
    firstDayOfWeek: 0
  },

  onLoad() {
    this.initCalendar();
    this.loadFamilyData();
  },

  onShow() {
    // onShow 依然保留，以防从非 reLaunch 场景跳转回来（虽然目前项目主要是 reLaunch）
    this.checkTargetDate();
  },

  onBack() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pages/home/home' })
    });
  },

  checkTargetDate() {
    if (app.globalData.targetCalendarDate) {
      const targetDateStr = app.globalData.targetCalendarDate;
      app.globalData.targetCalendarDate = null;
      
      const [year, month] = targetDateStr.split('-').map(Number);
      
      // 同步年月并刷新日历
      if (year !== this.data.currentYear || month !== this.data.currentMonth) {
        this.setData({
          currentYear: year,
          currentMonth: month
        });
        this.generateCalendar(year, month);
      }
      
      // 选中日期
      this.setData({
        selectedDate: targetDateStr
      });
      this.loadTasksForDate(targetDateStr);
    }
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

    const currentMember = familyMembers.find(m => m.id === currentFamilyIdToUse);

    // 优先使用目标跳转日期
    const initialSelectedDate = app.globalData.targetCalendarDate || todayStr;

    this.setData({
      familyMembers,
      currentFamilyId: currentFamilyIdToUse,
      currentFamilyRelation: currentMember ? currentMember.relationLabel : '',
      selectedDate: initialSelectedDate,
      todayDateStr
    });

    this.loadTasksForDate(initialSelectedDate);
    
    // 如果是目标日期，还需要确保日历年月对齐
    if (app.globalData.targetCalendarDate) {
      this.checkTargetDate();
    }
  },

  generateCalendar(year, month) {
    const days = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const firstDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    const currentFamilyId = this.data.currentFamilyId || app.globalData.currentFamilyId;
    const eventDays = new Set();
    
    // 遍历本月的每一天，检查是否有该家人的提醒
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      const dayReminders = DataManager.getRemindersByDate(dateStr).filter(r => r.familyId === currentFamilyId);
      if (dayReminders.length > 0) {
        eventDays.add(i);
      }
    }
    
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
    const currentMember = this.data.familyMembers.find(m => m.id === id);
    this.setData({
      currentFamilyId: id,
      currentFamilyRelation: currentMember ? currentMember.relationLabel : ''
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
    const familyReminders = DataManager.sortRemindersByPriority(
      reminders.filter(r => r.familyId == currentFamilyId)
    );
    
    const tasks = familyReminders.map(r => ({
      id: r.id,
      time: r.time,
      title: r.type.name,
      icon: r.type.icon,
      iconBg: r.completed ? 'icon-bg-white' : 'icon-bg-sky',
      completed: r.completed,
      important: DataManager.isReminderImportant(r),
      frequency: r.frequency,
      location: r.remark || ''
    }));

    this.setData({
      tasks
    });
  },

  onTaskTap(e) {
    const taskId = e.currentTarget.dataset.id;
    const { tasks } = this.data;
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return;
    
    const task = tasks[taskIndex];
    const newCompletedStatus = !task.completed;
    
    wx.showModal({
      title: task.title,
      content: newCompletedStatus ? (task.location || '标记为已完成？') : '取消已完成状态？',
      confirmText: newCompletedStatus ? '完成' : '取消完成',
      success: (res) => {
        if (res.confirm) {
          const updatedTasks = [...tasks];
          updatedTasks[taskIndex] = {
            ...task,
            completed: newCompletedStatus,
            iconBg: newCompletedStatus ? 'icon-bg-white' : 'icon-bg-sky'
          };
          
          this.setData({
            tasks: updatedTasks
          });
          
          DataManager.toggleReminderCompletion(taskId, this.data.selectedDate, newCompletedStatus);
          
          if (newCompletedStatus) {
            wx.showToast({
              title: '做得很好！💖',
              icon: 'success'
            });
          }
        }
      }
    });
  },

  onDeleteTask(e) {
    const taskId = e.currentTarget.dataset.id;
    const task = this.data.tasks.find(item => item.id === taskId);
    if (task && this.isRecurringTask(task)) {
      this.showRecurringDeleteOptions(taskId, this.data.selectedDate);
      return;
    }
    this.confirmDeleteReminder(taskId);
    return;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条提醒吗？',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          const success = DataManager.deleteReminder(taskId);
          if (success) {
            wx.showToast({
              title: '已删除',
              icon: 'success'
            });
            this.loadTasksForDate(this.data.selectedDate);
            this.generateCalendar(this.data.currentYear, this.data.currentMonth);
          } else {
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  isRecurringTask(task) {
    return task.frequency === 'daily'
      || task.frequency === 'weekly'
      || task.frequency === 'custom_weekly';
  },

  showRecurringDeleteOptions(taskId, date) {
    wx.showActionSheet({
      itemList: ['仅隐藏这一天', '删除整个重复提醒'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.hideReminderForDate(taskId, date);
        }
        if (res.tapIndex === 1) {
          this.confirmDeleteReminder(taskId, '这是一个重复提醒，删除后以后也不会再提醒。');
        }
      }
    });
  },

  hideReminderForDate(taskId, date) {
    const success = DataManager.hideReminderForDate(taskId, date);
    if (success) {
      wx.showToast({ title: '已隐藏这一天', icon: 'success' });
      this.loadTasksForDate(this.data.selectedDate);
      this.generateCalendar(this.data.currentYear, this.data.currentMonth);
    } else {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  confirmDeleteReminder(taskId, content = '确定要删除这条提醒吗？') {
    wx.showModal({
      title: '确认删除',
      content,
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: (res) => {
        if (!res.confirm) return;
        const success = DataManager.deleteReminder(taskId);
        if (success) {
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadTasksForDate(this.data.selectedDate);
          this.generateCalendar(this.data.currentYear, this.data.currentMonth);
        } else {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
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
