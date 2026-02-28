import { LightningElement, api } from 'lwc';

export default class Calendar extends LightningElement {
    // View state
    currentView = 'week'; // 'day' | 'week' | 'month' | 'year'
    currentDate = new Date();

    // Project filter
    @api projectOptions = [];
    selectedProjectId = '';

    // Events stored locally for now
    events = [];

    // Booking modal state
    isBookingModalOpen = false;
    draftTitle = '';
    draftNote = '';
    draftStart = '';
    draftEnd = '';

    // ---------- Getters for view flags ----------
    get isDayView() {
        return this.currentView === 'day';
    }

    get isWeekView() {
        return this.currentView === 'week';
    }

    get isMonthView() {
        return this.currentView === 'month';
    }

    get isYearView() {
        return this.currentView === 'year';
    }

    // ---------- Button variants ----------
    get dayButtonVariant() {
        return this.currentView === 'day' ? 'brand' : 'neutral';
    }

    get weekButtonVariant() {
        return this.currentView === 'week' ? 'brand' : 'neutral';
    }

    get monthButtonVariant() {
        return this.currentView === 'month' ? 'brand' : 'neutral';
    }

    get yearButtonVariant() {
        return this.currentView === 'year' ? 'brand' : 'neutral';
    }

    // ---------- Current range label (top center) ----------
    get currentRangeLabel() {
        const date = this.currentDate;

        if (!date) {
            return '';
        }

        if (this.isDayView) {
            return this.formatDateLong(date);
        }

        if (this.isWeekView) {
            const start = this.getStartOfWeek(date);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            return `${this.formatDateShort(start)} - ${this.formatDateShort(end)}`;
        }

        if (this.isMonthView) {
            return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        }

        if (this.isYearView) {
            return date.getFullYear().toString();
        }

        return '';
    }

    // ---------- Week view helpers ----------
    get weekDays() {
        const start = this.getStartOfWeek(this.currentDate);
        const days = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push({
                dateKey: d.toISOString().slice(0, 10),
                label: d.toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                })
            });
        }

        return days;
    }

    get timeSlots() {
        // Build 30-minute slots from 8:00 to 18:00 for a cleaner view
        const slots = [];
        const startHour = 8;
        const endHour = 18;

        const weekStart = this.getStartOfWeek(this.currentDate);

        for (let hour = startHour; hour <= endHour; hour++) {
            for (let minute of [0, 30]) {
                const rowDate = new Date(weekStart);
                rowDate.setHours(hour, minute, 0, 0);

                const rowLabel = rowDate.toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit'
                });

                const cells = [];
                for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
                    const cellStart = new Date(rowDate);
                    cellStart.setDate(weekStart.getDate() + dayOffset);

                    const key = cellStart.toISOString();
                    const event = this.findEventForDateTime(cellStart);

                    cells.push({
                        key,
                        start: key,
                        hasEvent: !!event,
                        eventTitle: event ? event.title : ''
                    });
                }

                slots.push({
                    key: `${hour}-${minute}`,
                    label: rowLabel,
                    cells
                });
            }
        }

        return slots;
    }

    // ---------- Event helpers ----------
    findEventForDateTime(dateObj) {
        if (!this.events || !this.events.length) {
            return null;
        }

        const targetTime = dateObj.getTime();

        return this.events.find((evt) => {
            const start = new Date(evt.start).getTime();
            const end = new Date(evt.end).getTime();
            return targetTime >= start && targetTime < end;
        }) || null;
    }

    // ---------- Handlers: view switching & navigation ----------
    handleViewChange(event) {
        const value = event.target.value;
        this.currentView = value;
    }

    handlePrevious() {
        const date = new Date(this.currentDate);
        switch (this.currentView) {
            case 'day':
                date.setDate(date.getDate() - 1);
                break;
            case 'week':
                date.setDate(date.getDate() - 7);
                break;
            case 'month':
                date.setMonth(date.getMonth() - 1);
                break;
            case 'year':
                date.setFullYear(date.getFullYear() - 1);
                break;
            default:
                break;
        }
        this.currentDate = date;
    }

    handleNext() {
        const date = new Date(this.currentDate);
        switch (this.currentView) {
            case 'day':
                date.setDate(date.getDate() + 1);
                break;
            case 'week':
                date.setDate(date.getDate() + 7);
                break;
            case 'month':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'year':
                date.setFullYear(date.getFullYear() + 1);
                break;
            default:
                break;
        }
        this.currentDate = date;
    }

    handleToday() {
        this.currentDate = new Date();
    }

    // ---------- Slot click & booking modal ----------
    handleSlotClick(event) {
        const iso = event.currentTarget.dataset.datetime;
        if (!iso) {
            return;
        }

        const start = new Date(iso);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + 30);

        this.draftTitle = '';
        this.draftNote = '';
        this.draftStart = start.toISOString();
        this.draftEnd = end.toISOString();
        this.isBookingModalOpen = true;
    }

    closeBookingModal() {
        this.isBookingModalOpen = false;
    }

    handleTitleChange(event) {
        this.draftTitle = event.target.value;
    }

    handleNoteChange(event) {
        this.draftNote = event.target.value;
    }

    handleStartChange(event) {
        this.draftStart = event.target.value;
    }

    handleEndChange(event) {
        this.draftEnd = event.target.value;
    }

    saveBooking() {
        if (!this.draftStart || !this.draftEnd) {
            this.closeBookingModal();
            return;
        }

        const newEvent = {
            id: `${Date.now()}`,
            title: this.draftTitle || 'Booked',
            note: this.draftNote || '',
            start: this.draftStart,
            end: this.draftEnd,
            projectId: this.selectedProjectId || null
        };

        this.events = [...this.events, newEvent];
        this.closeBookingModal();
    }

    // ---------- Project filter ----------
    handleProjectChange(event) {
        this.selectedProjectId = event.detail.value;
        this.dispatchEvent(
            new CustomEvent('projectchange', {
                detail: { projectId: this.selectedProjectId }
            })
        );
    }

    // ---------- Utility methods ----------
    getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day of week
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    formatDateShort(date) {
        return date.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short'
        });
    }

    formatDateLong(date) {
        return date.toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
}