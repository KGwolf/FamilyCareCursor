const { DataManager } = require('../../utils/data-manager');
const app = getApp();

const DEBUG_TREND = false;
const DAY_MS = 24 * 60 * 60 * 1000;

const getRangeStart = (days) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  return start;
};

const safeStringify = (value) => {
  try {
    const seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    return JSON.stringify(value, (key, val) => {
      if (typeof val === 'bigint') return val.toString();
      if (typeof val === 'function') return `[Function ${val.name || 'anonymous'}]`;
      if (typeof val === 'undefined') return '[Undefined]';
      if (seen && typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    });
  } catch (e) {
    try {
      return String(value);
    } catch (e2) {
      return '[Unstringifiable]';
    }
  }
};

Page({
  data: {
    statusBarHeight: 0,
    familyMembers: [],
    completionRate: 0,
    activeTab: 'reminders',
    rangeOptions: [
      { label: '7日', days: 7 },
      { label: '30日', days: 30 },
      { label: '90日', days: 90 }
    ],
    selectedRangeDays: 7,
    rangeLabel: '近7日',
    hasReminderData: false,
    hasWeightData: false,
    hasSymptomData: false,
    weightTrendReady: false,
    weightRecordCount: 0,
    symptomRecordCount: 0,
    weightChangeLabel: '',
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
    reminderCompletion: 0,
    reminderTotal: 0,
    completionStatus: '正在统计...',
    missedReminders: [],
    trendLabels: [],
    trendPath: '',
    trendAreaPath: '',
    trendBadgeValue: 0,
    trendData: [],
    trendTotalData: [],
    trendDateStrs: [],
    trendSelectedIndex: -1,
    trendGranularity: '按天',
    trendCanvasW: 0,
    trendCanvasH: 0,
    trendCanvasCssW: 0,
    trendCanvasCssH: 0
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
    if (DEBUG_TREND) console.log(`[Records] 开始加载提醒数据 familyId=${safeStringify(familyId)}`);
    const { selectedRangeDays } = this.data;
    const rangeLabel = `近${selectedRangeDays}日`;
    const now = new Date();
    const dailyCompletedCounts = [];
    const dailyPlannedCounts = [];
    const fullTrendLabels = [];
    const trendDateStrs = [];
    let periodCompletedTotal = 0;
    let periodPlannedTotal = 0;
    
    for (let i = selectedRangeDays - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * DAY_MS);
      const dateStr = DataManager.formatDate(date);
      trendDateStrs.push(dateStr);
      
      // 使用 DataManager.getRemindersByDate 获取该日期的提醒及其当时的完成状态
      const dayReminders = DataManager.getRemindersByDate(dateStr).filter(r => r.familyId == familyId);
      const dayCompleted = dayReminders.filter(r => r.completed).length;
      const dayTotal = dayReminders.length;
      if (DEBUG_TREND) console.log(`[Records] 趋势日期=${dateStr} total=${dayReminders.length} done=${dayCompleted}`);
      
      // 记录已完成数量，而不是完成率
      dailyCompletedCounts.push(dayCompleted);
      dailyPlannedCounts.push(dayTotal);
      periodCompletedTotal += dayCompleted;
      periodPlannedTotal += dayTotal;
      
      if (i === 0) {
        fullTrendLabels.push('今日');
      } else {
        fullTrendLabels.push(`${date.getMonth() + 1}.${date.getDate()}`);
      }
    }

    const completionRate = periodPlannedTotal > 0
      ? Math.round((periodCompletedTotal / periodPlannedTotal) * 100)
      : 0;
    let completionStatus = '本期完成情况';
    if (periodPlannedTotal > 0 && completionRate >= 90) completionStatus = '绝大部分已完成';
    else if (periodPlannedTotal > 0 && completionRate >= 60) completionStatus = '多数事项已完成';
    else if (periodPlannedTotal > 0) completionStatus = '还有事项待确认';

    const shortDate = dateStr => {
      const parts = dateStr.split('-');
      return `${Number(parts[1])}.${Number(parts[2])}`;
    };
    const bucketSize = selectedRangeDays === 7 ? 1 : 7;
    const trendGroups = [];
    for (let end = dailyCompletedCounts.length; end > 0; end -= bucketSize) {
      const start = Math.max(0, end - bucketSize);
      const startDate = trendDateStrs[start];
      const endDate = trendDateStrs[end - 1];
      const completed = dailyCompletedCounts.slice(start, end).reduce((sum, value) => sum + value, 0);
      const planned = dailyPlannedCounts.slice(start, end).reduce((sum, value) => sum + value, 0);
      const isToday = endDate === DataManager.formatDate(now);
      trendGroups.unshift({
        completed,
        planned,
        axisLabel: isToday ? '今日' : shortDate(endDate),
        rangeLabel: startDate === endDate ? (isToday ? '今日' : shortDate(endDate)) : `${shortDate(startDate)}–${shortDate(endDate)}`
      });
    }

    const trendData = trendGroups.map(group => group.completed);
    const trendTotalData = trendGroups.map(group => group.planned);
    const trendRangeLabels = trendGroups.map(group => group.rangeLabel);
    const axisIndexes = trendGroups.length <= 7
      ? trendGroups.map((_, index) => index)
      : [0, 1, 2, 3, 4].map(index => Math.round(index * (trendGroups.length - 1) / 4));
    const trendLabels = axisIndexes.map(index => trendGroups[index].axisLabel);

    // 计算近48小时内的待补项
    const missedReminders = [];
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const checkDates = [0, 1, 2]; // 检查最近3天
    
    checkDates.forEach(daysAgo => {
      const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const dateStr = DataManager.formatDate(date);
      
      const dayReminders = DataManager.getRemindersByDate(dateStr).filter(r => r.familyId == familyId);
      dayReminders.forEach(r => {
        if (!r.completed) {
          // 检查是否在48小时内
          const [hours, minutes] = r.time.split(':');
          const reminderTime = new Date(date.getTime());
          reminderTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          if (reminderTime < now && reminderTime >= fortyEightHoursAgo) {
            const delayMs = now.getTime() - reminderTime.getTime();
            const delayHours = Math.floor(delayMs / (1000 * 60 * 60));
            
            missedReminders.push({
              id: `${r.id}_${dateStr}`,
              name: r.type.name,
              time: `${daysAgo === 0 ? '今日' : daysAgo === 1 ? '昨日' : '前日'} ${r.time}`,
              delay: `${delayHours}h`,
              type: r.type.name,
              icon: r.type.icon
            });
          }
        }
      });
    });

    this.setData({
      reminderCompletion: completionRate,
      reminderTotal: periodPlannedTotal,
      weeklyCompletedTotal: periodCompletedTotal,
      completionStatus,
      hasReminderData: periodPlannedTotal > 0,
      rangeLabel,
      missedReminders: missedReminders,
      trendLabels: trendLabels,
      trendBadgeValue: '',
      trendSelectedIndex: -1,
      trendDateStrs: trendRangeLabels,
      trendData,
      trendTotalData,
      trendGranularity: bucketSize === 1 ? '按天' : '按7天汇总'
    }, () => {
      if (DEBUG_TREND) console.log(`[Records] 最终趋势数据 trendData=${safeStringify(trendData)}`);
      if (typeof wx.nextTick === 'function') {
        wx.nextTick(() => this.drawTrendChart());
      } else {
        this.drawTrendChart();
      }
    });
  },

  drawTrendChart() {
    const query = this.createSelectorQuery();
    query.select('.trend-chart-container').boundingClientRect();
    query.exec((res) => {
      const rect = res && res[0] ? res[0] : null;
      const width = rect && rect.width ? Math.floor(rect.width) : 0;
      const height = rect && rect.height ? Math.floor(rect.height) : 0;
      if (!width || !height) return;

      this._trendCanvasRect = rect;
      this.setData({ trendCanvasCssW: width, trendCanvasCssH: height }, () => {
        const ctx = wx.createCanvasContext('trendChart', this);
        if (!ctx) return;

        const completedData = this.data.trendData || [];
        const plannedData = this.data.trendTotalData || [];
        const count = completedData.length;
        if (!count) return;

        const padding = { top: 24, bottom: 20, left: 32, right: 12 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const maxVal = Math.max(1, ...plannedData, ...completedData);
        const slotW = chartW / count;
        const plannedBarW = Math.max(6, Math.min(18, slotW * 0.56));
        const completedBarW = Math.max(4, Math.min(12, plannedBarW * 0.62));

        ctx.clearRect(0, 0, width, height);
        ctx.setFontSize(10);
        ctx.setTextAlign('right');
        ctx.setTextBaseline('middle');
        ctx.setFillStyle('#94a3b8');
        ctx.setStrokeStyle('#edf1f5');
        ctx.setLineWidth(1);

        const ticks = [maxVal, Math.round(maxVal / 2), 0]
          .filter((value, index, values) => values.indexOf(value) === index)
          .sort((a, b) => b - a);
        ticks.forEach(value => {
          const y = padding.top + chartH - (value / maxVal) * chartH;
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(padding.left + chartW, y);
          ctx.stroke();
          ctx.fillText(String(value), padding.left - 7, y);
        });

        this._trendTouchBars = completedData.map((completed, index) => {
          const planned = plannedData[index] || 0;
          const centerX = padding.left + slotW * (index + 0.5);
          const baseline = padding.top + chartH;
          const plannedH = (planned / maxVal) * chartH;
          const completedH = (completed / maxVal) * chartH;

          if (planned > 0) {
            ctx.setFillStyle('#d9e0e8');
            ctx.fillRect(centerX - plannedBarW / 2, baseline - plannedH, plannedBarW, plannedH);
          } else {
            ctx.setStrokeStyle('#cbd5e1');
            ctx.setLineWidth(2);
            ctx.beginPath();
            ctx.moveTo(centerX - plannedBarW / 2, baseline - 1);
            ctx.lineTo(centerX + plannedBarW / 2, baseline - 1);
            ctx.stroke();
          }

          if (completed > 0) {
            ctx.setFillStyle('#137fec');
            ctx.fillRect(centerX - completedBarW / 2, baseline - completedH, completedBarW, completedH);
          }

          if (this.data.trendSelectedIndex === index) {
            ctx.setStrokeStyle('#0f6dce');
            ctx.setLineWidth(2);
            ctx.strokeRect(centerX - plannedBarW / 2 - 3, padding.top - 4, plannedBarW + 6, chartH + 8);
          }

          return {
            x: centerX,
            hitWidth: Math.max(20, slotW),
            completed,
            planned,
            label: this.data.trendDateStrs[index] || ''
          };
        });

        const selectedIndex = this.data.trendSelectedIndex;
        if (selectedIndex >= 0 && selectedIndex < this._trendTouchBars.length) {
          const selected = this._trendTouchBars[selectedIndex];
          const tooltip = `${selected.label}  完成 ${selected.completed}/${selected.planned}`;
          const boxW = Math.min(width - 16, Math.max(112, tooltip.length * 7 + 18));
          const boxX = Math.max(8, Math.min(width - boxW - 8, selected.x - boxW / 2));
          ctx.setFillStyle('#ffffff');
          ctx.setStrokeStyle('#dfe6ee');
          ctx.setLineWidth(1);
          ctx.fillRect(boxX, 2, boxW, 24);
          ctx.strokeRect(boxX, 2, boxW, 24);
          ctx.setFillStyle('#334155');
          ctx.setFontSize(10);
          ctx.setTextAlign('center');
          ctx.fillText(tooltip, boxX + boxW / 2, 14);
        }

        ctx.draw(false);
      });
    });
  },

  onTrendTouch(e) {
    const touch = e && e.touches && e.touches[0] ? e.touches[0] : null;
    if (!touch || !this._trendTouchBars || this._trendTouchBars.length === 0) return;

    let localX = touch.x;
    if (localX === undefined && this._trendCanvasRect) {
      if (touch.clientX !== undefined) localX = touch.clientX - this._trendCanvasRect.left;
      else if (touch.pageX !== undefined) localX = touch.pageX - this._trendCanvasRect.left;
    }
    if (localX === undefined) return;

    let bestIndex = -1;
    let bestDistance = Infinity;
    this._trendTouchBars.forEach((bar, index) => {
      const distance = Math.abs(bar.x - localX);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    if (bestIndex < 0 || bestDistance > this._trendTouchBars[bestIndex].hitWidth / 2) return;
    const nextIndex = this.data.trendSelectedIndex === bestIndex ? -1 : bestIndex;
    const selected = nextIndex >= 0 ? this._trendTouchBars[nextIndex] : null;
    this.setData({
      trendSelectedIndex: nextIndex,
      trendBadgeValue: selected ? `${selected.completed}/${selected.planned}` : ''
    }, () => this.drawTrendChart());
  },

  onRetryTask() {
    const { missedReminders } = this.data;
    if (!missedReminders || missedReminders.length === 0) return;

    // 得到所有有待补项的日期（从 id 格式 "id_YYYY-MM-DD" 中提取）
    const dates = missedReminders.map(m => m.id.split('_')[1]).sort();
    if (dates.length === 0) return;

    // 获取最早的那个日期
    const earliestDate = dates[0];
    
    // 先设置全局变量，再执行跳转
    app.globalData.targetCalendarDate = earliestDate;
    
    wx.navigateTo({
      url: '/pages/calendar/calendar'
    });
  },

  loadWeightData(familyId) {
    const { selectedRangeDays } = this.data;
    const start = getRangeStart(selectedRangeDays);
    const weightRecords = DataManager.getHealthRecordsByFamilyId(familyId)
      .filter(record => record.type === 'weight' && new Date(record.recordTime) >= start)
      .sort((a, b) => new Date(a.recordTime) - new Date(b.recordTime));
    
    if (weightRecords.length === 0) {
      this.setData({
        currentWeight: null,
        weightDiff: 0,
        weightChangeLabel: '',
        history: [],
        chartData: [],
        weightLabels: [],
        trendSummary: '',
        hasWeightData: false,
        weightTrendReady: false,
        weightRecordCount: 0,
        rangeLabel: `近${selectedRangeDays}日`
      });
      return;
    }

    const latestRecord = weightRecords[weightRecords.length - 1];
    const firstRecord = weightRecords[0];
    const weightDiff = weightRecords.length > 1 ? latestRecord.weight - firstRecord.weight : 0;
    const weightChangeLabel = weightRecords.length > 1
      ? `${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)}kg`
      : '';

    const history = weightRecords.slice().reverse().map(r => ({
      id: r.id,
      value: `${r.weight} kg`,
      status: r.weightDiff > 0 ? '上升' : r.weightDiff < 0 ? '下降' : '平稳',
      time: DataManager.formatDateTime(r.recordTime),
      note: r.note || ''
    }));

    const chartData = weightRecords.map(r => r.weight);
    const fullWeightLabels = weightRecords.map(r => {
      const date = new Date(r.recordTime);
      return `${date.getMonth() + 1}.${date.getDate()}`;
    });
    const weightLabelIndexes = fullWeightLabels.length <= 7
      ? fullWeightLabels.map((_, index) => index)
      : [0, 1, 2, 3, 4, 5, 6].map(index => Math.round(index * (fullWeightLabels.length - 1) / 6));
    const weightLabels = weightLabelIndexes.map(index => fullWeightLabels[index]);

    const avgWeight = chartData.reduce((a, b) => a + b, 0) / chartData.length;
    const trendSummary = weightRecords.length < 3
      ? `本周期已记录 ${weightRecords.length} 次，至少记录 3 次后再观察趋势。`
      : `本周期记录 ${weightRecords.length} 次，平均 ${avgWeight.toFixed(1)}kg，整体变化 ${weightChangeLabel}。`;

    this.setData({
      currentWeight: latestRecord.weight,
      weightDiff,
      weightChangeLabel,
      history,
      chartData,
      weightLabels,
      trendSummary,
      hasWeightData: true,
      weightTrendReady: weightRecords.length >= 3,
      weightRecordCount: weightRecords.length,
      rangeLabel: `近${selectedRangeDays}日`,
      completionRate: Math.min(100, weightRecords.length * 15)
    });
  },

  loadSymptomData(familyId) {
    const { selectedRangeDays } = this.data;
    const start = getRangeStart(selectedRangeDays);
    const symptomRecords = DataManager.getHealthRecordsByFamilyId(familyId)
      .filter(record => record.type === 'symptoms' && new Date(record.recordTime) >= start)
      .sort((a, b) => new Date(b.recordTime) - new Date(a.recordTime));
    
    if (symptomRecords.length === 0) {
      this.setData({
        symptomStats: [],
        symptomHistory: [],
        symptomCompletion: 0,
        hasSymptomData: false,
        symptomRecordCount: 0,
        rangeLabel: `近${selectedRangeDays}日`
      });
      return;
    }

    const symptomCounts = {};
    symptomRecords.forEach(r => {
      r.symptoms.forEach(s => {
        if (!symptomCounts[s.name]) symptomCounts[s.name] = { count: 0, dates: {} };
        symptomCounts[s.name].count++;
        symptomCounts[s.name].dates[DataManager.formatDate(r.recordTime)] = true;
      });
    });

    const symptomStats = Object.entries(symptomCounts).map(([name, stats]) => {
      const symptomDef = this.getSymptomDef(name);
      const dayCount = Object.keys(stats.dates).length;
      return {
        name,
        count: stats.count,
        dayCount,
        countLabel: `${dayCount}天`,
        color: symptomDef ? symptomDef.color : 'slate'
      };
    }).sort((a, b) => b.dayCount - a.dayCount || b.count - a.count);

    const symptomHistory = symptomRecords.map(r => ({
      id: r.id,
      time: DataManager.formatDateTime(r.recordTime),
      severity: r.severity || '',
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
      symptomHistory: symptomHistory.slice(0, 20),
      symptomCompletion: Math.min(100, symptomRecords.length * 10),
      hasSymptomData: true,
      symptomRecordCount: symptomRecords.length,
      rangeLabel: `近${selectedRangeDays}日`
    });
  },

  getSymptomDef(name) {
    const symptoms = [
      { name: '腹泻', icon: '🚽', color: 'orange' },
      { name: '声音嘶哑', icon: '🗣️', color: 'purple' },
      { name: '疼痛', icon: '🤕', color: 'rose' },
      { name: '恶心', icon: '🤢', color: 'orange' },
      { name: '疲劳', icon: '😫', color: 'blue' },
      { name: '发热', icon: '🤒', color: 'red' },
      { name: '感冒', icon: '🤧', color: 'blue' },
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
      } else if (this.data.activeTab === 'reminders') {
        this.drawTrendChart();
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
      } else if (tab === 'reminders') {
        this.drawTrendChart();
      }
    });
  },

  onRangeChange(e) {
    const days = Number(e.currentTarget.dataset.days);
    if (!days || days === this.data.selectedRangeDays) return;

    this.setData({
      selectedRangeDays: days,
      rangeLabel: `近${days}日`,
      selectedIndex: -1,
      trendSelectedIndex: -1
    }, () => {
      this.loadData();
      if (this.data.activeTab === 'weight') {
        wx.nextTick(() => this.drawWeightChart());
      } else if (this.data.activeTab === 'reminders') {
        wx.nextTick(() => this.drawTrendChart());
      }
    });
  },

  onAddMember() {
    wx.navigateTo({
      url: '/pages/addFamily/addFamily'
    });
  },

  onAddRecord(e) {
    const tab = e && e.currentTarget ? e.currentTarget.dataset.tab : this.data.activeTab;
    const url = tab === 'reminders'
      ? '/pages/addReminder/addReminder'
      : `/pages/addRecord/addRecord?tab=${tab === 'symptoms' ? 'symptoms' : 'weight'}`;
    wx.navigateTo({ url });
  }
});
