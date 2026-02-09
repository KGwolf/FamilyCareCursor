const { DataManager, STORAGE_KEYS } = require('./utils/data-manager');

App({
  globalData: {
    currentFamilyId: null,
    currentFamily: null,
    familyMembers: [],
    userInfo: null,
    settings: null
  },

  onLaunch() {
    this.initGlobalData();
  },

  initGlobalData() {
    this.globalData.userInfo = DataManager.getUserInfo();
    this.globalData.familyMembers = DataManager.getFamilyMembers();
    this.globalData.settings = DataManager.getSettings();
    this.globalData.currentFamilyId = DataManager.getCurrentFamilyId();
    
    if (this.globalData.currentFamilyId) {
      this.updateCurrentFamily();
    }
  },

  updateCurrentFamily() {
    const family = this.globalData.familyMembers.find(m => m.id === this.globalData.currentFamilyId);
    this.globalData.currentFamily = family || null;
    
    if (!family && this.globalData.familyMembers.length > 0) {
      this.globalData.currentFamilyId = this.globalData.familyMembers[0].id;
      this.globalData.currentFamily = this.globalData.familyMembers[0];
      DataManager.setCurrentFamilyId(this.globalData.currentFamilyId);
    }
  },

  setCurrentFamily(familyId) {
    this.globalData.currentFamilyId = familyId;
    DataManager.setCurrentFamilyId(familyId);
    this.updateCurrentFamily();
  },

  refreshFamilyMembers() {
    this.globalData.familyMembers = DataManager.getFamilyMembers();
    this.updateCurrentFamily();
  },

  refreshUserInfo() {
    this.globalData.userInfo = DataManager.getUserInfo();
  },

  refreshSettings() {
    this.globalData.settings = DataManager.getSettings();
  }
});
