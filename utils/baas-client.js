const { BAAS_CONFIG } = require('./baas-config');

let readyPromise = null;
let currentUser = null;

function initialize() {
  if (readyPromise) return readyPromise;

  readyPromise = Promise.resolve().then(() => {
    require('./sdk-wechat.3.23.6.js');

    if (!wx.BaaS) {
      throw new Error('知晓云 SDK 加载失败');
    }

    wx.BaaS.init(BAAS_CONFIG.clientId);
    return wx.BaaS.auth.loginWithWechat();
  }).then(user => {
    currentUser = user;
    return user;
  }).catch(error => {
    readyPromise = null;
    throw error;
  });

  return readyPromise;
}

function getCurrentUser() {
  return currentUser;
}

function getCurrentUserId() {
  if (!currentUser) return null;
  return currentUser.id || currentUser.user_id || null;
}

function getCurrentOpenId() {
  if (!currentUser) return null;
  if (currentUser.openid) return currentUser.openid;
  if (typeof currentUser.get === 'function' && currentUser.get('openid')) {
    return currentUser.get('openid');
  }
  return wx.getStorageSync('ifx_baas_openid') || null;
}

module.exports = {
  initialize,
  getCurrentUser,
  getCurrentUserId,
  getCurrentOpenId
};
