import { LightningElement, track } from 'lwc';


const TABS = [
    {
        id: 'commandCenter',
        label: 'Command Center',
        icon: 'utility:home',
    },
    {
        id: 'multiProjectQuality',
        label: 'Multi-Project Quality View',
        icon: 'utility:chart',
    },
    {
        id: 'qaExecution',
        label: 'QA Execution (Internal QA/SIT)',
        icon: 'utility:record_alt',
    },
    {
        id: 'uatReadiness',
        label: 'UAT Readiness & Sign-off',
        icon: 'utility:approval',
    },
    {
        id: 'bugLifecycle',
        label: 'Bug Lifecycle Governance',
        icon: 'utility:bug',
    },
    {
        id: 'slaAging',
        label: 'SLA & Aging',
        icon: 'utility:clock',
    },
    {
        id: 'developerQuality',
        label: 'Developer Quality Signals',
        icon: 'utility:lightning_strike',
    },
    {
        id: 'timesheetAdmin',
        label: 'Timesheet & QA Admin Governance',
        icon: 'utility:date_time',
    },
];

export default class QaCommandCenter extends LightningElement {
    @track activeTabId = 'commandCenter';

    get tabs() {
        return TABS.map((tab) => ({
            ...tab,
            isActive: tab.id === this.activeTabId,
            cssClass: `tab-btn ${tab.id === this.activeTabId ? 'tab-btn--active' : ''}`,
        }));
    }

    handleTabClick(event) {
        const tabId = event.currentTarget.dataset.tabId;
        this.activeTabId = tabId;
    }

    get isCommandCenter() {
        return this.activeTabId === 'commandCenter';
    }

    get isMultiProjectQuality() {
        return this.activeTabId === 'multiProjectQuality';
    }
}