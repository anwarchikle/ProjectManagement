import { LightningElement, api, track } from 'lwc';
import getProjectData from '@salesforce/apex/projectStatusController.getProjectData';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

export default class ProjectStatusReport extends NavigationMixin(LightningElement) {
    @api recordId;
    @track data;

    connectedCallback() {
        getProjectData({ recordId: this.recordId })
            .then(result => {
                console.log('Project Data:', JSON.stringify(result));
                if (result != null) {
                    this.data = result;
                } else {
                    this.showToast('Error', 'Data is Null', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                this.showToast('Error', error.body?.message || error.message || 'Unknown error', 'error');
            });
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({ title: title, message: message, variant: variant });
        this.dispatchEvent(event);
    }

    get hasMilestones() {
        return this.data?.Milestones__r && this.data.Milestones__r.length > 0;
    }

    get allTasks() {
        if (!this.data?.Milestones__r) {
            console.log('No milestones found');
            return [];
        }
        
        const tasks = [];
        this.data.Milestones__r.forEach(milestone => {
            console.log('Milestone:', milestone.Name);
            if (milestone.Task_Lists__r) {
                milestone.Task_Lists__r.forEach(taskList => {
                    console.log('Task List:', taskList.Name);
                    if (taskList.Tasks__r) {
                        taskList.Tasks__r.forEach(task => {
                            console.log('Task:', task.Name);
                            
                            // Get all task owners
                            let assigneeNames = '--';
                            if (task.Task_Owners__r && task.Task_Owners__r.length > 0) {
                                assigneeNames = task.Task_Owners__r
                                    .map(owner => owner.User__r?.Name || owner.Name)
                                    .filter(name => name) // Remove any null/undefined
                                    .join(', ');
                            }
                            
                            tasks.push({
                                Id: task.Id,
                                Name: task.Name,
                                Status__c: task.Status__c,
                                Priority__c: task.Priority__c,
                                End_Date__c: task.End_Date__c,
                                Completion_Percentage__c: task.Completion_Percentage__c,
                                Actual_Hours__c: task.Actual_Hours__c,
                                assigneeNames: assigneeNames
                            });
                        });
                    }
                });
            }
        });
        
        console.log('Total tasks found:', tasks.length);
        return tasks;
    }

    handlePreview(){
        window.print();
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
}