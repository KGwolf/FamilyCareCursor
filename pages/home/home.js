const { DataManager } = require('../../utils/data-manager');
const app = getApp();

Page({
  data: {
    currentPatient: {
      id: 1,
      name: '王伯伯',
      avatar: 'https://placehold.co/64x64'
    },
    familyMembers: [],
    activeTab: 'today',
    todayDate: '',
    tasks: [],
    completedTasks: 0,
    totalTasks: 0,
    progressPercent: 0
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
    });

    this.loadTodayTasks();
  },

  loadTodayTasks() {
    const { currentPatient } = this.data;
    const todayStr = DataManager.formatDate(new Date());
    const reminders = DataManager.getRemindersByDate(todayStr);
    
    const familyReminders = reminders.filter(r => r.familyId === currentPatient.id);
    
    const tasks = familyReminders.map(r => ({
      id: r.id,
      time: r.time,
      title: r.type.name,
      icon: r.type.icon,
      iconBg: r.completed ? 'icon-bg-white' : 'icon-bg-sky',
      completed: r.completed,
      important: r.type.id === 1 || r.type.id === 5,
      location: r.remark || ''
    }));

    const completedTasks = tasks.filter(task => task.completed).length;
    const totalTasks = tasks.length;
    const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    this.setData({
      tasks,
      completedTasks,
      totalTasks,
      progressPercent
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
        title: '暂无其他患者',
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
          wx.showToast({
            title: `已切换到 ${selected.name}`,
            icon: 'none'
          });
        }
      }
    });
  },

  onNotification() {
    wx.showToast({
      title: '暂无新通知',
      icon: 'none'
    });
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
    
    if (task.completed) {
      wx.showModal({
        title: task.title,
        content: '此任务已完成',
        showCancel: false
      });
    } else {
      wx.showModal({
        title: task.title,
        content: task.location || '是否标记为已完成？',
        confirmText: '完成',
        success: (res) => {
          if (res.confirm) {
            const updatedTasks = [...tasks];
            updatedTasks[taskIndex] = {
              ...task,
              completed: true,
              iconBg: 'icon-bg-white'
            };
            
            this.setData({
              tasks: updatedTasks
            });
            
            DataManager.updateReminder(taskId, { completed: true });
            this.calculateProgress();
            
            wx.showToast({
              title: '做得很好！💖',
              icon: 'success'
            });
          }
        }
      });
    }
  },

  onViewTips() {
    wx.showModal({
      title: '心情小贴士',
      content: '记得每天给自己15分钟的独处时间，听听音乐、散散步，或者只是静静地喝杯茶。您的身心健康同样重要！',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  onShareAppMessage() {
    return {
      title: '家庭照护助手',
      path: '/pages/home/home'
    };
  }
});
