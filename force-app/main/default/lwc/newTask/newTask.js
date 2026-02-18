import { LightningElement, track, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from 'lightning/actions';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';
import TASK_OBJECT from '@salesforce/schema/Tasks__c';
import BillType from '@salesforce/schema/Tasks__c.Billing_Type__c';
import Priority from '@salesforce/schema/Tasks__c.Priority__c';

import saveTasksWithOwners from '@salesforce/apex/taskController.saveTasksWithOwners';
import getMilestonesByProject from '@salesforce/apex/taskController.getMilestonesByProject';
import getTaskListsByMilestone from '@salesforce/apex/taskController.getTaskListsByMilestone';
import resolveContext from '@salesforce/apex/taskController.resolveContext';

import { NavigationMixin } from 'lightning/navigation';

const ALLOC_STANDARD = 'Standard';
const ALLOC_FLEXIBLE = 'Flexible';

export default class NewTask extends NavigationMixin(LightningElement) {
    @track tasks = [];
    @track recordIdAvail = true;

    _parentId;
    _parentObject;

    @track endDateOnChange;
    @track selectedRecords;
    @track users;
    @track teamMembersArray;
    @track teamMembersForChild;
    @track workHours;

    @api
    get recordId() {
        return this._parentId;
    }
    set recordId(val) {
        this._parentId = val;
        if (val && this._parentObject) {
            this.resolveFromAura(val, this._parentObject);
        }
    }

    @track billingOptions;
    @track priorityOptions;
    defaultPriority;
    billableValue;
    nonBillableValue;
    todayDate;

    allocationModeOptions = [
        { label: 'Standard', value: ALLOC_STANDARD },
        { label: 'Flexible', value: ALLOC_FLEXIBLE }
    ];

    defaultContext = {
        projectId: null,
        milestoneId: null,
        taskListId: null
    };

    connectedCallback() {
        const now = new Date();
        this.todayDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }).format(now);

        // NEW: Get recordId from URL parameter (for Experience Site)
        const urlParams = new URLSearchParams(window.location.search);
        const recordIdFromUrl = urlParams.get('recordId');

        // Use URL parameter if available, otherwise use this._parentId
        const effectiveRecordId = recordIdFromUrl || this._parentId;

        if (effectiveRecordId) {
            this.resolveFromAura(effectiveRecordId);
        } else {
            this.addRow();
        }
    }

    resolveFromAura(parentId) {
        resolveContext({ recordId: parentId })
            .then((ctx) => {
                this.defaultContext = {
                    projectId: ctx?.projectId || null,
                    milestoneId: ctx?.milestoneId || null,
                    taskListId: ctx?.taskListId || null
                };
                this.tasks = [];
                this.addRow();
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('resolveContext error', error);
                this.defaultContext = { projectId: null, milestoneId: null, taskListId: null };
                this.tasks = [];
                this.addRow();
            });
    }

    @wire(getObjectInfo, { objectApiName: TASK_OBJECT })
    taskInfo;

    @wire(getPicklistValues, { recordTypeId: '$taskInfo.data.defaultRecordTypeId', fieldApiName: BillType })
    BillingInfo({ data }) {
        if (data) {
            this.billingOptions = data.values;

            const billable = data.values.find(item => item.label === 'Billable');
            const nonBillable = data.values.find(item => item.label === 'Non Billable' || item.label === 'Non-Billable');

            this.billableValue = billable ? billable.value : (data.values[0] && data.values[0].value);
            this.nonBillableValue = nonBillable ? nonBillable.value : this.billableValue;
        }
    }

    @wire(getPicklistValues, { recordTypeId: '$taskInfo.data.defaultRecordTypeId', fieldApiName: Priority })
    priorityInfo({ data }) {
        if (data) {
            this.priorityOptions = data.values;

            const medium = data.values.find(item => item.label === 'Medium');
            this.defaultPriority = medium ? medium.value : (data.values[0] && data.values[0].value);

            if (this.defaultPriority && this.tasks && this.tasks.length) {
                this.tasks = this.tasks.map(task => {
                    if (!task.priority) {
                        return { ...task, priority: this.defaultPriority };
                    }
                    return task;
                });
            }
        }
    }

    addRow() {
        const base = this._getRowSeedFromContextOrLastRow();
        const newIndex = this.tasks.length;

        const newTask = {
            id: Date.now() + newIndex,
            index: newIndex,
            displayIndex: newIndex + 1,
            isExpanded: true,
            isAllocOpen: false,
            taskName: '',
            project: base.projectId,
            milestone: base.milestoneId,
            taskList: base.taskListId,
            teamMembers: [],
            teamMembersForChild: [],
            workHours: '',
            priority: this.defaultPriority || '',
            billingType: this.billableValue || '',
            startDate: '',
            endDate: '',
            comments: '',
            issueBug: null,
            files: [],              // *** ADD THIS ***
            hasFiles: false,        // *** ADD THIS ***
            fileCount: 0,           // *** ADD THIS ***
            isFilesSectionOpen: true,  // *** ADD THIS - default to open ***
            fileToggleIcon: 'utility:chevronup',      // *** ADD THIS ***
            fileToggleTitle: 'Collapse Files',        // *** ADD THIS ***
            milestoneOptions: [],
            taskListOptions: [],
            milestoneDisabled: !base.projectId,
            taskListDisabled: !base.milestoneId,
            endDateDisabled: true,
            workHoursDisabled: true,
            minEndDate: this.todayDate,
            showAllocation: false,
            allocationMode: ALLOC_STANDARD,
            isFlexible: false,
            workHoursReadOnly: true,
            dateColumns: [],
            dayTotals: [],
            allocationRows: [],
            isBillable: true
        };

        this.tasks = [...this.tasks, newTask];

        const rowIndex = this.tasks.length - 1;
        if (base.projectId) {
            this.fetchMilestones(rowIndex, base.projectId);
        }
        if (base.milestoneId) {
            this.fetchTaskLists(rowIndex, base.milestoneId);
        }
    }

    resetProjectDependencies(task) {
        return {
            ...task,
            project: null,
            milestone: null,
            milestoneOptions: [],
            milestoneDisabled: true,
            taskList: null,
            taskListOptions: [],
            taskListDisabled: true,
            startDate: '',
            endDate: '',
            workHours: '',
            endDateDisabled: true,
            workHoursDisabled: true,
            showAllocation: false,
            dateColumns: [],
            allocationRows: []
        };
    }

    _getRowSeedFromContextOrLastRow() {
        if (this.tasks.length > 0) {
            const last = this.tasks[this.tasks.length - 1];
            return {
                projectId: last.project || null,
                milestoneId: last.milestone || null,
                taskListId: last.taskList || null
            };
        }
        return {
            projectId: this.defaultContext.projectId,
            milestoneId: this.defaultContext.milestoneId,
            taskListId: this.defaultContext.taskListId
        };
    }

    deleteRow(event) {
        const rowId = event.currentTarget.dataset.id;
        if (this.tasks.length > 1) {
            this.tasks = this.tasks.filter(task => task.id != rowId);
            this.tasks.forEach((task, index) => {
                task.index = index;
                task.displayIndex = index + 1;
            });
        } else {
            this.showToast('Error', 'Cannot delete the only row', 'error');
        }
    }

    toggleTaskExpand(event) {
        const index = parseInt(event?.currentTarget?.dataset?.index, 10);
        if (Number.isNaN(index)) return;
        this.toggleTaskExpandByIndex(index);
    }

    toggleTaskExpandByIndex(index) {
        const task = this.tasks[index];
        if (!task) return;
        task.isExpanded = !task.isExpanded;
        this.tasks = [...this.tasks];
    }

    handleCollapsedToggle(event) {
        event.stopPropagation();
        const indexAttr = event?.currentTarget?.dataset?.index
            || event?.target?.closest('[data-index]')?.dataset?.index;
        const index = parseInt(indexAttr, 10);
        if (Number.isNaN(index)) return;
        this.toggleTaskExpandByIndex(index);
    }

    expandAll() {
        const shouldExpand = this.tasks.some(task => !task.isExpanded);
        this.tasks = this.tasks.map(task => ({ ...task, isExpanded: shouldExpand }));
    }

    handleInputChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const fieldName = event.target.name;
        const value = event.target.value;

        this.tasks = this.tasks.map((task, idx) => {
            if (idx === index) {
                return { ...task, [fieldName]: value };
            }
            return task;
        });
    }

    handleBillableToggle(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const checked = event.target.checked;

        const billingValue = checked ? this.billableValue : this.nonBillableValue || this.billableValue;

        this.tasks = this.tasks.map((task, idx) => {
            if (idx === index) {
                return {
                    ...task,
                    isBillable: checked,
                    billingType: billingValue
                };
            }
            return task;
        });
    }

    handleComboboxChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const fieldName = event.target.name;
        const value = event.detail.value;

        this.tasks = this.tasks.map((task, idx) => {
            if (idx === index) {
                return { ...task, [fieldName]: value };
            }
            return task;
        });
    }

    handleUploadFinished(event) {
    const index = parseInt(event.target.dataset.index, 10);
    const uploadedFiles = event.detail.files;
    
    const task = this.tasks[index];
    if (!task) return;

    // Initialize files array if it doesn't exist
    if (!task.files) {
        task.files = [];
    }

    // Add uploaded files with formatted data
    uploadedFiles.forEach(file => {
        const newFile = {
            documentId: file.documentId,
            fileName: file.name,
            fileType: this.getFileExtension(file.name),
            fileSize: file.contentSize || 0,
            versionId: file.contentVersionId || null,
            fileSizeFormatted: this.formatFileSize(file.contentSize || 0),
            icon: this.getFileIcon(this.getFileExtension(file.name))
        };
        task.files.push(newFile);
    });

    // Update computed properties
    task.hasFiles = task.files.length > 0;
    task.fileCount = task.files.length;

    // Update tasks array
    this.tasks = this.tasks.map((t, idx) => {
        if (idx === index) {
            return { ...task };
        }
        return t;
    });

    this.showToast('Success', `${uploadedFiles.length} file(s) uploaded successfully`, 'success');
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
    const index = parseInt(event.currentTarget.dataset.index, 10);
    const documentId = event.currentTarget.dataset.id;
    
    if (!confirm('Are you sure you want to remove this file?')) {
        return;
    }

    const task = this.tasks[index];
    if (!task) return;

    // Remove file from array
    task.files = task.files.filter(f => f.documentId !== documentId);
    
    // Update computed properties
    task.hasFiles = task.files.length > 0;
    task.fileCount = task.files.length;

    // Update tasks array
    this.tasks = this.tasks.map((t, idx) => {
        if (idx === index) {
            return { ...task };
        }
        return t;
    });
    
    this.showToast('Success', 'File removed', 'success');
}

getFileExtension(fileName) {
    return fileName.split('.').pop().toLowerCase();
}

formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
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
        'csv': 'doctype:csv',
        'png': 'doctype:image',
        'jpg': 'doctype:image',
        'jpeg': 'doctype:image',
        'gif': 'doctype:image',
        'txt': 'doctype:txt',
        'zip': 'doctype:zip'
    };
    return iconMap[fileType?.toLowerCase()] || 'doctype:attachment';
}

    handleProjectChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const projectId = event.detail?.recordId || null;

        this.tasks = this.tasks.map((task, idx) => {
            if (idx !== index) return task;
            if (!projectId) {
                return this.resetProjectDependencies(task);
            }
            return {
                ...task,
                project: projectId,
                milestone: null,
                taskList: null,
                milestoneOptions: [],
                taskListOptions: [],
                milestoneDisabled: false,
                taskListDisabled: true
            };
        });

        if (projectId) {
            this.fetchMilestones(index, projectId);
        }
    }

    fetchMilestones(index, projectId) {
        getMilestonesByProject({ projectId })
            .then(result => {
                const milestoneOptions = (result || []).map(m => ({ label: m.Name, value: m.Id }));
                const next = [...this.tasks];
                const row = { ...next[index] };
                row.milestoneOptions = milestoneOptions;
                row.milestoneDisabled = milestoneOptions.length === 0;

                const desiredMilestone = row.milestone || this.defaultContext?.milestoneId || null;
                const hasDesired = desiredMilestone && milestoneOptions.some(o => o.value === desiredMilestone);

                if (hasDesired) {
                    row.milestone = desiredMilestone;
                    this.fetchTaskLists(index, desiredMilestone);
                } else if (!row.milestone && milestoneOptions.length === 1) {
                    row.milestone = milestoneOptions[0].value;
                    this.fetchTaskLists(index, row.milestone);
                }

                next[index] = row;
                this.tasks = next;

                if (milestoneOptions.length === 0) {
                    this.showToast('Info', 'No milestones found for this project', 'info');
                }
            })
            .catch(error => {
                // eslint-disable-next-line no-console
                console.error('Error fetching milestones:', error);
                this.showToast('Error', 'Error loading milestones', 'error');
            });
    }

    handleMilestoneChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const milestoneId = event.detail.value;

        this.tasks = this.tasks.map((task, idx) => {
            if (idx === index) {
                return {
                    ...task,
                    milestone: milestoneId,
                    taskList: '',
                    taskListOptions: [],
                    taskListDisabled: !milestoneId
                };
            }
            return task;
        });

        if (milestoneId) {
            this.fetchTaskLists(index, milestoneId);
        }
    }

    fetchTaskLists(index, milestoneId) {
        getTaskListsByMilestone({ milestoneId })
            .then(result => {
                const taskListOptions = (result || []).map(tl => ({ label: tl.Name, value: tl.Id }));
                const next = [...this.tasks];
                const row = { ...next[index] };
                row.taskListOptions = taskListOptions;
                row.taskListDisabled = taskListOptions.length === 0;

                const desiredTaskList = row.taskList || this.defaultContext?.taskListId || null;
                const hasDesired = desiredTaskList && taskListOptions.some(o => o.value === desiredTaskList);

                if (hasDesired) {
                    row.taskList = desiredTaskList;
                } else if (!row.taskList && taskListOptions.length === 1) {
                    row.taskList = taskListOptions[0].value;
                }

                next[index] = row;
                this.tasks = next;

                if (taskListOptions.length === 0) {
                    this.showToast('Info', 'No task lists found for this milestone', 'info');
                }
            })
            .catch(error => {
                // eslint-disable-next-line no-console
                console.error('Error fetching task lists:', error);
                this.showToast('Error', 'Error loading task lists', 'error');
            });
    }

    handleTaskListChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const taskListId = event.detail.value;

        this.tasks = this.tasks.map((task, idx) => {
            if (idx === index) {
                return { ...task, taskList: taskListId };
            }
            return task;
        });
    }



    handleTeamMembersChange(event) {
        debugger;
        const index = parseInt(event.target.dataset.index, 10);
        this.selectedRecords = event.detail.selRecords || [];
        // this.user = 

        console.log('*** Selected Records from Child:', this.selectedRecords);

        // de-duplicate by recId
        const unique = new Map();
        this.selectedRecords.forEach(r => unique.set(r.recId, r));

        this.teamMembersArray = [...unique.values()].map(record => ({
            Id: record.recId,
            UserName: record.recName,
            Name: record.name || record.recName  // ✅ Fallback to recName if name is missing
        }));

        // IMPORTANT: Create array for child component (lwcMultiLookup expects this format)
        this.teamMembersForChild = this.teamMembersArray.map(member => ({
            Id: member.Id,
            Email: member.UserName,
            Name: member.Name  // ✅ This should be the display name
        }));

        console.log('*** Team Members Array:', JSON.stringify(this.teamMembersArray));
        console.log('*** Team Members For Child:', JSON.stringify(this.teamMembersForChild));

        this.tasks = this.tasks.map((task, idx) => {
            if (idx === index) {
                return {
                    ...task,
                    teamMembers: this.teamMembersArray,
                    teamMembersForChild: this.teamMembersForChild
                };
            }
            return task;
        });

        // const t = this.tasks[index];
        if (this.tasks[index].startDate && this.tasks[index].endDate) {
            this.users = (this.tasks[index].teamMembers && this.tasks[index].teamMembers.length)
                ? this.tasks[index].teamMembers.length
                : 1;

            const hours = this.calculateWorkHours(
                this.tasks[index].startDate,
                this.tasks[index].endDate,
                this.users
            );

            console.log('*** Work Hours:', hours);

            this.tasks[index].workHours = hours;
            this.tasks[index].workHoursDisabled = false;
        }

        this.initOrRecalcAllocation(index);
    }

    handleStartDateChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const startDate = event.target.value;

        if (startDate < this.todayDate) {
            this.showToast('Error', 'Start Date cannot be in the past', 'error');
            event.target.value = '';
            return;
        }

        this.tasks = this.tasks.map((task, idx) => {
            if (idx === index) {
                return {
                    ...task,
                    startDate,
                    minEndDate: startDate,
                    endDateDisabled: !startDate,
                    endDate: '',
                    workHours: '',
                    workHoursDisabled: true,
                    showAllocation: false,
                    dateColumns: [],
                    dayTotals: [],
                    allocationRows: [],
                    isAllocOpen: false
                };
            }
            return task;
        });
    }

    // handleEndDateChange(event) {
    //     debugger;
    //     const index = parseInt(event.target.dataset.index, 10);
    //     this.endDateOnChange = event.target.value;

    //     this.tasks = this.tasks.map((task, idx) => {
    //         if (idx === index) {
    //             if (task.startDate && this.endDateOnChange < task.startDate) {
    //                 this.showToast('Error', 'End Date cannot be earlier than Start Date', 'error');
    //                 return {
    //                     ...task,
    //                     endDate: '',
    //                     workHours: '',
    //                     workHoursDisabled: true,
    //                     showAllocation: false,
    //                     dateColumns: [],
    //                     dayTotals: [],
    //                     allocationRows: []
    //                 };
    //             }

    //             if (this.endDateOnChange < this.todayDate) {
    //                 this.showToast('Error', 'End Date cannot be in the past', 'error');
    //                 return {
    //                     ...task,endDate: this.endDateOnChange,
    //                     workHours: '',
    //                     workHoursDisabled: true,
    //                     showAllocation: false,
    //                     dateColumns: [],
    //                     dayTotals: [],
    //                     allocationRows: []
    //                 };
    //             }

    //             const numberOfUsers = task.teamMembers.length || 1;
    //             const workHours = this.calculateWorkHours(
    //                                                             task.startDate,
    //                                                             this.endDateOnChange,
    //                                                             numberOfUsers
    //                                                             );

    //             return {
    //                 ...task,endDate:this.endDateOnChange,
    //                 workHours,
    //                 workHoursDisabled: false
    //             };
    //         }
    //         return task;
    //     });

    //     this.initOrRecalcAllocation(index);
    // }

    handleEndDateChange(event) {
        debugger;
        const index = parseInt(event.target.dataset.index, 10);
        const newEndDate = event.target.value;

        this.tasks = this.tasks.map((task, idx) => {
            if (idx === index) {
                const start = new Date(task.startDate);
                const end = new Date(newEndDate);
                const today = new Date(this.todayDate);

                if (task.startDate && end < start) {
                    this.showToast('Error', 'End Date cannot be earlier than Start Date', 'error');
                    return {
                        ...task,
                        endDate: '',
                        workHours: '',
                        workHoursDisabled: true,
                        showAllocation: false,
                        dateColumns: [],
                        dayTotals: [],
                        allocationRows: []
                    };
                }

                if (end < today) {
                    this.showToast('Error', 'End Date cannot be in the past', 'error');
                    return {
                        ...task,
                        endDate: '',
                        workHours: '',
                        workHoursDisabled: true,
                        showAllocation: false,
                        dateColumns: [],
                        dayTotals: [],
                        allocationRows: []
                    };
                }

                const numberOfUsers = (task.teamMembers && task.teamMembers.length)
                    ? task.teamMembers.length
                    : 1;
                const workHours = this.calculateWorkHours(
                    task.startDate,
                    newEndDate,
                    numberOfUsers
                );
                console.log('Recalculated Work Hours:', workHours);
                return {
                    ...task,
                    endDate: newEndDate,
                    workHours: workHours,
                    workHoursDisabled: false
                };
            }
            return task;
        });

        this.initOrRecalcAllocation(index);

        this.tasks = this.tasks.map((t, i) =>
            i === index ? { ...t } : t
        );
    }

    calculateWorkHours(startDate, endDate, numberOfUsers) {
        debugger;
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
        const index = parseInt(event.target.dataset.index, 10);
        const value = event.target.value;

        this.tasks = this.tasks.map((task, idx) => {
            if (idx === index) {
                return { ...task, comments: value };
            }
            return task;
        });
    }

    navigateToTaskListView() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Tasks__c',
                actionName: 'list'
            },
            state: {
                filterName: 'All'
            }
        });
    }

    handleIssueChange(event){
        debugger;
        const index = parseInt(event.target.dataset.index, 10);
        const issueBugId = event.detail?.recordId || null;

        this.tasks = this.tasks.map((task, idx) => {
            if (idx === index) {
                return { ...task, issueBug: issueBugId };
            }
            return task;
        });
    }

    handleSave() {
        debugger;
        const isValid = this.validateTasks();
        if (!isValid) return;

        const tasksToSave = this.tasks.map(task => {
            const taskData = {
                taskName: task.taskName,
                priority: task.priority,
                project: task.project,
                milestone: task.milestone,
                taskList: task.taskList,
                billingType: task.billingType,
                startDate: task.startDate,
                endDate: task.endDate,
                workHours: task.workHours,
                comments: task.comments,
                issueBug: task.issueBug,
                files: (task.files || []).map(file => ({
                    fileName: file.name,
                    docId: file.documentId,        // This maps to FileWrapper.docId
                    versionId: file.contentVersionId,
                    bodyId: file.contentBodyId,
                    fileType: file.mimeType
                })),

                teamMemberIds: task.teamMembers.map(member => member.Id)
            };

            // Add allocation data if in flexible mode
            console.log('*** Task:', task.taskName);
            console.log('*** Is Flexible?', task.isFlexible);
            console.log('*** Is Alloc Open?', task.isAllocOpen);
            console.log('*** Allocation Rows:', task.allocationRows);

            if (task.isFlexible && task.allocationRows && task.allocationRows.length > 0) {
                taskData.allocationData = this.extractAllocationData(task);
                console.log('*** Allocation Data Added:', taskData.allocationData);
            } else {
                console.log('*** Using Standard Allocation (no allocationData sent)');
            }
            return taskData;
        });

        console.log('*** FINAL TASKS DATA:', JSON.stringify(tasksToSave, null, 2));

        saveTasksWithOwners({ tasksData: JSON.stringify(tasksToSave) })
            .then(result => {
                debugger;
                this.showToast('Success', `${result} task(s) saved successfully with team members and resource allocations`, 'success');
                this.handleCancel();
                this.navigateToTaskListView();
                this.closeModal();
            })
            .catch(error => {
                // eslint-disable-next-line no-console
                console.error('Error saving tasks:', error);
                const errorMessage = error.body?.message || 'An error occurred while saving tasks';
                this.showToast('Error', errorMessage, 'error');
            });
    }

    extractAllocationData(task) {
        const allocationData = [];

        console.log('*** EXTRACT ALLOCATION - Task:', task.taskName);
        console.log('*** Allocation Rows:', task.allocationRows);

        if (!task.allocationRows || task.allocationRows.length === 0) {
            console.log('*** WARNING: No allocation rows found!');
            return allocationData;
        }

        task.allocationRows.forEach(row => {
            const userId = row.userId;
            console.log('*** Processing User:', row.userName, 'ID:', userId);

            if (row.cells && row.cells.length > 0) {
                row.cells.forEach(cell => {
                    const hours = parseFloat(cell.hours);

                    if (!isNaN(hours) && hours > 0) {
                        const allocEntry = {
                            userId: userId,
                            allocationDate: cell.date,
                            hours: hours
                        };
                        console.log('*** Adding Allocation:', allocEntry);
                        allocationData.push(allocEntry);
                    }
                });
            }
        });

        console.log('*** TOTAL ALLOCATIONS EXTRACTED:', allocationData.length);
        return allocationData;
    }

    handleCancel() {
        this.tasks = [];
        this.addRow();
        window.close();
        this.navigateToTaskListView()
    }

    validateTasks() {
        debugger;
        for (let i = 0; i < this.tasks.length; i++) {
            const task = this.tasks[i];
            const n = i + 1;

            if (!task.taskName) return this._err(`Task ${n}: Task Name is required`);
            if (!task.project) return this._err(`Task ${n}: Project is required`);
            if (!task.milestone) return this._err(`Task ${n}: Milestone is required`);
            if (!task.taskList) return this._err(`Task ${n}: Task List is required`);
            if (!task.teamMembers || task.teamMembers.length === 0) return this._err(`Task ${n}: At least one Team Member is required`);
            if (!task.priority) return this._err(`Task ${n}: Priority is required`);
            if (!task.billingType) return this._err(`Task ${n}: Billing Type is required`);
            if (!task.startDate) return this._err(`Task ${n}: Start Date is required`);
            if (!task.endDate) return this._err(`Task ${n}: End Date is required`);
        }
        return true;
    }

    _err(msg) {
        this.showToast('Error', msg, 'error');
        return false;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    @api getTasksData() {
        return this.tasks;
    }

    get isDeleteDisabled() {
        return this.tasks.length <= 1;
    }

    closeModal() {
        this.dispatchEvent(new CloseActionScreenEvent());
    }

    handleAllocationModeChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const mode = event.detail.value;

        const t = this.tasks[index];
        if (!t) return;

        t.allocationMode = mode;
        t.isFlexible = (mode === ALLOC_FLEXIBLE);
        t.workHoursReadOnly = !t.isFlexible;

        if (t.isFlexible) {
            if (!t.allocationRows || t.allocationRows.length === 0) {
                this.distributeStandard(t);
            }
        } else {
            this.distributeStandard(t);
        }

        this.recalcTotals(t);
        const clone = [...this.tasks];
        clone[index] = { ...t };
        this.tasks = clone;
    }

    handleCellHoursChange(event) {
        const tIndex = parseInt(event.target.dataset.index, 10);
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

        const t = this.tasks[tIndex];
        if (!t || !t.isFlexible) return;

        t.allocationRows[uIndex].cells[dIndex].hours = val;
        event.target.value = val;
    }

    handleCellHoursBlur(event) {
        const tIndex = parseInt(event.target.dataset.index, 10);
        const t = this.tasks[tIndex];
        if (!t || !t.isFlexible) return;

        this.recalcTotals(t);

        const clone = [...this.tasks];
        clone[tIndex] = { ...t };
        this.tasks = clone;
    }

    handleWorkHoursManualChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const t = this.tasks[index];
        if (!t) return;

        if (!t.isFlexible) {
            event.target.value = t.workHours;
            return;
        }

        let newTotal = parseFloat(event.target.value);
        if (isNaN(newTotal) || newTotal < 0) {
            newTotal = 0;
        }

        t.workHours = newTotal;
    }

    handleWorkHoursManualBlur(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const t = this.tasks[index];
        if (!t) return;

        if (!t.isFlexible) {
            event.target.value = t.workHours;
            return;
        }

        let newTotal = parseFloat(event.target.value);
        if (isNaN(newTotal) || newTotal < 0) newTotal = 0;

        this.scaleAllocationToTotal(t, newTotal);
        this.recalcTotals(t);

        const clone = [...this.tasks];
        clone[index] = { ...t };
        this.tasks = clone;
    }

    initOrRecalcAllocation(index) {
        const t = this.tasks[index];
        if (!t) return;

        const datesReady = !!(t.startDate && t.endDate);
        const membersReady = (t.teamMembers && t.teamMembers.length > 0);

        t.showAllocation = datesReady && membersReady;
        if (!t.showAllocation) {
            t.dateColumns = [];
            t.dayTotals = [];
            t.allocationRows = [];
            const clone = [...this.tasks];
            clone[index] = { ...t };
            this.tasks = clone;
            return;
        }

        t.dateColumns = this.buildDateColumns(t.startDate, t.endDate);

        const users = (t.teamMembers || []);
        const userIds = users.map(u => u.Id);
        const needRebuild = !t.allocationRows || t.allocationRows.length !== userIds.length;

        if (needRebuild) {
            if (t.allocationMode === ALLOC_FLEXIBLE) {
                this.distributeStandard(t);
                t.isFlexible = true;
                t.workHoursReadOnly = false;
            } else {
                this.distributeStandard(t);
                t.isFlexible = false;
                t.workHoursReadOnly = true;
            }
        } else if (t.isFlexible) {
            t.allocationRows.forEach(r => {
                const cells = [];
                t.dateColumns.forEach(col => {
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

        this.recalcTotals(t);

        const clone = [...this.tasks];
        clone[index] = { ...t };
        this.tasks = clone;

        this.linkVerticalScrollFor(index);
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

    distributeStandard(t) {
        const users = (t.teamMembers || []);
        const cols = t.dateColumns || [];
        t.allocationRows = users.map(u => ({
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

        t.isFlexible = false;
        t.workHoursReadOnly = true;
    }

    recalcTotals(t) {
        const cols = t.dateColumns || [];

        if (t.isFlexible) {
            t.allocationRows.forEach(r => {
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
                t.allocationRows.forEach(r => dt += (r.cells[ci]?.hours || 0));
                return { date: c.date, total: +dt.toFixed(2) };
            });
            t.dayTotals = dayTotals;

            const grand = t.allocationRows.reduce((acc, r) => acc + (r.total || 0), 0);
            t.workHours = +grand.toFixed(2);
        } else {
            t.allocationRows.forEach(r => {
                let sum = 0;
                r.cells.forEach(cell => sum += (cell.hours || 0));
                r.total = +sum.toFixed(2);
            });
            const grand = t.allocationRows.reduce((acc, r) => acc + (r.total || 0), 0);
            t.workHours = +grand.toFixed(2);
            t.dayTotals = [];
        }
    }

    scaleAllocationToTotal(t, newTotal) {
        const current = t.allocationRows.reduce((acc, r) => acc + (r.total || 0), 0);

        const weekdayCellsCount = t.allocationRows.reduce((acc, r) => {
            return acc + (r.cells?.filter(cell => {
                const dateColumn = t.dateColumns.find(col => col.date === cell.date);
                return dateColumn && !dateColumn.isWeekend;
            }).length || 0);
        }, 0);

        if (current <= 0) {
            const perWeekdayCell = weekdayCellsCount ? +(newTotal / weekdayCellsCount).toFixed(2) : 0;
            t.allocationRows.forEach(r => {
                r.cells.forEach(cell => {
                    const dateColumn = t.dateColumns.find(col => col.date === cell.date);
                    if (dateColumn && !dateColumn.isWeekend) {
                        cell.hours = perWeekdayCell;
                    } else {
                        cell.hours = 0;
                    }
                });
            });
        } else {
            const factor = newTotal / current;
            t.allocationRows.forEach(r => {
                r.cells.forEach(cell => {
                    const dateColumn = t.dateColumns.find(col => col.date === cell.date);
                    if (dateColumn && !dateColumn.isWeekend) {
                        cell.hours = +((cell.hours || 0) * factor).toFixed(2);
                    } else {
                        cell.hours = 0;
                    }
                });
            });
        }
    }

    getInclusiveDays(startStr, endStr) {
        if (!startStr || !endStr) return 0;
        const s = new Date(`${startStr}T00:00:00Z`).getTime();
        const e = new Date(`${endStr}T00:00:00Z`).getTime();
        if (e < s) return 0;
        const MS_PER_DAY = 86400000;
        return Math.floor((e - s) / MS_PER_DAY) + 1;
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

    isWeekend(isoDate) {
        const d = new Date(`${isoDate}T00:00:00Z`);
        const day = d.getUTCDay();
        return day === 0 || day === 6;
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

    handleToggleAlloc(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        const t = this.tasks[index];
        if (!t) return;

        const eligible = !!(t.startDate && t.endDate && t.teamMembers && t.teamMembers.length);

        if (!t.isAllocOpen) {
            if (!eligible) {
                this.showToast('Info', 'Select Start Date, End Date and Team Members to adjust daily hours', 'info');
                return;
            }
            t.isAllocOpen = true;
            t.allocationMode = ALLOC_FLEXIBLE;
            t.isFlexible = true;
            t.workHoursReadOnly = false;

            this.initOrRecalcAllocation(index);
        } else {
            t.isAllocOpen = false;
            t.allocationMode = ALLOC_STANDARD;
            t.isFlexible = false;
            t.workHoursReadOnly = true;

            this.distributeStandard(t);
            this.recalcTotals(t);
        }

        const clone = [...this.tasks];
        clone[index] = { ...t };
        this.tasks = clone;

        this.linkVerticalScrollFor(index);
    }

    linkVerticalScrollFor(index) {
        window.requestAnimationFrame(() => {
            const root = this.template.querySelector(`[data-alloc="${index}"]`);
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

    // ************************************************** UPLOAD FILE *******************************************

    handleUploadClick(event) {
    const index = parseInt(event.currentTarget.dataset.index, 10);
    
    // Find the hidden file input for this task row
    const fileInputs = this.template.querySelectorAll('input[type="file"]');
    const fileInput = Array.from(fileInputs).find(input => 
        parseInt(input.dataset.index, 10) === index
    );
    
    if (fileInput) {
        fileInput.click();
    }
}

handleFileSelect(event) {
    const index = parseInt(event.target.dataset.index, 10);
    const files = event.target.files;
    
    if (!files || files.length === 0) return;

    const task = this.tasks[index];
    if (!task) return;

    // Upload files to Salesforce (removed the "Uploading..." toast)
    this.uploadFilesToSalesforce(files, index);
    
    // Clear the input so the same file can be selected again
    event.target.value = '';
}

handleToggleFileSection(event) {
    const index = parseInt(event.currentTarget.dataset.index, 10);
    const task = this.tasks[index];
    if (!task) return;

    task.isFilesSectionOpen = !task.isFilesSectionOpen;
    task.fileToggleIcon = task.isFilesSectionOpen ? 'utility:chevronup' : 'utility:chevrondown';
    task.fileToggleTitle = task.isFilesSectionOpen ? 'Collapse Files' : 'Expand Files';

    this.tasks = this.tasks.map((t, idx) => {
        if (idx === index) {
            return { ...task };
        }
        return t;
    });
}

uploadFilesToSalesforce(files, taskIndex) {
    const maxSize = 25 * 1024 * 1024; // 25MB
    let uploadCount = 0;
    let errorCount = 0;
    const totalFiles = files.length;

    Array.from(files).forEach((file) => {
        if (file.size > maxSize) {
            this.showToast('Error', `${file.name} exceeds 25MB limit`, 'error');
            errorCount++;
            
            // Check if all files are processed
            if (uploadCount + errorCount === totalFiles) {
                if (uploadCount > 0) {
                    this.showToast('Success', `${uploadCount} file(s) ready to upload`, 'success');
                }
            }
            return;
        }

        const reader = new FileReader();
        
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            
            const newFile = {
                documentId: 'temp_' + Date.now() + '_' + Math.random(),
                fileName: file.name,
                fileType: this.getFileExtension(file.name),
                fileSize: file.size,
                versionId: null,
                fileSizeFormatted: this.formatFileSize(file.size),
                icon: this.getFileIcon(this.getFileExtension(file.name)),
                base64Data: base64
            };

            const task = this.tasks[taskIndex];
            if (!task.files) {
                task.files = [];
            }
            task.files.push(newFile);
            task.hasFiles = task.files.length > 0;
            task.fileCount = task.files.length;

            uploadCount++;

            // Update tasks array
            this.tasks = this.tasks.map((t, idx) => {
                if (idx === taskIndex) {
                    return { ...task };
                }
                return t;
            });

            // Show success ONLY when all files are processed
            if (uploadCount + errorCount === totalFiles) {
                if (uploadCount > 0) {
                    this.showToast('Success', `${uploadCount} file(s) ready to upload`, 'success');
                }
                if (errorCount > 0 && uploadCount === 0) {
                    this.showToast('Error', `${errorCount} file(s) failed to upload`, 'error');
                }
            }
        };
        
        reader.onerror = () => {
            errorCount++;
            this.showToast('Error', `Failed to read ${file.name}`, 'error');
            
            // Check if all files are processed
            if (uploadCount + errorCount === totalFiles) {
                if (uploadCount > 0) {
                    this.showToast('Success', `${uploadCount} file(s) ready to upload`, 'success');
                }
            }
        };
        
        reader.readAsDataURL(file);
    });
}


}