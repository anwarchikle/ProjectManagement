import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getListUi } from 'lightning/uiListApi';
import ISSUES_OBJECT from '@salesforce/schema/Issue_Bug__c';
import getMetrics from '@salesforce/apex/Mybugscontroller.getMetrics';
import getFilterOptions from '@salesforce/apex/Mybugscontroller.getFilterOptions';
import Id from '@salesforce/user/Id';
import { getRecord } from 'lightning/uiRecordApi';
import USER_ID from '@salesforce/user/Id';
import USER_ROLE_FIELD from '@salesforce/schema/User.Role__c';

export default class MyBugs extends LightningElement {
    @track records = [];
    @track Newcolumns = [];
    @api selectedListView = 'All';

    @track totalRaised = 0;
    @track openCount = 0;
    @track criticalBlockerOpen = 0;
    @track avgAging = '0d';

    @track projectOptions = [];
    @track statusOptions = [];
    @track severityOptions = [];
    @track classificationOptions = [];
    @track selectedProject = '';
    @track selectedStatus = '';
    @track selectedSeverity = '';
    @track selectedClassification = '';

    @track searchKey = '';

    @track isLoading = true;
    userId = Id;

    @track pageSize = 10;
    @track currentPage = 1;

    _wirePageSize = 200;

    currentUserRole;
    isSeniorDeveloper = false;

    @track showTaskModal = false;
    @track selectedIssueId;

    connectedCallback() {
        this.loadInitialData();
    }

    @wire(getRecord, { recordId: USER_ID, fields: [USER_ROLE_FIELD] })
    wiredUser({ data, error }) {
        if (data) {
            this.currentUserRole = data.fields.Role__c?.value;
            this.isSeniorDeveloper = this.currentUserRole === 'Senior Developer';
        } else if (error) {
            // if role can't be fetched, keep button hidden
            this.isSeniorDeveloper = false;
            // optional: log error
            // console.error('Error fetching user role', error);
        }
    }

    @wire(getListUi, {
        objectApiName: ISSUES_OBJECT,
        listViewApiName: 'My_List',
        pageSize: 200// fetch only first 20 records from the list view
    })
    wiredListView({ error, data }) {
        if (data) {
            this.Newcolumns = data.info.displayColumns || [];
            this.processListViewRecords(data.records.records);
            this.isLoading = false;
        }
        if (error) {
            console.error('List View Error:', error);
            this.showError('Error', 'Failed to load list view');
            this.isLoading = false;
        }
    }

    processListViewRecords(records) {
        this.records = records.map(record => {
            let row = { Id: record.id, cells: [], rawFields: {} };

            this.Newcolumns.forEach(col => {
                let fieldApi = col.fieldApiName;
                let cell = { fieldApiName: fieldApi, value: '', isLink: false, url: null };

                if (fieldApi.includes('.')) {
                    let relationshipField = fieldApi.split('.')[0];
                    let parentField = record.fields[relationshipField];
                    if (parentField?.value) {
                        cell.value = parentField.displayValue || parentField.value.fields?.Name?.value || '';
                        cell.isLink = true;
                        cell.url = '/' + parentField.value.id;
                    }
                } else {
                    let fieldData = record.fields[fieldApi];
                    cell.value = fieldData?.displayValue || fieldData?.value || '';
                    row.rawFields[fieldApi] = cell.value;

                    if (fieldApi === 'Name') {
                        cell.isLink = true;
                        cell.url = '/' + record.id;
                    }

                    if (fieldData?.value?.id) {
                        cell.isLink = true;
                        cell.url = '/' + fieldData.value.id;
                        cell.value = fieldData.displayValue || fieldData.value.fields?.Name?.value || '';
                    }
                }

                row.cells.push(cell);
            });

            return row;
        });
    }

    async loadInitialData() {
        this.isLoading = true;
        try {
            const filterData = await getFilterOptions();
            this.processFilterOptions(filterData);

            const metrics = await getMetrics({
                userId: this.userId,
                projectFilter: this.selectedProject,
                statusFilter: this.selectedStatus,
                severityFilter: this.selectedSeverity
            });

            this.totalRaised = metrics.totalRaised || 0;
            this.openCount = metrics.openCount || 0;
            this.criticalBlockerOpen = metrics.criticalBlockerOpen || 0;

            const avgDays = metrics.avgAging || 0;
            this.avgAging = avgDays > 0
                ? (avgDays < 1 ? `${Math.round(avgDays * 10) / 10}d` : `${Math.floor(avgDays)}d`)
                : '0d';

        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Error loading data', error.body?.message || error.message);
        } finally {
            // Ensure loading spinner is cleared once metrics & filters are loaded
            this.isLoading = false;
        }
    }

    processFilterOptions(data) {
        this.projectOptions = [
            { label: 'All Projects', value: '' },
            ...data.projects.map(p => ({ label: p, value: p }))
        ];
        this.statusOptions = [
            { label: 'All Status', value: '' },
            ...data.statuses.map(s => ({ label: s, value: s }))
        ];
        this.severityOptions = [
            { label: 'All Severity', value: '' },
            ...data.severities.map(s => ({ label: s, value: s }))
        ];
        this.classificationOptions = [
            { label: 'All Classification', value: '' },
            { label: 'None', value: 'None' },
            { label: 'Security', value: 'Security' },
            { label: 'Crash/Hang', value: 'Crash/Hang' },
            { label: 'Data Loss', value: 'Data Loss' },
            { label: 'Performance', value: 'Performance' },
            { label: 'UI/Usability', value: 'UI/Usability' },
            { label: 'Other bug', value: 'Other bug' },
            { label: 'Feature(New)', value: 'Feature(New)' },
            { label: 'Enhancement', value: 'Enhancement' }
        ];
    }

    get filteredRecords() {
        let filtered = [...this.records];

        if (this.searchKey) {
            const key = this.searchKey.toLowerCase();
            filtered = filtered.filter(row =>
                row.cells.some(cell => String(cell.value).toLowerCase().includes(key))
            );
        }
        if (this.selectedProject) {
            filtered = filtered.filter(row => {
                const c = row.cells.find(c =>
                    c.fieldApiName === 'Project__r.Name' || c.fieldApiName.includes('Project')
                );
                return c?.value === this.selectedProject;
            });
        }
        if (this.selectedStatus) {
            filtered = filtered.filter(row => {
                const c = row.cells.find(c => c.fieldApiName === 'Status__c');
                return c?.value === this.selectedStatus;
            });
        }
        if (this.selectedSeverity) {
            filtered = filtered.filter(row => {
                const c = row.cells.find(c => c.fieldApiName === 'Severity__c');
                return c?.value === this.selectedSeverity;
            });
        }
        if (this.selectedClassification) {
            filtered = filtered.filter(row => {
                const c = row.cells.find(c => c.fieldApiName === 'Classification__c');
                return c?.value === this.selectedClassification;
            });
        }

        return filtered;
    }

    get visibleRecords() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return this.filteredRecords.slice(start, end);
    }

    get filteredBugCount() {
        return this.filteredRecords.length;
    }

    get totalPages() {
        return Math.max(1, Math.ceil(this.filteredRecords.length / this.pageSize));
    }

    get isPreviousDisabled() {
        return this.currentPage <= 1;
    }

    get isNextDisabled() {
        return this.currentPage >= this.totalPages;
    }

    get pageSizeOptions() {
        return [
            { label: '10', value: '10' },
            { label: '20', value: '20' },
            { label: '50', value: '50' },
            { label: '100', value: '100' },
            { label: '200', value: '200' }
        ];
    }

    _resetPage() {
        this.currentPage = 1;
    }

    handleSearchChange(event) {
        this.searchKey = event.target.value;
        this._resetPage();
    }

    handleProjectFilter(event) {
        this.selectedProject = event.detail.value;
        this._resetPage();
    }

    handleStatusFilter(event) {
        this.selectedStatus = event.detail.value;
        this._resetPage();
    }

    handleSeverityFilter(event) {
        this.selectedSeverity = event.detail.value;
        this._resetPage();
    }

    handleClassificationFilter(event) {
        this.selectedClassification = event.detail.value;
        this._resetPage();
    }

    handlePageSizeChange(event) {
        this.pageSize = Number(event.detail.value);
        this._resetPage();
    }

    handleNextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage += 1;
        }
    }

    handlePreviousPage() {
        if (this.currentPage > 1) {
            this.currentPage -= 1;
        }
    }

    handleReset() {
        this.searchKey = '';
        this.selectedProject = '';
        this.selectedStatus = '';
        this.selectedSeverity = '';
        this.selectedClassification = '';
        this.pageSize = 10;
        this._resetPage();
    }

    handleCreateTaskClick(event) {
        const issueId = event.currentTarget.dataset.id;
        if (!issueId) {
            return;
        }

        // Open Experience Cloud new-task page in a new tab with recordId
        const baseUrl = 'https://orgfarm-9291e137a3-dev-ed.develop.my.site.com/UtilPM/s/new-task';
        const url = `${baseUrl}?recordId=${issueId}`;
        try {
            window.open(url, '_blank');
        } catch (e) {
            // Fallback: still store selection in case future behavior needs it
            this.selectedIssueId = issueId;
            this.showTaskModal = true;
        }
    }

    handleTaskModalClose() {
        this.showTaskModal = false;
        this.selectedIssueId = undefined;
    }

    handleExport() {
        try {
            const recordsToExport = this.filteredRecords;
            if (recordsToExport.length === 0) {
                this.showError('Export failed', 'No records to export');
                return;
            }
            const headers = this.Newcolumns.map(col => col.label);
            const rows = recordsToExport.map(row => row.cells.map(cell => cell.value || ''));
            let csv = headers.join(',') + '\n';
            rows.forEach(row => { csv += row.map(cell => `"${cell}"`).join(',') + '\n'; });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `MyBugs_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            window.URL.revokeObjectURL(url);
            this.showSuccess('Export successful', 'Bugs exported successfully');
        } catch (error) {
            this.showError('Export failed', error.message);
        }
    }

    handleSaveView() {
        this.showSuccess('View saved', 'Your current view has been saved');
    }

    showSuccess(title, message) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant: 'success' }));
    }

    showError(title, message) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant: 'error' }));
    }
}