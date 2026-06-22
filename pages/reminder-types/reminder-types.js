const { DataManager } = require('../../utils/data-manager');

Page({
  data: {
    typeList: [],
    showModal: false,
    newName: '',
    newIsKey: false,
    selectedIcon: 'event_note',
    iconOptions: [
      'event_note', 'medication', 'event_available', 'notifications', 
      'health_and_safety', 'favorite', 'medical_services', 'self_care',
      'assignment', 'schedule', 'more_horiz', 'alarm'
    ]
  },

  onLoad() {
   
    console.log('ReminderTypes Page Load');
    console.log('DataManager object:', DataManager);
    this.loadTypes();
  },

  onShow() {
    this.loadTypes();
  },

  loadTypes() {
    if (DataManager && typeof DataManager.getReminderTypes === 'function') {
      const types = DataManager.getReminderTypes();
      console.log('Loaded types:', types);
      this.setData({
        typeList: types
      });
    } else {
      console.error('DataManager.getReminderTypes is not a function');
    }
  },

  showAddModal() {
    this.setData({
      showModal: true,
      newName: '',
      newIsKey: false,
      selectedIcon: 'event_note'
    });
  },

  hideAddModal() {
    this.setData({
      showModal: false
    });
  },

  onNameInput(e) {
    this.setData({
      newName: e.detail.value
    });
  },

  onIsKeyChange(e) {
    this.setData({
      newIsKey: e.detail.value
    });
  },

  onSelectIcon(e) {
    this.setData({
      selectedIcon: e.currentTarget.dataset.icon
    });
  },

  onAddConfirm() {
    const { newName, newIsKey, selectedIcon } = this.data;
    
    if (!newName.trim()) {
      wx.showToast({
        title: '请输入名称',
        icon: 'none'
      });
      return;
    }

    if (DataManager && typeof DataManager.addReminderType === 'function') {
      const success = DataManager.addReminderType({
        name: newName.trim(),
        isKey: newIsKey,
        icon: selectedIcon
      });

      if (success) {
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        });
        this.hideAddModal();
        this.loadTypes();
      }
    } else {
      console.error('DataManager.addReminderType is not a function');
      wx.showToast({
        title: '系统错误',
        icon: 'none'
      });
    }
  },

  onDeleteType(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定要删除这个提醒类型吗？',
      success: (res) => {
        if (res.confirm) {
          if (DataManager && typeof DataManager.deleteReminderType === 'function') {
            const success = DataManager.deleteReminderType(id);
            if (success) {
              wx.showToast({
                title: '已删除',
                icon: 'success'
              });
              this.loadTypes();
            }
          }
        }
      }
    });
  }
});
