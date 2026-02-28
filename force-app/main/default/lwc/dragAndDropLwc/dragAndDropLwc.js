import { LightningElement, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { refreshApex } from '@salesforce/apex';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';
import TASKS_OBJECT from '@salesforce/schema/Tasks__c';
import STATUS_FIELD from '@salesforce/schema/Tasks__c.Status__c';
import ID_FIELD from '@salesforce/schema/Tasks__c.Id';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import isInternalUser from '@salesforce/apex/taskController.isInternalUser'
import updateTaskStatusWithChecks from '@salesforce/apex/taskController.updateTaskStatusWithChecks';
import getKanbanTasks from '@salesforce/apex/taskController.getKanbanTasks';
import USER_ID from '@salesforce/user/Id';
export default class DragAndDropLwc extends LightningElement {
    records;
    pickVals;
    allStatuses;
    recordId;
    searchKey = '';
    viewType = 'My_Tasks';
    viewMode = 'kanban';
    wiredData;
    @track showExportDialog = false;
    @track selectedExportStatus = 'All';
    @track isInternalUser = false;
    @wire(getRecord, { recordId: USER_ID, fields: ['User.Profile.Name'] })
    currentUser;
    /* ============================
       FETCH TASKS
    ============================ */

    connectedCallback() {
        debugger;
        this.checkUserType();
    }
    updateStagesForView() {
        if (!Array.isArray(this.allStatuses) || this.allStatuses.length === 0) {
            this.pickVals = this.allStatuses;
            return;
        }
        if (this.viewType === 'All_Tasks') {
            // All Tasks: show all statuses for everyone
            this.pickVals = this.allStatuses;
            return;
        }

        const profile = this.userProfileName;
        if (profile === 'PMT Developer') {
            // Developer in My Tasks / My Today Tasks:
            // Open, Assigned, In Progress, Testing
            const allowedDev = ['Open', 'Assigned', 'In Progress', 'Testing'];
            this.pickVals = this.allStatuses.filter(s => allowedDev.includes(s));
        } else {
            // Other profiles in My Tasks / My Today Tasks:
            // Open, In Progress, Completed
            const allowed = ['Open', 'In Progress', 'Completed'];
            this.pickVals = this.allStatuses.filter(s => allowed.includes(s));
        }
    }

    checkUserType() {
        isInternalUser()
            .then(result => {
                this.isInternalUser = result;
                console.log('Is Internal User:', result);
            })
            .catch(error => {
                console.error('Error checking user type:', error);
                this.isInternalUser = false;
            });
    }




    get viewTypeOptions() {
        const opts = [
            { label: 'My Tasks', value: 'My_Tasks' },
            { label: 'My Today Tasks', value: 'My_Today_Tasks' }
        ];
        const profile = this.userProfileName;
        if (profile !== 'PMT Developer') {
            opts.splice(1, 0, { label: 'All Tasks', value: 'All_Tasks' });
        }
        return opts;
    }
    @wire(getObjectInfo, { objectApiName: TASKS_OBJECT })
    objectInfo;
    get userProfileName() {
        return this.currentUser?.data?.fields?.Profile?.value?.fields?.Name?.value || '';
    }
    get canCreateTask() {
        debugger;
        return this.objectInfo?.data?.createable;
    }
    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: STATUS_FIELD
    })
    statusPicklistValues({ data, error }) {
        if (data) {
            this.allStatuses = data.values.map(item => item.value);
            this.updateStagesForView();
        }
        if (error) {
            console.error(error);
        }
    }
    @wire(getKanbanTasks, { viewType: '$viewType' })
    wiredKanbanTasks(result) {
        debugger;
        this.wiredData = result;
        const { data, error } = result;
        if (data) {
            this.records = data
                .filter(item => item.Status__c)
                .map(item => ({
                    Id: item.Id,
                    Name: item.Name || '',
                    recordUrl: item.Id ? '/' + item.Id : '',
                    Status__c: item.Status__c || '',
                    Priority__c: item.Priority__c || '',
                    Start_Date__c: item.Start_Date__c || '',
                    End_Date__c: item.End_Date__c || ''
                }));
        }
        if (error) {
            console.error(error);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Failed to load tasks for the selected view',
                    variant: 'error'
                })
            );
        }
    }
    
    /* ============================
       FETCH PICKLIST VALUES
    ============================ */
    
    /* ============================
       VIEW SWITCH LOGIC
    ============================ */
    get isKanbanView() {
        return this.viewMode === 'kanban';
    }
    get isListView() {
        return this.viewMode === 'list';
    }
    get kanbanVariant() {
        return this.viewMode === 'kanban' ? 'brand' : 'neutral';
    }
    get listVariant() {
        return this.viewMode === 'list' ? 'brand' : 'neutral';
    }
    showKanban() {
        this.viewMode = 'kanban';
    }
    showList() {
        this.viewMode = 'list';
    }
    handleViewTypeChange(event) {
        this.viewType = event.detail.value;
        this.updateStagesForView();
    }
    handleSearchChange(event) {
        this.searchKey = event.target.value;
    }
    get visibleRecords() {
        debugger;
        if (!Array.isArray(this.records)) {
            return this.records;
        }
        const key = (this.searchKey || '').trim().toLowerCase();
        if (!key) {
            return this.records;
        }
        return this.records.filter(r => {
            const name = (r.Name || '').toLowerCase();
            const priority = (r.Priority__c || '').toLowerCase();
            const status = (r.Status__c || '').toLowerCase();
            return name.includes(key) || priority.includes(key) || status.includes(key);
        });
    }
    get visibleCount() {
        return Array.isArray(this.visibleRecords) ? this.visibleRecords.length : 0;
    }
    getCountForStage(stage) {
        if (!Array.isArray(this.visibleRecords)) {
            return 0;
        }
        return this.visibleRecords.filter(r => r.Status__c === stage).length;
    }
    get stagesWithCounts() {
        if (!Array.isArray(this.pickVals)) {
            return [];
        }
        return this.pickVals.map(stage => ({
            value: stage,
            count: this.getCountForStage(stage)
        }));
    }
    /* ============================
       EXPORT PDF DIALOG
    ============================ */
    get exportStatusOptions() {
        const options = [{ label: 'All', value: 'All' }];
        if (Array.isArray(this.pickVals)) {
            this.pickVals.forEach(stage => {
                options.push({ label: `Only ${stage}`, value: stage });
            });
        }
        return options;
    }
    exportToPdf() {
        try {
            if (!this.isKanbanView) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Info',
                        message: 'Switch to Kanban view to export',
                        variant: 'info'
                    })
                );
                return;
            }
            this.showExportDialog = true;
        } catch (e) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: e?.message || 'Failed to open export dialog',
                    variant: 'error'
                })
            );
        }
    }
    handleExportStatusChange(event) {
        this.selectedExportStatus = event.detail.value;
    }
    handleCancelExport() {
        this.showExportDialog = false;
        this.selectedExportStatus = 'All';
    }
    handleConfirmExport() {
        try {
            const html = this.buildPrintHtml(this.selectedExportStatus);
            
            // Debug: check if we have data
            console.log('Selected Status:', this.selectedExportStatus);
            console.log('HTML length:', html.length);
            console.log('Records:', this.visibleRecords);
            
            // Create a new window and write directly (simple approach)
            const printWindow = window.open('', '_blank', 'width=1200,height=800');
            
            if (!printWindow) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Popup blocked',
                        message: 'Please allow popups to export PDF',
                        variant: 'warning'
                    })
                );
                return;
            }
            
            // Write the HTML content
            printWindow.document.write(html);
            printWindow.document.close();
            
            // Wait for content to load then print
            printWindow.onload = function() {
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                }, 250);
            };
            
            this.showExportDialog = false;
            this.selectedExportStatus = 'All';
        } catch (e) {
            console.error('Export error:', e);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: e?.message || 'Failed to export PDF',
                    variant: 'error'
                })
            );
        }
    }
    escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    formatDateForPrint(value) {
        if (!value) {
            return '';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(date);
    }
    buildPrintHtml(filterStatus) {
        const title = 'Kanban Board';
        const stages = Array.isArray(this.pickVals) ? this.pickVals.map(stage => ({
            value: stage,
            count: 0
        })) : [];
        
        // Use this.records directly, not visibleRecords
        const allRecords = Array.isArray(this.records) ? this.records : [];
        
        console.log('All records:', allRecords);
        console.log('Filter status:', filterStatus);
        
        // Apply search filter if exists
        let records = allRecords;
        if (this.searchKey) {
            const key = this.searchKey.trim().toLowerCase();
            records = allRecords.filter(r => {
                const name = (r.Name || '').toLowerCase();
                const priority = (r.Priority__c || '').toLowerCase();
                const status = (r.Status__c || '').toLowerCase();
                return name.includes(key) || priority.includes(key) || status.includes(key);
            });
        }
        
        // Filter records based on selected status
        const filteredRecords = filterStatus === 'All' 
            ? records 
            : records.filter(r => r.Status__c === filterStatus);
        
        console.log('Filtered records:', filteredRecords);
        
        // Filter stages based on selected status
        const filteredStages = filterStatus === 'All' 
            ? stages 
            : stages.filter(s => s.value === filterStatus);
        
        const stageToRecords = new Map();
        filteredStages.forEach(s => stageToRecords.set(s.value, []));
        filteredRecords.forEach(r => {
            const stage = r.Status__c;
            if (stageToRecords.has(stage)) {
                stageToRecords.get(stage).push(r);
            }
        });
        
        const columnsHtml = filteredStages.map(col => {
            const colRecords = stageToRecords.get(col.value) || [];
            const cardsHtml = colRecords.length
                ? colRecords.map(r => {
                    const name = this.escapeHtml(r.Name);
                    const priority = this.escapeHtml(r.Priority__c || '');
                    const start = this.escapeHtml(this.formatDateForPrint(r.Start_Date__c));
                    const end = this.escapeHtml(this.formatDateForPrint(r.End_Date__c));
                    const status = this.escapeHtml(r.Status__c);
                    const priorityClass = `priority-${this.escapeHtml(r.Priority__c || '')}`;
                    return `<div class="task-card"><div class="card-content"><div class="card-header"><div class="task-title">${name}</div><div class="card-actions"><div class="task-priority ${priorityClass}">${priority}</div></div></div><div class="card-details"><div class="task-status">Status: ${status}</div>${start ? `<div class="task-date">Start: ${start}</div>` : ``}${end ? `<div class="task-date">End: ${end}</div>` : ``}</div></div></div>`;
                }).join('')
                : `<div class="empty-state"><div class="empty-text">No tasks</div></div>`;
            return `<section class="stageContainer"><div class="column_heading"><span class="column_headingText">${this.escapeHtml(col.value)}</span><span class="countPill">${colRecords.length}</span></div><div class="drop-zone">${cardsHtml}</div></section>`;
        }).join('');
        
        const timestamp = new Date().toLocaleString();
        const filterLabel = filterStatus === 'All' ? 'All Tasks' : `${filterStatus} Tasks`;
        
        return `<!doctype html><html><head><meta charset="utf-8"/><title>${this.escapeHtml(title)}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#fff;color:#0f172a;padding:20px}.page-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:20px}.page-title{font-size:18px;font-weight:bold}.page-subtitle{font-size:12px;color:#64748b}.board{display:flex;gap:16px;width:100%}.stageContainer{flex:1;min-width:250px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}.column_heading{padding:12px;font-size:14px;font-weight:bold;background:#2563eb;color:#fff;display:flex;justify-content:space-between;align-items:center}.countPill{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:20px;padding:0 8px;border-radius:10px;font-size:11px;background:rgba(255,255,255,0.2)}.drop-zone{padding:12px;min-height:60px}.task-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;border-left:3px solid #3b82f6}.task-title{font-size:13px;font-weight:600;margin-bottom:8px;color:#1e293b}.task-priority{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold;text-transform:uppercase}.priority-High{background:#fee;color:#dc2626}.priority-Medium{background:#fef3c7;color:#d97706}.priority-Low{background:#dcfce7;color:#16a34a}.card-details{margin-top:8px;font-size:11px;color:#64748b}.task-status{font-weight:500;margin-bottom:4px}.task-date{color:#94a3b8}.empty-state{text-align:center;padding:40px 20px;color:#94a3b8}.empty-text{font-size:12px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:landscape;margin:10mm}}</style></head><body><div class="page-header"><h1 class="page-title">${this.escapeHtml(title)} - ${this.escapeHtml(filterLabel)}</h1><div class="page-subtitle">Exported: ${this.escapeHtml(timestamp)} | Tasks: ${filteredRecords.length}</div></div><main class="board">${columnsHtml}</main></body></html>`;
    }
    /* ============================
       DATATABLE COLUMNS
    ============================ */
    columns = [
        {
        label: 'Name',
        fieldName: 'recordUrl',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'Name' },
            target: '_blank' 
        }
    },
        { label: 'Status', fieldName: 'Status__c' },
        { label: 'Priority', fieldName: 'Priority__c' },
        { label: 'Start Date', fieldName: 'Start_Date__c', type: 'date' },
        { label: 'End Date', fieldName: 'End_Date__c', type: 'date' }
    ];
    /* ============================
       DRAG EVENTS
    ============================ */
    handleListItemDrag(event) {
        this.recordId = event.detail;
    }
    handleItemDrop(event) {
        let status = event.detail;
        this.updateHandler(status);
    }
    handleMoveNext(event) {
        const recordId = event.detail?.recordId;
        const currentStage = event.detail?.currentStage;
        if (!recordId || !currentStage || !Array.isArray(this.pickVals) || this.pickVals.length === 0) {
            return;
        }
        const idx = this.pickVals.indexOf(currentStage);
        if (idx < 0) {
            return;
        }
        if (idx >= this.pickVals.length - 1) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Info',
                    message: 'This task is already in the last stage',
                    variant: 'info'
                })
            );
            return;
        }
        const nextStage = this.pickVals[idx + 1];
        this.recordId = recordId;
        this.updateHandler(nextStage);
    }
    /* ============================
       UPDATE RECORD
    ============================ */
    updateHandler(status) {
        updateTaskStatusWithChecks({ taskId: this.recordId, newStatus: status })
            .then(() => {
                this.showToast();
                return refreshApex(this.wiredData);
            })
            .catch(error => {
                console.error(error);
                let message = 'Something went wrong';
                if (error && error.body && error.body.message) {
                    message = error.body.message;
                } else if (error && error.message) {
                    message = error.message;
                }
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: message,
                        variant: 'error'
                    })
                );
            });
    }
    /* ============================
       SUCCESS TOAST
    ============================ */
    showToast() {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Status updated Successfully',
                variant: 'success'
            })
        );
    }

    handleAdd(event) {
        debugger;
        const recordId = event.currentTarget.dataset.id;
        if (this.isInternalUser) {
                const compDefinition = {
                    componentDef: 'c:newTask',
                    attributes: {
                        recordId: recordId
                    }
                };
                const encodedDef = btoa(JSON.stringify(compDefinition));
                window.open('/one/one.app#' + encodedDef, '_blank');
            } else {
                const url = `/s/new-task?recordId=${recordId}`;
                window.open(url, '_blank');
            }

    }
}