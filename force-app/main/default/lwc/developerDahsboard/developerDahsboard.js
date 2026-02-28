import { LightningElement, track, wire } from 'lwc';
import getProjects from '@salesforce/apex/DeveloperDashboardController.getProjects';

export default class DeveloperDashboard extends LightningElement {
    @track selectedRange = 'This Month';
    @track activeTab = 'My Day';
    @track selectedProjectId = null;

    // Range Options
    get rangeOptions() {
        return [
            { label: 'Today', value: 'Today' },
            { label: 'This Week', value: 'This Week' },
            { label: 'Last 10 Days', value: 'Last 10 Days' },
            { label: 'This Month', value: 'This Month' },
            { label: 'Last 60 Days', value: 'Last 60 Days' },
        ];
    }

    // Retrieve Projects (Now filtered by Tasks in Apex)
    @wire(getProjects, { range: '$selectedRange' })
    projects;

    get isProjectsEmpty() {
        return !this.projects.data || this.projects.data.length === 0;
    }

    // Tab Configuration
    get tabs() {
        const allTabs = [
            { label: 'My Day', icon: 'utility:clock' },
            { label: 'Workload Snapshot', icon: 'utility:target' },
            { label: 'Delays & Aging', icon: 'utility:warning' },
            { label: 'Bugs & Fix Queue', icon: 'utility:bug' },
            { label: 'Quality & Ownership', icon: 'utility:check' },
            { label: 'Productivity & Predictability', icon: 'utility:trending' },
            { label: 'Release / Handover Readiness', icon: 'utility:rocket' }
        ];

        return allTabs.map(tab => {
            return {
                ...tab,
                class: `nav-item ${this.activeTab === tab.label ? 'active-tab' : ''}`
            };
        });
    }

    // --- Event Handlers ---

    handleRangeChange(event) {
        this.selectedRange = event.detail.value;
        // Reset project selection when range changes as the list might change
        this.selectedProjectId = null; 
    }

    handleTabClick(event) {
        this.activeTab = event.currentTarget.dataset.name;
    }

    // --- Getters for Tab Visibility ---

    get isMyDayTab() {
        return this.activeTab === 'My Day';
    }

    get isWorkloadSnapshotTab() {
        return this.activeTab === 'Workload Snapshot';
    }

    get isDelaysAgingTab() {
        return this.activeTab === 'Delays & Aging';
    }

    get isBugsFixQueueTab() {
        return this.activeTab === 'Bugs & Fix Queue';
    }

    get isQualityOwnershipTab() {
        return this.activeTab === 'Quality & Ownership';
    }

    get isProductivityPredictabilityTab() {
        return this.activeTab === 'Productivity & Predictability';
    }

    get isReleaseHandoverTab() {
        return this.activeTab === 'Release / Handover Readiness';
    }

    get getProjectClass() {
        return 'project-pill';
    }
}