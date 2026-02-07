// pages/addFamily/addFamily.js
Page({
  data: {
    // 表单数据
    formData: {
      name: '',
      relation: 'father',
      age: '',
      avatarId: 1,
      avatarUrl: ''
    },

    // 关系选项
    relations: [
      { label: '父亲', value: 'father' },
      { label: '母亲', value: 'mother' },
      { label: '配偶', value: 'spouse' },
      { label: '其他', value: 'other' }
    ],

    // 预设头像列表
    avatars: [
      { id: 1, url: 'https://placehold.co/100x100/FFEDD5/8B4513?text=Family', bgColor: 'orange' },
      { id: 2, url: 'https://placehold.co/100x100/DBEAFE/1E40AF?text=User', bgColor: 'blue' },
      { id: 3, url: 'https://placehold.co/100x100/F3E8FF/6B21A8?text=User', bgColor: 'purple' },
      { id: 4, url: 'https://placehold.co/100x100/DCFCE7/166534?text=User', bgColor: 'green' }
    ]
  },

  onLoad(options) {
    // 页面加载时的初始化逻辑
  },

  onReady() {
    // #region agent log
    // 调试：获取布局信息
    const sysInfo = wx.getSystemInfoSync();
    console.log('[DEBUG-A-B] 系统信息:', JSON.stringify({windowHeight:sysInfo.windowHeight,screenHeight:sysInfo.screenHeight,statusBarHeight:sysInfo.statusBarHeight}));
    wx.request({url:'http://127.0.0.1:7242/ingest/2dd21c87-e1ed-4586-97d8-6e40fe45e568',method:'POST',header:{'Content-Type':'application/json'},data:{location:'addFamily.js:onReady',message:'系统信息',data:{windowHeight:sysInfo.windowHeight,screenHeight:sysInfo.screenHeight,statusBarHeight:sysInfo.statusBarHeight},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A-B'}});
    // #endregion

    // #region agent log
    // 调试：获取各元素尺寸
    const query = wx.createSelectorQuery();
    query.select('.page-container').boundingClientRect();
    query.select('.main-content').boundingClientRect();
    query.select('.footer').boundingClientRect();
    query.select('.submit-btn').boundingClientRect();
    query.exec((res) => {
      console.log('[DEBUG-A-B-C-D] 元素尺寸:', JSON.stringify({pageContainer:res[0],mainContent:res[1],footer:res[2],submitBtn:res[3]}));
      wx.request({url:'http://127.0.0.1:7242/ingest/2dd21c87-e1ed-4586-97d8-6e40fe45e568',method:'POST',header:{'Content-Type':'application/json'},data:{location:'addFamily.js:onReady:query',message:'元素尺寸',data:{pageContainer:res[0],mainContent:res[1],footer:res[2],submitBtn:res[3]},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A-B-C-D'}});
    });
    // #endregion
  },

  // 姓名输入
  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  // 关系选择
  onRelationSelect(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      'formData.relation': value
    });
  },

  // 年龄输入
  onAgeInput(e) {
    this.setData({
      'formData.age': e.detail.value
    });
  },

  // 头像选择
  onAvatarSelect(e) {
    const id = e.currentTarget.dataset.id;
    const avatar = this.data.avatars.find(a => a.id === id);
    
    this.setData({
      'formData.avatarId': id,
      'formData.avatarUrl': avatar ? avatar.url : ''
    });
  },

  // 选择自定义头像
  onChooseCustomAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        // 添加自定义头像到列表
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

  // 表单验证
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

  // 提交表单
  onSubmit() {
    if (!this.validateForm()) {
      return;
    }
    
    const { formData, relations, avatars } = this.data;
    
    // 获取关系文本
    const relationItem = relations.find(r => r.value === formData.relation);
    const relationLabel = relationItem ? relationItem.label : '其他';
    
    // 获取头像URL
    let avatarUrl = formData.avatarUrl;
    if (!avatarUrl) {
      const avatar = avatars.find(a => a.id === formData.avatarId);
      avatarUrl = avatar ? avatar.url : avatars[0].url;
    }
    
    // 构建家人数据
    const familyMember = {
      id: Date.now(),
      name: formData.name.trim(),
      relation: formData.relation,
      relationLabel: relationLabel,
      age: parseInt(formData.age),
      avatar: avatarUrl,
      createdAt: new Date().toISOString()
    };
    
    // 保存到本地存储
    this.saveFamilyMember(familyMember);
  },

  // 保存家人数据
  saveFamilyMember(member) {
    try {
      // 获取现有家人列表
      let familyMembers = wx.getStorageSync('familyMembers') || [];
      
      // 添加新成员
      familyMembers.push(member);
      
      // 保存到本地
      wx.setStorageSync('familyMembers', familyMembers);
      
      // 显示成功提示
      wx.showToast({
        title: '添加成功 💖',
        icon: 'success',
        duration: 1500
      });
      
      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack({
          delta: 1,
          fail: () => {
            // 如果没有上一页，跳转到首页
            wx.redirectTo({
              url: '/pages/home/home'
            });
          }
        });
      }, 1500);
      
    } catch (err) {
      console.error('保存失败', err);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  },

  // 分享功能
  onShareAppMessage() {
    return {
      title: '一起守护家人健康',
      path: '/pages/home/home'
    };
  }
});
