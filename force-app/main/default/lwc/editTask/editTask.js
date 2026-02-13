import { LightningElement, track, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from 'lightning/actions';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getRecord } from 'lightning/uiRecordApi';
import { NavigationMixin } from 'lightning/navigation';

import TASK_OBJECT from '@salesforce/schema/Tasks__c';
import BillType from '@salesforce/schema/Tasks__c.Billing_Type__c';
import Priority from '@salesforce/schema/Tasks__c.Priority__c';

import getTaskDetails from '@salesforce/apex/EditTaskController.getTaskDetails';
import updateTaskWithOwners from '@salesforce/apex/EditTaskController.updateTaskWithOwners';
import uploadFile from '@salesforce/apex/EditTaskController.uploadFile'; 
import getMilestonesByProject from '@salesforce/apex/taskController.getMilestonesByProject';
import getTaskListsByMilestone from '@salesforce/apex/taskController.getTaskListsByMilestone';

const ALLOC_STANDARD = 'Standard';
const ALLOC_FLEXIBLE = 'Flexible';

export default class EditTask extends NavigationMixin(LightningElement) {
    @api recordId;
    @track task = null;
    @track isLoading = true;
    @track billingOptions;
    @track priorityOptions;
    todayDate;

    originalTaskId;
    isComponentLoaded = false;
    initialTeamMembersLoaded = false;

    connectedCallback() {
        const now = new Date();
        this.todayDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }).format(now);

        if (this.recordId) {
            this.originalTaskId = this.recordId;
            this.loadTaskData();
        } else {
            this.showToast('Error', 'No Task ID provided', 'error');
            this.isLoading = false;
        }
    }

    @wire(getObjectInfo, { objectApiName: TASK_OBJECT })
    taskInfo;

    @wire(getPicklistValues, { recordTypeId: '$taskInfo.data.defaultRecordTypeId', fieldApiName: BillType })
    BillingInfo({ data }) {
        if (data) {
            this.billingOptions = data.values;
        }
    }

    @wire(getPicklistValues, { recordTypeId: '$taskInfo.data.defaultRecordTypeId', fieldApiName: Priority })
    priorityInfo({ data }) {
        if (data) {
            this.priorityOptions = data.values;
        }
    }

    loadTaskData() {
        this.isLoading = true;
        getTaskDetails({ taskId: this.recordId })
            .then(result => {
                // Build the task object
                this.task = {
                    id: result.taskRecord.Id,
                    taskName: result.taskRecord.Name || '',
                    project: result.taskRecord.Associated_Project__c || null,
                    milestone: result.taskRecord.Milestone__c || null,
                    taskList: result.taskRecord.Task_List__c || null,
                    priority: result.taskRecord.Priority__c || '',
                    billingType: result.taskRecord.Billing_Type__c || '',
                    startDate: result.taskRecord.Start_Date__c || '',
                    endDate: result.taskRecord.End_Date__c || '',
                    workHours: result.taskRecord.Work_Hours__c || '',
                    comments: result.taskRecord.Comment__c || '',
                    
                    // Team Members
                    teamMembers: result.teamMembers || [],
                    teamMembersForChild: (result.teamMembers || []).map(member => ({
                        Id: member.Id,
                        Email: member.Name,
                        Name: member.Name
                    })),
                    
                    // *** ADD FILES ***
                    files: (result.attachedFiles || []).map(file => ({
                        documentId: file.documentId,
                        fileName: file.fileName,
                        fileType: file.fileType,
                        fileSize: file.fileSize,
                        versionId: file.versionId,
                        fileSizeFormatted: this.formatFileSize(file.fileSize),
                        icon: this.getFileIcon(file.fileType)
                    })),
                    
                    // Options
                    milestoneOptions: [],
                    taskListOptions: [],
                    milestoneDisabled: !result.taskRecord.Associated_Project__c,
                    taskListDisabled: !result.taskRecord.Milestone__c,
                    endDateDisabled: !result.taskRecord.Start_Date__c,
                    workHoursDisabled: false,
                    minEndDate: result.taskRecord.Start_Date__c || this.todayDate,
                    
                    // Allocation
                    showAllocation: false,
                    allocationMode: ALLOC_STANDARD,
                    isFlexible: false,
                    workHoursReadOnly: true,
                    isAllocOpen: false,
                    dateColumns: [],
                    dayTotals: [],
                    allocationRows: []
                };

                // Load dependent picklists
                if (this.task.project) {
                    this.fetchMilestones(this.task.project);
                }
                if (this.task.milestone) {
                    this.fetchTaskLists(this.task.milestone);
                }

                // Check if we have existing allocations
                if (result.allocations && result.allocations.length > 0) {
                    // Flexible mode detected
                    this.task.isAllocOpen = true;
                    this.task.isFlexible = true;
                    this.task.workHoursReadOnly = false;
                    this.task.allocationMode = ALLOC_FLEXIBLE;
                    
                    // Load existing allocations
                    this.loadExistingAllocations(result.allocations);
                } else {
                    // Standard mode
                    this.task.isFlexible = false;
                    this.task.workHoursReadOnly = true;
                }

                this.isLoading = false;
                
                // Set flag after a short delay to ensure component is fully rendered
                setTimeout(() => {
                    this.isComponentLoaded = true;
                    this.initialTeamMembersLoaded = true;
                }, 500);
            })
            .catch(error => {
                console.error('Error loading task:', error);
                this.showToast('Error', 'Failed to load task data', 'error');
                this.isLoading = false;
            });
    }

    // **********************************************FILE UPLOAD**************************

    get hasFiles() {
        return this.task && this.task.files && this.task.files.length > 0;
    }

    get fileCount() {
        return this.task && this.task.files ? this.task.files.length : 0;
    }

    handleUploadFiles() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt,.zip';
    
    fileInput.onchange = (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            this.uploadFilesToSalesforce(files);
        }
    };
    
    fileInput.click();
}

uploadFilesToSalesforce(files) {
    const maxSize = 25 * 1024 * 1024; // 25MB
    let uploadCount = 0;
    let errorCount = 0;

    // Show loading toast
    this.showToast('Info', `Uploading ${files.length} file(s)...`, 'info');

    Array.from(files).forEach((file) => {
        if (file.size > maxSize) {
            this.showToast('Error', `${file.name} exceeds 25MB limit`, 'error');
            errorCount++;
            return;
        }

        const reader = new FileReader();
        
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            
            // Upload to Salesforce
            uploadFile({ 
                fileName: file.name, 
                base64Data: base64, 
                contentType: file.type,
                taskId: this.originalTaskId 
            })
            .then(documentId => {
                uploadCount++;
                
                // Add to task files array with REAL documentId
                const newFile = {
                    documentId: documentId,
                    fileName: file.name,
                    fileType: this.getFileExtension(file.name),
                    fileSize: file.size,
                    fileSizeFormatted: this.formatFileSize(file.size),
                    icon: this.getFileIcon(this.getFileExtension(file.name))
                };

                if (!this.task.files) {
                    this.task.files = [];
                }
                this.task.files = [...this.task.files, newFile];
                this.task = { ...this.task };
                
                // Show success when all done
                if (uploadCount + errorCount === files.length) {
                    if (uploadCount > 0) {
                        this.showToast('Success', `${uploadCount} file(s) uploaded successfully`, 'success');
                    }
                }
            })
            .catch(error => {
                errorCount++;
                console.error('Upload error:', error);
                this.showToast('Error', `Failed to upload ${file.name}`, 'error');
                
                if (uploadCount + errorCount === files.length) {
                    if (uploadCount > 0) {
                        this.showToast('Info', `${uploadCount} file(s) uploaded, ${errorCount} failed`, 'info');
                    }
                }
            });
        };
        
        reader.onerror = () => {
            errorCount++;
            this.showToast('Error', `Failed to read ${file.name}`, 'error');
        };
        
        reader.readAsDataURL(file);
    });
}

getFileExtension(fileName) {
    return fileName.split('.').pop().toLowerCase();
}
// *******************************

    uploadFiles(files) {
        const maxSize = 25 * 1024 * 1024; // 25MB
        const uploadPromises = [];

        for (let file of files) {
            if (file.size > maxSize) {
                this.showToast('Error', `${file.name} exceeds 25MB limit`, 'error');
                continue;
            }

            const reader = new FileReader();
            const uploadPromise = new Promise((resolve, reject) => {
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1];
                    const contentVersion = {
                        Title: file.name,
                        PathOnClient: file.name,
                        VersionData: base64,
                        FirstPublishLocationId: this.originalTaskId
                    };
                    
                    // Use Salesforce's standard file upload (you'll need to create apex method or use standard API)
                    // For now, we'll simulate by adding to the files array
                    this.addFileToTask(file, base64);
                    resolve();
                };
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });

            uploadPromises.push(uploadPromise);
        }

        Promise.all(uploadPromises)
            .then(() => {
                this.showToast('Success', 'Files uploaded successfully', 'success');
            })
            .catch(error => {
                console.error('Upload error:', error);
                this.showToast('Error', 'Failed to upload files', 'error');
            });
    }

    addFileToTask(file, base64Data) {
        // This is a simplified version - you'll need proper ContentVersion creation
        const newFile = {
            documentId: 'temp_' + Date.now(), // Temporary ID
            fileName: file.name,
            fileType: file.type.split('/')[1] || 'unknown',
            fileSize: file.size,
            fileSizeFormatted: this.formatFileSize(file.size),
            icon: this.getFileIcon(file.type.split('/')[1]),
            base64Data: base64Data // Store for later upload
        };

        if (!this.task.files) {
            this.task.files = [];
        }
        this.task.files = [...this.task.files, newFile];
        this.task = { ...this.task };
    }

    handlePreviewFile(event) {
    const documentId = event.currentTarget.dataset.id;

    this[NavigationMixin.Navigate]({
        type: 'standard__namedPage',
        attributes: {
            pageName: 'filePreview'
        },
        state: {
            selectedRecordId: documentId
        }
    });
}

    handleRemoveFile(event) {
    const documentId = event.currentTarget.dataset.id;
    
    if (!confirm('Are you sure you want to remove this file?')) {
        return;
    }

    // Remove from UI immediately
    this.task.files = this.task.files.filter(f => f.documentId !== documentId);
    this.task = { ...this.task };
    
    // Delete from Salesforce (optional - files will be orphaned but not linked to task)
    // If you want to actually delete the file, you'll need to create a delete apex method
    
    this.showToast('Success', 'File removed', 'success');
}

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    getFileIcon(fileType) {
        const iconMap = {
            'pdf': 'doctype:pdf',
            'doc': 'doctype:word',
            'docx': 'doctype:word',
            'xls': 'doctype:excel',
            'xlsx': 'doctype:excel',
            'png': 'doctype:image',
            'jpg': 'doctype:image',
            'jpeg': 'doctype:image',
            'gif': 'doctype:image',
            'txt': 'doctype:txt',
            'zip': 'doctype:zip'
        };
        return iconMap[fileType?.toLowerCase()] || 'doctype:attachment';
    }

    // *****************************************************************************************

    loadExistingAllocations(allocations) {
        if (!this.task.startDate || !this.task.endDate) return;

        // Build date columns
        this.task.dateColumns = this.buildDateColumns(this.task.startDate, this.task.endDate);

        // Group allocations by user
        const allocationsByUser = new Map();
        allocations.forEach(alloc => {
            const userId = alloc.Resource__c;
            if (!allocationsByUser.has(userId)) {
                allocationsByUser.set(userId, []);
            }
            allocationsByUser.get(userId).push(alloc);
        });

        // Build allocation rows
        this.task.allocationRows = this.task.teamMembers.map(member => {
            const userAllocations = allocationsByUser.get(member.Id) || [];
            
            const cells = this.task.dateColumns.map(col => {
                const existingAlloc = userAllocations.find(a => {
                    const allocDate = new Date(a.Date__c);
                    const colDate = new Date(col.date);
                    return allocDate.getTime() === colDate.getTime();
                });

                const hours = existingAlloc ? existingAlloc.Allocated_Hours__c : (col.isWeekend ? 0 : 8);
                const pct = (hours / 8) * 100;

                return {
                    date: col.date,
                    hours: hours,
                    percent: `${Math.round(pct)}%`,
                    badgeClass: this.getBadgeClass(pct)
                };
            });

            const total = cells.reduce((sum, c) => sum + (c.hours || 0), 0);

            return {
                userId: member.Id,
                userName: member.Name,
                initials: this.getInitials(member.Name),
                name: member.Name,
                total: +total.toFixed(2),
                cells: cells
            };
        });

        this.recalcTotals();
        this.linkVerticalScroll();
    }

    fetchMilestones(projectId) {
        getMilestonesByProject({ projectId })
            .then(result => {
                const milestoneOptions = (result || []).map(m => ({ label: m.Name, value: m.Id }));
                this.task.milestoneOptions = milestoneOptions;
                this.task.milestoneDisabled = milestoneOptions.length === 0;
                this.task = { ...this.task };

                if (milestoneOptions.length === 0) {
                    this.showToast('Info', 'No milestones found for this project', 'info');
                }
            })
            .catch(error => {
                console.error('Error fetching milestones:', error);
                this.showToast('Error', 'Error loading milestones', 'error');
            });
    }

    fetchTaskLists(milestoneId) {
        getTaskListsByMilestone({ milestoneId })
            .then(result => {
                const taskListOptions = (result || []).map(tl => ({ label: tl.Name, value: tl.Id }));
                this.task.taskListOptions = taskListOptions;
                this.task.taskListDisabled = taskListOptions.length === 0;
                this.task = { ...this.task };

                if (taskListOptions.length === 0) {
                    this.showToast('Info', 'No task lists found for this milestone', 'info');
                }
            })
            .catch(error => {
                console.error('Error fetching task lists:', error);
                this.showToast('Error', 'Error loading task lists', 'error');
            });
    }

    handleInputChange(event) {
        const fieldName = event.target.name;
        const value = event.target.value;
        this.task[fieldName] = value;
        this.task = { ...this.task };
    }

    handleComboboxChange(event) {
        const fieldName = event.target.name;
        const value = event.detail.value;
        this.task[fieldName] = value;
        this.task = { ...this.task };
    }

    handleProjectChange(event) {
        const projectId = event.detail?.recordId || null;

        if (!projectId) {
            this.task.project = null;
            this.task.milestone = null;
            this.task.taskList = null;
            this.task.milestoneOptions = [];
            this.task.taskListOptions = [];
            this.task.milestoneDisabled = true;
            this.task.taskListDisabled = true;
            this.task = { ...this.task };
            return;
        }

        this.task.project = projectId;
        this.task.milestone = null;
        this.task.taskList = null;
        this.task.milestoneOptions = [];
        this.task.taskListOptions = [];
        this.task.milestoneDisabled = false;
        this.task.taskListDisabled = true;
        this.task = { ...this.task };

        this.fetchMilestones(projectId);
    }

    handleMilestoneChange(event) {
        const milestoneId = event.detail.value;

        this.task.milestone = milestoneId;
        this.task.taskList = '';
        this.task.taskListOptions = [];
        this.task.taskListDisabled = !milestoneId;
        this.task = { ...this.task };

        if (milestoneId) {
            this.fetchTaskLists(milestoneId);
        }
    }

    handleTaskListChange(event) {
        const taskListId = event.detail.value;
        this.task.taskList = taskListId;
        this.task = { ...this.task };
    }

    handleTeamMembersChange(event) {
        debugger; // Debug point for team member changes
        
        const selectedRecords = event.detail.selRecords || [];

        // IMPORTANT: Skip confirmation on initial load
        if (!this.isComponentLoaded || !this.initialTeamMembersLoaded) {
            console.log('*** Initial load - skipping confirmation');
            
            // Update team members without confirmation
            const unique = new Map();
            selectedRecords.forEach(r => unique.set(r.recId, r));

            this.task.teamMembers = [...unique.values()].map(record => ({
                Id: record.recId,
                UserName: record.recName,
                Name: record.name || record.recName
            }));

            this.task.teamMembersForChild = this.task.teamMembers.map(member => ({
                Id: member.Id,
                Email: member.UserName,
                Name: member.Name
            }));

            if (this.task.startDate && this.task.endDate) {
                const users = (this.task.teamMembers && this.task.teamMembers.length)
                    ? this.task.teamMembers.length
                    : 1;

                const hours = this.calculateWorkHours(
                    this.task.startDate,
                    this.task.endDate,
                    users
                );

                this.task.workHours = hours;
                this.task.workHoursDisabled = false;
            }

            this.task = { ...this.task };
            this.initOrRecalcAllocation();
            return;
        }

        // Get current team member IDs
        const currentMemberIds = new Set((this.task.teamMembers || []).map(m => m.Id));
        
        // Get new team member IDs
        const unique = new Map();
        selectedRecords.forEach(r => unique.set(r.recId, r));
        const newMemberIds = new Set([...unique.keys()]);
        
        // Find removed members
        const removedMembers = [];
        currentMemberIds.forEach(id => {
            if (!newMemberIds.has(id)) {
                const member = this.task.teamMembers.find(m => m.Id === id);
                if (member) {
                    removedMembers.push(member);
                }
            }
        });
        
        // If members are being removed, show confirmation
        if (removedMembers.length > 0) {
            const memberNames = removedMembers.map(m => m.Name).join(', ');
            const confirmMessage = `Are you sure you want to remove ${memberNames} from this task? This will also delete their resource allocation records.`;
            
            // Use LightningConfirm for better UX (if available), otherwise use native confirm
            if (!confirm(confirmMessage)) {
                // User cancelled - don't update
                console.log('*** User cancelled team member removal');
                return;
            }
            console.log('*** User confirmed removal of: ' + memberNames);
        }

        // Update team members
        this.task.teamMembers = [...unique.values()].map(record => ({
            Id: record.recId,
            UserName: record.recName,
            Name: record.name || record.recName
        }));

        this.task.teamMembersForChild = this.task.teamMembers.map(member => ({
            Id: member.Id,
            Email: member.UserName,
            Name: member.Name
        }));

        if (this.task.startDate && this.task.endDate) {
            const users = (this.task.teamMembers && this.task.teamMembers.length)
                ? this.task.teamMembers.length
                : 1;

            const hours = this.calculateWorkHours(
                this.task.startDate,
                this.task.endDate,
                users
            );

            this.task.workHours = hours;
            this.task.workHoursDisabled = false;
        }

        this.task = { ...this.task };
        this.initOrRecalcAllocation();
    }

    handleStartDateChange(event) {
        const startDate = event.target.value;

        if (startDate < this.todayDate) {
            this.showToast('Error', 'Start Date cannot be in the past', 'error');
            event.target.value = '';
            return;
        }

        this.task.startDate = startDate;
        this.task.minEndDate = startDate;
        this.task.endDateDisabled = !startDate;
        this.task.endDate = '';
        this.task.workHours = '';
        this.task.workHoursDisabled = true;
        this.task.showAllocation = false;
        this.task.dateColumns = [];
        this.task.dayTotals = [];
        this.task.allocationRows = [];
        this.task.isAllocOpen = false;
        this.task = { ...this.task };
    }

    handleEndDateChange(event) {
        const newEndDate = event.target.value;

        const start = new Date(this.task.startDate);
        const end = new Date(newEndDate);
        const today = new Date(this.todayDate);

        if (this.task.startDate && end < start) {
            this.showToast('Error', 'End Date cannot be earlier than Start Date', 'error');
            this.task.endDate = '';
            this.task.workHours = '';
            this.task.workHoursDisabled = true;
            this.task.showAllocation = false;
            this.task.dateColumns = [];
            this.task.dayTotals = [];
            this.task.allocationRows = [];
            this.task = { ...this.task };
            return;
        }

        if (end < today) {
            this.showToast('Error', 'End Date cannot be in the past', 'error');
            this.task.endDate = '';
            this.task.workHours = '';
            this.task.workHoursDisabled = true;
            this.task.showAllocation = false;
            this.task.dateColumns = [];
            this.task.dayTotals = [];
            this.task.allocationRows = [];
            this.task = { ...this.task };
            return;
        }

        const numberOfUsers = (this.task.teamMembers && this.task.teamMembers.length)
            ? this.task.teamMembers.length
            : 1;

        const workHours = this.calculateWorkHours(
            this.task.startDate,
            newEndDate,
            numberOfUsers
        );

        this.task.endDate = newEndDate;
        this.task.workHours = workHours;
        this.task.workHoursDisabled = false;
        this.task = { ...this.task };

        this.initOrRecalcAllocation();
    }

    calculateWorkHours(startDate, endDate, numberOfUsers) {
        if (!startDate || !endDate) return '';
        const s = new Date(`${startDate}T00:00:00Z`);
        const e = new Date(`${endDate}T00:00:00Z`);
        if (e < s) return '';

        let weekdays = 0;
        for (let d = new Date(s); d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
            const day = d.getUTCDay();
            if (day !== 0 && day !== 6) weekdays++;
        }
        const users = numberOfUsers > 0 ? numberOfUsers : 1;
        return 8 * weekdays * users;
    }

    handleCommentChange(event) {
        const value = event.target.value;
        this.task.comments = value;
        this.task = { ...this.task };
    }

    handleToggleAlloc() {
        debugger; // Debug point for allocation toggle
        const eligible = !!(this.task.startDate && this.task.endDate && this.task.teamMembers && this.task.teamMembers.length);

        if (!this.task.isAllocOpen) {
            if (!eligible) {
                this.showToast('Info', 'Select Start Date, End Date and Team Members to adjust daily hours', 'info');
                return;
            }
            this.task.isAllocOpen = true;
            this.task.allocationMode = ALLOC_FLEXIBLE;
            this.task.isFlexible = true;
            this.task.workHoursReadOnly = false;

            this.initOrRecalcAllocation();
        } else {
            this.task.isAllocOpen = false;
            this.task.allocationMode = ALLOC_STANDARD;
            this.task.isFlexible = false;
            this.task.workHoursReadOnly = true;

            this.distributeStandard();
            this.recalcTotals();
        }

        this.task = { ...this.task };
        this.linkVerticalScroll();
    }

    handleCellHoursChange(event) {
        const uIndex = parseInt(event.target.dataset.userindex, 10);
        const dIndex = parseInt(event.target.dataset.dateindex, 10);

        let raw = String(event.target.value || '');
        raw = raw.replace(/[^0-9.]/g, '');
        if ((raw.match(/\./g) || []).length > 1) {
            raw = raw.replace(/\.+/g, '.');
        }
        let val = parseFloat(raw);
        if (isNaN(val) || val < 0) {
            val = 0;
            this.showToast('Warning', 'Only numbers are allowed. Symbols are not permitted.', 'warning');
        }
        if (val > 12) {
            val = 12;
            this.showToast('Warning', 'Work hour should be 12 (max). Value adjusted to 12.', 'warning');
        }

        if (!this.task.isFlexible) return;

        this.task.allocationRows[uIndex].cells[dIndex].hours = val;
        event.target.value = val;
    }

    handleCellHoursBlur() {
        if (!this.task.isFlexible) return;

        this.recalcTotals();
        this.task = { ...this.task };
    }

    handleWorkHoursManualChange(event) {
        if (!this.task.isFlexible) {
            event.target.value = this.task.workHours;
            return;
        }

        let newTotal = parseFloat(event.target.value);
        if (isNaN(newTotal) || newTotal < 0) {
            newTotal = 0;
        }
        
        this.task.workHours = newTotal;
    }

    handleWorkHoursManualBlur(event) {
        if (!this.task.isFlexible) {
            event.target.value = this.task.workHours;
            return;
        }

        let newTotal = parseFloat(event.target.value);
        if (isNaN(newTotal) || newTotal < 0) newTotal = 0;

        this.scaleAllocationToTotal(newTotal);
        this.recalcTotals();
        this.task = { ...this.task };
    }

    initOrRecalcAllocation() {
        const datesReady = !!(this.task.startDate && this.task.endDate);
        const membersReady = (this.task.teamMembers && this.task.teamMembers.length > 0);

        this.task.showAllocation = datesReady && membersReady;
        if (!this.task.showAllocation) {
            this.task.dateColumns = [];
            this.task.dayTotals = [];
            this.task.allocationRows = [];
            this.task = { ...this.task };
            return;
        }

        this.task.dateColumns = this.buildDateColumns(this.task.startDate, this.task.endDate);

        const users = (this.task.teamMembers || []);
        const userIds = users.map(u => u.Id);
        const needRebuild = !this.task.allocationRows || this.task.allocationRows.length !== userIds.length;

        if (needRebuild) {
            if (this.task.allocationMode === ALLOC_FLEXIBLE) {
                this.distributeStandard();
                this.task.isFlexible = true;
                this.task.workHoursReadOnly = false;
            } else {
                this.distributeStandard();
                this.task.isFlexible = false;
                this.task.workHoursReadOnly = true;
            }
        } else if (this.task.isFlexible) {
            this.task.allocationRows.forEach(r => {
                const cells = [];
                this.task.dateColumns.forEach(col => {
                    const exist = (r.cells || []).find(c => c.date === col.date);
                    cells.push(
                        exist
                            ? { ...exist }
                            : (() => {
                                const h = col.isWeekend ? 0 : 8;
                                const pct = (h / 8) * 100;
                                return {
                                    date: col.date,
                                    hours: h,
                                    percent: `${Math.round(pct)}%`,
                                    badgeClass: this.getBadgeClass(pct)
                                };
                            })()
                    );
                });
                r.cells = cells;
            });
        }

        this.recalcTotals();
        this.task = { ...this.task };
        this.linkVerticalScroll();
    }

    buildDateColumns(startStr, endStr) {
        const cols = [];
        const s = new Date(`${startStr}T00:00:00Z`);
        const e = new Date(`${endStr}T00:00:00Z`);
        for (let d = new Date(s); d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
            const wd = d.getUTCDay();
            const isWeekend = (wd === 0 || wd === 6);
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            cols.push({
                date: `${y}-${m}-${day}`,
                label: `${day}/${m}/${y}`,
                isWeekend
            });
        }
        return cols;
    }

    distributeStandard() {
        const users = (this.task.teamMembers || []);
        const cols = this.task.dateColumns || [];
        this.task.allocationRows = users.map(u => ({
            userId: u.Id,
            userName: u.Name,
            initials: this.getInitials(u.Name),
            name: u.Name,
            hoursPerDay: 8,
            hoursPercent: '100%',
            hoursBadgeClass: 'badge-normal',
            total: 0,
            cells: cols.map(c => {
                const h = c.isWeekend ? 0 : 8;
                return {
                    date: c.date,
                    hours: h,
                    percent: `${Math.round((h / 8) * 100)}%`,
                    badgeClass: this.getBadgeClass((h / 8) * 100)
                };
            })
        }));

        this.task.isFlexible = false;
        this.task.workHoursReadOnly = true;
    }

    recalcTotals() {
        const cols = this.task.dateColumns || [];

        if (this.task.isFlexible) {
            this.task.allocationRows.forEach(r => {
                let sum = 0;
                r.cells.forEach(cell => {
                    let h = parseFloat(cell.hours);
                    if (isNaN(h) || h < 0) h = 0;
                    if (h > 12) h = 12;
                    cell.hours = +h.toFixed(2);

                    const pct = (cell.hours / 8) * 100;
                    cell.percent = `${Math.round(pct)}%`;
                    cell.badgeClass = this.getBadgeClass(pct);
                    sum += cell.hours || 0;
                });
                r.total = +sum.toFixed(2);
            });

            const dayTotals = cols.map((c, ci) => {
                let dt = 0;
                this.task.allocationRows.forEach(r => dt += (r.cells[ci]?.hours || 0));
                return { date: c.date, total: +dt.toFixed(2) };
            });
            this.task.dayTotals = dayTotals;

            const grand = this.task.allocationRows.reduce((acc, r) => acc + (r.total || 0), 0);
            this.task.workHours = +grand.toFixed(2);
        } else {
            this.task.allocationRows.forEach(r => {
                let sum = 0;
                r.cells.forEach(cell => sum += (cell.hours || 0));
                r.total = +sum.toFixed(2);
            });
            const grand = this.task.allocationRows.reduce((acc, r) => acc + (r.total || 0), 0);
            this.task.workHours = +grand.toFixed(2);
            this.task.dayTotals = [];
        }
    }

    scaleAllocationToTotal(newTotal) {
        const current = this.task.allocationRows.reduce((acc, r) => acc + (r.total || 0), 0);
        
        const weekdayCellsCount = this.task.allocationRows.reduce((acc, r) => {
            return acc + (r.cells?.filter(cell => {
                const dateColumn = this.task.dateColumns.find(col => col.date === cell.date);
                return dateColumn && !dateColumn.isWeekend;
            }).length || 0);
        }, 0);

        if (current <= 0) {
            const perWeekdayCell = weekdayCellsCount ? +(newTotal / weekdayCellsCount).toFixed(2) : 0;
            this.task.allocationRows.forEach(r => {
                r.cells.forEach(cell => {
                    const dateColumn = this.task.dateColumns.find(col => col.date === cell.date);
                    if (dateColumn && !dateColumn.isWeekend) {
                        cell.hours = perWeekdayCell;
                    } else {
                        cell.hours = 0;
                    }
                });
            });
        } else {
            const factor = newTotal / current;
            this.task.allocationRows.forEach(r => {
                r.cells.forEach(cell => {
                    const dateColumn = this.task.dateColumns.find(col => col.date === cell.date);
                    if (dateColumn && !dateColumn.isWeekend) {
                        cell.hours = +((cell.hours || 0) * factor).toFixed(2);
                    } else {
                        cell.hours = 0;
                    }
                });
            });
        }
    }

    getInitials(name) {
        if (!name) return '';
        const parts = name.trim().split(' ');
        const first = parts[0]?.charAt(0) || '';
        const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
        return (first + last).toUpperCase();
    }

    getBadgeClass(percent) {
        if (percent > 100) return 'badge-over';
        if (percent < 100) return 'badge-under';
        return 'badge-normal';
    }

    blockInvalidKeys(e) {
        const invalid = ['-', '+', 'e', 'E'];
        if (invalid.includes(e.key)) {
            e.preventDefault();
            return;
        }
        if (e.key === '.' && e.target.value?.includes('.')) {
            e.preventDefault();
        }
    }

    sanitizePaste(e) {
        e.preventDefault();
        let text = (e.clipboardData || window.clipboardData).getData('text') || '';
        text = text.replace(/[^0-9.]/g, '');
        const parts = text.split('.');
        if (parts.length > 2) {
            text = parts.shift() + '.' + parts.join('');
        }
        let val = parseFloat(text);
        if (isNaN(val) || val < 0) val = 0;
        if (val > 12) val = 12;
        e.target.value = val.toString();
        e.target.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true }));
    }

    linkVerticalScroll() {
        window.requestAnimationFrame(() => {
            const root = this.template.querySelector(`[data-alloc="0"]`);
            if (!root) return;

            const left = root.querySelector('.pane-left .users-scroll');
            const center = root.querySelector('.pane-center .users-scroll');
            const right = root.querySelector('.pane-right .users-scroll');

            const group = [left, center, right].filter(Boolean);
            let isSyncing = false;

            const sync = (src) => {
                if (isSyncing) return;
                isSyncing = true;
                group.forEach(el => { if (el !== src) el.scrollTop = src.scrollTop; });
                isSyncing = false;
            };

            group.forEach(el => {
                el.removeEventListener('scroll', el.__syncScrollHandler);
                el.__syncScrollHandler = () => sync(el);
                el.addEventListener('scroll', el.__syncScrollHandler, { passive: true });
            });
        });
    }

    handleUpdate() {
    const isValid = this.validateTask();
    if (!isValid) return;

    const taskData = {
        taskId: this.originalTaskId,
        taskName: this.task.taskName,
        priority: this.task.priority,
        project: this.task.project,
        milestone: this.task.milestone,
        taskList: this.task.taskList,
        billingType: this.task.billingType,
        startDate: this.task.startDate,
        endDate: this.task.endDate,
        workHours: this.task.workHours,
        comments: this.task.comments,
        teamMemberIds: this.task.teamMembers.map(member => member.Id)
        // NO NEED TO SEND FILES - they're already uploaded to Salesforce
    };

    // Add allocation data if in flexible mode
    if (this.task.isFlexible && this.task.allocationRows && this.task.allocationRows.length > 0) {
        taskData.allocationData = this.extractAllocationData();
    }

    updateTaskWithOwners({ taskDataJson: JSON.stringify(taskData) })
        .then(result => {
            this.showToast('Success', 'Task updated successfully', 'success');
            this.navigateToTaskRecord();
            this.closeModal();
        })
        .catch(error => {
            console.error('Error updating task:', error);
            const errorMessage = error.body?.message || 'An error occurred while updating task';
            this.showToast('Error', errorMessage, 'error');
        });
}


    extractAllocationData() {
        //debugger; // Debug point for allocation data extraction
        const allocationData = [];
        
        if (!this.task.allocationRows || this.task.allocationRows.length === 0) {
            return allocationData;
        }

        this.task.allocationRows.forEach(row => {
            const userId = row.userId;
            
            if (row.cells && row.cells.length > 0) {
                row.cells.forEach(cell => {
                    const hours = parseFloat(cell.hours);
                    
                    if (!isNaN(hours) && hours > 0) {
                        allocationData.push({
                            userId: userId,
                            allocationDate: cell.date,
                            hours: hours
                        });
                    }
                });
            }
        });

        return allocationData;
    }

    handleCancel() {
        this.navigateToTaskRecord();
        this.closeModal();
    }

    navigateToTaskRecord() {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.originalTaskId,
                objectApiName: 'Tasks__c',
                actionName: 'view'
            }
        });
    }

    validateTask() {
        if (!this.task.taskName) return this._err('Task Name is required');
        if (!this.task.project) return this._err('Project is required');
        if (!this.task.milestone) return this._err('Milestone is required');
        if (!this.task.taskList) return this._err('Task List is required');
        if (!this.task.teamMembers || this.task.teamMembers.length === 0) return this._err('At least one Team Member is required');
        if (!this.task.priority) return this._err('Priority is required');
        if (!this.task.billingType) return this._err('Billing Type is required');
        if (!this.task.startDate) return this._err('Start Date is required');
        if (!this.task.endDate) return this._err('End Date is required');
        return true;
    }

    _err(msg) {
        this.showToast('Error', msg, 'error');
        return false;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    closeModal() {
        this.dispatchEvent(new CloseActionScreenEvent());
    }
}