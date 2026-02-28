import { LightningElement, api, wire, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import ChartJs from '@salesforce/resourceUrl/chartJs';
import getProjects from '@salesforce/apex/ProjectDashboardService.getProjects';
import getProjectDashboardData from '@salesforce/apex/ProjectDashboardService.getProjectDashboardData';
import { initProjectStatusBarChart, initResourceAllocationBarChart } from './barCharts';
import { initRiskDistributionPieChart, initTaskCompletionPieChart } from './pieCharts';

export default class ProjectDashboard extends LightningElement {

    @api recordId; // auto on record page

    @track selectedProjectId;
    @track projectOptions = [];

    @track dashboardData;
    @track dashboardError;

    isChartJsInitialized = false;
    @track isModalOpen = false;
    @track modalChartTitle = '';
    modalChartKey;
    get bugListViewUrl() {
        return '/lightning/o/Issue_Bug__c/list?filterName=My_List';
    }
    get bugRetestListViewUrl() {
        return '/lightning/o/Issue_Bug__c/list?filterName=Retesting';
    }

    get totalTaskViewUrl() {
        return '/lightning/o/Tasks__c/list?filterName=My_Assigned';
    }
    get overDueTaskListViewUrl() {
        return '/lightning/o/Tasks__c/list?filterName=My_Overdue_Open'; 
    }
    get todayTaskListViewUrl() {
        return '/lightning/o/Tasks__c/list?filterName=Todays_Task';
    }
    get upcommingTaskListViewUrl() {
        return '/lightning/o/Tasks__c/list?filterName=Upcoming_Task';
    }

    connectedCallback() {
        debugger;
        if (this.recordId) {
            this.selectedProjectId = this.recordId;
        }
    }

    renderedCallback() {
        debugger;
        if (this.isChartJsInitialized || !this.dashboardData) {
            return;
        }

        console.log('customDashboard: renderedCallback, loading Chart.js, dashboardData =', this.dashboardData);
        
        loadScript(this, ChartJs)
            .then(() => {
                this.isChartJsInitialized = true;
                console.log('customDashboard: Chart.js loaded successfully');
                this.initializeCharts();
            })
            .catch(error => {
                // Keep flag false so we can retry on next render if needed
                this.isChartJsInitialized = false;
                console.error('Error loading Chart.js', error);
            });
    }

    initializeCharts() {
        if (!window.Chart) {
            console.error('customDashboard: window.Chart is not defined. Check Chart.js static resource in Experience Cloud.');
            return;
        }

        const barChartOneCanvas = this.template.querySelector('canvas[data-id="barChartOne"]');
        const barChartTwoCanvas = this.template.querySelector('canvas[data-id="barChartTwo"]');
        const pieChartOneCanvas = this.template.querySelector('canvas[data-id="pieChartOne"]');
        const pieChartTwoCanvas = this.template.querySelector('canvas[data-id="pieChartTwo"]');

        const taskLabels = this.taskStatusSummary.map(s => s.status);
        const taskCounts = this.taskStatusSummary.map(s => s.count);
        const bugLabels  = this.bugStatusSummary.map(s => s.status);
        const bugCounts  = this.bugStatusSummary.map(s => s.count);

        const teamLabels = this.teamMembers.map(m => m.Role__c || 'Unknown');
        const teamData   = this.teamMembers.map(m => m.Allocation__c || 0);

        console.log('customDashboard: initializing charts with', {
            taskLabels,
            taskCounts,
            bugLabels,
            bugCounts,
            teamLabels,
            teamData
        });

        if (barChartOneCanvas) {
            initProjectStatusBarChart(barChartOneCanvas.getContext('2d'), taskLabels, taskCounts);
        }
        if (barChartTwoCanvas) {
            initResourceAllocationBarChart(barChartTwoCanvas.getContext('2d'), teamLabels, teamData);
        }
        if (pieChartOneCanvas) {
            initRiskDistributionPieChart(pieChartOneCanvas.getContext('2d'), taskLabels, taskCounts);
        }
        if (pieChartTwoCanvas) {
            initTaskCompletionPieChart(pieChartTwoCanvas.getContext('2d'), bugLabels, bugCounts);
        }
    }

    get showProjectSelector() {
        return !this.recordId;
    }

    @wire(getProjects, { projectId: '$selectedProjectId' })
    wiredProjects({ data, error }) {
        if (data && this.showProjectSelector) {
            this.projectOptions = data.map(proj => ({
                label: proj.Name,
                value: proj.Id
            }));

            if (!this.selectedProjectId && this.projectOptions.length > 0) {
                this.selectedProjectId = this.projectOptions[0].value;
            }
        }
    }

    @wire(getProjectDashboardData, { projectId: '$selectedProjectId' })
    wiredDashboard({ data, error }) {
        if (data) {
            // Deep clone to strip reactive proxies before passing to Chart.js
            this.dashboardData = JSON.parse(JSON.stringify(data));
            this.dashboardError = undefined;
        } else if (error) {
            this.dashboardError = error;
            this.dashboardData = undefined;
        }
    }

    handleProjectChange(event) {
        this.selectedProjectId = event.detail.value;
    }

    get hasDashboardData() {
        return this.dashboardData !== undefined;
    }

    get teamMembers() {
        return this.dashboardData && this.dashboardData.project && this.dashboardData.project.Project_Teams__r
            ? this.dashboardData.project.Project_Teams__r
            : [];
    }

    get tasks() {
        return this.dashboardData && this.dashboardData.tasks ? this.dashboardData.tasks : [];
    }

    get bugs() {
        return this.dashboardData && this.dashboardData.bugs ? this.dashboardData.bugs : [];
    }

    get bugsWithUrl() {
        return this.bugs.map(b => ({
            ...b,
            url: `/lightning/r/Issue_Bug__c/${b.Id}/view`
        }));
    }

    get taskStatusSummary() {
        return this.dashboardData && this.dashboardData.taskStatusSummary ? this.dashboardData.taskStatusSummary : [];
    }

    get bugStatusSummary() {
        return this.dashboardData && this.dashboardData.bugStatusSummary ? this.dashboardData.bugStatusSummary : [];
    }

    get totalTasks() {
        return this.dashboardData ? this.dashboardData.totalTasks : 0;
    }

    get overdueTasks() {
        return this.dashboardData ? this.dashboardData.overdueTasks : 0;
    }

    get todaysTasks() {
        return this.dashboardData ? this.dashboardData.todaysTasks : 0;
    }

    get upcomingTasks() {
        return this.dashboardData ? this.dashboardData.upcomingTasks : 0;
    }

    get bugsInRetest() {
        return this.dashboardData ? this.dashboardData.bugsInRetest : 0;
    }

    handleChartClick(event) {
        const key   = event.currentTarget.dataset.chartKey;
        const title = event.currentTarget.dataset.chartTitle;

        this.modalChartKey   = key;
        this.modalChartTitle = title;  
        this.isModalOpen     = true;

        setTimeout(() => {
            const modalCanvas = this.template.querySelector('canvas[data-id="modalChart"]');
            if (!modalCanvas) return;

            const ctx        = modalCanvas.getContext('2d');
            const taskLabels = this.taskStatusSummary.map(s => s.status);
            const taskCounts = this.taskStatusSummary.map(s => s.count);
            const bugLabels  = this.bugStatusSummary.map(s => s.status);
            const bugCounts  = this.bugStatusSummary.map(s => s.count);
            const teamLabels = this.teamMembers.map(m => m.Role__c || 'Unknown');
            const teamData   = this.teamMembers.map(m => m.Allocation__c || 0);

            if (key === 'barTasks') {
                initProjectStatusBarChart(ctx, taskLabels, taskCounts);
            } else if (key === 'barTeam') {
                initResourceAllocationBarChart(ctx, teamLabels, teamData);
            } else if (key === 'pieTasks') {
                initRiskDistributionPieChart(ctx, taskLabels, taskCounts);
            } else if (key === 'pieBugs') {
                initTaskCompletionPieChart(ctx, bugLabels, bugCounts);
            }
        }, 0);
    }

    closeModal() {
        this.isModalOpen     = false;
        this.modalChartKey   = null;
        this.modalChartTitle = '';
    }
}