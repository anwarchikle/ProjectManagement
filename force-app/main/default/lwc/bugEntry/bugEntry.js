import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';
import ISSUE_BUG_OBJECT from '@salesforce/schema/Issue_Bug__c';
import ENVIRONMENT_FIELD from '@salesforce/schema/Issue_Bug__c.Environment__c';

export default class BugEntry extends NavigationMixin(LightningElement) {

    @track projectId;
    @track milestoneId;
    @track userId;
    @track taskListId;
    @track uploadIdentifier;

    mileStoneCondition;
    taskListCondition;

    picklistValues;

    get acceptedFormats() {
        return ['.pdf', '.docx', '.xlsx', '.csv'];
    }

    @wire(getObjectInfo, { objectApiName: ISSUE_BUG_OBJECT })
    issueBugInfo;

    @wire(getPicklistValues, { recordTypeId: '$issueBugInfo.data.defaultRecordTypeId', fieldApiName: ENVIRONMENT_FIELD })
    wiredPicklistValues({ data, error }) {
        if (data) {
            this.picklistValues = data.values;
        }
        if (error) {
            console.error('Picklist error → ', error);
        }
    }

    handleChange(event) {
        debugger;
        const inpName = event.target.name;
        if (inpName == 'environment') {
            this.selectedIndustry = event.detail.value;
        }
    }

    connectedCallback() {
        debugger;
        // this.uploadIdentifier = `FORM_${Date.now()}`;
    }

    handleUploadFinished(event) {
        debugger;
        const uploadedFiles = event.detail.files;
    }

    keyIndex = 0;
    @track itemList = [{ id: 0 }];

    addRow() {
        ++this.keyIndex;
        var newItem = [{ id: this.keyIndex }];
        this.itemList = this.itemList.concat(newItem);
    }

    removeRow(event) {
        if (this.itemList.length >= 2) {
            this.itemList = this.itemList.filter(function (element) {
                return parseInt(element.id) !== parseInt(event.target.accessKey);
            });
        }
    }

    handleSubmit() {
        var isVal = true;
        this.template.querySelectorAll('lightning-input-field').forEach(element => {
            isVal = isVal && element.reportValidity();
        });
        if (isVal) {
            this.template.querySelectorAll('lightning-record-edit-form').forEach(element => {
                element.submit();
            });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Contacts successfully created',
                    variant: 'success',
                }),
            );
            // Navigate to the Account home page
            this[NavigationMixin.Navigate]({
                type: 'standard__objectPage',
                attributes: {
                    objectApiName: 'Contact',
                    actionName: 'home',
                },
            });
        } else {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error creating record',
                    message: 'Please enter all the required fields',
                    variant: 'error',
                }),
            );
        }
    }

    handleLookupSelection(event) {
        debugger;
        const { name, selectedRecord } = event.detail;

        switch (name) {
            case 'Project':
                this.projectId = selectedRecord;
                this.mileStoneCondition = `Project__c = '${this.projectId}'`;
                break;

            case 'Milestone':
                this.milestoneId = selectedRecord;
                this.taskListCondition = `Milestone__c = '${this.milestoneId}'`;
                break;

            case 'TaskList':
                this.taskListId = selectedRecord;
                break;

            case 'User':
                this.userId = selectedRecord;
                break;

        }
    }


    handleLookupUpdate(event) {
        debugger;
        const { name, selectedRecord } = event.detail;
        switch (name) {
            case 'Project':
                this.projectId = null;
                this.milestoneId = null;
                this.mileStoneCondition = false;
                this.taskListId = null;
                this.taskListCondition = false;
                break;

            case 'Milestone':
                this.milestoneId = null;
                this.taskListId = null;
                this.taskListCondition = false;
                break;

            case 'TaskList':
                this.taskListId = null;
                break;

            case 'User':
                this.userId = null;
                break;

        }
    }



}