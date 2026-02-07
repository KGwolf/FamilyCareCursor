// pages/calendar/calendar.js
Page({
  data: {
    darkMode: false,
    currentYear: 2023,
    currentMonth: 10,
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],
    selectedDate: '2023-10-05',
    todayDateStr: 'Oct 5, Thu',
    currentFamilyId: 1,
    familyMembers: [
      {
        id: 1,
        name: '爸爸',
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAz0ZCohbXy4cvH0kTKvvZBuYhRfBpYvpOc5dSv76YgLPIl3MmgSAwCFrxghQV5RHA3TMKGFqIynDH83m1LeeSxiGYv-82xyEhU-GxreN7fp4BW8TLl6nSA1BhK7tB5xlh8I04fBsCHzK1GBCxomPk0IdUrcVEueTznB81Y5qLS3jylj0ELwG-WlVuDuFJS03rPHRgRuZTc3RuVg7KE23fAWZ68H4rCsAgICzoWic-B0mye1Vn8s8aGisvpV_DNSij3biwqldyv-LUa'
      },
      {
        id: 2,
        name: '妈妈',
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0UK4GWHcfzPsX-hCCjd1kPS-V8DRBb6MICyQx_p9NIn7Rafvyc9IY2XvEF-ZzldME9G_F6qYKO6a3rPAuS8Ept47qisL1BjxF9nKCxvYuJb9SaIpPENmk-eOCEAs91UndCsmbekaPuJkp9uwMGwcg4TXr9G8OK6Z4_mKZljgdF0NXMR96L0TMQnEl125elZJffENqUHiRDhUdCqLy3VXNeAM2zrYOPEKwzTKrdKZyPVaUDSMbqkvnJhD_OnlyC2VWt6p1n2Ko_Z0I'
      }
    ],
    tasks: [
      {
        id: 1,
        time: '08:00',
        label: '早起',
        title: '早餐后服药',
        desc: '多美舒 1片，温水送服',
        completed: false
      }
    ],
    firstDayOfWeek: 0
  },

  onLoad() {
    this.loadIcons();
    this.initCalendar();
  },

  loadIcons() {
    wx.loadFontFace({
      family: 'Material Icons',
      source: 'url("https://fonts.gstatic.com/s/materialicons/v140/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2")',
    });
  },

  initCalendar() {
    const year = 2023;
    const month = 10;
    this.setData({
      currentYear: year,
      currentMonth: month
    });
    this.generateCalendar(year, month);
  },

  generateCalendar(year, month) {
    const days = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const firstDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    // Previous month filler
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      days.push({
        day: d,
        fullDate: `${prevYear}-${prevMonth.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`,
        currentMonth: false,
        isToday: false,
        hasEvent: false
      });
    }

    // Current month
    const eventDays = [2, 7];
    for (let i = 1; i <= totalDays; i++) {
      const fullDate = `${year}-${month.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      days.push({
        day: i,
        fullDate: fullDate,
        currentMonth: true,
        isToday: year === 2023 && month === 10 && i === 5,
        hasEvent: eventDays.includes(i)
      });
    }

    // Next month filler
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        fullDate: `${nextYear}-${nextMonth.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`,
        currentMonth: false,
        isToday: false,
        hasEvent: false
      });
    }

    this.setData({
      calendarDays: days,
      firstDayOfWeek: firstDayOfWeek
    });
  },

  switchFamily(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      currentFamilyId: id
    });
    // 这里可以根据家人ID加载不同的任务数据
  },

  addFamily() {
    wx.navigateTo({
      url: '/pages/addFamily/addFamily'
    });
  },

  selectDate(e) {
    const date = e.currentTarget.dataset.date;
    this.setData({
      selectedDate: date
    });
    // 加载选中日期的任务
  },

  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 1) {
      currentYear--;
      currentMonth = 12;
    } else {
      currentMonth--;
    }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar(currentYear, currentMonth);
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentYear++;
      currentMonth = 1;
    } else {
      currentMonth++;
    }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar(currentYear, currentMonth);
  },

  toggleTask(e) {
    const id = e.currentTarget.dataset.id;
    const tasks = this.data.tasks.map(task => {
      if (task.id === id) {
        return { ...task, completed: !task.completed };
      }
      return task;
    });
    this.setData({ tasks });
  },

  goToGreet() {
    wx.showToast({
      title: '正在前往问候...',
      icon: 'none'
    });
  },

  onAddClick() {
    wx.navigateTo({
      url: '/pages/addReminder/addReminder'
    });
  },

  navTo(e) {
    const page = e.currentTarget.dataset.page;
    if (page === 'home') {
      wx.redirectTo({
        url: '/pages/home/home'
      });
    }
  }
});
