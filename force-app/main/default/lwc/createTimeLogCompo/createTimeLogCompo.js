import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import USER_ID from '@salesforce/user/Id';

import getTaskWithProject from '@salesforce/apex/TimeLogHelper.getTaskWithProject';
import getProjects from '@salesforce/apex/TimeLogHelper.getProjects';
import getTasksByProject from '@salesforce/apex/TimeLogHelper.getTasksByProject';
import getBillablePicklistValues from '@salesforce/apex/TimeLogHelper.getBillablePicklistValues';
// Commented by Harsh: Issue_Bug__c picklist no longer used
// import getIssueBugPicklistValues from '@salesforce/apex/TimeLogHelper.getIssueBugPicklistValues';
import getActiveUsers from '@salesforce/apex/TimeLogHelper.getActiveUsers';
import getDailyCapacityValue from '@salesforce/apex/TimeLogHelper.getDailyCapacityValue';
import createTimeLog from '@salesforce/apex/TimeLogHelper.createTimeLog';

export default class CreateTimeLogCompo extends NavigationMixin(LightningElement) {
    @api recordTypeId;
    @api recordId;

    // Store wired results for refresh
    wiredTaskResult;

    // Form field values
    @track projectValue = '';
    @track taskValue = '';
    @track dateValue = '';
    @track dailyHours = '';
    // Commented by Harsh: Issue_Bug__c field removed
    // @track issueBugValue = '';
    @track userValue = '';
  //  @track generalLogValue = '';
    @track billableTypeValue = '';
    @track notesValue = '';

    // Picklist options
    @track projectOptions = [];
    @track taskOptions = [];
    @track userOptions = [];
    // Commented by Harsh: Issue_Bug__c options removed
    // @track issueBugOptions = [];
    @track billableTypeOptions = [];

    // State variables
    parentTaskId;
    parentProjectId;
    todayDate;
    loggedInUserId = USER_ID;
    isEmbedded = false;
    lockTaskProject = false;
    isSaving = false;
    dailyCapacity = 16; // Default value, will be updated from custom label via Apex

    // View state
    @track showAddTimeLog = true;
    @track showWeeklyLog = false;

    // Computed properties for field locking
    get isProjectLocked() {
        return this.parentProjectId ? true : false;
    }

    get isTaskLocked() {
        return this.parentTaskId ? true : false;
    }

    get isUserLocked() {
        return this.loggedInUserId ? true : false;
    }

    // This uses the dynamically loaded dailyCapacity from Apex
    get hoursValidationMessage() {
        return `You cannot log more than ${this.dailyCapacity} hours in a day`;
    }

    /* -----------------------------------------
       GET CONTEXT (RECORD PAGE / RELATED LIST)
    ------------------------------------------*/
    @wire(CurrentPageReference)
    wiredPageRef(pageRef) {
        if (!pageRef) return;

        if (this.recordId) {
            this.parentTaskId = this.recordId;
            if (this.parentTaskId) {
                this.taskValue = this.parentTaskId;
            }
            this.resetToDefaultView();
            return;
        }

        const state = pageRef.state || {};

        if (state.backgroundContext) {
            const bg = state.backgroundContext;
            if (bg.includes('/Tasks__c/')) {
                this.parentTaskId = bg.split('/Tasks__c/')[1].split('/')[0];
                if (this.parentTaskId) {
                    this.taskValue = this.parentTaskId;
                }
            }
        }

        if (!this.parentTaskId && state.c__recordId) {
            this.parentTaskId = state.c__recordId;
            if (this.parentTaskId) {
                this.taskValue = this.parentTaskId;
            }
        }

        this.resetToDefaultView();
    }

    @wire(CurrentPageReference)
    wiredPageRef2(pageRef) {
        if (!pageRef) return;

        if (this.recordId) {
            this.parentTaskId = this.recordId;
            if (this.parentTaskId) {
                this.taskValue = this.parentTaskId;
            }
            this.isEmbedded = true;
            this.resetToDefaultView();
            return;
        }

        const state = pageRef.state || {};

        if (state.backgroundContext) {
            const bg = state.backgroundContext;
            if (bg.includes('/Tasks__c/')) {
                this.parentTaskId = bg.split('/Tasks__c/')[1].split('/')[0];
                if (this.parentTaskId) {
                    this.taskValue = this.parentTaskId;
                }
            }
        }

        if (!this.parentTaskId && state.c__recordId) {
            this.parentTaskId = state.c__recordId;
            if (this.parentTaskId) {
                this.taskValue = this.parentTaskId;
            }
        }

        this.isEmbedded = false;
        this.resetToDefaultView();
    }

    /* -----------------------------------------
       LOAD PICKLIST VALUES AND DAILY CAPACITY
    ------------------------------------------*/
    connectedCallback() {
        document.body.style.overflow = 'hidden';
        const today = new Date();
        this.todayDate = today.toISOString().split('T')[0];
        this.dateValue = this.todayDate;
        
        // Load all data
        this.loadAllData();
        
        // Set default user
        if (this.loggedInUserId) {
            this.userValue = this.loggedInUserId;
        }
        
        this.resetToDefaultView();
    }

    disconnectedCallback() {
        document.body.style.overflow = '';
    }

    async loadAllData() {
        await Promise.all([
            this.loadDailyCapacity(),
            this.loadPicklistValues(),
            this.loadProjects(),
            this.loadUsers()
        ]);
    }

    async loadDailyCapacity() {
        try {
            const capacity = await getDailyCapacityValue();
            if (capacity) {
                this.dailyCapacity = capacity;
                console.log('Daily capacity loaded:', capacity);
            }
        } catch (error) {
            console.error('Error loading daily capacity:', error);
        }
    }

    // Commented by Harsh: Issue_Bug__c picklist loading removed; only Billable_Type__c is used
    async loadPicklistValues() {
        try {
            const billableResult = await getBillablePicklistValues();
            this.billableTypeOptions = billableResult.map(value => ({ label: value, value: value }));

            if (!this.billableTypeValue && billableResult.includes('Billable')) {
                this.billableTypeValue = 'Billable';
            }

        } catch (error) {
            console.error('Error loading picklist values:', error);
        }
    }

    async loadProjects() {
        try {
            const projects = await getProjects();
            this.projectOptions = projects.map(proj => ({
                label: proj.Name,
                value: proj.Id
            }));
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    }

    async loadUsers() {
        try {
            const users = await getActiveUsers();
            this.userOptions = users.map(user => ({
                label: user.Name,
                value: user.Id
            }));
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    async loadTasks(projectId) {
        if (!projectId) return;
        
        try {
            const tasks = await getTasksByProject({ projectId: projectId });
            this.taskOptions = tasks.map(task => ({
                label: task.Name,
                value: task.Id
            }));
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }

    /* -----------------------------------------
       FETCH PROJECT FROM TASK
    ------------------------------------------*/
    @wire(getTaskWithProject, { taskId: '$parentTaskId' })
    wiredTask(result) {
        this.wiredTaskResult = result;
        const { data, error } = result;
        
        if (data) {
            this.parentProjectId = data.Associated_Project__c;
            if (this.parentProjectId) {
                this.projectValue = this.parentProjectId;
                this.loadTasks(this.parentProjectId);
            }
        } else if (error) {
            console.error('Error fetching project', error);
        }
    }

    /* -----------------------------------------
       FORM HANDLERS
    ------------------------------------------*/
    handleProjectChange(event) {
        this.projectValue = event.detail.value;
        this.taskValue = '';
        this.taskOptions = [];
        if (this.projectValue) {
            this.loadTasks(this.projectValue);
        }
    }

    handleTaskChange(event) {
        this.taskValue = event.detail.value;
    }

    handleDateChange(event) {
        this.dateValue = event.target.value;
    }

    handleHoursChange(event) {
        this.dailyHours = event.target.value;
        
        const hours = parseFloat(this.dailyHours);
        if (hours > this.dailyCapacity) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Validation Error',
                    message: this.hoursValidationMessage,
                    variant: 'warning',
                    mode: 'dismissable'
                })
            );
        }
    }

    // Commented by Harsh: Issue_Bug__c change handler no longer needed
    // handleIssueBugChange(event) {
    //     this.issueBugValue = event.detail.value;
    // }

    handleUserChange(event) {
        this.userValue = event.detail.value;
    }

    // handleGeneralLogChange(event) {
    //     this.generalLogValue = event.target.value;
    // }

    handleBillableTypeChange(event) {
        this.billableTypeValue = event.detail.value;
    }

    handleNotesChange(event) {
        this.notesValue = event.target.value;
    }

    /* -----------------------------------------
       VIEW SWITCHING
    ------------------------------------------*/
    resetToDefaultView() {
        this.showAddTimeLog = true;
        this.showWeeklyLog = false;
    }

    handleAddWeek() {
        this.showAddTimeLog = false;
        this.showWeeklyLog = true;
    }

    handleBackToAddTimeLog() {
        this.showAddTimeLog = true;
        this.showWeeklyLog = false;
    }

    handleSwitchToSingle() {
        this.showAddTimeLog = true;
        this.showWeeklyLog = false;
    }

    handleCancel() {
        if (this.showWeeklyLog) {
            this.handleBackToAddTimeLog();
        } else {
            this.closeAndNavigate();
        }
    }

    closeAndNavigate() {
        this.resetToDefaultView();
        
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

        window.history.back();
    }

    /* -----------------------------------------
       REFRESH DATA METHOD
    ------------------------------------------*/
    async refreshData() {
        try {
            console.log('Refreshing data...');
            
            // Refresh wired task data
            if (this.wiredTaskResult) {
                await refreshApex(this.wiredTaskResult);
            }
            
            // Reload daily capacity
            await this.loadDailyCapacity();
            
            // Reload projects
            await this.loadProjects();
            
            // Reload tasks if project is selected
            if (this.projectValue) {
                await this.loadTasks(this.projectValue);
            }
            
            // Reload picklist values
            await this.loadPicklistValues();
            
            // Reload users
            await this.loadUsers();
            
            console.log('Data refreshed. Daily capacity:', this.dailyCapacity);
            
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    }

    /* -----------------------------------------
       VALIDATION
    ------------------------------------------*/
    validateForm() {
        let isValid = true;
        let errorMessages = [];

        if (!this.projectValue) {
            errorMessages.push('Project is required');
            isValid = false;
        }

        if (!this.taskValue) {
            errorMessages.push('Task is required');
            isValid = false;
        }

        if (!this.dateValue) {
            errorMessages.push('Date is required');
            isValid = false;
        }

        if (!this.dailyHours || this.dailyHours === '') {
            errorMessages.push('Daily Logs is required');
            isValid = false;
        } else {
            const hours = parseFloat(this.dailyHours);
            if (isNaN(hours) || hours <= 0) {
                errorMessages.push('Hours must be greater than 0');
                isValid = false;
            } else if (hours > this.dailyCapacity) {
                errorMessages.push(this.hoursValidationMessage);
                isValid = false;
            }
        }

        if (!this.userValue) {
            errorMessages.push('User is required');
            isValid = false;
        }

        if (!isValid) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Missing Required Fields',
                    message: errorMessages.join('. '),
                    variant: 'error',
                    mode: 'sticky'
                })
            );
        }

        return isValid;
    }

    /* -----------------------------------------
       SUBMIT HANDLERS - FIXED REFRESH
    ------------------------------------------*/
    handleSave() {
        this.saveTimeLog(false);
    }

    handleSaveAndNew() {
        this.saveTimeLog(true);
    }

    async saveTimeLog(isSaveAndNew) {
        if (!this.validateForm()) {
            return;
        }

        this.isSaving = true;

        try {
            const timeLog = {
                Projects__c: this.projectValue,
                Tasks__c: this.taskValue,
                Date__c: this.dateValue,
                Daily_Logs__c: parseFloat(this.dailyHours),
                User__c: this.userValue,
                Notes__c: this.notesValue || null,
                // Commented by Harsh: Issue_Bug__c removed from payload
                // Issue_Bug__c: this.issueBugValue || null,
               // General_Log__c: this.generalLogValue || null,
                Billable_Type__c: this.billableTypeValue || null
            };

            const result = await createTimeLog({ timeLog: timeLog });

            if (result && result.Id) {
                // Show success message
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Time Log created successfully',
                        variant: 'success'
                    })
                );

                // REFRESH DATA IMMEDIATELY before any navigation
                await this.refreshData();

                const recordIdToRefresh = this.parentTaskId || this.recordId;
               
                if (isSaveAndNew) {
                    this.resetForm();
                } else {
                    // Small delay to ensure refresh completes before navigation
                    setTimeout(() => {
                        this.closeAndNavigate();
                    }, 100);
                }
            }

        } catch (error) {
            console.error('Error creating time log:', error);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || error.message || 'Save failed',
                    variant: 'error',
                    mode: 'sticky'
                })
            );
        } finally {
            this.isSaving = false;
        }
    }

    resetForm() {
        this.dailyHours = '';
        // Commented by Harsh: Issue_Bug__c reset removed
        // this.issueBugValue = '';
        this.generalLogValue = '';
        this.billableTypeValue = '';
        this.notesValue = '';
        this.dateValue = this.todayDate;
        this.billableTypeValue = 'Billable';
        
        if (!this.isProjectLocked) {
            this.projectValue = '';
        }
        if (!this.isTaskLocked) {
            this.taskValue = '';
            this.taskOptions = [];
        }
        
        if (this.loggedInUserId) {
            this.userValue = this.loggedInUserId;
        }
    }
}