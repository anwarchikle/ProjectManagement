import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import getTaskWithProject from '@salesforce/apex/TimeLogHelper.getTaskWithProject';
import USER_ID from '@salesforce/user/Id';

export default class TimeLogForm extends NavigationMixin(LightningElement) {
    @api recordTypeId;
    @api recordId;

    parentTaskId;
    parentProjectId;
    todayDate;
    loggedInUserId = USER_ID;
    isEmbedded = false;
    lockTaskProject = false;
    
    // Always start with Add Time Log component
    @track showAddTimeLog = true;  // Default: Show Add Time Log
    @track showWeeklyLog = false;  // Default: Hide Weekly Log

    get viewClass() {
    return this.showWeeklyLog 
        ? 'view slide-left'
        : 'view slide-right';
}


    /* -----------------------------------------
       GET CONTEXT (RECORD PAGE / RELATED LIST)
    ------------------------------------------*/
    @wire(CurrentPageReference)
    wiredPageRef(pageRef) {
        if (!pageRef) return;

        // Component placed on Tasks__c record page
        if (this.recordId) {
            this.parentTaskId = this.recordId;
            // Reset to default view when component opens
            this.resetToDefaultView();
            return;
        }

        const state = pageRef.state || {};

        // Related list → New
        if (state.backgroundContext) {
            const bg = state.backgroundContext;

            if (bg.includes('/Tasks__c/')) {
                this.parentTaskId = bg.split('/Tasks__c/')[1].split('/')[0];
            }
        }

        // Explicit param (button override URL)
        if (!this.parentTaskId && state.c__recordId) {
            this.parentTaskId = state.c__recordId;
        }
        
        // Always reset to default view when component opens
        this.resetToDefaultView();
    }

    @wire(CurrentPageReference)
    wiredPageRef2(pageRef) {
        if (!pageRef) return;

        // If component is placed directly on record page
        if (this.recordId) {
            this.parentTaskId = this.recordId;
            this.isEmbedded = true;
            this.resetToDefaultView();
            return;
        }

        const state = pageRef.state || {};

        if (state.backgroundContext) {
            const bg = state.backgroundContext;

            if (bg.includes('/Tasks__c/')) {
                this.parentTaskId = bg.split('/Tasks__c/')[1].split('/')[0];
            }
        }

        if (!this.parentTaskId && state.c__recordId) {
            this.parentTaskId = state.c__recordId;
        }

        this.isEmbedded = false;
        this.resetToDefaultView();
    }

    // Method to reset to default view (Add Time Log)
    resetToDefaultView() {
        this.showAddTimeLog = true;
        this.showWeeklyLog = false;
    }

    get containerClass() {
        return this.isEmbedded
            ? 'page-container'
            : 'modal-backdrop';
    }
            
    /* -----------------------------------------
       FETCH PROJECT FROM TASK
    ------------------------------------------*/
    @wire(getTaskWithProject, { taskId: '$parentTaskId' })
    wiredTask({ data, error }) {
        if (data) {
            this.parentProjectId = data.Associated_Project__c;
        } else if (error) {
            console.error('Error fetching project', error);
        }
    }

    connectedCallback() {
        document.body.style.overflow = 'hidden';
        const today = new Date();
        this.todayDate = today.toISOString().split('T')[0];
        // Ensure default view when component loads
        this.resetToDefaultView();
    }

    disconnectedCallback() {
        document.body.style.overflow = '';
    }
      handleSwitchToSingle() {
        // Simply switch back to Add Time Log component
        this.showAddTimeLog = true;
        this.showWeeklyLog = false;
    }
      
    /* -----------------------------------------
        NAVIGATION & VIEW SWITCHING
    ------------------------------------------*/
    // Handle Add Week button click - Switch to Weekly Log
    handleAddWeek() {
        this.showAddTimeLog = false;
        this.showWeeklyLog = true;
    }

    // Handle Back button click from Weekly component
    handleBackToAddTimeLog() {
        this.showAddTimeLog = true;
        this.showWeeklyLog = false;
    }

    // Handle Cancel/Close
    handleCancel() {
        // If weekly log is showing, go back to Add Time Log first
        if (this.showWeeklyLog) {
            this.handleBackToAddTimeLog();
        } else {
            this.closeAndNavigate();
        }
    }

    closeAndNavigate() {
        // Reset view for next time component opens
        this.resetToDefaultView();
        
        // If opened from Task record page or related list
        if (this.parentTaskId) {
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: this.parentTaskId,
                    objectApiName: 'Tasks__c',
                    actionName: 'view'
                }
            });
            return;
        }

        // If opened globally (App launcher / global action)
        window.history.back();
    }

    /* -----------------------------------------
       SUBMIT
    ------------------------------------------*/
    handleSubmit(event) {
        event.preventDefault();

        const requiredFields =
            this.template.querySelectorAll('lightning-input-field[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value) {
                field.reportValidity();
                isValid = false;
            }
        });

        if (!isValid) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Missing Required Fields',
                    message: 'Please fill all required fields',
                    variant: 'error',
                    mode: 'sticky'
                })
            );
            return;
        }

        const fields = event.detail.fields;

        // FORCE Task + Project
        if (this.parentTaskId) {
            fields.Tasks__c = this.parentTaskId;
        }

        if (this.parentProjectId) {
            fields.Projects__c = this.parentProjectId;
        }

        this.template
            .querySelector('lightning-record-edit-form')
            .submit(fields);
    }

    /* -----------------------------------------
       SUCCESS
    ------------------------------------------*/
    handleSuccess(event) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Time Log created successfully',
                variant: 'success'
            })
        );

        const submitter = event.detail.submitter;
        if (submitter?.name === 'saveAndNew') {
            this.resetForm();
        } else {
            this.closeAndNavigate();
        }
    }

    /* -----------------------------------------
       ERROR
    ------------------------------------------*/
    handleError(event) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Error',
                message: event.detail?.message || 'Save failed',
                variant: 'error',
                mode: 'sticky'
            })
        );
    }

    resetForm() {
        const form = this.template.querySelector('lightning-record-edit-form');
        if (form) {
            form.reset();
            // Stay in Add Time Log view
            this.resetToDefaultView();
        }
    }
}