const { DataManager } = require('../../utils/data-manager');
const app = getApp();

Page({
  data: {
    familyInfo: {
      id: '',
      name: '',
      relation: 'father',
      age: '',
      gender: 'male',
      avatar: '',
      remark: ''
    },
    nameFocused: false,
    ageFocused: false,
    remarkFocused: false
  },

  onLoad(options) {
    const familyId = parseInt(options.id);
    this.loadFamilyInfo(familyId);
  },

  loadFamilyInfo(familyId) {
    const familyMembers = app.globalData.familyMembers;
    const familyInfo = familyMembers.find(m => m.id === familyId);
    
    if (familyInfo) {
      this.setData({
        familyInfo: {
          id: familyInfo.id,
          name: familyInfo.name,
          relation: familyInfo.relation,
          age: familyInfo.age.toString(),
          gender: familyInfo.gender || 'male',
          avatar: familyInfo.avatar,
          remark: familyInfo.remark || ''
        }
      });
    } else {
      wx.showToast({
        title: '未找到成员信息',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 聚焦处理
  onNameFocus() { 
    this.setData({ nameFocused: true }); 
  },
  onNameBlur() { 
    this.setData({ nameFocused: false }); 
  },
  onAgeFocus() { 
    this.setData({ ageFocused: true }); 
  },
  onAgeBlur() { 
    this.setData({ ageFocused: false }); 
  },
  onRemarkFocus() { 
    this.setData({ remarkFocused: true }); 
  },
  onRemarkBlur() { 
    this.setData({ remarkFocused: false }); 
  },

  // 姓名输入处理
  onNameInput(e) {
    const name = e.detail.value;
    this.setData({
      'familyInfo.name': name
    });
  },

  // 关系选择处理
  onRelationSelect(e) {
    const relation = e.currentTarget.dataset.value;
    this.setData({
      'familyInfo.relation': relation
    });
  },

  // 年龄输入处理
  onAgeInput(e) {
    const age = e.detail.value;
    this.setData({
      'familyInfo.age': age
    });
  },

  // 性别选择处理
  onGenderSelect(e) {
    const gender = e.currentTarget.dataset.value;
    this.setData({
      'familyInfo.gender': gender
    });
  },

  // 备注输入处理
  onRemarkInput(e) {
    const remark = e.detail.value;
    this.setData({
      'familyInfo.remark': remark
    });
  },

  // 更换头像处理
  onChangeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        this.setData({
          'familyInfo.avatar': tempFilePath
        });
      },
      fail: (err) => {
        console.log('选择图片失败', err);
      }
    });
  },

  // 保存修改
  onSaveChanges() {
    const { familyInfo } = this.data;
    
    // 验证表单
    if (!familyInfo.name || !familyInfo.name.trim()) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
      return;
    }
    
    if (!familyInfo.age) {
      wx.showToast({
        title: '请输入年龄',
        icon: 'none'
      });
      return;
    }
    
    const ageNum = parseInt(familyInfo.age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      wx.showToast({
        title: '请输入有效年龄',
        icon: 'none'
      });
      return;
    }
    
    // 更新家人信息
    const updates = {
      name: familyInfo.name.trim(),
      relation: familyInfo.relation,
      relationLabel: this.getRelationLabel(familyInfo.relation),
      age: ageNum,
      gender: familyInfo.gender,
      avatar: familyInfo.avatar,
      remark: familyInfo.remark.trim(),
      createdAt: new Date().toISOString()
    };
    
    const success = DataManager.updateFamilyMember(familyInfo.id, updates);
    
    if (success) {
      app.refreshFamilyMembers();
      
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 1500
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } else {
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  },

  // 删除成员
  onDeleteMember() {
    const { familyInfo } = this.data;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要移除此成员吗？此操作不可恢复。',
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          const success = DataManager.deleteFamilyMember(familyInfo.id);
          
          if (success) {
            app.refreshFamilyMembers();
            
            wx.showToast({
              title: '删除成功',
              icon: 'success',
              duration: 1500
            });
            
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } else {
            wx.showToast({
              title: '删除失败，请重试',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 获取关系标签
  getRelationLabel(relation) {
    const labels = {
      'father': '父亲',
      'mother': '母亲',
      'spouse': '配偶',
      'other': '其他'
    };
    return labels[relation] || '其他';
  }
});