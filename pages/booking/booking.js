const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const { SERVICE_TABS, serviceCategory, serviceMatchesCategory } = require('../../utils/serviceCategories.js');
const { serviceTagLabels } = require('../../utils/serviceTags.js');
const analytics = require('../../utils/analytics');
const salonDetail = require('../../utils/salonDetail');
const { formatFen } = require('../../utils/money');
const { staffRoleLabel } = require('../../utils/staffRoles');
const { dataPatch } = require('../../utils/dataPatch');
const NO_PREFERENCE_STAFF_ID = '__no_preference__';
// 可预约日期范围（含今天）。后端按天计算休息日覆盖未来 31 天，下单不限制提前天数。
const BOOKING_DAYS = 9;

Page({
  onShareAppMessage,

  // 店铺详情（this.salon）和时间段原始数据（this.slots）只供逻辑层使用，
  // 不进入 setData，避免把模板用不到的数据传到视图层。
  data: {
    dates: [],
    slotsLoading: false,
    slotErrorMessage: '',
    staffOptions: [],
    serviceTabs: SERVICE_TABS,
    serviceOptions: [],
    activeServiceCategory: 'cut',
    slotOptions: [],
    previousSlotOptions: [],
    slotsAnimating: false,
    selectedStaffId: NO_PREFERENCE_STAFF_ID,
    selectedServiceId: '',
    selectedDate: '',
    selectedTime: '',
    canSubmit: false,
    submitText: '请选择时间段',
    loading: true,
    errorMessage: '',
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
    // 从确认页返回时，期间可能已提交预约（或有其他写操作），已展示的时间段不再可信。
    if (this.salon && this.data.selectedDate && this.slotsStartedAt < api.lastWriteAt()) {
      return this.loadSlots();
    }
    if (!this.salonId || this.salon || this.loadingSalon) return;
    return this.load();
  },

  async load() {
    if (this.loadingSalon) return;
    this.loadingSalon = true;
    // 从详情页进入时店铺数据通常还在缓存里：同步取出，表单在 onLoad 内就设置好，首帧直接渲染，
    // 不会先闪一下加载占位。没有缓存时才显示占位并请求。
    const cached = salonDetail.peek(this.salonId);
    if (!cached) this.setData({ loading: true, errorMessage: '' });
    try {
      const salon = cached || await salonDetail.load(this.salonId);
      const dates = nextDates(salon.closedDates, salon.acceptsSameDayBooking !== false);
      const selectedDate = (dates.find((date) => !date.isDisabled) || {}).value || '';
      const requestedServiceId = String(this.initialServiceId || '');
      const services = salon.services || [];
      const selectedService = services.find((service) => String(service.id) === requestedServiceId);
      const selectedServiceId = selectedService ? requestedServiceId : '';
      const firstAvailableCategory = (SERVICE_TABS.find((tab) =>
        services.some((service) => serviceMatchesCategory(service, tab.id))) || SERVICE_TABS[0]).id;
      this.salon = salon;
      this.refreshOptions({
        dates,
        selectedDate,
        selectedStaffId: this.initialStaffId || NO_PREFERENCE_STAFF_ID,
        selectedServiceId,
        activeServiceCategory: selectedService
          ? serviceCategory(selectedService)
          : firstAvailableCategory,
        // 表单先渲染；时间段单独请求并显示自己的加载态，不阻塞首屏。
        slotsLoading: Boolean(selectedDate),
        loading: false
      });
      if (requestedServiceId && !selectedServiceId) {
        wx.showToast({ title: '套餐已更新，请重新选择', icon: 'none' });
      }
      if (selectedDate) await this.loadSlots();
      analytics.track('booking_started', {
        salonId: this.salonId,
        serviceId: selectedServiceId
      });
    } catch (err) {
      if (!this.salon) this.setData({ errorMessage: err.message || '店铺加载失败，请稍后重试' });
      else wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.loadingSalon = false;
      if (this.data.loading) this.setData({ loading: false });
    }
  },

  // 网络恢复后重新加载之前失败的内容。
  onNetworkRestored() {
    if (this.data.errorMessage) this.load();
    else if (this.data.slotErrorMessage) this.loadSlots();
  },

  retryLoad() {
    return this.load();
  },

  async loadSlots({ animate = false } = {}) {
    const requestId = (this.slotRequestId || 0) + 1;
    this.slotRequestId = requestId;
    const selectedDate = this.data.selectedDate;
    const staffId = this.data.selectedStaffId;
    const serviceId = this.data.selectedServiceId;
    this.refreshOptions({
      selectedTime: '',
      slotsLoading: Boolean(selectedDate),
      slotErrorMessage: '',
      previousSlotOptions: [],
      slotsAnimating: false
    });
    if (!selectedDate) return;
    this.slotsStartedAt = Date.now();

    try {
      const serviceQuery = serviceId ? `&serviceId=${encodeURIComponent(serviceId)}` : '';
      const slots = staffId === NO_PREFERENCE_STAFF_ID
        ? await api.request(`/staff/${staffId}/slots?date=${selectedDate}&salonId=${encodeURIComponent(this.salonId)}${serviceQuery}`)
        : await api.request(`/staff/${staffId}/slots?date=${selectedDate}${serviceQuery}`);
      if (requestId !== this.slotRequestId) return;
      // 复制一份旧时间段用于滑出动画，不与随后按路径更新的 slotOptions 共用对象。
      const previousSlotOptions = this.data.slotOptions.map((slot) => ({ ...slot }));
      this.slots = slots;
      this.refreshOptions({
        slotsLoading: false,
        previousSlotOptions: animate ? previousSlotOptions : [],
        slotsAnimating: animate && previousSlotOptions.length > 0
      });
    } catch (err) {
      if (requestId !== this.slotRequestId) return;
      this.slots = [];
      this.refreshOptions({
        selectedTime: '',
        slotsLoading: false,
        slotErrorMessage: err.message || '时间段加载失败',
        previousSlotOptions: [],
        slotsAnimating: false
      });
      wx.showToast({ title: err.message || '时间段加载失败', icon: 'none' });
    }
  },

  selectStaff(e) {
    const staffId = e.currentTarget.dataset.id;
    const service = ((this.salon || {}).services || [])
      .find((item) => String(item.id) === this.data.selectedServiceId);
    if (service && service.staffSelectionRestricted === true && staffId !== NO_PREFERENCE_STAFF_ID
      && !(service.selectableStaffIds || []).includes(staffId)) return;
    this.setData({ selectedStaffId: staffId });
    return this.loadSlots({ animate: true });
  },

  selectService(e) {
    const selectedServiceId = String(e.currentTarget.dataset.id || '');
    this.refreshOptions({ selectedServiceId });
    analytics.track('service_click', { salonId: this.salonId, serviceId: selectedServiceId });
    return this.loadSlots();
  },

  selectServiceCategory(e) {
    const category = String(e.currentTarget.dataset.category || '');
    if (!SERVICE_TABS.some((tab) => tab.id === category)) return;
    const selectedService = ((this.salon || {}).services || [])
      .find((service) => String(service.id) === this.data.selectedServiceId);
    if (selectedService && !serviceMatchesCategory(selectedService, category)) {
      this.setData({ activeServiceCategory: category, selectedServiceId: '' });
      return this.loadSlots();
    }
    this.refreshOptions({ activeServiceCategory: category });
  },

  selectDate(e) {
    const isDisabled = e.currentTarget.dataset.disabled;
    if (isDisabled === true || isDisabled === 'true') return;
    this.setData({ selectedDate: e.currentTarget.dataset.value });
    return this.loadSlots({ animate: true });
  },

  selectTime(e) {
    const available = e.currentTarget.dataset.available;
    if (available === false || available === 'false') return;
    this.refreshOptions({ selectedTime: e.currentTarget.dataset.time });
    if (!this.slotSelectedTracked && this.data.canSubmit) {
      this.slotSelectedTracked = true;
      analytics.track('slot_selected', {
        salonId: this.salonId,
        serviceId: this.data.selectedServiceId
      });
    }
  },

  finishSlotAnimation() {
    this.setData({ previousSlotOptions: [], slotsAnimating: false });
  },

  // 按「当前 data + 本次变更」重新计算各选项列表，并只把发生变化的字段交给 setData。
  refreshOptions(changes = {}) {
    const state = { ...this.data, ...changes };
    const salon = this.salon || {};
    const selectedService = (salon.services || [])
      .find((service) => String(service.id) === state.selectedServiceId);
    const staffSelectionRestricted = selectedService && selectedService.staffSelectionRestricted === true;
    const staffUnavailable = (staffId) => Boolean(staffSelectionRestricted
      && staffId !== NO_PREFERENCE_STAFF_ID
      && !(selectedService.selectableStaffIds || []).includes(staffId));
    if (staffUnavailable(state.selectedStaffId)) state.selectedStaffId = NO_PREFERENCE_STAFF_ID;
    const showStaffExtraFee = selectedService
      ? serviceCategory(selectedService) === 'cut'
      : state.activeServiceCategory === 'cut';
    const staffOptions = [
      { id: NO_PREFERENCE_STAFF_ID, name: '无需指定', isNoPreference: true },
      ...((salon.staff || []).map((staff) => ({
        id: staff.id,
        name: staff.name,
        role: staffRoleLabel(staff.roleId),
        experience: staff.experience || '',
        bio: staff.bio || staff.description || '',
        imageUrl: api.thumbnailUrl(staff.imageUrl || '', 240),
        extraServiceFeeText: showStaffExtraFee && staff.extraServiceFeeFen > 0 ? formatFen(staff.extraServiceFeeFen) : ''
      })))
    ].map((staff) => {
      const disabled = staffUnavailable(staff.id);
      return {
        ...staff,
        disabled,
        className: disabled ? 'disabled' : state.selectedStaffId === staff.id ? 'active' : ''
      };
    });
    const serviceTabs = SERVICE_TABS.map((tab) => ({
      ...tab,
      className: state.activeServiceCategory === tab.id ? 'active' : ''
    }));
    // 只保留模板使用的字段。
    const serviceOptions = (salon.services || [])
      .filter((service) => serviceMatchesCategory(service, state.activeServiceCategory))
      .map((service) => ({
        id: service.id,
        name: service.name,
        imageUrl: api.thumbnailUrl((service.imageUrls || [])[0] || service.imageUrl || '', 480),
        tags: serviceTagLabels(service.tagIds),
        noteText: service.note || service.description || '',
        durationText: service.durationMinutes ? `${service.durationMinutes}分钟` : '',
        priceFen: service.priceFen,
        discountTenths: service.discountTenths,
        originalPriceFen: service.originalPriceFen,
        className: state.selectedServiceId === String(service.id) ? 'active-card' : ''
      }));
    const dates = state.dates.map((date) => ({
      ...date,
      className: date.isDisabled ? 'disabled' : state.selectedDate === date.value ? 'active' : ''
    }));
    const slotOptions = (this.slots || []).map((slot) => {
      const isAvailable = isSlotAvailable(slot, state.selectedDate);
      return {
        time: slot.time,
        startTime: slot.startTime,
        isAvailable,
        className: !isAvailable ? 'disabled' : state.selectedTime === slot.time ? 'active' : ''
      };
    });
    const selectedSlotAvailable = slotOptions.some((slot) => (
      slot.isAvailable && slot.time === state.selectedTime
    ));
    const canSubmit = Boolean(
      !state.slotsLoading
      && state.selectedStaffId
      && state.selectedServiceId
      && state.selectedDate
      && selectedSlotAvailable
    );
    const submitText = !state.selectedStaffId
      ? '请选择理发师'
      : !state.selectedDate
        ? '请选择营业日期'
        : !state.selectedServiceId
          ? '请选择服务项目'
          : state.slotsLoading
            ? '时间段加载中'
            : !state.selectedTime
              ? '请选择时间段'
              : '确认预约';
    const patch = dataPatch(this.data, {
      ...changes,
      selectedStaffId: state.selectedStaffId,
      staffOptions,
      serviceTabs,
      serviceOptions,
      dates,
      slotOptions,
      canSubmit,
      submitText
    });
    if (Object.keys(patch).length) this.setData(patch);
  },

  async submit() {
    const { selectedServiceId, selectedStaffId, selectedDate, selectedTime } = this.data;
    const salon = this.salon || {};
    if (!this.data.canSubmit || !selectedStaffId || !selectedServiceId || !selectedDate || !selectedTime) {
      wx.showToast({ title: '请选完整预约信息', icon: 'none' });
      return;
    }
    const staffId = selectedStaffId;
    const service = (salon.services || []).find((item) => String(item.id) === selectedServiceId);
    if (!service) {
      this.refreshOptions({ selectedServiceId: '' });
      wx.showToast({ title: '套餐已更新，请重新选择', icon: 'none' });
      return;
    }
    const staff = selectedStaffId === NO_PREFERENCE_STAFF_ID
      ? { id: NO_PREFERENCE_STAFF_ID, name: '无需指定' }
      : (salon.staff || []).find((item) => item.id === selectedStaffId) || {};
    const payload = {
      salonId: this.salonId,
      salonName: salon.name,
      staffId,
      staffName: staff.name,
      serviceId: selectedServiceId,
      serviceName: service.name,
      servicePriceFen: Number.isSafeInteger(service.priceFen) ? service.priceFen : 0,
      extraServiceFeeFen: serviceCategory(service) === 'cut' && Number.isSafeInteger(staff.extraServiceFeeFen)
        ? staff.extraServiceFeeFen : 0,
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
  return Array.from({ length: BOOKING_DAYS }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const value = `${date.getFullYear()}-${month}-${day}`;
    return {
      value,
      label: index === 0 ? '今天' : index === 1 ? '明天' : week[date.getDay()],
      isRelativeDate: index < 2,
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
