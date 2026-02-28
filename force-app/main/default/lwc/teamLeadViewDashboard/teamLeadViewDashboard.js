import { LightningElement, wire } from 'lwc';
import getSummaryMetrics from '@salesforce/apex/TeamLeadDashboardController.getSummaryMetrics';

export default class TeamLeadViewDashboard extends LightningElement {
    activeTab = 'tlCommandCenter';

    selectedRange = 'last30Days';
    selectedProject = 'all';
    filterProject = 'all';
    searchKey = '';

    teamTasksDueToday = 0;
    dueThisWeek = 0;
    overdueTeam = 0;
    s1s2BugsOpen = 0;

    get rangeOptions() {
        return [
            { label: 'Last 7 Days', value: 'last7Days' },
            { label: 'Last 30 Days', value: 'last30Days' },
            { label: 'Last 90 Days', value: 'last90Days' }
        ];
    }

    get projectOptions() {
        return [
            { label: 'All Projects', value: 'all' },
            { label: 'Project Alpha', value: 'alpha' },
            { label: 'Project Beta', value: 'beta' },
            { label: 'Project Gamma', value: 'gamma' }
        ];
    }

    @wire(getSummaryMetrics)
    wiredSummary({ error, data }) {
        if (data) {
            this.teamTasksDueToday = data.teamTasksDueToday || 0;
            this.dueThisWeek = data.dueThisWeek || 0;
            this.overdueTeam = data.overdueTeam || 0;
            this.s1s2BugsOpen = data.s1s2BugsOpen || 0;
        } else if (error) {
            // Optional: handle error (e.g., console.error), but no UI change for now
            // console.error('Error loading dashboard metrics', error);
        }
    }

    handleTabChange(event) {
        this.activeTab = event.target.value;
    }
}