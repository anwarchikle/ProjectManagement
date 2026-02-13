import { LightningElement, wire, track } from 'lwc';
import getTasks from '@salesforce/apex/taskController.getTasks';
// import updateTaskStatus from '@salesforce/apex/taskController.updateTaskStatus';

export default class PmTaskKanban extends LightningElement {

    @track tasks = [];
    draggedTaskId;
    selectedStatus = '';

    columns = [
        { label: 'Open', status: 'Open', tasks: [] },
        { label: 'Assigned', status: 'Assigned', tasks: [] },
        { label: 'In Progress', status: 'In Progress', tasks: [] },
        { label: 'Testing', status: 'Testing', tasks: [] }
    ];

    @wire(getTasks, { status: '$selectedStatus' })
    wiredTasks({ data }) {
        if (data) {
            this.tasks = data;
            this.mapTasksToColumns();
        }
    }

    mapTasksToColumns() {
        this.columns.forEach(col => col.tasks = []);
        this.tasks.forEach(task => {
            const col = this.columns.find(c => c.status === task.Status__c);
            if (col) col.tasks.push(task);
        });
    }

    handleDragStart(event) {
        this.draggedTaskId = event.target.dataset.id;
    }

    allowDrop(event) {
        event.preventDefault();
    }

    handleDrop(event) {
        const newStatus = event.currentTarget.dataset.status;
        updateTaskStatus({
            taskId: this.draggedTaskId,
            newStatus: newStatus
        }).then(() => {
            this.selectedStatus = ''; // refresh
        });
    }

    handleStatusFilter(event) {
        this.selectedStatus = event.detail.value;
    }
}