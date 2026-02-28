import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getListUi } from 'lightning/uiListApi';
import CHANGE_REQUEST_OBJECT from '@salesforce/schema/Change_Request__c';
import getCRMetrics from '@salesforce/apex/Mybugscontroller.getCRMetrics';
import getCRFilterOptions from '@salesforce/apex/Mybugscontroller.getCRFilterOptions';
import Id from '@salesforce/user/Id';

export default class ChangeRequestComponent extends LightningElement {
    @track records = [];
    @track Newcolumns = [];
    @api selectedListView = 'All';

    @track totalRaised = 0;
    @track onHoldCount = 0;
    @track acceptedCount = 0;
    @track avgAging = '0d';

    @track projectOptions = [];
    @track decisionOptions = [];
    @track selectedProject = '';
    @track selectedDecision = '';

    @track searchKey = '';

    @track isLoading = true;
    userId = Id;

    @track pageSize = 10;
    @track currentPage = 1;

    _wirePageSize = 200;

    connectedCallback() {
        this.loadInitialData();
    }

    @wire(getListUi, {
        objectApiName: CHANGE_REQUEST_OBJECT,
        listViewApiName: 'All',
        pageSize: 200
    })
    wiredListView({ error, data }) {
        debugger;
        if (data) {
            this.Newcolumns = data.info.displayColumns || [];
            this.processListViewRecords(data.records.records);
            this.isLoading = false;
        }
        if (error) {
            console.error('Change Request List View Error:', error);
            this.showError('Error', 'Failed to load Change Requests list view');
            this.isLoading = false;
        }
    }

    processListViewRecords(records) {
        debugger;
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
        try {
            this.isLoading = true;

            const filterData = await getCRFilterOptions();
            this.processFilterOptions(filterData);

            const metrics = await getCRMetrics({
                userId: this.userId,
                projectFilter: this.selectedProject,
                decisionFilter: this.selectedDecision
            });

            this.totalRaised = metrics.totalRaised || 0;
            this.onHoldCount = metrics.onHoldCount || 0;
            this.acceptedCount = metrics.acceptedCount || 0;

            const avgDays = metrics.avgAging || 0;
            this.avgAging = avgDays > 0
                ? (avgDays < 1 ? `${Math.round(avgDays * 10) / 10}d` : `${Math.floor(avgDays)}d`)
                : '0d';

        } catch (error) {
            console.error('Error loading Change Request data:', error);
            this.showError('Error loading data', error.body?.message || error.message);
        }
    }

    processFilterOptions(data) {
        this.projectOptions = [
            { label: 'All Projects', value: '' },
            ...data.projects.map(p => ({ label: p, value: p }))
        ];
        this.decisionOptions = [
            { label: 'All Decisions', value: '' },
            ...data.decisions.map(d => ({ label: d, value: d }))
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
                    c.fieldApiName === 'Project__r.Name' || c.fieldApiName.includes('Project__c')
                );
                return c?.value === this.selectedProject;
            });
        }
        if (this.selectedDecision) {
            filtered = filtered.filter(row => {
                const c = row.cells.find(c => c.fieldApiName === 'CR_Decision__c');
                return c?.value === this.selectedDecision;
            });
        }

        return filtered;
    }

    get visibleRecords() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return this.filteredRecords.slice(start, end);
    }

    get filteredCRCount() {
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

    handleDecisionFilter(event) {
        this.selectedDecision = event.detail.value;
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
        this.selectedDecision = '';
        this.pageSize = 10;
        this._resetPage();
    }

    handleCreateTaskClick(event) {
        const changeRequestId = event.currentTarget.dataset.id;
        if (!changeRequestId) {
            return;
        }

        const baseUrl = 'https://orgfarm-9291e137a3-dev-ed.develop.my.site.com/UtilPM/s/new-task';
        const url = `${baseUrl}?recordId=${changeRequestId}`;
        try {
            window.open(url, '_blank');
        } catch (e) {
            this.showError('Error', 'Unable to open task creation page');
        }
    }

    showSuccess(title, message) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant: 'success' }));
    }

    showError(title, message) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant: 'error' }));
    }
}