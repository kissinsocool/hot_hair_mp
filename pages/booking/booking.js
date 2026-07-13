const api = require('../../utils/api');

Page({
  data: {
    salon: null,
    dates: [],
    slots: [],
    staffOptions: [],
    serviceOptions: [],
    slotOptions: [],
    selectedStaffId: '__no_preference__',
    selectedServiceId: '',
    selectedDate: '',
    selectedTime: '',
    canSubmit: false,
    submitText: '请选择时间段',
    loading: true,
    submitting: false
  },

  onLoad(query) {
    if (!api.requireLogin()) return;
    this.salonId = query.id;
    this.initialStaffId = query.staffId || '';
    this.initialServiceId = query.serviceId || '';
    const dates = nextDates();
    this.setData({ dates, selectedDate: dates[0].value });
    this.load();
  },

  async load() {
    try {
      const salon = await api.request(`/salons/${this.salonId}`);
      this.setData({
        salon,
        selectedStaffId: this.initialStaffId || '__no_preference__',
        selectedServiceId: this.initialServiceId || ''
      });
      this.refreshOptions();
      await this.loadSlots();
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadSlots() {
    const staffIds = ((this.data.salon && this.data.salon.staff) || []).map((staff) => staff.id);
    const staffId = this.data.selectedStaffId;
    if (!staffIds.length) return;
    const slots = staffId === '__no_preference__'
      ? mergeCandidateSlots(await Promise.all(staffIds.map(async (id) => ({
        staffId: id,
        slots: await api.request(`/staff/${id}/slots?date=${this.data.selectedDate}`)
      }))), this.data.selectedDate)
      : await api.request(`/staff/${staffId}/slots?date=${this.data.selectedDate}`);
    this.setData({ slots, selectedTime: '' });
    this.refreshOptions();
  },

  selectStaff(e) {
    this.setData({ selectedStaffId: e.currentTarget.dataset.id });
    this.refreshOptions();
    this.loadSlots();
  },

  selectService(e) {
    this.setData({ selectedServiceId: e.currentTarget.dataset.id });
    this.refreshOptions();
  },

  selectDate(e) {
    this.setData({ selectedDate: e.currentTarget.dataset.value });
    this.refreshOptions();
    this.loadSlots();
  },

  selectTime(e) {
    const available = e.currentTarget.dataset.available;
    if (available === false || available === 'false') return;
    this.setData({ selectedTime: e.currentTarget.dataset.time });
    this.refreshOptions();
  },

  refreshOptions() {
    const salon = this.data.salon || {};
    const staffOptions = [
      { id: '__no_preference__', name: '无需指定', isNoPreference: true },
      ...((salon.staff || []).map((staff) => ({
        id: staff.id,
        name: staff.name,
        role: staff.role || '',
        experience: staff.experience || '',
        bio: staff.bio || staff.description || '',
        imageUrl: api.mediaUrl(staff.imageUrl || ''),
        extraServiceFee: staff.extraServiceFee || 0
      })))
    ].map((staff) => ({
      ...staff,
      className: this.data.selectedStaffId === staff.id ? 'active' : ''
    }));
    const serviceOptions = (salon.services || []).map((service) => ({
      ...service,
      imageUrl: api.mediaUrl(service.imageUrl || ''),
      tags: service.tags || service.categories || [],
      noteText: service.note || service.description || '',
      durationText: service.duration || (service.durationMinutes ? `${service.durationMinutes} min` : ''),
      priceText: formatPrice(service.price || service.priceLabel),
      className: this.data.selectedServiceId === service.id ? 'active-card' : ''
    }));
    const dates = this.data.dates.map((date) => ({
      ...date,
      className: this.data.selectedDate === date.value ? 'active' : ''
    }));
    const slotOptions = this.data.slots.map((slot) => {
      const isAvailable = isSlotAvailable(slot, this.data.selectedDate);
      return {
        ...slot,
        isAvailable,
        className: !isAvailable ? 'disabled' : this.data.selectedTime === slot.time ? 'active' : ''
      };
    });
    const canSubmit = Boolean(this.data.selectedStaffId && this.data.selectedServiceId && this.data.selectedTime);
    const submitText = !this.data.selectedStaffId
      ? '请选择理发师'
      : !this.data.selectedServiceId
        ? '请选择服务项目'
        : !this.data.selectedTime
          ? '请选择时间段'
          : '确认预约';
    this.setData({ staffOptions, serviceOptions, dates, slotOptions, canSubmit, submitText });
  },

  async submit() {
    const { selectedServiceId, selectedStaffId, selectedDate, selectedTime, salon } = this.data;
    if (!selectedStaffId || !selectedServiceId || !selectedTime) {
      wx.showToast({ title: '请选完整预约信息', icon: 'none' });
      return;
    }
    const staffIds = (salon.staff || []).map((staff) => staff.id);
    const staffId = selectedStaffId;
    const service = (salon.services || []).find((item) => item.id === selectedServiceId) || {};
    const staff = selectedStaffId === '__no_preference__'
      ? { id: '__no_preference__', name: '无需指定' }
      : (salon.staff || []).find((item) => item.id === selectedStaffId) || {};
    const payload = {
      salonId: this.salonId,
      salonName: salon.name,
      staffId,
      staffName: staff.name,
      serviceId: selectedServiceId,
      serviceName: service.name,
      servicePrice: service.price || service.priceLabel || '',
      extraServiceFee: staff.extraServiceFee || 0,
      selectedStaffId,
      startTime: `${selectedDate}T${selectedTime}:00`,
      candidateStaffIds: selectedStaffId === '__no_preference__' ? staffIds : []
    };
    wx.navigateTo({ url: `/pages/confirm/confirm?data=${encodeURIComponent(JSON.stringify(payload))}` });
  }
});

function nextDates() {
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return {
      value: `${date.getFullYear()}-${month}-${day}`,
      label: week[date.getDay()],
      day
    };
  });
}

function formatPrice(value) {
  if (!value) return '';
  const text = String(value);
  return text.startsWith('¥') || !/^\d+(\.\d+)?$/.test(text) ? text : `¥${text}`;
}

function isSlotAvailable(slot, selectedDate) {
  const available = slot.isAvailable !== false;
  const start = new Date(slot.startTime || `${selectedDate}T${slot.time}:00`);
  return available && (Number.isNaN(start.getTime()) || start > new Date());
}

function mergeCandidateSlots(staffSlotGroups, selectedDate) {
  const slotsByTime = {};
  staffSlotGroups.forEach(({ staffId, slots }) => {
    slots.forEach((slot) => {
      const time = slot.time || String(slot.startTime || '').slice(11, 16);
      if (!time) return;
      const isAvailable = isSlotAvailable({ ...slot, time }, selectedDate);
      const current = slotsByTime[time];
      if (!current || (!current.isAvailable && isAvailable)) {
        slotsByTime[time] = { ...slot, time, isAvailable, availableStaffId: isAvailable ? staffId : '' };
      }
    });
  });
  return Object.values(slotsByTime).sort((a, b) => a.time.localeCompare(b.time));
}
