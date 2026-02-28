import { LightningElement, track, wire, api } from 'lwc';
import { getListUi } from 'lightning/uiListApi';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import ISSUES_OBJECT from '@salesforce/schema/Issue_Bug__c';
import STATUS_FIELD from '@salesforce/schema/Issue_Bug__c.Status__c';
import SEVERITY_FIELD from '@salesforce/schema/Issue_Bug__c.Severity__c';
import REPRODUCIBLE_FIELD from '@salesforce/schema/Issue_Bug__c.Reproducible__c';
import STEPS_FIELD from '@salesforce/schema/Issue_Bug__c.Steps_To_Reproduce__c';
import ESTIMATED_HOURS_FIELD from '@salesforce/schema/Issue_Bug__c.Estimated_no_of_hours__c';
import uatIssues from '@salesforce/apex/Mybugscontroller.uatIssues';
import { getRecord, updateRecord } from 'lightning/uiRecordApi';
import USER_ID from '@salesforce/user/Id';
import USER_ROLE_FIELD from '@salesforce/schema/User.Role__c';
import CLASSIFICATION_FIELD from '@salesforce/schema/Issue_Bug__c.Classification__c';
import DECISION_FIELD from '@salesforce/schema/Issue_Bug__c.Decision__c';
import REJECT_REASON_FIELD from '@salesforce/schema/Issue_Bug__c.Reason_For_Rejected__c';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

export default class UatIssues extends LightningElement {

    @api selectedListView = 'UAT';

    @track records = [];
    @track columns = [];
    @track totalRaised;
    @track openCount;
    @track criticalBlockerOpen;

    @track searchKey = '';
    selectedStatus = '';
    selectedSeverity = '';

    // Client-side pagination (similar to myBugs)
    @track pageSize = 10; // default rows per page
    @track currentPage = 1;
    currentUserRole;
    canEditClassification = false;
    canEditDecision = false;
    canEditEstimatedHours = false;
    isTeamLead = false;
    rejectedDecisionValue;
    draftValues = {};
    showTaskModal = false;
    selectedIssueId;

    wiredListViewResult;

    recordTypeId;
    @wire(getObjectInfo, { objectApiName: ISSUES_OBJECT })
    objectInfo({ data }) {
        if (data) {
            this.recordTypeId = data.defaultRecordTypeId;
        }
    }

    @track statusOptions = [];

    @wire(getPicklistValues, { recordTypeId: '$recordTypeId', fieldApiName: STATUS_FIELD })
    wiredStatus({ data }) {
        if (data) {
            this.statusOptions = [
                { label: 'All', value: '' },
                ...data.values.map(item => ({
                    label: item.label,
                    value: item.value
                }))
            ];
        }
    }

    @wire(getRecord, { recordId: USER_ID, fields: [USER_ROLE_FIELD] })
    wiredUser({ data, error }) {
        if (data) {
            this.currentUserRole = data.fields.Role__c?.value;
            this.isTeamLead = this.currentUserRole === 'Team Lead';

            this.canEditClassification =
                this.currentUserRole === 'Consultant' ||
                this.currentUserRole === 'Project Manager' ||
                this.currentUserRole === 'QA';
            this.canEditDecision =
                this.currentUserRole === 'Project Manager' ||
                this.currentUserRole === 'QA';

            // Only Consultant and Project Manager can edit Estimated Hours
            this.canEditEstimatedHours =
                this.currentUserRole === 'Consultant' ||
                this.currentUserRole === 'Project Manager';

            // Default list view based on role
            if (this.currentUserRole === 'QA') {
                this.selectedListView = 'UAT_QA';
            } else if (this.currentUserRole === 'Consultant' || this.currentUserRole === 'Project Manager') {
                this.selectedListView = 'UAT';
            }
        } else if (error) {
            // If user role can't be fetched, keep editing disabled
            console.error('Error fetching user role', error);
            this.canEditClassification = false;
            this.canEditDecision = false;
        }
    }

    @track severityOptions = [];
    selectedProject = '';
    @track classificationOptions = [];
    @track decisionOptions = [];

    @wire(getPicklistValues, { recordTypeId: '$recordTypeId', fieldApiName: SEVERITY_FIELD })
    wiredSeverity({ data }) {
        if (data) {
            this.severityOptions = [
                { label: 'All', value: '' },
                ...data.values.map(item => ({ label: item.label, value: item.value }))
            ];
        }
    }

    @wire(getPicklistValues, { recordTypeId: '$recordTypeId', fieldApiName: CLASSIFICATION_FIELD })
    wiredClassification({ data }) {
        if (data) {
            this.classificationOptions = data.values.map(item => ({
                label: item.label,
                value: item.value
            }));
        }
    }

    @wire(getPicklistValues, { recordTypeId: '$recordTypeId', fieldApiName: DECISION_FIELD })
    wiredDecision({ data }) {
        if (data) {
            this.decisionOptions = data.values.map(item => ({
                label: item.label,
                value: item.value
            }));

            const rejected = data.values.find(item => item.label === 'Rejected');
            this.rejectedDecisionValue = rejected ? rejected.value : null;
        }
    }

    @wire(getListUi, {
        objectApiName: ISSUES_OBJECT,
        listViewApiName: '$selectedListView',
        pageSize: 2000
    })
    wiredListView(result) {

        this.wiredListViewResult = result;

        const { error, data } = result;

        if (data) {

            this.Newcolumns =
                data.info?.displayColumns || [];

            // Ensure Reason_For_Rejected__c column is present in the UI
            if (!this.Newcolumns.find(col => col.fieldApiName === REJECT_REASON_FIELD.fieldApiName)) {
                this.Newcolumns = [
                    ...this.Newcolumns,
                    {
                        label: 'Reason For Rejected',
                        fieldApiName: REJECT_REASON_FIELD.fieldApiName
                    }
                ];
            }

            // Ensure Estimated_no_of_hours__c column is present in the UI
            if (!this.Newcolumns.find(col => col.fieldApiName === ESTIMATED_HOURS_FIELD.fieldApiName)) {
                this.Newcolumns = [
                    ...this.Newcolumns,
                    {
                        label: 'Estimated Hours',
                        fieldApiName: ESTIMATED_HOURS_FIELD.fieldApiName
                    }
                ];
            }

            if (data.records) {

                this.records = data.records.records.map(record => {

                    let row = {
                        Id: record.id,
                        cells: []
                    };

                    this.Newcolumns.forEach(col => {

                        let fieldApi = col.fieldApiName;

                        let cell = {
                            fieldApiName: fieldApi,
                            value: '',
                            isLink: false,
                            url: null,
                            isClassification: fieldApi === CLASSIFICATION_FIELD.fieldApiName,
                            isDecision: fieldApi === DECISION_FIELD.fieldApiName,
                            isRejectReason: fieldApi === REJECT_REASON_FIELD.fieldApiName,
                            isReproducible: fieldApi === REPRODUCIBLE_FIELD.fieldApiName,
                            isStepsToReproduce: fieldApi === STEPS_FIELD.fieldApiName,
                            isEstimatedHours: fieldApi === ESTIMATED_HOURS_FIELD.fieldApiName
                        };

                        // 🔹 Relationship field (e.g., Project__r.Name)
                        if (fieldApi.includes('.')) {

                            let relationshipField = fieldApi.split('.')[0];
                            let parentField = record.fields[relationshipField];

                            if (parentField?.value) {

                                cell.value =
                                    parentField.displayValue ||
                                    parentField.value.fields?.Name?.value ||
                                    '';

                                cell.isLink = true;
                                cell.url = '/' + parentField.value.id;
                            }
                        }

                        // 🔹 Normal field
                        else {

                            let fieldData = record.fields[fieldApi];

                            cell.value =
                                fieldData?.displayValue ||
                                fieldData?.value ||
                                '';

                            // Name field clickable
                            if (fieldApi === 'Name') {
                                cell.isLink = true;
                                cell.url = '/' + record.id;
                            }

                            // Lookup field clickable
                            if (fieldData?.value?.id) {

                                cell.isLink = true;
                                cell.url = '/' + fieldData.value.id;

                                cell.value =
                                    fieldData.displayValue ||
                                    fieldData.value.fields?.Name?.value ||
                                    '';
                            }
                        }

                        row.cells.push(cell);
                    });

                    return row;
                });
            }
        }

        else if (error) {

            console.error(error);

            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Failed to load list view',
                    variant: 'error'
                })
            );
        }
    }


    connectedCallback() {
        this.callApexMethod();
    }

    callApexMethod() {
        uatIssues()
            .then(result => {
                this.totalRaised = result.Total;
                this.openCount = result.Open;
                this.criticalBlockerOpen = result.Critical;
            })
            .catch(error => {
                console.error(error);
            });
    }

    // ── Filtering: works over the full dataset ───────────────────────────────
    get filteredRecords() {
        let filtered = [...this.records];

        if (this.searchKey) {
            const key = this.searchKey.toLowerCase();
            filtered = filtered.filter(row =>
                row.cells.some(cell => String(cell.value).toLowerCase().includes(key))
            );
        }

        if (this.selectedStatus) {
            filtered = filtered.filter(row =>
                row.cells.some(cell =>
                    cell.fieldApiName === 'Status__c' && cell.value === this.selectedStatus
                )
            );
        }

        if (this.selectedSeverity) {
            filtered = filtered.filter(row =>
                row.cells.some(cell =>
                    cell.fieldApiName === 'Severity__c' && cell.value === this.selectedSeverity
                )
            );
        }

        if (this.selectedProject) {
            filtered = filtered.filter(row =>
                row.cells.some(cell =>
                    (
                        cell.fieldApiName === 'Associated_Project__c' ||
                        cell.fieldApiName === 'Associated_Project__r.Name' ||
                        cell.fieldApiName === 'Project__c' ||
                        cell.fieldApiName === 'Project__r.Name'
                    ) &&
                    cell.value === this.selectedProject
                )
            );
        }

        return filtered;
    }

    // ── Visible slice for current page ───────────────────────────────────────
    get visibleRecords() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return this.filteredRecords.slice(start, end);
    }

    get hasDraftValues() {
        return Object.keys(this.draftValues || {}).length > 0;
    }

    get projectOptions() {
        // Build distinct project names from current records for filtering
        const names = new Set();

        (this.records || []).forEach(row => {
            (row.cells || []).forEach(cell => {
                if (
                    cell.value &&
                    (
                        cell.fieldApiName === 'Associated_Project__c' ||
                        cell.fieldApiName === 'Associated_Project__r.Name' ||
                        cell.fieldApiName === 'Project__c' ||
                        cell.fieldApiName === 'Project__r.Name'
                    )
                ) {
                    names.add(cell.value);
                }
            });
        });

        const options = Array.from(names).map(name => ({ label: name, value: name }));
        // Prepend "All" option
        return [{ label: 'All', value: '' }, ...options];
    }

    // ── Helpers for paging reset ─────────────────────────────────────────────
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


    handleClassificationChange(event) {
        const recordId = event.target.dataset.id;
        const fieldApiName = event.target.dataset.field;
        const value = event.target.value;

        if (!recordId || !fieldApiName) {
            return;
        }

        const existingDraft = this.draftValues[recordId] || {};
        this.draftValues = {
            ...this.draftValues,
            [recordId]: {
                ...existingDraft,
                [fieldApiName]: value
            }
        };

        // Update local UI value
        this.records = this.records.map(row => {
            if (row.Id === recordId) {
                const updatedCells = row.cells.map(cell => {
                    if (cell.fieldApiName === fieldApiName) {
                        return { ...cell, value };
                    }
                    return cell;
                });
                return { ...row, cells: updatedCells };
            }
            return row;
        });
    }

    handleCreateTaskClick(event) {
        const issueId = event.currentTarget.dataset.id;
        if (!issueId) {
            return;
        }

        const baseUrl = 'https://orgfarm-9291e137a3-dev-ed.develop.my.site.com/UtilPM/s/new-task';
        const url = `${baseUrl}?recordId=${issueId}`;
        try {
            window.open(url, '_blank');
        } catch (e) {
            // Fallback to previous modal behavior if window.open is blocked
            this.selectedIssueId = issueId;
            this.showTaskModal = true;
        }
    }

    handleTaskModalClose() {
        this.showTaskModal = false;
        this.selectedIssueId = undefined;
    }

    handleSave() {
        // Validation: if Decision__c is Rejected, Reason_For_Rejected__c is mandatory
        if (this.rejectedDecisionValue) {
            for (const row of this.records) {
                const recordId = row.Id;

                const decisionDraft = this.draftValues[recordId]?.[DECISION_FIELD.fieldApiName];
                const reasonDraft = this.draftValues[recordId]?.[REJECT_REASON_FIELD.fieldApiName];

                let currentDecision = decisionDraft;
                let currentReason = reasonDraft;

                if (!currentDecision || currentReason === undefined) {
                    // derive from existing cells if not in draft
                    const decisionCell = row.cells.find(c => c.fieldApiName === DECISION_FIELD.fieldApiName);
                    const reasonCell = row.cells.find(c => c.fieldApiName === REJECT_REASON_FIELD.fieldApiName);

                    if (!currentDecision && decisionCell) {
                        currentDecision = decisionCell.value;
                    }
                    if (currentReason === undefined && reasonCell) {
                        currentReason = reasonCell.value;
                    }
                }

                if (currentDecision === this.rejectedDecisionValue && !currentReason) {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Validation Error',
                            message: 'Reason For Rejected is mandatory when Decision is Rejected.',
                            variant: 'error'
                        })
                    );
                    return;
                }
            }
        }

        // Validation: Estimated_no_of_hours__c is mandatory for Consultant/Project Manager
        if (this.canEditEstimatedHours) {
            for (const recordId of Object.keys(this.draftValues)) {
                const hoursDraft = this.draftValues[recordId]?.[ESTIMATED_HOURS_FIELD.fieldApiName];
                let currentHours = hoursDraft;

                if (currentHours === undefined || currentHours === null || currentHours === '') {
                    const row = this.records.find(r => r.Id === recordId);
                    if (row) {
                        const hoursCell = row.cells.find(c => c.fieldApiName === ESTIMATED_HOURS_FIELD.fieldApiName);
                        if (hoursCell) {
                            currentHours = hoursCell.value;
                        }
                    }
                }

                if (!currentHours) {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Validation Error',
                            message: 'Estimated No of Hours is mandatory.',
                            variant: 'error'
                        })
                    );
                    return;
                }
            }
        }

        const recordInputs = Object.keys(this.draftValues).map(recordId => {
            const fields = { Id: recordId };
            Object.keys(this.draftValues[recordId]).forEach(fieldApiName => {
                fields[fieldApiName] = this.draftValues[recordId][fieldApiName];
            });
            return { fields };
        });

        if (!recordInputs.length) {
            return;
        }

        const promises = recordInputs.map(recordInput => updateRecord(recordInput));

        Promise.all(promises)
            .then(() => {
                this.draftValues = {};
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Classification updated successfully',
                        variant: 'success'
                    })
                );

                if (this.wiredListViewResult) {
                    refreshApex(this.wiredListViewResult);
                }
            })
            .catch(error => {
                console.error('Error updating records', error);
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error updating records',
                        message: error.body?.message || 'Error while saving changes',
                        variant: 'error'
                    })
                );
            });
    }

    // handleSearchChange(event) {
    //     this.searchKey = event.target.value;
    //     this.pageSize = Number('200');
    // }

    // handleStatusFilter(event) {
    //     this.selectedStatus = event.detail.value;
    //     this.pageSize = Number('200');
    // }

    // handleSeverityFilter(event) {
    //     this.selectedSeverity = event.detail.value;
    //     this.pageSize = Number('200');
    // }

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
        debugger;
        this.searchKey = '';
        this.selectedStatus = '';
        this.selectedSeverity = '';
        this.selectedProject = '';
        this.pageSize = 10;
        this._resetPage();
    }

    get isNextDisabled() {
        return this.currentPage >= this.totalPages;
    }

    get isPreviousDisabled() {
        return this.currentPage <= 1;
    }

    get totalPages() {
        return Math.max(1, Math.ceil(this.filteredRecords.length / this.pageSize));
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


}