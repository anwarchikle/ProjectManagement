import { LightningElement, track, wire, api } from 'lwc';
import { getListUi } from 'lightning/uiListApi';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import ISSUES_OBJECT from '@salesforce/schema/Issue_Bug__c';
import STATUS_FIELD from '@salesforce/schema/Issue_Bug__c.Status__c';
import SEVERITY_FIELD from '@salesforce/schema/Issue_Bug__c.Severity__c';
import uatIssues from '@salesforce/apex/Mybugscontroller.uatIssues';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class UatIssues extends LightningElement {

    @api selectedListView;

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

    recordTypeId;
    @wire(getObjectInfo, { objectApiName: ISSUES_OBJECT })
    objectInfo({ data }) {
        if (data) {
            this.recordTypeId = data.defaultRecordTypeId;
        }
    }

    @track statusOptions = [];

    @wire(getPicklistValues, {recordTypeId: '$recordTypeId', fieldApiName: STATUS_FIELD})
    wiredStatus({ data }) {
        debugger;
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
        debugger;
        if (data) {
            this.severityOptions = [
                { label: 'All', value: '' },
                ...data.values.map(item => ({label: item.label,value: item.value}))
            ];
        }
    }

    @wire(getListUi, {objectApiName: ISSUES_OBJECT, listViewApiName: '$selectedListView',
        pageSize: '$pageSize', pageToken: '$pageToken',filterBy:'{searchKey},{selectedStatus},{selectedSeverity}'})
    wiredListView({ error, data }) {
        debugger;
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
                    else {

                        let fieldData = record.fields[fieldApi];

                        cell.value =
                            fieldData?.displayValue ||
                            fieldData?.value ||
                            '';

                        if (fieldApi === 'Name') {
                            cell.isLink = true;
                            cell.url = '/' + record.id;
                        }
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

    connectedCallback() {
        debugger;
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

     handleSearchChange(event) {
        debugger;
        this.searchKey = event.target.value;
        if(this.searchKey != ''){
            this.pageSize = Number('200');
        }else{
            this.pageSize = Number('20');
        }
    }

    handleProjectFilter(event) {
        debugger;
        this.selectedProject = event.detail.value;
        if(this.selectedProject != ''){
            this.pageSize = Number('200');
        }else{
            this.pageSize = Number('20');
        }
    }

    handleStatusFilter(event) {
        debugger;
        this.selectedStatus = event.detail.value;
        if(this.selectedStatus != ''){
            this.pageSize = Number('200');
        }else{
            this.pageSize = Number('20');
        }
    }

    handleSeverityFilter(event) {
        debugger;
        this.selectedSeverity = event.detail.value;
        if(this.selectedSeverity != ''){
            this.pageSize = Number('200');
        }else{
            this.pageSize = Number('20');
        }
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