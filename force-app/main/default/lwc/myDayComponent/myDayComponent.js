import { LightningElement, api, wire, track } from 'lwc';
import getMyDayData from '@salesforce/apex/DeveloperDashboardController.getMyDayData';

export default class MyDayComponent extends LightningElement {
    // Expose variables so the Parent Dashboard can pass them down
    @api selectedRange;
    @api projectId;

    @track dashboardData = {};

    // Wire the Apex method to fetch data reactively
    @wire(getMyDayData, { range: '$selectedRange', projectId: '$projectId' })
    wiredData({ error, data }) {
        if (data) {
            this.dashboardData = data;
        } else if (error) {
            console.error('Error fetching My Day Data:', error);
            this.dashboardData = {};
        }
    }

    // --- Metric Value Getters ---
    get wipCount() { return this.dashboardData.wipCount || 0; }
    get dueTodayCount() { return this.dashboardData.dueTodayCount || 0; }
    get overdueCount() { return this.dashboardData.overdueCount || 0; }

    // --- Empty State Checkers ---
    get hasAssignedToday() {
        return this.dashboardData.tasksAssignedToday && this.dashboardData.tasksAssignedToday.length > 0;
    }
    get hasHighPriority() {
        return this.dashboardData.highPriorityQueue && this.dashboardData.highPriorityQueue.length > 0;
    }
    get hasDueNext7() {
        return this.dashboardData.dueNext7Days && this.dashboardData.dueNext7Days.length > 0;
    }
    get hasBlocked() {
        return this.dashboardData.blockedItems && this.dashboardData.blockedItems.length > 0;
    }
}