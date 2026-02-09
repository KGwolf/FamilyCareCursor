const { DataManager } = require('../../utils/data-manager');
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    familyMembers: [],
    completionRate: 0,
    activeTab: 'reminders',
    currentWeight: 0,
    weightDiff: 0,
    history: [],
    trendSummary: '',
    weightLabels: [],
    selectedIndex: -1,
    chartData: [],
    symptomCompletion: 0,
    symptomStats: [],
    symptomHistory: [],
    reminderCompletion: 92,
    reminderTotal: 42,
    missedReminders: []
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    });

    if (options.tab) {
      this.setData({
        activeTab: options.tab
      });
    }

    this.loadFamilyData();
  },

  onReady() {
    if (this.data.activeTab === 'weight') {
      this.drawWeightChart();
    }
  },

  onShow() {
    this.loadFamilyData();
  },

  loadFamilyData() {
    const familyMembers = app.globalData.familyMembers;
    const currentFamilyId = app.globalData.currentFamilyId;
    
    if (familyMembers.length === 0) {
      wx.reLaunch({
        url: '/pages/index/index'
      });
      return;
    }

    const activeMembers = familyMembers.map(m => ({
      ...m,
      active: m.id === currentFamilyId
    }));

    this.setData({
      familyMembers: activeMembers
    });

    this.loadData();
  },

  loadData() {
    const { activeTab, familyMembers } = this.data;
    const currentMember = familyMembers.find(m => m.active);
    
    if (!currentMember) return;

    if (activeTab === 'weight') {
      this.loadWeightData(currentMember.id);
    } else if (activeTab === 'symptoms') {
      this.loadSymptomData(currentMember.id);
    } else if (activeTab === 'reminders') {
      this.loadReminderData(currentMember.id);
    }
  },

  loadReminderData(familyId) {
    // 获取当前家庭成员的所有提醒
    const reminders = DataManager.getRemindersByFamilyId(familyId);
    const totalReminders = reminders.length;
    
    // 计算完成率
    const completedReminders = reminders.filter(r => r.completed).length;
    const completionRate = totalReminders > 0 ? Math.round((completedReminders / totalReminders) * 100) : 0;
    
    // 计算近48小时内的待补项
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    
    const missedReminders = reminders.filter(r => {
      if (r.completed) return false;
      
      // 检查提醒是否在近48小时内
      const reminderDate = new Date(r.date);
      return reminderDate >= fortyEightHoursAgo;
    }).map(r => {
      // 计算超时时间
      const reminderDate = new Date(r.date);
      const delayMs = now.getTime() - reminderDate.getTime();
      const delayHours = Math.round(delayMs / (1000 * 60 * 60));
      
      return {
        id: r.id,
        name: r.type.name,
        time: `${r.date} ${r.time}`,
        delay: `${delayHours}h`,
        type: r.type.name,
        icon: r.type.icon
      };
    });

    this.setData({
      reminderCompletion: completionRate,
      reminderTotal: totalReminders,
      missedReminders: missedReminders
    });
  },

  loadWeightData(familyId) {
    const weightRecords = DataManager.getWeightRecords(familyId, 7);
    
    if (weightRecords.length === 0) {
      this.setData({
        currentWeight: 0,
        weightDiff: 0,
        history: [],
        chartData: [],
        weightLabels: [],
        trendSummary: '暂无体重记录'
      });
      return;
    }

    const latestRecord = weightRecords[weightRecords.length - 1];
    const previousRecord = weightRecords.length > 1 ? weightRecords[weightRecords.length - 2] : null;
    const weightDiff = previousRecord ? (latestRecord.weight - previousRecord.weight).toFixed(1) : 0;

    const history = weightRecords.map(r => ({
      id: r.id,
      value: `${r.weight} kg`,
      status: r.weightDiff > 0 ? '上升' : r.weightDiff < 0 ? '下降' : '平稳',
      time: DataManager.formatDateTime(r.recordTime),
      note: r.note || ''
    }));

    const chartData = weightRecords.map(r => r.weight);
    const weightLabels = weightRecords.map(r => {
      const date = new Date(r.recordTime);
      return `${date.getMonth() + 1}.${date.getDate()}`;
    });

    const avgWeight = chartData.reduce((a, b) => a + b, 0) / chartData.length;
    const trendSummary = `平均体重 ${avgWeight.toFixed(1)}kg，${weightDiff > 0 ? '较上次上升' : weightDiff < 0 ? '较上次下降' : '保持平稳'} ${Math.abs(weightDiff)}kg`;

    this.setData({
      currentWeight: latestRecord.weight,
      weightDiff: weightDiff,
      history,
      chartData,
      weightLabels,
      trendSummary,
      completionRate: Math.min(100, weightRecords.length * 15)
    });
  },

  loadSymptomData(familyId) {
    const symptomRecords = DataManager.getSymptomRecords(familyId, 10);
    
    if (symptomRecords.length === 0) {
      this.setData({
        symptomStats: [],
        symptomHistory: [],
        symptomCompletion: 0
      });
      return;
    }

    const symptomCounts = {};
    symptomRecords.forEach(r => {
      r.symptoms.forEach(s => {
        symptomCounts[s.name] = (symptomCounts[s.name] || 0) + 1;
      });
    });

    const symptomStats = Object.entries(symptomCounts).map(([name, count]) => {
      const symptomDef = this.getSymptomDef(name);
      return {
        name,
        count,
        color: symptomDef ? symptomDef.color : 'slate'
      };
    });

    const symptomHistory = symptomRecords.map(r => ({
      id: r.id,
      time: DataManager.formatDateTime(r.recordTime),
      severity: r.severity || '轻度',
      tags: r.symptoms.map(s => {
        const symptomDef = this.getSymptomDef(s.name);
        return {
          name: s.name,
          icon: symptomDef ? symptomDef.icon : '❓',
          color: symptomDef ? symptomDef.color : 'slate'
        };
      }),
      note: r.note || ''
    }));

    this.setData({
      symptomStats,
      symptomHistory,
      symptomCompletion: Math.min(100, symptomRecords.length * 10)
    });
  },

  getSymptomDef(name) {
    const symptoms = [
      { name: '疼痛', icon: '🤕', color: 'rose' },
      { name: '恶心', icon: '🤢', color: 'orange' },
      { name: '疲劳', icon: '😫', color: 'blue' },
      { name: '发热', icon: '🤒', color: 'red' },
      { name: '头晕', icon: '😵', color: 'purple' }
    ];
    return symptoms.find(s => s.name === name);
  },

  drawWeightChart(selectedIndex = -1) {
    const query = this.createSelectorQuery();
    query.select('#weightChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const width = res[0].width;
        const height = res[0].height;
        const dpr = wx.getWindowInfo().pixelRatio;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        const weights = this.data.chartData;
        if (weights.length === 0) return;

        const minW = Math.min(...weights) - 5;
        const maxW = Math.max(...weights) + 5;
        const range = maxW - minW || 1;

        const padding = { top: 20, bottom: 20, left: 35, right: 15 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const ySteps = 3;
        for (let i = 0; i <= ySteps; i++) {
          const val = (minW + (range * i) / ySteps).toFixed(0);
          const y = padding.top + chartH - (i / ySteps) * chartH;
          ctx.fillText(val, padding.left - 8, y);
          
          ctx.beginPath();
          ctx.setLineDash([2, 4]);
          ctx.moveTo(padding.left, y);
          ctx.lineTo(padding.left + chartW, y);
          ctx.strokeStyle = '#f1f5f9';
          ctx.stroke();
          ctx.setLineDash([]);
        }

        const points = weights.map((w, i) => ({
          x: padding.left + (i / (weights.length - 1 || 1)) * chartW,
          y: padding.top + chartH - ((w - minW) / range) * chartH,
          val: w
        }));

        this.chartPoints = points;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
          const cp1x = (points[i].x + points[i + 1].x) / 2;
          ctx.bezierCurveTo(cp1x, points[i].y, cp1x, points[i + 1].y, points[i + 1].x, points[i + 1].y);
        }
        ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.closePath();
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(19, 127, 236, 0.2)');
        gradient.addColorStop(1, 'rgba(19, 127, 236, 0.02)');
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
          const cp1x = (points[i].x + points[i + 1].x) / 2;
          ctx.bezierCurveTo(cp1x, points[i].y, cp1x, points[i + 1].y, points[i + 1].x, points[i + 1].y);
        }
        ctx.strokeStyle = '#137fec';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        points.forEach((p, i) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, i === selectedIndex ? 5 : 3, 0, Math.PI * 2);
          ctx.fillStyle = i === selectedIndex ? '#137fec' : '#fff';
          ctx.fill();
          ctx.strokeStyle = '#137fec';
          ctx.lineWidth = 2;
          ctx.stroke();

          if (i === selectedIndex) {
            ctx.fillStyle = '#137fec';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.val + 'kg', p.x, p.y - 12);
          }
        });

        if (selectedIndex === -1) {
          const last = points[points.length - 1];
          ctx.beginPath();
          ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#137fec';
          ctx.fill();
        }
      });
  },

  onChartTouch(e) {
    if (!this.chartPoints) return;
    const touch = e.touches[0];
    const x = touch.x;
    const y = touch.y;

    let closestIndex = -1;
    let minDistance = 30;

    this.chartPoints.forEach((p, i) => {
      const dist = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    });

    if (closestIndex !== -1 && closestIndex !== this.data.selectedIndex) {
      this.setData({ selectedIndex: closestIndex });
      this.drawWeightChart(closestIndex);
    }
  },

  onViewMore() {
    wx.showActionSheet({
      itemList: ['最近7天', '最近30天', '导出报表'],
      success: (res) => {
        wx.showToast({
          title: '正在加载历史数据',
          icon: 'loading'
        });
      }
    });
  },

  onSwitchMember(e) {
    const id = e.currentTarget.dataset.id;
    const familyMembers = this.data.familyMembers.map(member => ({
      ...member,
      active: member.id === id
    }));
    
    this.setData({ 
      familyMembers,
      selectedIndex: -1
    }, () => {
      app.setCurrentFamily(id);
      this.loadData();
      if (this.data.activeTab === 'weight') {
        this.drawWeightChart();
      }
    });
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab,
      selectedIndex: -1
    }, () => {
      this.loadData();
      if (tab === 'weight') {
        this.drawWeightChart();
      }
    });
  },

  onAddRecord() {
    wx.navigateTo({
      url: '/pages/addRecord/addRecord'
    });
  },

  onRetryTask() {
    wx.navigateTo({
      url: '/pages/addReminder/addReminder'
    });
  }
});
