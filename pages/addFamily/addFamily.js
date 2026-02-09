const { DataManager } = require('../../utils/data-manager');
const app = getApp();

Page({
  data: {
    formData: {
      name: '',
      relation: 'father',
      age: '',
      avatarId: 1,
      avatarUrl: ''
    },
    relations: [
      { label: '父亲', value: 'father' },
      { label: '母亲', value: 'mother' },
      { label: '配偶', value: 'spouse' },
      { label: '其他', value: 'other' }
    ],
    avatars: [
      { id: 1, url: 'https://placehold.co/100x100/FFEDD5/8B4513?text=Family', bgColor: 'orange' },
      { id: 2, url: 'https://placehold.co/100x100/DBEAFE/1E40AF?text=User', bgColor: 'blue' },
      { id: 3, url: 'https://placehold.co/100x100/F3E8FF/6B21A8?text=User', bgColor: 'purple' },
      { id: 4, url: 'https://placehold.co/100x100/DCFCE7/166534?text=User', bgColor: 'green' }
    ]
  },

  timers: [],

  onLoad(options) {
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

  onReady() {
  },

  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  onRelationSelect(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      'formData.relation': value
    });
  },

  onAgeInput(e) {
    this.setData({
      'formData.age': e.detail.value
    });
  },

  onAvatarSelect(e) {
    const id = e.currentTarget.dataset.id;
    const avatar = this.data.avatars.find(a => a.id === id);
    
    this.setData({
      'formData.avatarId': id,
      'formData.avatarUrl': avatar ? avatar.url : ''
    });
  },

  onChooseCustomAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        const customId = Date.now();
        const newAvatar = {
          id: customId,
          url: tempFilePath,
          bgColor: 'custom'
        };
        
        const avatars = [...this.data.avatars, newAvatar];
        
        this.setData({
          avatars,
          'formData.avatarId': customId,
          'formData.avatarUrl': tempFilePath
        });
      },
      fail: (err) => {
        console.log('选择图片失败', err);
      }
    });
  },

  validateForm() {
    const { name, age } = this.data.formData;
    
    if (!name || !name.trim()) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
      return false;
    }
    
    if (!age) {
      wx.showToast({
        title: '请输入年龄',
        icon: 'none'
      });
      return false;
    }
    
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      wx.showToast({
        title: '请输入有效年龄',
        icon: 'none'
      });
      return false;
    }
    
    return true;
  },

  onSubmit() {
    if (!this.validateForm()) {
      return;
    }
    
    const { formData, relations, avatars } = this.data;
    
    const relationItem = relations.find(r => r.value === formData.relation);
    const relationLabel = relationItem ? relationItem.label : '其他';
    
    let avatarUrl = formData.avatarUrl;
    if (!avatarUrl) {
      const avatar = avatars.find(a => a.id === formData.avatarId);
      avatarUrl = avatar ? avatar.url : avatars[0].url;
    }
    
    const familyMember = {
      id: Date.now(),
      name: formData.name.trim(),
      relation: formData.relation,
      relationLabel: relationLabel,
      age: parseInt(formData.age),
      avatar: avatarUrl,
      createdAt: new Date().toISOString()
    };
    
    const success = DataManager.addFamilyMember(familyMember);

    if (success) {
      app.refreshFamilyMembers();
      
      if (app.globalData.familyMembers.length === 1) {
        app.setCurrentFamily(familyMember.id);
      }
      
      wx.showToast({
        title: '添加成功 💖',
        icon: 'success',
        duration: 1500
      });
      
      this.setTimeout(() => {
        wx.reLaunch({
          url: '/pages/home/home'
        });
      }, 1500);
      
    } else {
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  },

  onShareAppMessage() {
    return {
      title: '一起守护家人健康',
      path: '/pages/home/home'
    };
  }
});
