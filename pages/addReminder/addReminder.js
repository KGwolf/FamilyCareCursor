// pages/addReminder/addReminder.js
Page({
  data: {
    // 当前对象
    currentTarget: {
      id: 1,
      name: '爸爸',
      avatar: ''
    },
    
    // 提醒类型列表
    reminderTypes: [
      { id: 1, name: '用药提醒', icon: '💊' },
      { id: 2, name: '喝水提醒', icon: '💧' },
      { id: 3, name: '运动提醒', icon: '🏃' },
      { id: 4, name: '测量提醒', icon: '📊' },
      { id: 5, name: '就医提醒', icon: '🏥' },
      { id: 6, name: '其他提醒', icon: '📝' }
    ],
    selectedTypeIndex: 0,
    
    // 时间
    selectedTime: '08:30',
    
    // 频率选项
    frequencyOptions: [
      { id: 1, name: '每天', value: 'daily' },
      { id: 2, name: '每周一次', value: 'weekly' },
      { id: 3, name: '自定义', value: 'custom' }
    ],
    selectedFreqIndex: 0,
    
    // 备注
    remark: ''
  },

  onLoad(options) {
    // 如果有传入家人ID，获取对应信息
    if (options.familyId) {
      this.loadFamilyInfo(options.familyId);
    }
  },

  // 加载家人信息
  loadFamilyInfo(familyId) {
    // TODO: 从存储或接口获取家人信息
    console.log('加载家人信息:', familyId);
  },

  // 切换对象
  onSwitchTarget() {
    wx.showActionSheet({
      itemList: ['爸爸', '妈妈', '爷爷', '奶奶'],
      success: (res) => {
        const names = ['爸爸', '妈妈', '爷爷', '奶奶'];
        this.setData({
          'currentTarget.name': names[res.tapIndex]
        });
      }
    });
  },

  // 选择提醒类型
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

  // 选择时间
  onSelectTime() {
    const that = this;
    wx.showModal({
      title: '选择时间',
      editable: true,
      placeholderText: '请输入时间，格式：HH:MM',
      success(res) {
        if (res.confirm && res.content) {
          // 简单验证时间格式
          const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
          if (timeRegex.test(res.content)) {
            that.setData({
              selectedTime: res.content
            });
          } else {
            wx.showToast({
              title: '时间格式不正确',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 选择频率
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

  // 频率按钮点击
  onFreqSelect(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      selectedFreqIndex: index
    });
  },

  // 备注输入
  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  // 提交
  onSubmit() {
    const { currentTarget, reminderTypes, selectedTypeIndex, selectedTime, frequencyOptions, selectedFreqIndex, remark } = this.data;
    
    // 构建提醒数据
    const reminderData = {
      targetId: currentTarget.id,
      targetName: currentTarget.name,
      type: reminderTypes[selectedTypeIndex],
      time: selectedTime,
      frequency: frequencyOptions[selectedFreqIndex],
      remark: remark,
      createTime: new Date().toISOString()
    };

    console.log('提交提醒:', reminderData);

    // TODO: 保存到存储或上传到服务器
    wx.showToast({
      title: '添加成功',
      icon: 'success',
      duration: 1500,
      success: () => {
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    });
  }
});
