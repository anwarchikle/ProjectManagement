import { LightningElement, track, wire, api } from 'lwc';
import { getListUi } from 'lightning/uiListApi';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import ISSUES_OBJECT from '@salesforce/schema/Issue_Bug__c';
import STATUS_FIELD from '@salesforce/schema/Issue_Bug__c.Status__c';
import SEVERITY_FIELD from '@salesforce/schema/Issue_Bug__c.Severity__c';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class UatIssues extends LightningElement {

    @api selectedListView;

    @track records = [];
    @track columns = [];

    searchKey = '';
    selectedStatus = '';
    selectedSeverity = '';

    @track pageSize = 10;
    pageToken = null;
    nextPageToken = null;
    previousPageToken = null;

    recordTypeId;
    @wire(getObjectInfo, { objectApiName: ISSUES_OBJECT })
    objectInfo({ data }) {
        if (data) {
            this.recordTypeId = data.defaultRecordTypeId;
        }
    }

    @track statusOptions = [];

    @wire(getPicklistValues, {
        recordTypeId: '$recordTypeId', fieldApiName: STATUS_FIELD
    })
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

    @track severityOptions = [];

    @wire(getPicklistValues, { recordTypeId: '$recordTypeId', fieldApiName: SEVERITY_FIELD })
    wiredSeverity({ data }) {
        if (data) {
            this.severityOptions = [
                { label: 'All', value: '' },
                ...data.values.map(item => ({
                    label: item.label,
                    value: item.value
                }))
            ];
        }
    }



    @wire(getListUi, {
        objectApiName: ISSUES_OBJECT,
        listViewApiName: '$selectedListView',
        pageSize: '$pageSize',
        pageToken: '$pageToken'
    })
    wiredListView({ error, data }) {

        if (data) {

            this.Newcolumns = data.info.displayColumns || [];
            this.nextPageToken = data.records.nextPageToken;
            this.previousPageToken = data.records.previousPageToken;

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
                        url: null
                    };

                    // 🔹 Relationship fields (Example: Project__r.Name)
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

                    // 🔹 Normal fields
                    else {

                        let fieldData = record.fields[fieldApi];

                        cell.value =
                            fieldData?.displayValue ||
                            fieldData?.value ||
                            '';

                        // Name field hyperlink
                        if (fieldApi === 'Name') {
                            cell.isLink = true;
                            cell.url = '/' + record.id;
                        }

                        // Lookup field hyperlink
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

        if (error) {
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

    handleSearchChange(event) {
        this.searchKey = event.target.value;
    }

    handleStatusFilter(event) {
        this.selectedStatus = event.detail.value;
    }

    handleSeverityFilter(event) {
        this.selectedSeverity = event.detail.value;
    }

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
        this.pageSize = 10;
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