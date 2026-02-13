import { LightningElement } from 'lwc';

export default class PmHomeLayout extends LightningElement {

    showHome = true;
    showTasks = false;
    showIssues = false;
    showMilestones = false;
    showTimeLogs = false;
    showReports = false;

    resetView() {
        this.showHome = false;
        this.showTasks = false;
        this.showIssues = false;
        this.showMilestones = false;
        this.showTimeLogs = false;
        this.showReports = false;
    }

    openHome() {
        this.resetView();
        this.showHome = true;
    }

    openTasks() {
        this.resetView();
        this.showTasks = true;
    }

    openIssues() {
        this.resetView();
        this.showIssues = true;
    }

    openMilestones() {
        this.resetView();
        this.showMilestones = true;
    }

    openTimeLogs() {
        this.resetView();
        this.showTimeLogs = true;
    }

    openReports() {
        this.resetView();
        this.showReports = true;
    }

    /* Active tab highlighting */
    get homeClass() {
        return this.showHome ? 'active' : '';
    }
    get taskClass() {
        return this.showTasks ? 'active' : '';
    }
    get issueClass() {
        return this.showIssues ? 'active' : '';
    }
    get milestoneClass() {
        return this.showMilestones ? 'active' : '';
    }
    get timelogClass() {
        return this.showTimeLogs ? 'active' : '';
    }
    get reportClass() {
        return this.showReports ? 'active' : '';
    }
}