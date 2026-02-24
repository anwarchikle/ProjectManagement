import { LightningElement, track, wire, api } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { getListUi } from 'lightning/uiListApi';
import ISSUE_BUG_OBJECT from '@salesforce/schema/Issue_Bug__c';
import getRetestQueue from '@salesforce/apex/RetestController.getRetestQueue';
import updateRetestStatus from '@salesforce/apex/RetestController.updateRetestStatus';
import getRetestFixedCountForCurrentUserOrAdmin
    from '@salesforce/apex/RetestController.getRetestFixedCountForCurrentUserOrAdmin';

export default class RetestAndVerificationCompo extends NavigationMixin(LightningElement) {
    
    @track records = [];
    @track Newcolumns = [];
    @track showModal = false;
    @track selectedRecordId;
    @track retestStatus;
    @track wiredResult;
    @track wiredListResult;
    @track listViewOptions = [];
    @track totalRetestRecordsCount = 0;
    
    
    searchKey = '';
    selectedListViewId = 'Retesting'; // Your list view API name
    
    pageToken = null;
    nextPageToken = null;
    previousPageToken = null;
    
    pendingCount = 0;
    fixedCount = 0;
    inRetestCount = 0;
    slaAtRiskCount = 0;

    // Wire to get list view data for table display
    @wire(getListUi, {
        objectApiName: ISSUE_BUG_OBJECT,
        listViewApiName: '$selectedListViewId',
        pageSize: 200,
        pageToken: '$pageToken'
    })
    wiredListView(result) {
        debugger;
        this.wiredListResult = result;
        const { error, data } = result;

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

            // Calculate counts from list view data
            this.calculateCountsFromListView(data.records.records);
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

    // Wire to get Apex data for counts (optional - if you still want to use Apex)
    @wire(getRetestQueue)
    wiredRetestQueue(result) {
        this.wiredResult = result;
        if (result.data) {
            this.calculateCountsFromApex(result.data);
        } else if (result.error) {
            this.showToast('Error', 'Error loading retest queue', 'error');
        }
    }

        calculateCountsFromListView(data) {

        let counts = {
            pending: 0,
            fixed: 0,
            inRetest: 0,
            slaAtRisk: 0
        };

        data.forEach(record => {

            let retestStatus = record.fields?.Retest_Status__c?.value;
            let status = record.fields?.Status__c?.value;
            let slaStatus = record.fields?.SLA_Status__c?.value;

            // Pending
            if (retestStatus === 'Pending Retest') {
                counts.pending++;
            }

            // In Retest
            if (retestStatus === 'In Retest') {
                counts.inRetest++;
            }

            // Fixed → based on Status__c
            if (status === 'Completed') {
                counts.fixed++;
            }

            // SLA
            if (slaStatus === 'At Risk') {
                counts.slaAtRisk++;
            }

        });

        this.pendingCount = counts.pending;
        this.fixedCount = counts.fixed;
        this.inRetestCount = counts.inRetest;
        this.slaAtRiskCount = counts.slaAtRisk;
        this.totalRetestRecordsCount = data.length;
    }


    calculateCountsFromApex(data) {
        let counts = {
            pending: 0,
            fixed: 0,
            inRetest: 0,
            slaAtRisk: 0
        };

        data.forEach(record => {
            switch(record.Retest_Status__c) {
                case 'Pending Retest':
                    counts.pending++;
                    break;
                case 'Fixed (Awaiting)':
                    counts.fixed++;
                    break;
                case 'In Retest':
                    counts.inRetest++;
                    break;
            }

            if (record.SLA_Status__c === 'At Risk') {
                counts.slaAtRisk++;
            }
        });

        this.pendingCount = counts.pending;
        this.fixedCount = counts.fixed;
        this.inRetestCount = counts.inRetest;
        this.slaAtRiskCount = counts.slaAtRisk;
        this.totalRetestRecordsCount = data.length;
    }

    get visibleRecords() {
        
        if (!this.searchKey) {
            return this.records;
        }
        
        const key = this.searchKey.toLowerCase();
        
        return this.records.filter(row =>
            row.cells.some(cell =>
                String(cell.value).toLowerCase().includes(key)
            )
        );
    }

    get selectedListViewLabel() {
        return this.selectedListViewId.replace(/_/g, ' ');
    }

    handleSearchChange(event) {
        this.searchKey = event.target.value;
    }

    handleListViewChange(event) {
        this.selectedListViewId = event.detail.value;
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

        @wire(getRetestFixedCountForCurrentUserOrAdmin)
    wiredRetestFixedCount({ data, error }) {
        if (data !== undefined) {
            // This will drive the "Retesting Fixed" card
            this.fixedCount = data;
        } else if (error) {
            console.error('Error loading Retest Fixed count', error);
        }
    }

    // ================= PASS / FAIL QUICK ACTIONS =================

    async handlePassClick(event) {
        const recordId = event.currentTarget.dataset.id;

        try {
            await updateRetestStatus({
                recordId,
                status: 'Completed'
            });

            this.showToast('Success', 'Issue marked as Completed', 'success');

            await Promise.all([
                this.wiredResult ? refreshApex(this.wiredResult) : Promise.resolve(),
                this.wiredListResult ? refreshApex(this.wiredListResult) : Promise.resolve()
            ]);
        } catch (error) {
            console.error(error);
            this.showToast('Error', 'Error updating status to Completed', 'error');
        }
    }

    async handleFailClick(event) {
        const recordId = event.currentTarget.dataset.id;

        try {
            await updateRetestStatus({
                recordId,
                status: 'Open'
            });

            this.showToast('Success', 'Issue re-opened as Open', 'success');

            await Promise.all([
                this.wiredResult ? refreshApex(this.wiredResult) : Promise.resolve(),
                this.wiredListResult ? refreshApex(this.wiredListResult) : Promise.resolve()
            ]);
        } catch (error) {
            console.error(error);
            this.showToast('Error', 'Error updating status to Open', 'error');
        }
    }

    get isNextDisabled() {
        return !this.nextPageToken;
    }

    get isPreviousDisabled() {
        return !this.previousPageToken;
    }

    openModal(recordId) {
        this.selectedRecordId = recordId;
        this.showModal = true;
    }

    closeModal() {
        this.showModal = false;
        this.selectedRecordId = null;
        this.retestStatus = null;
    }

    handlePass() {
        this.retestStatus = 'Passed';
    }

    handleFail() {
        this.retestStatus = 'Failed';
    }

    handleSuccess() {
        this.closeModal();
        this.showToast('Success', 'Retest result updated successfully', 'success');
        return refreshApex(this.wiredResult);
    }

    cancelRetest(recordId) {
        updateRetestStatus({ 
            recordId: recordId, 
            status: 'Pending Retest' 
        })
        .then(() => {
            this.showToast('Success', 'Retest cancelled successfully', 'success');
            return refreshApex(this.wiredResult);
        })
        .catch(error => {
            this.showToast('Error', 'Error cancelling retest', 'error');
        });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}