const { DataManager } = require('../../utils/data-manager');
const NotificationService = require('../../utils/notification-service');
const app = getApp();

Page({
  data: {
    currentPatient: {
      id: 1,
      name: '王伯伯',
      avatar: '/images/user1.png'
    },
    familyMembers: [],
    activeTab: 'today',
    todayDate: '',
    tasks: [],
    completedTasks: 0,
    totalTasks: 0,
    progressPercent: 0,
    hiddenTasksCount: 0,
    upcomingItems: [],
    recentChanges: []
  },

  onLoad(options) {
    this.setTodayDate();
    this.loadFamilyData();
  },

  onShow() {
    this.loadFamilyData();
  },


  setTodayDate() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekDay = weekDays[now.getDay()];
    
    this.setData({
      todayDate: `${month}月${date}日 ${weekDay}`
    });
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

    let currentPatient = familyMembers.find(m => m.id === currentFamilyId);
    if (!currentPatient) {
      currentPatient = familyMembers[0];
      app.setCurrentFamily(currentPatient.id);
    }

    this.setData({
      familyMembers,
      currentPatient
    }, () => {
      this.loadTodayTasks();
      this.loadCareOverview();
      this.maybePromptSubscriptionRenewal();
    });
  },

  maybePromptSubscriptionRenewal() {
    if (this.subscriptionRenewalChecking) return;
    this.subscriptionRenewalChecking = true;
    NotificationService.maybePromptSubscriptionRenewal()
      .catch(error => {
        console.error('订阅消息续授权检查失败', error);
      })
      .finally(() => {
        this.subscriptionRenewalChecking = false;
      });
  },

  loadCareOverview() {
    const familyId = this.data.currentPatient.id;
    const today = DataManager.formatDate(new Date());
    const upcoming = DataManager.getRemindersByFamilyId(familyId)
      .filter(item => item.type && item.frequency === 'custom' && item.date && item.date > today)
      .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`))
      .slice(0, 3);

    const upcomingItems = upcoming.map(item => {
      const targetDate = DataManager.parseLocalDate(item.date);
      const month = targetDate.getMonth() + 1;
      const day = targetDate.getDate();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = DataManager.formatDate(tomorrow) === item.date;
      return {
        id: item.id,
        title: item.type.name,
        date: item.date,
        time: item.time,
        icon: item.type.icon,
        remark: item.remark || '',
        dateLabel: isTomorrow ? '明天' : `${month}月${day}日`
      };
    });

    const recentChanges = DataManager.getHealthRecordsByFamilyId(familyId)
      .slice()
      .sort((a, b) => new Date(b.recordTime) - new Date(a.recordTime))
      .slice(0, 3)
      .map(record => ({
        id: record.id,
        icon: record.type === 'weight' ? '⚖️' : '●',
        title: record.type === 'weight'
          ? `体重 ${record.weight}kg`
          : record.symptoms.map(item => item.name).join('、'),
        time: DataManager.formatDateTime(record.recordTime),
        note: record.type === 'weight' && record.weightDiff
          ? `较上次 ${record.weightDiff > 0 ? '+' : ''}${record.weightDiff}kg`
          : (record.note || '')
      }));

    this.setData({ upcomingItems, recentChanges });
  },

  loadTodayTasks() {
    const { currentPatient } = this.data;
    const todayStr = DataManager.formatDate(new Date());
    const reminders = DataManager.getRemindersByDate(todayStr);
    
    const familyReminders = DataManager.sortRemindersByPriority(
      reminders.filter(r => r.familyId === currentPatient.id)
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

    const completedTasks = tasks.filter(task => task.completed).length;
    const totalTasks = tasks.length;
    const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const hiddenTasksCount = Math.max(totalTasks - 3, 0);

    this.setData({
      tasks,
      completedTasks,
      totalTasks,
      progressPercent,
      hiddenTasksCount
    });
  },

  calculateProgress() {
    const { tasks } = this.data;
    const completedTasks = tasks.filter(task => task.completed).length;
    const totalTasks = tasks.length;
    const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    this.setData({
      completedTasks,
      totalTasks,
      progressPercent
    });
  },

  onSwitchPatient() {
    const { familyMembers, currentPatient } = this.data;
    
    if (familyMembers.length <= 1) {
      wx.showToast({
        title: '暂无其他家人',
        icon: 'none'
      });
      return;
    }
    
    const names = familyMembers.map(m => m.name);
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const selected = familyMembers[res.tapIndex];
        if (selected.id !== currentPatient.id) {
          this.setData({
            currentPatient: selected
          });
          app.setCurrentFamily(selected.id);
          this.loadTodayTasks();
          this.loadCareOverview();
          wx.showToast({
            title: `已切换到 ${selected.name}`,
            icon: 'none'
          });
        }
      }
    });
  },

  onAddMember() {
    wx.navigateTo({
      url: '/pages/addFamily/addFamily'
    });
  },

  onOpenSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' });
  },

  onQuickAction(e) {
    const action = e.currentTarget.dataset.action;
    const routes = {
      item: '/pages/addReminder/addReminder',
      symptoms: '/pages/addRecord/addRecord?tab=symptoms',
      weight: '/pages/addRecord/addRecord?tab=weight'
    };
    if (routes[action]) wx.navigateTo({ url: routes[action] });
  },

  onOpenCalendar(e) {
    const targetDate = e && e.currentTarget ? e.currentTarget.dataset.date : '';
    app.globalData.targetCalendarDate = targetDate || DataManager.formatDate(new Date());
    wx.navigateTo({ url: '/pages/calendar/calendar' });
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
    
    switch (tab) {
      case 'today':
        break;
      case 'trends':
        wx.navigateTo({
          url: '/pages/records/records?tab=trends'
        });
        break;
      case 'records':
        wx.navigateTo({
          url: '/pages/records/records?tab=records'
        });
        break;
    }
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
          
          const todayStr = DataManager.formatDate(new Date());
          DataManager.toggleReminderCompletion(taskId, todayStr, newCompletedStatus);
          this.calculateProgress();
          
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
      this.showRecurringDeleteOptions(taskId, DataManager.formatDate(new Date()));
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
            this.loadTodayTasks();
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
      itemList: ['仅隐藏今天', '删除整个重复提醒'],
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
      wx.showToast({ title: '已隐藏今天', icon: 'success' });
      this.loadTodayTasks();
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
          this.loadTodayTasks();
        } else {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },

  onShareAppMessage() {
    return {
      title: '家人照护记',
      path: '/pages/home/home'
    };
  }
});
