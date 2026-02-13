import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import USER_ID from '@salesforce/user/Id';

// Apex imports
import getProjects from '@salesforce/apex/TimeLogHelper.getProjects';
import getTasksByProject from '@salesforce/apex/TimeLogHelper.getTasksByProject';
import getBillablePicklistValues from '@salesforce/apex/TimeLogHelper.getBillablePicklistValues';
import createWeeklyTimeLogs from '@salesforce/apex/TimeLogHelper.createWeeklyTimeLogs';
import getUserName from '@salesforce/apex/TimeLogHelper.getUserName';

export default class WeeklyTimeLogForm extends NavigationMixin(LightningElement) {
    loggedInUserId = USER_ID;
    @api recordId; // Task Id if from record page
    @api projectId; // Project Id if passed directly
    
    @track timeLogRows = [];
   

    projectOptions = [];
    billableTypeOptions = [];
    taskOptionsMap = {};
    
  
    loggedInUserName = '';

    weekStart = null;
    weekEnd = null;
    weekNumber = 0;
    weekRange = '';
    
    isEmbedded = false;
    parentTaskId = '';
    parentProjectId = '';

    // Week days display
    weekDays = {
        mon: '',
        tue: '',
        wed: '',
        thu: '',
        fri: '',
        sat: '',
        sun: ''
    };

    /* -----------------------------------------
       GET LOGGED IN USER NAME
    ------------------------------------------*/
            @wire(getUserName, { userId: '$loggedInUserId' })
        wiredUserName({ data, error }) {
            if (data) {
                this.loggedInUserName = data;
                console.log('User name loaded:', this.loggedInUserName);
                
                // Update any existing rows with the actual user name
                if (this.timeLogRows && this.timeLogRows.length > 0) {
                    this.timeLogRows = this.timeLogRows.map(row => ({
                        ...row,
                        userName: this.loggedInUserName
                    }));
                }
            } else if (error) {
                console.error('Error loading user name', error);
                // Fallback - try to get from USER_ID? 
                this.loggedInUserName = 'User';
            }
        }

    /* -----------------------------------------
       GET CONTEXT
    ------------------------------------------*/
    @wire(CurrentPageReference)
    wiredPageRef(pageRef) {
        if (!pageRef) return;

        if (this.recordId) {
            this.parentTaskId = this.recordId;
            this.isEmbedded = true;
            // Add default row with task pre-selected
            this.addDefaultRowWithTask();
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
    }

    /* -----------------------------------------
       WIRE METHODS
    ------------------------------------------*/
    @wire(getProjects)
    wiredProjects({ data, error }) {
        if (data) {
            this.projectOptions = data.map(proj => ({
                label: proj.Name,
                value: proj.Id
            }));
        } else if (error) {
            console.error('Error loading projects', error);
        }
    }

    @wire(getBillablePicklistValues)
    wiredBillableTypes({ data, error }) {
        if (data) {
            this.billableTypeOptions = data.map(value => ({
                label: value,
                value: value
            }));
        } else if (error) {
            console.error('Error loading billable types', error);
        }
    }

    /* -----------------------------------------
       LIFECYCLE
    ------------------------------------------*/
        connectedCallback() {
        document.body.style.overflow = 'hidden';
        this.initializeWeek();
        
        // Debug: Check if userName is set
        console.log('Logged in user ID:', this.loggedInUserId);
        console.log('Logged in user name:', this.loggedInUserName);
        
        // Add default row if no rows exist
        if (this.timeLogRows.length === 0) {
            this.handleAddRow();
        }
    }

    disconnectedCallback() {
        document.body.style.overflow = '';
    }

    /* -----------------------------------------
       DEFAULT ROW WITH TASK
    ------------------------------------------*/
    addDefaultRowWithTask() {
        if (this.parentTaskId) {
            // Fetch task details and add row
            getTasksByProject({ projectId: null })
                .then(tasks => {
                    const task = tasks.find(t => t.Id === this.parentTaskId);
                    if (task) {
                        this.handleAddRow();
                        const newRow = this.timeLogRows[0];
                        newRow.taskId = task.Id;
                        newRow.projectId = task.Associated_Project__c;
                        newRow.taskOptions = [{ label: task.Name, value: task.Id }];
                        newRow.userName = this.loggedInUserName;
                        
                        // Fetch tasks for this project
                        this.loadTasksForProject(newRow.projectId, 0);
                        this.timeLogRows = [...this.timeLogRows];
                    }
                })
                .catch(error => {
                    console.error('Error loading task', error);
                });
        }
    }

    /* -----------------------------------------
       WEEK NAVIGATION
    ------------------------------------------*/
    initializeWeek() {
        const today = new Date();
        this.weekStart = this.getStartOfWeek(today);
        this.weekEnd = this.getEndOfWeek(this.weekStart);
        this.updateWeekDisplay();
    }

    getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    getEndOfWeek(startDate) {
        const end = new Date(startDate);
        end.setDate(end.getDate() + 6);
        return end;
    }

    updateWeekDisplay() {
        const startDay = this.formatDate(this.weekStart);
        const endDay = this.formatDate(this.weekEnd);
        this.weekRange = `${startDay} - ${endDay}`;
        
        this.weekNumber = this.getWeekNumber(this.weekStart);
        
        const currentDay = new Date(this.weekStart);
        this.weekDays = {
            mon: this.formatDayMonth(currentDay),
            tue: this.formatDayMonth(this.addDays(currentDay, 1)),
            wed: this.formatDayMonth(this.addDays(currentDay, 2)),
            thu: this.formatDayMonth(this.addDays(currentDay, 3)),
            fri: this.formatDayMonth(this.addDays(currentDay, 4)),
            sat: this.formatDayMonth(this.addDays(currentDay, 5)),
            sun: this.formatDayMonth(this.addDays(currentDay, 6))
        };
    }

    formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    formatDayMonth(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    }

    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    handlePrevWeek() {
        this.weekStart.setDate(this.weekStart.getDate() - 7);
        this.weekEnd = this.getEndOfWeek(this.weekStart);
        this.updateWeekDisplay();
        this.recalculateTotals();
    }

    handleNextWeek() {
        this.weekStart.setDate(this.weekStart.getDate() + 7);
        this.weekEnd = this.getEndOfWeek(this.weekStart);
        this.updateWeekDisplay();
        this.recalculateTotals();
    }

    /* -----------------------------------------
       ROW MANAGEMENT
    ------------------------------------------*/
        handleAddRow() {
        const newRow = {
            id: 'row-' + Date.now() + '-' + Math.random(),
            projectId: '',
            taskId: '',
            userId: this.loggedInUserId,
            userName: this.loggedInUserName, // This will be empty initially, but will update when wired data arrives
            billableType: 'Billable',
            taskOptions: [],
            mon: 0,
            tue: 0,
            wed: 0,
            thu: 0,
            fri: 0,
            sat: 0,
            sun: 0,
            total: '0.00'
        };
        this.timeLogRows = [...this.timeLogRows, newRow];
    }

    handleRowChange(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        const field = event.currentTarget.dataset.field;
        let value = event.detail.value;
        
        if (!isNaN(index) && index >= 0 && index < this.timeLogRows.length) {
            // Handle special cases
            if (field === 'projectId') {
                this.timeLogRows[index].projectId = value;
                this.timeLogRows[index].taskId = ''; // Reset task
                this.loadTasksForProject(value, index);
            } else if (field === 'taskId') {
                this.timeLogRows[index].taskId = value;
            } else if (field === 'billableType') {
                this.timeLogRows[index].billableType = value;
            } else if (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(field)) {
                // Ensure value is a number
                value = parseFloat(value) || 0;
                this.timeLogRows[index][field] = value;
                this.calculateRowTotal(index);
            }
            
            this.timeLogRows = [...this.timeLogRows];
        }
    }

    loadTasksForProject(projectId, rowIndex) {
        if (projectId) {
            getTasksByProject({ projectId: projectId })
                .then(tasks => {
                    const taskOptions = tasks.map(task => ({
                        label: task.Name,
                        value: task.Id
                    }));
                    
                    if (this.timeLogRows[rowIndex]) {
                        this.timeLogRows[rowIndex].taskOptions = taskOptions;
                        this.timeLogRows = [...this.timeLogRows];
                    }
                })
                .catch(error => {
                    console.error('Error loading tasks', error);
                });
        }
    }

    handleDeleteRow(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        if (!isNaN(index)) {
            this.timeLogRows = this.timeLogRows.filter((_, i) => i !== index);
        }
    }

    calculateRowTotal(index) {
        const row = this.timeLogRows[index];
        const total = (parseFloat(row.mon) || 0) +
                     (parseFloat(row.tue) || 0) +
                     (parseFloat(row.wed) || 0) +
                     (parseFloat(row.thu) || 0) +
                     (parseFloat(row.fri) || 0) +
                     (parseFloat(row.sat) || 0) +
                     (parseFloat(row.sun) || 0);
        
        row.total = total.toFixed(2);
        this.timeLogRows = [...this.timeLogRows];
    }

    recalculateTotals() {
        this.timeLogRows.forEach((_, index) => {
            this.calculateRowTotal(index);
        });
    }

    get grandTotal() {
        const total = this.timeLogRows.reduce((sum, row) => {
            return sum + (parseFloat(row.total) || 0);
        }, 0);
        return total.toFixed(2);
    }

    get showEmptyState() {
        return this.timeLogRows.length === 0;
    }

    get containerClass() {
        return this.isEmbedded ? 'page-container' : 'modal-backdrop';
    }

    /* -----------------------------------------
       SAVE OPERATIONS
    ------------------------------------------*/
    async handleSave() {
        if (!this.validateRows()) {
            return;
        }

        const timeLogsToCreate = this.prepareTimeLogs();
        console.log('Time logs to create:', JSON.stringify(timeLogsToCreate));
        
        try {
            const result = await createWeeklyTimeLogs({ 
                timeLogs: timeLogsToCreate
            });
            
            console.log('Create result:', result);
            
            this.showToast(
                'Success',
                `${timeLogsToCreate.length} time log entries created successfully`,
                'success'
            );
            
            this.closeAndNavigate();
        } catch (error) {
            console.error('Error creating time logs:', error);
            this.showToast(
                'Error',
                error.body?.message || error.message || 'Failed to create time logs',
                'error'
            );
        }
    }

    async handleSaveAndNew() {
        if (!this.validateRows()) {
            return;
        }

        const timeLogsToCreate = this.prepareTimeLogs();
        
        try {
            await createWeeklyTimeLogs({ 
                timeLogs: timeLogsToCreate
            });
            
            this.showToast(
                'Success',
                `${timeLogsToCreate.length} time log entries created successfully`,
                'success'
            );
            
            // Reset for new entry
            this.resetForm();
        } catch (error) {
            console.error('Error creating time logs:', error);
            this.showToast(
                'Error',
                error.body?.message || error.message || 'Failed to create time logs',
                'error'
            );
        }
    }

        validateRows() {
        if (this.timeLogRows.length === 0) {
            this.showToast('No Entries', 'Please add at least one time log entry', 'error');
            return false;
        }

        for (let i = 0; i < this.timeLogRows.length; i++) {
            const row = this.timeLogRows[i];
            
            if (!row.projectId) {
                this.showToast('Validation Error', `Row ${i + 1}: Project is required`, 'error');
                return false;
            }
            
            // Check if any hours are entered
            const hasHours = (parseFloat(row.mon) > 0) ||
                            (parseFloat(row.tue) > 0) ||
                            (parseFloat(row.wed) > 0) ||
                            (parseFloat(row.thu) > 0) ||
                            (parseFloat(row.fri) > 0) ||
                            (parseFloat(row.sat) > 0) ||
                            (parseFloat(row.sun) > 0);
            
            if (!hasHours) {
                this.showToast('Validation Error', `Row ${i + 1}: Please enter hours for at least one day`, 'error');
                return false;
            }
        }

        return true;
    }

        prepareTimeLogs() {
        const logs = [];
        const dates = this.getWeekDates();
        
        this.timeLogRows.forEach((row, index) => {
            // Debug each row
            console.log(`Processing row ${index}:`, row);
            
            // Create individual log entries for each day with hours > 0
            if (parseFloat(row.mon) > 0) {
                logs.push(this.createTimeLog(row, dates.mon, row.mon));
            }
            if (parseFloat(row.tue) > 0) {
                logs.push(this.createTimeLog(row, dates.tue, row.tue));
            }
            if (parseFloat(row.wed) > 0) {
                logs.push(this.createTimeLog(row, dates.wed, row.wed));
            }
            if (parseFloat(row.thu) > 0) {
                logs.push(this.createTimeLog(row, dates.thu, row.thu));
            }
            if (parseFloat(row.fri) > 0) {
                logs.push(this.createTimeLog(row, dates.fri, row.fri));
            }
            if (parseFloat(row.sat) > 0) {
                logs.push(this.createTimeLog(row, dates.sat, row.sat));
            }
            if (parseFloat(row.sun) > 0) {
                logs.push(this.createTimeLog(row, dates.sun, row.sun));
            }
        });
        
        console.log('Total logs to create:', logs.length);
        return logs;
    }

                createTimeLog(row, date, hours) {
                // Debug the values being sent
                console.log('Creating time log:', {
                    Projects__c: row.projectId,
                    Tasks__c: row.taskId || null,
                    User__c: this.loggedInUserId,
                    Date__c: date,
                    Daily_Logs__c: parseFloat(hours), // Change this to match your field name
                    Billable_Type__c: row.billableType || 'Billable',
                    Notes__c: `Weekly log entry - Week ${this.weekNumber}`
                });

                return {
                    Projects__c: row.projectId,
                    Tasks__c: row.taskId || null,
                    User__c: this.loggedInUserId,
                    Date__c: date,
                    Daily_Logs__c: parseFloat(hours), // Use Daily_Logs__c instead of Hours__c
                    Billable_Type__c: row.billableType || 'Billable',
                    Notes__c: `Weekly log entry - Week ${this.weekNumber}` // Optional notes
                };
            }

    getWeekDates() {
        const mon = new Date(this.weekStart);
        const tue = this.addDays(mon, 1);
        const wed = this.addDays(mon, 2);
        const thu = this.addDays(mon, 3);
        const fri = this.addDays(mon, 4);
        const sat = this.addDays(mon, 5);
        const sun = this.addDays(mon, 6);
        
        return {
            mon: this.formatDateForSalesforce(mon),
            tue: this.formatDateForSalesforce(tue),
            wed: this.formatDateForSalesforce(wed),
            thu: this.formatDateForSalesforce(thu),
            fri: this.formatDateForSalesforce(fri),
            sat: this.formatDateForSalesforce(sat),
            sun: this.formatDateForSalesforce(sun)
        };
    }

    formatDateForSalesforce(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    resetForm() {
        this.timeLogRows = [];
        this.handleAddRow();
    }

    /* -----------------------------------------
       NAVIGATION & UTILITIES
    ------------------------------------------*/
        handleBackToAddTimeLog() {
        // Dispatch event to parent to switch back to Add Time Log
        this.dispatchEvent(new CustomEvent('back'));
    }
  
    handleSwitchToSingle() {
        // Close current component and open single time log
        this.dispatchEvent(new CustomEvent('switchtosingle', {
        detail: {
            recordId: this.parentTaskId,
            projectId: this.parentProjectId
        }
    }));
    }


    closeAndNavigate() {
        if (this.parentTaskId) {
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: this.parentTaskId,
                    objectApiName: 'Tasks__c',
                    actionName: 'view'
                }
            });
        } else {
            window.history.back();
        }
    }

    handleCancel() {
        this.closeAndNavigate();
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