Page({
  data: {
    statusBarHeight: 0,
    familyMembers: [
      { id: 1, name: '爸爸', avatar: 'https://i.pravatar.cc/100?u=3', active: true },
      { id: 2, name: '妈妈', avatar: 'https://i.pravatar.cc/100?u=4', active: false }
    ],
    completionRate: 95,
    activeTab: 'weight',
    currentWeight: 62,
    weightDiff: 4,
    history: [
      { id: 1, value: '62 kg', status: '平稳', time: '今天 08:30', note: '晨起空腹' },
      { id: 2, value: '58 kg', status: '下降', time: '昨天 08:15', note: '晨起空腹' }
    ],
    trendSummary: '体重较上周平均下降 0.7kg，整体呈稳步下降趋势，处于健康范围。',
    weightLabels: ['10.20', '10.21', '10.22', '10.23', '10.24', '10.25', '今日'],
    selectedIndex: -1,
    chartData: [40, 50, 60, 55, 65, 58, 62],
    // 症状相关数据
    symptomCompletion: 75,
    symptomStats: [
      { name: '疲劳', count: 5, color: 'rose' },
      { name: '恶心', count: 3, color: 'orange' },
      { name: '食欲差', count: 0, color: 'slate' }
    ],
    symptomHistory: [
      {
        id: 1,
        time: '今天 10:15',
        severity: '中度严重',
        tags: [
          { name: '疲劳', icon: '😫', color: 'rose' },
          { name: '轻微恶心', icon: '🤢', color: 'orange' }
        ],
        note: '上午做完康复训练后感觉比较疲劳，喝了点温水后稍有缓解...'
      }
    ]
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    });
  },

  onReady() {
    this.drawWeightChart();
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
        const minW = Math.min(...weights) - 5;
        const maxW = Math.max(...weights) + 5;
        const range = maxW - minW;

        const padding = { top: 20, bottom: 20, left: 35, right: 15 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        // 绘制 Y 轴坐标
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const ySteps = 3;
        for (let i = 0; i <= ySteps; i++) {
          const val = (minW + (range * i) / ySteps).toFixed(0);
          const y = padding.top + chartH - (i / ySteps) * chartH;
          ctx.fillText(val, padding.left - 8, y);
          
          // 绘制水平网格线
          ctx.beginPath();
          ctx.setLineDash([2, 4]);
          ctx.moveTo(padding.left, y);
          ctx.lineTo(padding.left + chartW, y);
          ctx.strokeStyle = '#f1f5f9';
          ctx.stroke();
          ctx.setLineDash([]);
        }

        const points = weights.map((w, i) => ({
          x: padding.left + (i / (weights.length - 1)) * chartW,
          y: padding.top + chartH - ((w - minW) / range) * chartH,
          val: w
        }));

        this.chartPoints = points;

        // 绘制渐变填充区域
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

        // 绘制曲线
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

        // 绘制数据点
        points.forEach((p, i) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, i === selectedIndex ? 5 : 3, 0, Math.PI * 2);
          ctx.fillStyle = i === selectedIndex ? '#137fec' : '#fff';
          ctx.fill();
          ctx.strokeStyle = '#137fec';
          ctx.lineWidth = 2;
          ctx.stroke();

          // 如果被选中，显示数值
          if (i === selectedIndex) {
            ctx.fillStyle = '#137fec';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.val + 'kg', p.x, p.y - 12);
          }
        });

        // 如果没有选中任何点，默认高亮最后一个点
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
    let minDistance = 30; // 触摸判定距离

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
      if (tab === 'weight') {
        this.drawWeightChart();
      }
    });
  },

  onAddRecord() {
    wx.navigateTo({
      url: '/pages/addRecord/addRecord'
    });
  }
});
