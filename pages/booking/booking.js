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
    this.load();
  },

  async load() {
    try {
      const salon = await api.request(`/salons/${this.salonId}`);
      const dates = nextDates(salon.closedDates);
      const selectedDate = (dates.find((date) => !date.isClosed) || {}).value || '';
      const requestedServiceId = String(this.initialServiceId || '');
      const selectedServiceId = (salon.services || []).some(
        (service) => String(service.id) === requestedServiceId
      ) ? requestedServiceId : '';
      this.setData({
        salon,
        dates,
        selectedDate,
        selectedStaffId: this.initialStaffId || '__no_preference__',
        selectedServiceId
      });
      if (requestedServiceId && !selectedServiceId) {
        wx.showToast({ title: '套餐已更新，请重新选择', icon: 'none' });
      }
      this.refreshOptions();
      if (selectedDate) await this.loadSlots();
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadSlots() {
    if (!this.data.selectedDate) {
      this.setData({ slots: [], selectedTime: '' });
      this.refreshOptions();
      return;
    }
    const staffId = this.data.selectedStaffId;
    const slots = staffId === '__no_preference__'
      ? await api.request(`/staff/${staffId}/slots?date=${this.data.selectedDate}&salonId=${encodeURIComponent(this.salonId)}`)
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
    this.setData({ selectedServiceId: String(e.currentTarget.dataset.id || '') });
    this.refreshOptions();
  },

  selectDate(e) {
    const isClosed = e.currentTarget.dataset.closed;
    if (isClosed === true || isClosed === 'true') return;
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
      className: this.data.selectedServiceId === String(service.id) ? 'active-card' : ''
    }));
    const dates = this.data.dates.map((date) => ({
      ...date,
      className: date.isClosed ? 'disabled' : this.data.selectedDate === date.value ? 'active' : ''
    }));
    const slotOptions = this.data.slots.map((slot) => {
      const isAvailable = isSlotAvailable(slot, this.data.selectedDate);
      return {
        ...slot,
        isAvailable,
        className: !isAvailable ? 'disabled' : this.data.selectedTime === slot.time ? 'active' : ''
      };
    });
    const canSubmit = Boolean(this.data.selectedStaffId && this.data.selectedServiceId && this.data.selectedDate && this.data.selectedTime);
    const submitText = !this.data.selectedStaffId
      ? '请选择理发师'
      : !this.data.selectedDate
        ? '请选择营业日期'
        : !this.data.selectedServiceId
        ? '请选择服务项目'
        : !this.data.selectedTime
          ? '请选择时间段'
          : '确认预约';
    this.setData({ staffOptions, serviceOptions, dates, slotOptions, canSubmit, submitText });
  },

  async submit() {
    const { selectedServiceId, selectedStaffId, selectedDate, selectedTime, salon } = this.data;
    if (!selectedStaffId || !selectedServiceId || !selectedDate || !selectedTime) {
      wx.showToast({ title: '请选完整预约信息', icon: 'none' });
      return;
    }
    const staffId = selectedStaffId;
    const service = (salon.services || []).find((item) => String(item.id) === selectedServiceId);
    if (!service) {
      this.setData({ selectedServiceId: '' });
      this.refreshOptions();
      wx.showToast({ title: '套餐已更新，请重新选择', icon: 'none' });
      return;
    }
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
      startTime: `${selectedDate}T${selectedTime}:00`
    };
    wx.navigateTo({ url: `/pages/confirm/confirm?data=${encodeURIComponent(JSON.stringify(payload))}` });
  }
});

function nextDates(closedDates = []) {
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const closedDateSet = new Set(closedDates || []);
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const value = `${date.getFullYear()}-${month}-${day}`;
    return {
      value,
      label: week[date.getDay()],
      day,
      isClosed: closedDateSet.has(value)
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
