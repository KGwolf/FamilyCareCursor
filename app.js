const { DataManager, STORAGE_KEYS } = require('./utils/data-manager');
const CloudSync = require('./utils/cloud-sync');

App({
  globalData: {
    currentFamilyId: null,
    currentFamily: null,
    familyMembers: [],
    userInfo: null,
    settings: null,
    cloudStatus: 'idle',
    cloudUserId: null
  },

  onLaunch() {
    this.initGlobalData();
    this.initializeCloud();
  },

  initializeCloud() {
    this.globalData.cloudStatus = 'loading';
    this.cloudReady = CloudSync.initialize().then(result => {
      this.globalData.cloudStatus = 'ready';
      this.globalData.cloudUserId = result.user && (result.user.id || result.user.user_id);
      console.info('知晓云初始化完成', {
        userId: this.globalData.cloudUserId,
        migrated: result.migrated
      });
      return result;
    }).catch(error => {
      this.globalData.cloudStatus = 'error';
      console.error('知晓云初始化或本地数据迁移失败，请检查数据表与权限配置', error);
      return null;
    });

    return this.cloudReady;
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
