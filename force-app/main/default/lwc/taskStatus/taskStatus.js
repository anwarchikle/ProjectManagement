import { LightningElement, api, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import USER_ID from '@salesforce/user/Id';
import getTasksByProject from '@salesforce/apex/taskController.getTasksByProject';

const FIELDS = ['User.IsActive']; // Add any user fields you need

export default class TaskStatus extends LightningElement {
    @api projectId;
    @track tasks = [];
    @track taskStats = {
        open: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
        total: 0
    };
    @track error;
    @track loading = true;
    
    currentUserId = USER_ID;

    @wire(getRecord, { recordId: USER_ID, fields: FIELDS })
    userDetails;

    // FIXED: Added @wire decorator and pass projectId to Apex
    @wire(getTasksByProject, { projectId: '$projectId' })
    wiredTasks({ error, data }) {
        this.loading = true;

        if (data) {
            console.log('Tasks received:', data); // Debug log
            this.tasks = data.map(task => {
                return {
                    ...task,
                    iconName: this.getTaskIcon(task.Status),
                    formattedDate: task.ActivityDate 
                        ? this.formatDate(task.ActivityDate) 
                        : null
                };
            });

            this.calculateTaskStats(this.tasks);
            this.error = undefined;
        } 
        else if (error) {
            console.error('Error fetching tasks:', error);
            this.error = error;
            this.tasks = [];
        }

        this.loading = false;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    getTaskIcon(status) {
        switch (status) {
            case 'Completed':
            case 'Closed':
                return 'utility:check';

            case 'In Progress':
            case 'Working':
                return 'utility:refresh';

            case 'Not Started':
            case 'Open':
                return 'utility:clock';

            default:
                return 'utility:task';
        }
    }
    
    calculateTaskStats(tasks) {
        // Reset stats
        this.taskStats = {
            open: 0,
            inProgress: 0,
            completed: 0,
            overdue: 0,
            total: tasks.length
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time part for accurate comparison
        
        tasks.forEach(task => {
            // Count by status
            switch(task.Status) {
                case 'Not Started':
                case 'Open':
                    this.taskStats.open++;
                    break;
                case 'In Progress':
                case 'Working':
                    this.taskStats.inProgress++;
                    break;
                case 'Completed':
                case 'Closed':
                    this.taskStats.completed++;
                    break;
            }

            // Check for overdue (if due date passed and not completed)
            if (task.ActivityDate && 
                task.Status !== 'Completed' && 
                task.Status !== 'Closed') {
                
                const dueDate = new Date(task.ActivityDate);
                dueDate.setHours(0, 0, 0, 0);
                
                if (dueDate < today) {
                    this.taskStats.overdue++;
                }
            }
        });
    }

    get hasTasks() {
        return this.tasks.length > 0;
    }

    get displayStats() {
        return [
            { label: 'Open', value: this.taskStats.open, color: '#ffb74d' },
            { label: 'In Progress', value: this.taskStats.inProgress, color: '#64b5f6' },
            { label: 'Completed', value: this.taskStats.completed, color: '#81c784' },
            { label: 'Overdue', value: this.taskStats.overdue, color: '#e57373' }
        ];
    }

    get totalTasks() {
        return this.taskStats.total;
    }

    get recentTasks() {
        if (!this.tasks.length) return [];
        
        // Return 3 most recent tasks
        return [...this.tasks]
            .sort((a, b) => {
                const dateA = new Date(a.CreatedDate || 0);
                const dateB = new Date(b.CreatedDate || 0);
                return dateB - dateA;
            })
            .slice(0, 3);
    }
}