import { LightningElement, track } from 'lwc';
import getCommandCenterData from '@salesforce/apex/QaViewDashboardController.getCommandCenterData';

const MAX_DISPLAY = 10;

export default class CommandCenterTab extends LightningElement {
    @track kpiData = {};
    @track isLoading = true;
    @track hasError = false;
    @track errorMessage = '';
    @track isDataLoaded = false;

    connectedCallback() {
        this.loadData();
    }

    loadData() {
        this.isLoading    = true;
        this.hasError     = false;
        this.isDataLoaded = false;

        getCommandCenterData()
            .then((result) => {
                this.kpiData      = this.processData(result);
                this.isDataLoaded = true;
            })
            .catch((error) => {
                this.hasError     = true;
                this.errorMessage = error?.body?.message || 'An error occurred while loading data.';
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    processData(raw) {
        const allTestExec = raw.testExecutionRecords || [];
        const allStuck    = raw.stuckBugRecords      || [];

        const testExecutionRecords = allTestExec.slice(0, MAX_DISPLAY);
        const stuckBugRecords = allStuck.slice(0, MAX_DISPLAY).map((rec) => ({
            ...rec,
            severityClass: this.getSeverityClass(rec.severity),
            statusClass:   this.getStatusClass(rec.status),
            hasSeverity:   !!rec.severity
        }));

        return {
            pendingQaCount:       raw.pendingQaCount    || 0,
            dueTodayCount:        raw.dueTodayCount      || 0,
            slaBreachedCount:     raw.slaBreachedCount   || 0,
            testExecutionCount:   raw.testExecutionCount || 0,
            stuckCount:           raw.stuckCount         || 0,
            testExecutionRecords,
            stuckBugRecords
        };
    }

    getSeverityClass(severity) {
        const map = {
            Critical : 'sev-badge sev-badge--s1',
            High     : 'sev-badge sev-badge--s2',
            Medium   : 'sev-badge sev-badge--s2',
            Low      : 'sev-badge sev-badge--s3',
            S1       : 'sev-badge sev-badge--s1',
            S2       : 'sev-badge sev-badge--s2',
            S3       : 'sev-badge sev-badge--s3'
        };
        return map[severity] || 'sev-badge sev-badge--s3';
    }

    getStatusClass(status) {
        const map = {
            'Reopened'     : 'status-badge status-badge--reopened',
            'Open'         : 'status-badge status-badge--open',
            'In Progress'  : 'status-badge status-badge--inprogress',
            'To be Tested' : 'status-badge status-badge--qa',
            'In Retest'    : 'status-badge status-badge--qa',
            'Closed'       : 'status-badge status-badge--closed'
        };
        return map[status] || 'status-badge status-badge--open';
    }

    get hasTestExecRecords() {
        return this.kpiData.testExecutionRecords && this.kpiData.testExecutionRecords.length > 0;
    }

    get hasStuckRecords() {
        return this.kpiData.stuckBugRecords && this.kpiData.stuckBugRecords.length > 0;
    }
}