const api = require('../../utils/api');
const { SERVICE_TABS, serviceCategory, serviceMatchesCategory } = require('../../utils/serviceCategories.js');
const analytics = require('../../utils/analytics');
const { formatFen } = require('../../utils/money');

Page({
  data: {
    salon: null,
    dates: [],
    slots: [],
    slotsLoading: false,
    slotErrorMessage: '',
    staffOptions: [],
    serviceTabs: SERVICE_TABS,
    serviceOptions: [],
    activeServiceCategory: 'cut',
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
    this.salonId = query.id;
    this.initialStaffId = query.staffId || '';
    this.initialServiceId = query.serviceId || '';
    if (!api.requireLogin()) {
      this.waitingForLogin = true;
      return;
    }
    return this.load();
  },

  onHide() {
    if (this.waitingForLogin) this.loginPageWasShown = true;
  },

  onShow() {
    const session = api.session();
    if (!(session && session.token)) {
      if (this.loginPageWasShown) {
        this.waitingForLogin = false;
        this.loginPageWasShown = false;
        this.setData({ loading: false });
        wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) });
      }
      return;
    }
    this.waitingForLogin = false;
    this.loginPageWasShown = false;
    if (!this.salonId || this.data.salon || this.loadingSalon) return;
    return this.load();
  },

  async load() {
    if (this.loadingSalon) return;
    this.loadingSalon = true;
    try {
      const salon = await api.request(`/salons/${this.salonId}`);
      const dates = nextDates(salon.closedDates, salon.acceptsSameDayBooking !== false);
      const selectedDate = (dates.find((date) => !date.isDisabled) || {}).value || '';
      const requestedServiceId = String(this.initialServiceId || '');
      const services = salon.services || [];
      const selectedService = services.find((service) => String(service.id) === requestedServiceId);
      const selectedServiceId = selectedService ? requestedServiceId : '';
      const firstAvailableCategory = (SERVICE_TABS.find((tab) =>
        services.some((service) => serviceMatchesCategory(service, tab.id))) || SERVICE_TABS[0]).id;
      this.setData({
        salon,
        dates,
        selectedDate,
        selectedStaffId: this.initialStaffId || '__no_preference__',
        selectedServiceId,
        activeServiceCategory: selectedService
          ? serviceCategory(selectedService)
          : firstAvailableCategory
      });
      if (requestedServiceId && !selectedServiceId) {
        wx.showToast({ title: '套餐已更新，请重新选择', icon: 'none' });
      }
      this.refreshOptions();
      if (selectedDate) await this.loadSlots();
      analytics.track('booking_started', {
        salonId: this.salonId,
        serviceId: selectedServiceId
      });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.loadingSalon = false;
      this.setData({ loading: false });
    }
  },

  async loadSlots() {
    const requestId = (this.slotRequestId || 0) + 1;
    this.slotRequestId = requestId;
    const selectedDate = this.data.selectedDate;
    const staffId = this.data.selectedStaffId;
    this.setData({
      slots: [],
      selectedTime: '',
      slotsLoading: Boolean(selectedDate),
      slotErrorMessage: ''
    });
    this.refreshOptions();
    if (!selectedDate) return;

    try {
      const slots = staffId === '__no_preference__'
        ? await api.request(`/staff/${staffId}/slots?date=${selectedDate}&salonId=${encodeURIComponent(this.salonId)}`)
        : await api.request(`/staff/${staffId}/slots?date=${selectedDate}`);
      if (requestId !== this.slotRequestId) return;
      this.setData({ slots, slotsLoading: false });
      this.refreshOptions();
    } catch (err) {
      if (requestId !== this.slotRequestId) return;
      this.setData({
        slots: [],
        selectedTime: '',
        slotsLoading: false,
        slotErrorMessage: err.message || '时间段加载失败'
      });
      this.refreshOptions();
      wx.showToast({ title: err.message || '时间段加载失败', icon: 'none' });
    }
  },

  selectStaff(e) {
    this.setData({ selectedStaffId: e.currentTarget.dataset.id });
    return this.loadSlots();
  },

  selectService(e) {
    const selectedServiceId = String(e.currentTarget.dataset.id || '');
    this.setData({ selectedServiceId });
    this.refreshOptions();
    analytics.track('service_click', { salonId: this.salonId, serviceId: selectedServiceId });
  },

  selectServiceCategory(e) {
    const category = String(e.currentTarget.dataset.category || '');
    if (!SERVICE_TABS.some((tab) => tab.id === category)) return;
    this.setData({ activeServiceCategory: category });
    this.refreshOptions();
  },

  selectDate(e) {
    const isDisabled = e.currentTarget.dataset.disabled;
    if (isDisabled === true || isDisabled === 'true') return;
    this.setData({ selectedDate: e.currentTarget.dataset.value });
    return this.loadSlots();
  },

  selectTime(e) {
    const available = e.currentTarget.dataset.available;
    if (available === false || available === 'false') return;
    this.setData({ selectedTime: e.currentTarget.dataset.time });
    this.refreshOptions();
    if (!this.slotSelectedTracked && this.data.canSubmit) {
      this.slotSelectedTracked = true;
      analytics.track('slot_selected', {
        salonId: this.salonId,
        serviceId: this.data.selectedServiceId
      });
    }
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
        extraServiceFeeText: staff.extraServiceFeeFen > 0 ? formatFen(staff.extraServiceFeeFen) : ''
      })))
    ].map((staff) => ({
      ...staff,
      className: this.data.selectedStaffId === staff.id ? 'active' : ''
    }));
    const serviceTabs = SERVICE_TABS.map((tab) => ({
      ...tab,
      className: this.data.activeServiceCategory === tab.id ? 'active' : ''
    }));
    const serviceOptions = (salon.services || []).map((service) => ({
      ...service,
      imageUrl: api.mediaUrl(service.imageUrl || ''),
      tags: service.tags || service.categories || [],
      noteText: service.note || service.description || '',
      durationText: service.durationMinutes ? `${service.durationMinutes} min` : '',
      priceText: formatFen(service.priceFen),
      className: this.data.selectedServiceId === String(service.id) ? 'active-card' : ''
    })).filter((service) => serviceMatchesCategory(service, this.data.activeServiceCategory));
    const dates = this.data.dates.map((date) => ({
      ...date,
      className: date.isDisabled ? 'disabled' : this.data.selectedDate === date.value ? 'active' : ''
    }));
    const slotOptions = this.data.slots.map((slot) => {
      const isAvailable = isSlotAvailable(slot, this.data.selectedDate);
      return {
        ...slot,
        isAvailable,
        className: !isAvailable ? 'disabled' : this.data.selectedTime === slot.time ? 'active' : ''
      };
    });
    const selectedSlotAvailable = slotOptions.some((slot) => (
      slot.isAvailable && slot.time === this.data.selectedTime
    ));
    const canSubmit = Boolean(
      !this.data.slotsLoading
      && this.data.selectedStaffId
      && this.data.selectedServiceId
      && this.data.selectedDate
      && selectedSlotAvailable
    );
    const submitText = !this.data.selectedStaffId
      ? '请选择理发师'
      : !this.data.selectedDate
        ? '请选择营业日期'
        : !this.data.selectedServiceId
          ? '请选择服务项目'
          : this.data.slotsLoading
            ? '时间段加载中'
            : !this.data.selectedTime
              ? '请选择时间段'
              : '确认预约';
    this.setData({ staffOptions, serviceTabs, serviceOptions, dates, slotOptions, canSubmit, submitText });
  },

  async submit() {
    const { selectedServiceId, selectedStaffId, selectedDate, selectedTime, salon } = this.data;
    if (!this.data.canSubmit || !selectedStaffId || !selectedServiceId || !selectedDate || !selectedTime) {
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
      servicePriceFen: Number.isSafeInteger(service.priceFen) ? service.priceFen : 0,
      extraServiceFeeFen: Number.isSafeInteger(staff.extraServiceFeeFen) ? staff.extraServiceFeeFen : 0,
      selectedStaffId,
      startTime: `${selectedDate}T${selectedTime}:00`
    };
    wx.navigateTo({ url: `/pages/confirm/confirm?data=${encodeURIComponent(JSON.stringify(payload))}` });
  }
});

function nextDates(closedDates = [], acceptsSameDayBooking = true) {
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
      isClosed: closedDateSet.has(value),
      isDisabled: closedDateSet.has(value) || (!acceptsSameDayBooking && index === 0)
    };
  });
}

function isSlotAvailable(slot, selectedDate) {
  const available = slot.isAvailable !== false;
  const start = new Date(slot.startTime || `${selectedDate}T${slot.time}:00`);
  return available && (Number.isNaN(start.getTime()) || start > new Date());
}
