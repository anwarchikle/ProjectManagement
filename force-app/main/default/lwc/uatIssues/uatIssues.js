import { LightningElement, track, wire, api } from 'lwc';
import { getListUi } from 'lightning/uiListApi';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import ISSUES_OBJECT from '@salesforce/schema/Issue_Bug__c';
import STATUS_FIELD from '@salesforce/schema/Issue_Bug__c.Status__c';
import SEVERITY_FIELD from '@salesforce/schema/Issue_Bug__c.Severity__c';
import uatIssues from '@salesforce/apex/Mybugscontroller.uatIssues';
import { getRecord, updateRecord } from 'lightning/uiRecordApi';
import USER_ID from '@salesforce/user/Id';
import USER_ROLE_FIELD from '@salesforce/schema/User.Role__c';
import CLASSIFICATION_FIELD from '@salesforce/schema/Issue_Bug__c.Classification__c';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

export default class UatIssues extends LightningElement {

    @api selectedListView = 'UAT';

    @track records = [];
    @track columns = [];
    @track totalRaised;
    @track openCount;
    @track criticalBlockerOpen;

    searchKey = '';
    selectedStatus = '';
    selectedSeverity = '';

    @track pageSize = 20;
    pageToken = null;
    nextPageToken = null;
    previousPageToken = null;

    // Current user role & permissions
    currentUserRole;
    canEditClassification = false;

    // Draft values for edited classifications
    draftValues = {};

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

    // Wire current user Role__c
    @wire(getRecord, { recordId: USER_ID, fields: [USER_ROLE_FIELD] })
    wiredUser({ data, error }) {
        if (data) {
            this.currentUserRole = data.fields.Role__c?.value;
            this.canEditClassification =
                this.currentUserRole === 'Consultant' ||
                this.currentUserRole === 'Project Manager';
        } else if (error) {
            // If user role can't be fetched, keep editing disabled
            console.error('Error fetching user role', error);
            this.canEditClassification = false;
        }
    }

    @track severityOptions = [];
    @track classificationOptions = [];

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

    @wire(getListUi, {
        objectApiName: ISSUES_OBJECT,
        listViewApiName: '$selectedListView',
        pageSize: '$pageSize',
        pageToken: '$pageToken'
    })
    wiredListView(result) {

        this.wiredListViewResult = result;

        const { error, data } = result;

        if (data) {

            this.Newcolumns =
                data.info?.displayColumns || [];

            this.nextPageToken =
                data.records?.nextPageToken || null;

            this.previousPageToken =
                data.records?.previousPageToken || null;

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
                            isClassification: fieldApi === CLASSIFICATION_FIELD.fieldApiName
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

    get visibleRecords() {
        let filtered = [...this.records];

        if (this.searchKey) {
            const key = this.searchKey.toLowerCase();
            filtered = filtered.filter(row =>
                row.cells.some(cell =>
                    String(cell.value).toLowerCase().includes(key)
                )
            );
        }

        if (this.selectedStatus) {
            filtered = filtered.filter(row =>
                row.cells.some(cell =>
                    cell.fieldApiName === 'Status__c' &&
                    cell.value === this.selectedStatus
                )
            );
        }

        if (this.selectedSeverity) {
            filtered = filtered.filter(row =>
                row.cells.some(cell =>
                    cell.fieldApiName === 'Severity__c' &&
                    cell.value === this.selectedSeverity
                )
            );
        }

        return filtered;
    }

    get hasDraftValues() {
        return Object.keys(this.draftValues || {}).length > 0;
    }

    handleSearchChange(event) {
        debugger;
        this.searchKey = event.target.value;
        if (this.searchKey != '') {
            this.pageSize = Number('200');
        } else {
            this.pageSize = Number('20');
        }
    }

    handleProjectFilter(event) {
        debugger;
        this.selectedProject = event.detail.value;
        if (this.selectedProject != '') {
            this.pageSize = Number('200');
        } else {
            this.pageSize = Number('20');
        }
    }

    handleStatusFilter(event) {
        debugger;
        this.selectedStatus = event.detail.value;
        if (this.selectedStatus != '') {
            this.pageSize = Number('200');
        } else {
            this.pageSize = Number('20');
        }
    }

    handleSeverityFilter(event) {
        debugger;
        this.selectedSeverity = event.detail.value;
        if (this.selectedSeverity != '') {
            this.pageSize = Number('200');
        } else {
            this.pageSize = Number('20');
        }
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

    handleSave() {
        debugger;
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
        this.pageToken = null;
    }

    handleNextPage() {
        if (this.nextPageToken) {
            this.pageToken = this.nextPageToken;
        }
    }

    handlePreviousPage() {
        if (this.previousPageToken) {
            this.pageToken = this.previousPageToken;
        }
    }

    handleReset() {
        debugger;
        this.searchKey = '';
        this.selectedStatus = '';
        this.selectedSeverity = '';
        this.pageSize = 20;
        this.pageToken = null;
    }

    get isNextDisabled() {
        return !this.nextPageToken;
    }

    get isPreviousDisabled() {
        return !this.previousPageToken;
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