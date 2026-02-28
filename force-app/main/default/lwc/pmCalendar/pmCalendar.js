import { LightningElement, track } from 'lwc';
import getAllProjects             from '@salesforce/apex/PMCalendarController.getAllProjects';
import getMilestonesByProject     from '@salesforce/apex/PMCalendarController.getMilestonesByProject';
import getCalendarItemsByProject  from '@salesforce/apex/PMCalendarController.getCalendarItemsByProject'; // ✅ NEW method

export default class PmCalendar extends LightningElement {

    @track projectOptions = [];
    @track milestones     = [];
    @track upcomingItems  = [];

    selectedProject;
    selectedCalendarProject;

    connectedCallback() {
        this.loadProjects();
    }

  
    loadProjects() {
        getAllProjects()
            .then(data => {
                this.projectOptions = data.map(p => ({ label: p.Name, value: p.Id }));
            })
            .catch(error => console.error('Error loading projects:', error));
    }

    handleProjectChange(event) {
        this.selectedProject = event.detail.value;
        this.loadMilestones();
    }

    
    handleCalendarProjectChange(event) {
        this.selectedCalendarProject = event.detail.value;
        this.loadCalendarItems();
    }


    loadMilestones() {
        if (!this.selectedProject) { this.milestones = []; return; }

        getMilestonesByProject({ projectId: this.selectedProject })
            .then(data => {
                const today = new Date();

                this.milestones = data.map(ms => {
                    const end   = ms.End_Date__c   ? new Date(ms.End_Date__c)   : null;
                    const start = ms.Start_Date__c ? new Date(ms.Start_Date__c) : null;

                    let dotClass  = 'ms-dot dot-white';
                    let nameClass = 'ms-name';

                    if (ms.Status__c === 'Completed' && end && end < today) {
                        dotClass  = 'ms-dot dot-green';
                        nameClass = 'ms-name ms-strike';
                    } else if (ms.Status__c !== 'Completed' && end && end < today) {
                        dotClass = 'ms-dot dot-red';
                    } else if (start && end && start <= today && end >= today) {
                        dotClass = 'ms-dot dot-blue';
                    }

                    return { ...ms, dotClass, nameClass };
                });
            })
            .catch(error => console.error('Error loading milestones:', error));
    }

   
    loadCalendarItems() {
        if (!this.selectedCalendarProject) { this.upcomingItems = []; return; }

        getCalendarItemsByProject({ projectId: this.selectedCalendarProject })
            .then(data => {
                const actionBadgeMap = {
                    'Meeting'    : 'badge-meeting',
                    'Client Visit'     : 'badge-Client Visit',
                    'Dependency' : 'badge-dependency',
                    'Decision'   : 'badge-decision',
                    'Milestone'  : 'badge-milestone',
                    'Risk'       : 'badge-risk'
                };

                this.upcomingItems = data.map(item => {
                    const d = item.End_Date_Time__c ? new Date(item.End_Date_Time__c) : null;
                    let displayDate = '';
                    if (d) {
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day   = String(d.getDate()).padStart(2, '0');
                        displayDate = `${month}-${day}`;
                    }

                    const badgeClass = `item-badge ${actionBadgeMap[item.Action__c] || 'badge-default'}`;
                    return { ...item, displayDate, badgeClass };
                });
            })
            .catch(error => console.error('Error loading calendar items:', error));
    }

    get hasMilestones() {
        return this.milestones && this.milestones.length > 0;
    }

    get hasUpcoming() {
        return this.upcomingItems && this.upcomingItems.length > 0;
    }
}