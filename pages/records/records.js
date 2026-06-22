const { DataManager } = require('../../utils/data-manager');
const app = getApp();

const DEBUG_TREND = false;

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
    // 获取当前家庭成员的所有提醒
    const reminders = DataManager.getRemindersByFamilyId(familyId);
    
    // 计算近7日趋势和周平均完成率
    const now = new Date();
    const trendCounts = [];
    const trendTotalCounts = [];
    const trendLabels = [];
    const trendDateStrs = [];
    let totalWeeklyRate = 0;
    let daysWithTasks = 0;
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = DataManager.formatDate(date);
      trendDateStrs.push(dateStr);
      
      // 使用 DataManager.getRemindersByDate 获取该日期的提醒及其当时的完成状态
      const dayReminders = DataManager.getRemindersByDate(dateStr).filter(r => r.familyId == familyId);
      const dayCompleted = dayReminders.filter(r => r.completed).length;
      const dayTotal = dayReminders.length;
      if (DEBUG_TREND) console.log(`[Records] 趋势日期=${dateStr} total=${dayReminders.length} done=${dayCompleted}`);
      
      // 记录已完成数量，而不是完成率
      trendCounts.push(dayCompleted);
      trendTotalCounts.push(dayTotal);
      
      // 计算当天的完成率用于周平均统计
      if (dayReminders.length > 0) {
        const dayRate = dayCompleted / dayReminders.length;
        totalWeeklyRate += dayRate;
        daysWithTasks++;
      }
      
      if (i === 0) {
        trendLabels.push('今日');
      } else {
        trendLabels.push(`${date.getMonth() + 1}.${date.getDate()}`);
      }
    }

    // 计算周平均完成率
    const weeklyCompletionRate = daysWithTasks > 0 ? Math.round((totalWeeklyRate / daysWithTasks) * 100) : 0;
    
    // 统计本周总完成任务数
    let weeklyCompletedTotal = 0;
    trendCounts.forEach(count => {
      weeklyCompletedTotal += count;
    });

    let completionStatus = '继续加油';
    if (weeklyCompletionRate >= 90) completionStatus = '完成度极佳';
    else if (weeklyCompletionRate >= 70) completionStatus = '表现不错';
    else if (weeklyCompletionRate >= 50) completionStatus = '还需努力';

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
      reminderCompletion: weeklyCompletionRate,
      reminderTotal: reminders.length,
      weeklyCompletedTotal: weeklyCompletedTotal,
      completionStatus,
      missedReminders: missedReminders,
      trendLabels: trendLabels,
      trendBadgeValue: '',
      trendSelectedIndex: -1,
      trendDateStrs: trendDateStrs,
      trendData: trendCounts,
      trendTotalData: trendTotalCounts
    }, () => {
      if (DEBUG_TREND) console.log(`[Records] 最终趋势数据 trendCounts=${safeStringify(trendCounts)}`);
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
      const width = rect && rect.width ? rect.width : 0;
      const height = rect && rect.height ? rect.height : 0;
      if (DEBUG_TREND) console.log(`[Records] trendChart 容器尺寸=${safeStringify({ width, height })} rect=${safeStringify(rect)}`);

      if (!width || !height) {
        this._trendDrawRetryCount = (this._trendDrawRetryCount || 0) + 1;
        if (this._trendDrawRetryCount <= 3) {
          setTimeout(() => this.drawTrendChart(), 60);
        }
        return;
      }

      const cssW = Math.floor(width);
      const cssH = Math.floor(height);
      this._trendCanvasRect = rect;

      this.setData({
        trendCanvasCssW: cssW,
        trendCanvasCssH: cssH,
        trendCanvasW: 0,
        trendCanvasH: 0
      }, () => {
        const ctx = wx.createCanvasContext('trendChart', this);
        if (!ctx) return;

        const doneData = this.data.trendData;
        const totalData = this.data.trendTotalData;
        if (!Array.isArray(doneData) || doneData.length === 0) return;
        const n = doneData.length;
        const safeTotalData = Array.isArray(totalData) && totalData.length === n ? totalData : new Array(n).fill(0);

        ctx.save();
        ctx.clearRect(0, 0, cssW, cssH);

        let maxVal = Math.max(...safeTotalData, ...doneData);
        if (!isFinite(maxVal) || maxVal <= 0) maxVal = 1;

        const padding = { top: 14, bottom: 24, left: 40, right: 16 };
        const chartW = cssW - padding.left - padding.right;
        const chartH = cssH - padding.top - padding.bottom;
        if (chartW <= 0 || chartH <= 0) {
          ctx.restore();
          ctx.draw(false);
          return;
        }

        const ticks = [maxVal, Math.round(maxVal / 2), 0]
          .filter((v, i, a) => a.indexOf(v) === i)
          .sort((a, b) => b - a);

        ctx.setFontSize(10);
        ctx.setTextAlign('left'); // 改为左对齐
        ctx.setTextBaseline('middle');
        ctx.setFillStyle('#94a3b8');

        ctx.setStrokeStyle('#f1f5f9');
        ctx.setLineWidth(1);
        ctx.setLineDash([4, 4]);
        ticks.forEach((val) => {
          const y = padding.top + chartH - (val / maxVal) * chartH;
          // 辅助线
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(padding.left + chartW, y);
          ctx.stroke();
          // 刻度文字放在最左侧 (x=0附近)
          ctx.fillText(String(val), 4, y);
        });
        ctx.setLineDash([]);

        const pointsTotal = safeTotalData.map((val, i) => ({
          x: padding.left + (i / (n - 1 || 1)) * chartW,
          y: padding.top + chartH - (val / maxVal) * chartH
        }));

        const pointsDone = doneData.map((val, i) => ({
          x: padding.left + (i / (n - 1 || 1)) * chartW,
          y: padding.top + chartH - (val / maxVal) * chartH
        }));

        this._trendTouchPoints = pointsDone.map((p, i) => ({
          x: p.x,
          y: p.y,
          done: doneData[i] || 0,
          total: safeTotalData[i] || 0,
          dateStr: (this.data.trendDateStrs && this.data.trendDateStrs[i]) ? this.data.trendDateStrs[i] : '',
          label: (this.data.trendLabels && this.data.trendLabels[i]) ? this.data.trendLabels[i] : ''
        }));

        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
        gradient.addColorStop(0, 'rgba(19, 127, 236, 0.22)');
        gradient.addColorStop(1, 'rgba(19, 127, 236, 0.02)');

        ctx.beginPath();
        ctx.moveTo(pointsDone[0].x, pointsDone[0].y);
        for (let i = 0; i < pointsDone.length - 1; i++) {
          const cp1x = (pointsDone[i].x + pointsDone[i + 1].x) / 2;
          ctx.bezierCurveTo(cp1x, pointsDone[i].y, cp1x, pointsDone[i + 1].y, pointsDone[i + 1].x, pointsDone[i + 1].y);
        }
        ctx.lineTo(padding.left + chartW, padding.top + chartH);
        ctx.lineTo(padding.left, padding.top + chartH);
        ctx.closePath();
        ctx.setFillStyle(gradient);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(pointsTotal[0].x, pointsTotal[0].y);
        for (let i = 0; i < pointsTotal.length - 1; i++) {
          const cp1x = (pointsTotal[i].x + pointsTotal[i + 1].x) / 2;
          ctx.bezierCurveTo(cp1x, pointsTotal[i].y, cp1x, pointsTotal[i + 1].y, pointsTotal[i + 1].x, pointsTotal[i + 1].y);
        }
        ctx.setStrokeStyle('#cbd5e1');
        ctx.setLineWidth(2);
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(pointsDone[0].x, pointsDone[0].y);
        for (let i = 0; i < pointsDone.length - 1; i++) {
          const cp1x = (pointsDone[i].x + pointsDone[i + 1].x) / 2;
          ctx.bezierCurveTo(cp1x, pointsDone[i].y, cp1x, pointsDone[i + 1].y, pointsDone[i + 1].x, pointsDone[i + 1].y);
        }
        ctx.setStrokeStyle('#137fec');
        ctx.setLineWidth(3);
        ctx.setLineCap('round');
        ctx.setLineJoin('round');
        ctx.stroke();

        pointsTotal.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.setFillStyle('#e2e8f0');
          ctx.fill();
        });

        pointsDone.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.setFillStyle('#ffffff');
          ctx.fill();
          ctx.setStrokeStyle('#137fec');
          ctx.setLineWidth(2);
          ctx.stroke();
        });

        const selectedIndex = this.data.trendSelectedIndex;
        if (selectedIndex >= 0 && selectedIndex < pointsDone.length) {
          const p = pointsDone[selectedIndex];
          const done = doneData[selectedIndex] || 0;
          const total = safeTotalData[selectedIndex] || 0;
          const dateStr = (this.data.trendDateStrs && this.data.trendDateStrs[selectedIndex]) ? this.data.trendDateStrs[selectedIndex] : '';
          const tooltipText = `${dateStr} 完成 ${done}/${total}`;

          ctx.beginPath();
          ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
          ctx.setFillStyle('#137fec');
          ctx.fill();
          ctx.setStrokeStyle('#ffffff');
          ctx.setLineWidth(2);
          ctx.stroke();

          const boxPadX = 8;
          const textW = tooltipText.length * 7;
          const boxW = textW + boxPadX * 2;
          const boxH = 24;
          let boxX = p.x - boxW / 2;
          let boxY = p.y - 34;
          if (boxX < 4) boxX = 4;
          if (boxX + boxW > cssW - 4) boxX = cssW - 4 - boxW;
          if (boxY < 4) boxY = p.y + 12;

          ctx.setFillStyle('#ffffff');
          ctx.setStrokeStyle('#e2e8f0');
          ctx.setLineWidth(1);
          ctx.fillRect(boxX, boxY, boxW, boxH);
          ctx.strokeRect(boxX, boxY, boxW, boxH);

          ctx.setFillStyle('#334155');
          ctx.setFontSize(10);
          ctx.setTextAlign('center');
          ctx.setTextBaseline('middle');
          ctx.fillText(tooltipText, boxX + boxW / 2, boxY + boxH / 2);
        }

        ctx.restore();
        ctx.draw(false);
      });
    });
  },

  onTrendTouch(e) {
    const touch = e && e.touches && e.touches[0] ? e.touches[0] : null;
    if (!touch || !this._trendTouchPoints || this._trendTouchPoints.length === 0) return;

    let localX = touch.x;
    let localY = touch.y;

    if ((localX === undefined || localY === undefined) && this._trendCanvasRect) {
      if (touch.clientX !== undefined && touch.clientY !== undefined) {
        localX = touch.clientX - this._trendCanvasRect.left;
        localY = touch.clientY - this._trendCanvasRect.top;
      } else if (touch.pageX !== undefined && touch.pageY !== undefined) {
        localX = touch.pageX - this._trendCanvasRect.left;
        localY = touch.pageY - this._trendCanvasRect.top;
      }
    }

    if (localX === undefined || localY === undefined) return;

    let bestIndex = -1;
    let bestDist = 999999;
    this._trendTouchPoints.forEach((p, i) => {
      const dx = p.x - localX;
      const dy = p.y - localY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        bestIndex = i;
      }
    });

    if (bestIndex === -1) return;
    if (bestDist > 28 * 28) return;

    const current = this.data.trendSelectedIndex;
    const nextIndex = current === bestIndex ? -1 : bestIndex;

    if (nextIndex === -1) {
      this.setData({ trendSelectedIndex: -1, trendBadgeValue: '' }, () => this.drawTrendChart());
      return;
    }

    const p = this._trendTouchPoints[nextIndex];
    const badge = `${p.done}/${p.total}`;
    this.setData({ trendSelectedIndex: nextIndex, trendBadgeValue: badge }, () => this.drawTrendChart());
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
    
    wx.reLaunch({
      url: '/pages/calendar/calendar'
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

  onAddMember() {
    wx.navigateTo({
      url: '/pages/addFamily/addFamily'
    });
  },

  onAddRecord() {
    wx.navigateTo({
      url: '/pages/addRecord/addRecord'
    });
  }
});
