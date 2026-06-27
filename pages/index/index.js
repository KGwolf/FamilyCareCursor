const { DataManager } = require('../../utils/data-manager');
const app = getApp();

const ACTION_ROUTES = {
  reminder: '/pages/addReminder/addReminder',
  symptoms: '/pages/addRecord/addRecord?tab=symptoms',
  weight: '/pages/addRecord/addRecord?tab=weight',
  schedule: '/pages/addReminder/addReminder?mode=schedule'
};

Page({
  data: {
    showRelationPicker: false,
    pendingAction: '',
    actions: [
      { id: 'reminder', icon: '✓', title: '添加今日事项', desc: '记住今天要做的事', tone: 'blue' },
      { id: 'symptoms', icon: '●', title: '记录身体状态', desc: '按时间留下身体变化', tone: 'orange' },
      { id: 'weight', icon: '↓', title: '记录体重', desc: '开始观察体重趋势', tone: 'green' },
      { id: 'schedule', icon: '日', title: '安排重要日期', desc: '记下复查、检查或治疗', tone: 'purple' }
    ],
    relations: [
      { value: 'father', label: '爸爸', avatar: '/images/user1.png' },
      { value: 'mother', label: '妈妈', avatar: '/images/user2.png' },
      { value: 'self', label: '自己', avatar: '/images/user3.png' },
      { value: 'spouse', label: '配偶', avatar: '/images/user4.png' },
      { value: 'other', label: '家人', avatar: '/images/user1.png' }
    ]
  },

  onShow() {
    this.checkFamilyMembers();
  },

  checkFamilyMembers() {
    if (DataManager.hasFamilyMembers() && !this.isNavigating) {
      this.isNavigating = true;
      wx.reLaunch({
        url: '/pages/home/home',
        fail: () => {
          this.isNavigating = false;
        }
      });
    }
  },

  onActionTap(e) {
    this.setData({
      pendingAction: e.currentTarget.dataset.action,
      showRelationPicker: true
    });
  },

  closeRelationPicker() {
    this.setData({ showRelationPicker: false });
  },

  preventClose() {},

  onRelationTap(e) {
    const relation = this.data.relations.find(item => item.value === e.currentTarget.dataset.relation);
    if (!relation || !this.data.pendingAction) return;

    const familyMember = {
      id: Date.now(),
      name: relation.label,
      relation: relation.value,
      relationLabel: relation.label,
      age: null,
      remark: '',
      avatar: relation.avatar,
      isQuickProfile: true,
      createdAt: new Date().toISOString()
    };

    if (!DataManager.addFamilyMember(familyMember)) {
      wx.showToast({ title: '创建失败，请重试', icon: 'none' });
      return;
    }

    app.refreshFamilyMembers();
    app.setCurrentFamily(familyMember.id);
    const route = ACTION_ROUTES[this.data.pendingAction];
    const onboardingRoute = `${route}${route.includes('?') ? '&' : '?'}from=onboarding`;
    this.setData({ showRelationPicker: false });
    this.isNavigating = true;
    wx.reLaunch({
      url: onboardingRoute,
      fail: () => {
        this.isNavigating = false;
        wx.showToast({ title: '页面打开失败', icon: 'none' });
      }
    });
  }
});
