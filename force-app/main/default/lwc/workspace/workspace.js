import { LightningElement, track, wire } from 'lwc';
import getProjectsAndReleatedRecrods from '@salesforce/apex/workSpaceController.getProjectsAndReleatedRecrods';
import isInternalUser from '@salesforce/apex/workSpaceController.isInternalUser';
import getRecordDetails from '@salesforce/apex/workSpaceController.getRecordDetails';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { encodeDefaultFieldValues } from 'lightning/pageReferenceUtils';

export default class ProjectGanttChart extends NavigationMixin(LightningElement) {
    @track gridData = [];
    @track rows = [];
    @track timelineStartDate;
    @track timelineEndDate;
    @track timelineMonths = [];
    @track todayPosition;
    @track isLoading = false;
    @track selectedDateFilter = 'month';
    @track filterStartDate;
    @track filterEndDate;
    @track isInternalUser = false;
    @track allData;
    @track selectedProjectId = '';
    @track selectedMilestoneId = '';
    @track selectedTaskListId = '';

    dateFilterOptions = [
        { label: 'Day', value: 'day' },
        { label: 'Month', value: 'month' },
        { label: 'Year', value: 'year' }
    ];

    get isProjectNotSelected() {
        return !this.selectedProjectId;
    }

    get projectOptions() {
        const options = (this.allData || []).map(project => ({
            label: project.Name,
            value: project.Id
        }));
        return [{ label: 'All Projects', value: '' }, ...options];
    }

    get milestoneOptions() {
        if (!this.selectedProjectId) {
            return [{ label: 'All Milestones', value: '' }];
        }

        const project = (this.allData || []).find(p => p.Id === this.selectedProjectId);
        const milestones = (project && project.Milestones__r) ? project.Milestones__r : [];

        const options = milestones.map(ms => ({
            label: ms.Name,
            value: ms.Id
        }));

        return [{ label: 'All Milestones', value: '' }, ...options];
    }

    get taskListOptions() {
        if (!this.selectedProjectId) {
            return [{ label: 'All Task Lists', value: '' }];
        }

        const project = (this.allData || []).find(p => p.Id === this.selectedProjectId);
        const milestones = (project && project.Milestones__r) ? project.Milestones__r : [];

        let taskLists = [];

        if (this.selectedMilestoneId) {
            const milestone = milestones.find(ms => ms.Id === this.selectedMilestoneId);
            taskLists = (milestone && milestone.Task_Lists__r) ? milestone.Task_Lists__r : [];
        } else {
            milestones.forEach(ms => {
                if (ms.Task_Lists__r && ms.Task_Lists__r.length) {
                    taskLists = taskLists.concat(ms.Task_Lists__r);
                }
            });
        }

        const options = taskLists.map(tl => ({
            label: tl.Name,
            value: tl.Id
        }));

        return [{ label: 'All Task Lists', value: '' }, ...options];
    }

    connectedCallback() {
        this.checkUserType();
        this.callApexMethod();
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

    callApexMethod() {
        this.isLoading = true;
        getProjectsAndReleatedRecrods()
            .then(result => {
                debugger;
                this.allData = result;
                this.gridData = this.buildGridData(result);

                this.calculateTimelineRange();
                this.initializeDateFilter();
                this.rows = this.flattenData(this.gridData);

                debugger;
            })
            .catch(error => {
                this.showToast(
                    'Error',
                    error?.body?.message || error.message,
                    'error'
                );
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    buildGridData(projects) {
        return (projects || []).map((project, pIndex) => ({
            Id: project.Id,
            Name: project.Name,
            StartDate: project.Start_Date__c,
            EndDate: project.End_Date__c,
            Status: project.Status__c || '',
            completion: project.Completion__c || '',
            EstimatedHours: project.Planned_Hours__c,
            LoggedHours: project.Actual_Hours__c,
            sequence: `${pIndex + 1}`,

            _children: (project.Milestones__r || []).map((ms, mIndex) => ({
                Id: ms.Id,
                Name: ms.Name,
                StartDate: ms.Start_Date__c,
                EndDate: ms.End_Date__c,
                Status: ms.Status__c || '',
                completion: ms.Completion__c || '',
                EstimatedHours: ms.Planned_Hours__c,
                LoggedHours: ms.Actual_Work_Hours__c,
                sequence: `${pIndex + 1}.${mIndex + 1}`,

                _children: (ms.Task_Lists__r || []).map((tl, tIndex) => ({
                    Id: tl.Id,
                    Name: tl.Name,
                    StartDate: tl.Start_Date__c,
                    EndDate: tl.End_Date__c,
                    Status: tl.Status__c || '',
                    completion: tl.Completion__c || '',
                    EstimatedHours: tl.Planned_Hours__c,
                    LoggedHours: tl.Actual_Hours__c,
                    sequence: `${pIndex + 1}.${mIndex + 1}.${tIndex + 1}`,

                    _children: (tl.Tasks__r || []).map((task, taskIndex) => ({
                        Id: task.Id,
                        Name: task.Name,
                        StartDate: task.Start_Date__c,
                        EndDate: task.End_Date__c,
                        Status: task.Status__c || '',
                        completion: task.Completion__c || '',
                        EstimatedHours: task.Work_Hours__c,
                        LoggedHours: task.Actual_Work_Hours__c,
                        sequence: `${pIndex + 1}.${mIndex + 1}.${tIndex + 1}.${taskIndex + 1}`
                    }))
                }))
            }))
        }));
    }

    initializeDateFilter() {
        this.selectedDateFilter = 'month';
        this.updateDateRange();
    }

    handleDateFilterChange(event) {
        this.selectedDateFilter = event.target.value;
        this.updateDateRange();
    }

    handleProjectFilterChange(event) {
        this.selectedProjectId = event.detail.value;
        this.selectedMilestoneId = '';
        this.selectedTaskListId = '';
        this.applyHierarchyFilter();
    }

    handleMilestoneFilterChange(event) {
        this.selectedMilestoneId = event.detail.value;
        this.selectedTaskListId = '';
        this.applyHierarchyFilter();
    }

    handleTaskListFilterChange(event) {
        this.selectedTaskListId = event.detail.value;
        this.applyHierarchyFilter();
    }

    handleResetFilters() {
        this.selectedProjectId = '';
        this.selectedMilestoneId = '';
        this.selectedTaskListId = '';
        this.selectedDateFilter = 'month';

        this.gridData = this.buildGridData(this.allData || []);
        this.updateDateRange();
    }

    applyHierarchyFilter() {
        let projectsToUse = this.allData || [];

        if (this.selectedProjectId) {
            const project = (this.allData || []).find(p => p.Id === this.selectedProjectId);

            if (project) {
                const filteredProject = { ...project };

                let milestones = (project.Milestones__r || []);

                if (this.selectedMilestoneId) {
                    milestones = milestones.filter(ms => ms.Id === this.selectedMilestoneId);
                }

                if (this.selectedTaskListId) {
                    milestones = milestones
                        .map(ms => {
                            const msCopy = { ...ms };
                            msCopy.Task_Lists__r = (ms.Task_Lists__r || []).filter(
                                tl => tl.Id === this.selectedTaskListId
                            );
                            return msCopy;
                        })
                        .filter(ms => (ms.Task_Lists__r && ms.Task_Lists__r.length));
                }

                filteredProject.Milestones__r = milestones;
                projectsToUse = [filteredProject];
            }
        }

        this.gridData = this.buildGridData(projectsToUse);
        this.updateDateRange();
    }

    getActualDateRange() {
        debugger;
        const allDates = [];

        const collectDates = (items) => {
            items.forEach(item => {
                if (item.StartDate) allDates.push(new Date(item.StartDate));
                if (item.EndDate) allDates.push(new Date(item.EndDate));
                if (item._children) collectDates(item._children);
            });
        };

        collectDates(this.gridData);

        if (allDates.length === 0) {
            const today = new Date();
            return {
                minDate: today,
                maxDate: today
            };
        }

        return {
            minDate: new Date(Math.min(...allDates)),
            maxDate: new Date(Math.max(...allDates))
        };
    }

    calculateTimelineRange() {
        debugger;
        const { minDate, maxDate } = this.getActualDateRange();

        this.timelineStartDate = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
        this.timelineEndDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0);

        this.generateTimelineMonths();
        this.calculateTodayPosition();
    }

    generateTimelineMonths() {
        debugger;
        this.timelineMonths = [];

        const { minDate, maxDate } = this.getActualDateRange();

        let startDate, endDate;

        switch (this.selectedDateFilter) {
            case 'day':
                startDate = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
                endDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
                break;
            case 'month':
                startDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
                endDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
                break;
            case 'year':
                startDate = new Date(minDate.getFullYear(), 0, 1);
                endDate = new Date(maxDate.getFullYear(), 11, 31);
                break;
            default:
                startDate = new Date(minDate);
                endDate = new Date(maxDate);
        }

        const current = new Date(startDate);

        if (this.selectedDateFilter === 'year') {
            while (current <= endDate) {
                this.timelineMonths.push({
                    year: current.getFullYear(),
                    month: current.getMonth(),
                    name: current.getFullYear().toString()
                });
                current.setFullYear(current.getFullYear() + 1);
            }
        } else if (this.selectedDateFilter === 'day') {
            const dayCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            const maxDays = Math.min(dayCount, 365);

            for (let i = 0; i <= maxDays; i++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(currentDate.getDate() + i);
                this.timelineMonths.push({
                    year: currentDate.getFullYear(),
                    month: currentDate.getMonth(),
                    name: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                });
            }
        } else {
            while (current <= endDate) {
                this.timelineMonths.push({
                    year: current.getFullYear(),
                    month: current.getMonth(),
                    name: current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                });
                current.setMonth(current.getMonth() + 1);
            }
        }

        this.filterStartDate = startDate.toISOString().substring(0, 10);
        this.filterEndDate = endDate.toISOString().substring(0, 10);
    }

    calculateTodayPosition() {
        debugger;
        const today = new Date();
        const startDate = this.filterStartDate ? new Date(this.filterStartDate) : this.timelineStartDate;
        const endDate = this.filterEndDate ? new Date(this.filterEndDate) : this.timelineEndDate;
        const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
        const daysFromStart = (today - startDate) / (1000 * 60 * 60 * 24);

        if (daysFromStart >= 0 && daysFromStart <= totalDays) {
            this.todayPosition = (daysFromStart / totalDays) * 100;
        } else {
            this.todayPosition = null;
        }
    }

    computeTimelineProps(item) {
        debugger;
        const startDate = item.StartDate ? new Date(item.StartDate) : null;
        const endDate = item.EndDate ? new Date(item.EndDate) : null;
        const today = new Date();
        const status = item.Status;
        const filterStart = this.filterStartDate ? new Date(this.filterStartDate) : this.timelineStartDate;
        const filterEnd = this.filterEndDate ? new Date(this.filterEndDate) : this.timelineEndDate;

        const totalDays = (filterEnd - filterStart) / (1000 * 60 * 60 * 24);

        let left = 0;
        let width = 0;
        let timelineBarStyle = '';
        let timelineLabel = '';
        let timelineTitle = '';
        let progressWidth = 0;
        let remainingWidth = 0;
        let completionPercentage = 0;

        if (startDate && endDate) {
            const startDays = Math.max(0, (startDate - filterStart) / (1000 * 60 * 60 * 24));
            const endDays = Math.min(totalDays, (endDate - filterStart) / (1000 * 60 * 60 * 24));

            left = (startDays / totalDays) * 100;
            width = ((endDays - startDays) / totalDays) * 100;

            if (width < 1) width = 1;

            // Completion now derived from status/estimated/logged hours (no date-based auto-progress)
            completionPercentage = this.calculateCompletion(item);

            progressWidth = (completionPercentage / 100) * width;
            remainingWidth = width - progressWidth;
        } else if (startDate) {
            const startDays = Math.max(0, (startDate - filterStart) / (1000 * 60 * 60 * 24));
            left = (startDays / totalDays) * 100;
            width = 5;
            progressWidth = width;
            remainingWidth = 0;
        } else if (endDate) {
            const endDays = Math.min(totalDays, (endDate - filterStart) / (1000 * 60 * 60 * 24));
            left = Math.max(0, ((endDays - 5) / totalDays) * 100);
            width = 5;
            progressWidth = width;
            remainingWidth = 0;
        }

        // Determine colors based on completion and status
        let progressColor = '#95a5a6'; // Default gray for no dates
        let remainingColor = '#f39c12'; // Default yellow
        timelineLabel = 'No Dates';

        if (startDate && endDate) {
            // Actual completion uses the same hours-based calculation
            const actualCompletionPercentage = this.calculateCompletion(item);

            const progressState = this.getProgressState(item);
            progressColor = progressState.color;
            remainingColor = progressState.state === 'normal' ? '#f39c12' : progressState.color;
            timelineLabel = progressState.label;
        }

        // Added by Harsh
        // Create two-color bar style (green for completed, yellow for remaining)
        // if (progressWidth > 0 && remainingWidth > 0) {
        //     timelineBarStyle = `
        //         left: ${left}%; 
        //         width: ${width}%; 
        //         background: linear-gradient(to right, 
        //             ${progressColor} 0%, 
        //             ${progressColor} ${progressWidth}%, 
        //             ${remainingColor} ${progressWidth}%, 
        //             ${remainingColor} 100%);
        //     `;
        // } else if (progressWidth > 0) {
        //     timelineBarStyle = `left: ${left}%; width: ${width}%; background: ${progressColor};`;
        // } else {
        //     timelineBarStyle = `left: ${left}%; width: ${width}%; background: ${remainingColor};`;
        // }
        timelineBarStyle = `left: ${left}%; width: ${width}%; background: ${remainingColor}; --progress: ${completionPercentage}%; --progress-color: ${progressColor}; --remaining-color: ${remainingColor};`;

        if (startDate && endDate) {
            timelineTitle = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()} (${timelineLabel})`;
        } else if (startDate) {
            timelineTitle = `Start: ${startDate.toLocaleDateString()}`;
        } else if (endDate) {
            timelineTitle = `End: ${endDate.toLocaleDateString()}`;
        }

        return {
            timelineStyle: 'position: relative; width: 100%; height: 30px;',
            timelineBarStyle,
            timelineLabel,
            timelineTitle
        };
    }

    getCompletionValue(item) {
        return this.calculateCompletion(item);
    }

    calculateProgressPercentage(startDate, endDate, currentDate, status) {
        if (status === 'Completed') {
            return 100;
        }
        const totalDuration = endDate - startDate;
        const elapsedDuration = currentDate - startDate;
        const progressPercentage = (elapsedDuration / totalDuration) * 100;
        return Math.round(progressPercentage);
    }

    calculateCompletion(item) {
        if (item.Status && item.Status.toLowerCase() === 'completed') {
            return 100;
        }

        const estimated = parseFloat(item.EstimatedHours ?? item.estimatedHours);
        const logged = parseFloat(item.LoggedHours ?? item.loggedHours);

        if (!isNaN(estimated) && estimated > 0 && !isNaN(logged)) {
            const percent = (logged / estimated) * 100;
            return Math.max(0, Math.round(percent));
        }

        if (item.completion && item.completion.includes('%')) {
            return Math.max(0, parseFloat(item.completion.replace('%', '')));
        }

        return 0;
    }

    // getProgressState(item) {
    //     const today = new Date();
    //     today.setHours(0, 0, 0, 0);

    //     const startDate = item.StartDate ? new Date(item.StartDate) : null;
    //     const endDate = item.EndDate ? new Date(item.EndDate) : null;

    //     if (startDate) startDate.setHours(0, 0, 0, 0);
    //     if (endDate) endDate.setHours(0, 0, 0, 0);

    //     const status = item.Status;

    //     const estimated = parseFloat(item.EstimatedHours ?? item.estimatedHours);
    //     const logged = parseFloat(item.LoggedHours ?? item.loggedHours);
    //     const completion = this.calculateCompletion(item);

    //     const isCompleted = status && status.toLowerCase() === 'completed';

    //     const isFullyComplete = completion >= 100;

    //     if (isCompleted || isFullyComplete) {
    //         if (!isNaN(estimated) && estimated > 0 && !isNaN(logged)) {
    //             const diff = logged - estimated;
    //             if (diff > 0) {
    //                 return {
    //                     state: 'completedOverrun',
    //                     color: '#8e44ad',
    //                     label: `Completed / Overrun (+${diff.toFixed(1)}h)`
    //                 };
    //             } else {
    //                 const remain = Math.abs(diff);
    //                 const remainText = remain > 0 ? ` (${remain.toFixed(1)}h remaining)` : '';
    //                 return {
    //                     state: 'completed',
    //                     color: '#2ecc71',
    //                     label: `Completed On Time${remainText}`
    //                 };
    //             }
    //         }
    //         return { state: 'completed', color: '#2ecc71', label: 'Completed' };
    //     }

    //     if (startDate && startDate < today && (isNaN(logged) || logged === 0 || logged === null)) {
    //         return {
    //             state: 'notStarted',
    //             color: '#95a5a6',
    //             label: 'Not Started'
    //         };
    //     }

    //     if (startDate && endDate && startDate < today && endDate < today) {
    //         let remainText = '';
    //         if (!isNaN(estimated) && estimated > 0) {
    //             const safeLogged = !isNaN(logged) ? logged : 0;
    //             const remaining = Math.max(0, estimated - safeLogged);
    //             remainText = ` (${remaining.toFixed(1)}h remaining)`;
    //         }
    //         return {
    //             state: 'overdue',
    //             color: '#e74c3c',
    //             label: `Overdue (late hours${remainText})`
    //         };
    //     }

    //     if (!isNaN(estimated) && estimated > 0 && !isNaN(logged) && logged > estimated) {
    //         const extra = logged - estimated;
    //         return {
    //             state: 'overrun',
    //             color: '#8e44ad',
    //             label: `Overrun (+${extra.toFixed(1)}h)`
    //         };
    //     }

    //     return {
    //         state: 'normal',
    //         color: '#2ecc71',
    //         label: `${Math.round(completion)}%`
    //     };
    // }


    getProgressState(item) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = item.StartDate ? new Date(item.StartDate) : null;
        const endDate = item.EndDate ? new Date(item.EndDate) : null;

        if (startDate) startDate.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(0, 0, 0, 0);

        const status = item.Status ? item.Status.toLowerCase() : '';

        const estimated = parseFloat(item.EstimatedHours ?? item.estimatedHours);
        const logged = parseFloat(item.LoggedHours ?? item.loggedHours);
        const completion = this.calculateCompletion(item);

        const isCompleted = status === 'completed';

        if (isCompleted) {
            return { state: 'completed', color: '#2ecc71', label: 'Completed' };
        }

        if (startDate && startDate < today && (isNaN(logged) || logged === 0 || logged === null)) {
            return { state: 'notStarted', color: '#95a5a6', label: 'Not Started' };
        }

        if (!isNaN(estimated) && estimated > 0 && !isNaN(logged) && logged > estimated) {
            const extra = logged - estimated;
            return {
                state: 'overdue', color: '#e74c3c', label: `Overdue (+${extra.toFixed(1)}h)`
            };
        }

        if (startDate && endDate && startDate < today && endDate < today) {
            let remainText = '';
            if (!isNaN(estimated) && estimated > 0) {
                const safeLogged = !isNaN(logged) ? logged : 0;
                const remaining = Math.max(0, estimated - safeLogged);
                remainText = ` (${remaining.toFixed(1)}h remaining)`;
            }
            return {
                state: 'overdue',
                color: '#e74c3c',
                label: `Overdue${remainText}`
            };
        }

        return {
            state: 'normal',
            color: '#2ecc71',
            label: `${Math.round(completion)}%`
        };
    }


    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    flattenData(data, parentId = null, level = 0) {
        let result = [];
        data.forEach(item => {
            const hasChildren = item._children && item._children.length > 0;
            const idPrefix = item.Id ? item.Id.substring(0, 3) : '';

            const timelineProps = this.computeTimelineProps(item);

            // Completion derived from status/estimated/logged hours (fallback to provided value)
            const computedCompletion = this.calculateCompletion(item);
            let completion = item.completion || `${Math.round(computedCompletion)}%`;

            result.push({
                Id: item.Id,
                Name: item.Name,
                StartDate: item.StartDate,
                EndDate: item.EndDate,
                Status: item.Status,
                completion: completion,
                progress: this.getCompletionValue(item),
                statusClass: this.getStatusClass(item.Status),
                EstimatedHours: item.EstimatedHours ? Number(item.EstimatedHours).toFixed(1) : '',
                LoggedHours: item.LoggedHours ? Number(item.LoggedHours).toFixed(1) : '',
                sequence: item.sequence,
                parentId,
                level,
                expanded: false,
                hasChildren,
                disableAdd: idPrefix === 'a04',
                addTooltip: this.getAddTooltip(item.sequence),
                ...timelineProps
            });

            if (hasChildren) {
                result = result.concat(
                    this.flattenData(item._children, item.Id, level + 1)
                );
            }
        });
        return result;
    }

    getAddTooltip(sequence) {
        if (!sequence) return '';

        const depth = sequence.split('.').length;

        switch (depth) {
            case 1:
                return 'Create Milestone';
            case 2:
                return 'Create Task-List';
            case 3:
                return 'Create Task';
            default:
                return '';
        }
    }

    get visibleRows() {
        debugger;
        const visibleRows = this.rows
            .filter(row => {
                if (!row.parentId) return true;
                const parent = this.rows.find(r => r.Id === row.parentId);
                return parent && parent.expanded;
            })
            .map(row => ({
                ...row,
                indentStyle: `padding-left:${row.level * 1.5}rem`,
                toggleIcon: row.expanded ? 'utility:chevrondown' : 'utility:chevronright',
                rowStyle: `height: 44px;`
            }));

        if (this.template.querySelector('.fixed-columns .tree-table') &&
            this.template.querySelector('.gantt-table')) {
            return visibleRows;
        }

        return visibleRows;
    }

    getStatusClass(status) {
        if (!status) return '';
        const normalized = status.toLowerCase();
        if (normalized.includes('completed')) return 'status-completed';
        if (normalized.includes('progress')) return 'status-inprogress';
        if (normalized.includes('active')) return 'status-active';
        if (normalized.includes('deferred')) return 'status-deferred';
        if (normalized.includes('cancel')) return 'status-cancelled';
        if (normalized.includes('assigned')) return 'status-assigned';
        if (normalized.includes('open')) return 'status-open';
        return 'status-default';
    }

    toggleRow(event) {
        const rowId = event.currentTarget.dataset.id;
        const clickedRow = this.rows.find(r => r.Id === rowId);
        const isExpanding = !clickedRow.expanded;

        this.rows = this.rows.map(row => {
            if (row.Id === rowId) {
                return { ...row, expanded: isExpanding };
            }
            if (!isExpanding && this.isDescendant(row, rowId)) {
                return { ...row, expanded: false };
            }
            return row;
        });
        this.rows = [...this.rows];
    }

    isDescendant(row, parentId) {
        let currentParentId = row.parentId;
        while (currentParentId) {
            if (currentParentId === parentId) return true;
            const parent = this.rows.find(r => r.Id === currentParentId);
            currentParentId = parent ? parent.parentId : null;
        }
        return false;
    }

    handleNavigate(event) {
        const recordId = event.currentTarget.dataset.id;
        const pageReference = {
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                actionName: 'view'
            }
        };
        this[NavigationMixin.GenerateUrl](pageReference)
            .then(url => {
                window.open(url, "_blank");
            })
            .catch(error => {
                console.error("Error generating URL:", error);
            });
    }

    handleEdit(event) {
        const recordId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                actionName: 'edit'
            }
        });
    }

    handleAdd(event) {
        debugger;
        const recordId = event.currentTarget.dataset.id;
        const idStartWith = recordId ? recordId.substring(0, 3) : '';

        if (idStartWith === 'a00') {
            const defaultValues = encodeDefaultFieldValues({ Project__c: recordId });

            this[NavigationMixin.Navigate]({
                type: 'standard__objectPage',
                attributes: {
                    objectApiName: 'Milestone__c',
                    actionName: 'new'
                },
                state: {
                    defaultFieldValues: defaultValues
                }
            });
        }
        if (idStartWith === 'a02') {
            getRecordDetails({ recordId : recordId })
                .then(projectId => {
                    const defaultValues = encodeDefaultFieldValues({
                        Milestone__c: recordId,
                        Project__c: projectId
                    });

                    this[NavigationMixin.Navigate]({
                        type: 'standard__objectPage',
                        attributes: {
                            objectApiName: 'Task_List__c',
                            actionName: 'new'
                        },
                        state: {
                            defaultFieldValues: defaultValues
                        }
                    });
                })
                .catch(error => {
                    console.error('Error:', error);
                });
        }

        else if (idStartWith === 'a03') {
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
        else {
            console.error('No matching prefix found for ID:', recordId);
        }
    }

    createNewProject() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Project__c',
                actionName: 'new'
            }
        });
    }

    handleUser(event) {
        const recordId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                actionName: 'edit'
            }
        });
    }

    handleGanttClick(event) {
        debugger;
        const rowId = event.currentTarget.dataset.rowId;
        const row = this.rows.find(r => r.Id === rowId);

        if (row) {
            this.showToast(
                'Timeline Details',
                `Project: ${row.Name}<br/>${row.timelineTitle}`,
                'info'
            );
        }
    }

    updateDateRange() {
        debugger;
        const { minDate, maxDate } = this.getActualDateRange();
        let startDate, endDate;

        switch (this.selectedDateFilter) {
            case 'day':
                startDate = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
                endDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
                break;
            case 'month':
                startDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
                endDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
                break;
            case 'year':
                startDate = new Date(minDate.getFullYear(), 0, 1);
                endDate = new Date(maxDate.getFullYear(), 11, 31);
                break;
            default:
                startDate = minDate;
                endDate = maxDate;
        }

        this.filterStartDate = startDate.toISOString().substring(0, 10);
        this.filterEndDate = endDate.toISOString().substring(0, 10);

        this.generateTimelineMonths();
        this.calculateTodayPosition();

        this.rows = this.flattenData(this.gridData);
    }
}