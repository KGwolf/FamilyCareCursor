// pages/home/home.js
Page({
  data: {
    // 当前选中的患者
    currentPatient: {
      id: 1,
      name: '王伯伯',
      avatar: 'https://placehold.co/64x64'
    },
    
    // 所有家人列表
    familyMembers: [
      { id: 1, name: '王伯伯', avatar: 'https://placehold.co/64x64' },
      { id: 2, name: '李奶奶', avatar: 'https://placehold.co/64x64' }
    ],
    
    // 当前选中的 Tab
    activeTab: 'today',
    
    // 今日日期
    todayDate: '',
    
    // 任务列表
    tasks: [
      {
        id: 1,
        time: '08:00 AM',
        title: '晨间药物',
        icon: '💊',
        iconBg: 'icon-bg-white',
        completed: true,
        important: false,
        location: ''
      },
      {
        id: 2,
        time: '02:30 PM',
        title: '医院复查',
        icon: '🏥',
        iconBg: 'icon-bg-sky',
        completed: false,
        important: true,
        location: '上海华山医院 - 肿瘤门诊'
      }
    ],
    
    // 任务进度
    completedTasks: 1,
    totalTasks: 4,
    progressPercent: 25
  },

  onLoad(options) {
    this.setTodayDate();
    this.calculateProgress();
  },

  onShow() {
    // 页面显示时可以刷新数据
  },

  // 设置今日日期
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

  // 计算任务进度
  calculateProgress() {
    const { tasks, totalTasks } = this.data;
    const completedTasks = tasks.filter(task => task.completed).length;
    const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    this.setData({
      completedTasks,
      progressPercent
    });
  },

  // 切换患者
  onSwitchPatient() {
    const { familyMembers, currentPatient } = this.data;
    
    if (familyMembers.length <= 1) {
      wx.showToast({
        title: '暂无其他患者',
        icon: 'none'
      });
      return;
    }
    
    // 显示患者选择弹窗
    const names = familyMembers.map(m => m.name);
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const selected = familyMembers[res.tapIndex];
        if (selected.id !== currentPatient.id) {
          this.setData({
            currentPatient: selected
          });
          // 切换患者后重新加载数据
          this.loadPatientData(selected.id);
        }
      }
    });
  },

  // 加载患者数据
  loadPatientData(patientId) {
    // TODO: 根据患者ID加载对应的任务数据
    wx.showToast({
      title: `已切换到 ${this.data.currentPatient.name}`,
      icon: 'none'
    });
  },

  // 通知按钮点击
  onNotification() {
    wx.showToast({
      title: '暂无新通知',
      icon: 'none'
    });
  },

  // Tab 切换
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
    
    // 根据不同 Tab 加载不同内容
    switch (tab) {
      case 'today':
        // 加载今日概览
        break;
      case 'trends':
        // 加载健康趋势
        wx.showToast({
          title: '健康趋势开发中',
          icon: 'none'
        });
        break;
      case 'records':
        // 加载病历管理
        wx.showToast({
          title: '病历管理开发中',
          icon: 'none'
        });
        break;
    }
  },

  // 任务点击
  onTaskTap(e) {
    const taskId = e.currentTarget.dataset.id;
    const { tasks } = this.data;
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return;
    
    const task = tasks[taskIndex];
    
    if (task.completed) {
      // 已完成的任务，显示详情
      wx.showModal({
        title: task.title,
        content: '此任务已完成',
        showCancel: false
      });
    } else {
      // 未完成的任务，询问是否标记为完成
      wx.showModal({
        title: task.title,
        content: task.location || '是否标记为已完成？',
        confirmText: '完成',
        success: (res) => {
          if (res.confirm) {
            // 标记任务为完成
            const updatedTasks = [...tasks];
            updatedTasks[taskIndex] = {
              ...task,
              completed: true,
              iconBg: 'icon-bg-white'
            };
            
            this.setData({
              tasks: updatedTasks
            });
            
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

  // 查看心情贴士
  onViewTips() {
    wx.showModal({
      title: '心情小贴士',
      content: '记得每天给自己15分钟的独处时间，听听音乐、散散步，或者只是静静地喝杯茶。您的身心健康同样重要！',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 分享功能
  onShareAppMessage() {
    return {
      title: '家庭照护助手',
      path: '/pages/home/home'
    };
  }
});
