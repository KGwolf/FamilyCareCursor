const BaaSClient = require('./baas-client');

function removeUndefined(value) {
  return Object.keys(value).reduce((result, key) => {
    if (value[key] !== undefined) result[key] = value[key];
    return result;
  }, {});
}

function getUserId() {
  const userId = BaaSClient.getCurrentUserId();
  if (!userId) throw new Error('知晓云用户尚未登录');
  return userId;
}

function findByLocalId(tableName, localId) {
  const table = new wx.BaaS.TableObject(tableName);
  const query = new wx.BaaS.Query();
  query.compare('owner_id', '=', getUserId());
  query.compare('local_id', '=', String(localId));
  return table.setQuery(query).limit(1).find().then(result => {
    const objects = result && result.data && result.data.objects;
    return objects && objects.length ? objects[0] : null;
  });
}

function upsertByLocalId(tableName, localId, data) {
  const payload = removeUndefined({
    ...data,
    local_id: String(localId),
    owner_id: getUserId()
  });

  return findByLocalId(tableName, localId).then(existing => {
    if (existing) {
      const record = new wx.BaaS.TableObject(tableName).getWithoutData(existing.id);
      record.set(payload);
      return record.update();
    }

    const record = new wx.BaaS.TableObject(tableName).create();
    record.set(payload);
    return record.save();
  });
}

function deleteByLocalId(tableName, localId) {
  return findByLocalId(tableName, localId).then(existing => {
    if (!existing) return false;
    return new wx.BaaS.TableObject(tableName).delete(existing.id).then(() => true);
  });
}

module.exports = {
  findByLocalId,
  upsertByLocalId,
  deleteByLocalId
};
