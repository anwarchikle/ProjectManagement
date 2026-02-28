import { LightningElement, api, wire, track } from 'lwc';
import getProjectInfo from '@salesforce/apex/projectDashboardProvider.getProjectInfo';
import getDashboardData from '@salesforce/apex/projectDashboardProvider.getDashboardData';

export default class ProjectDashboard extends LightningElement {

    @api recordId;

    // Tooltip
    @track showTooltipFlag = false;

    // Hours
    @track estimatedHours = 0;
    @track loggedHours = 0;
    @track scheduledHours = 0;
    @track billableHours = 0;
    @track nonBillableHours = 0;

    // Actual vs Planned
    @track actualHours = 0;
    @track plannedHours = 0;
    @track loggedPercent = 0;

    @track actualAmount = 0;
    @track budgetedAmount = 0;
    @track budgetPercent = 0;

    // =========================
    // Logged Ring Style
    // =========================
    get loggedRingStyle() {
        const circumference = 2 * Math.PI * 40;
        const offset =
            circumference - (this.loggedPercent / 100) * circumference;

        return `stroke-dasharray: ${circumference};
                stroke-dashoffset: ${offset};`;
    }

    // =========================
    // Project Info (for endDate)
    // =========================
    @wire(getProjectInfo, { projectId: '$recordId' })
    wiredProjectInfo({ data, error }) {
        if (data) {
            if (data.endDate) {
                this.calculateTimeRemaining(data.endDate);
            }
        } else if (error) {
            console.error('Error loading project info', error);
        }
    }

    // =========================
    // Dashboard Data
    // =========================
    @wire(getDashboardData, { projectId: '$recordId' })
    wiredDashboardData({ data, error }) {
        if (data) {
            // Project Hours data
            if (data.projectHours) {
                this.estimatedHours = data.projectHours.estimatedHours || 0;
                this.loggedHours = data.projectHours.loggedHours || 0;
                this.scheduledHours = data.projectHours.scheduledHours || 0;
                this.billableHours = data.projectHours.billableHours || 0;
                this.nonBillableHours = data.projectHours.nonBillableHours || 0;
                this.actualHours = data.projectHours.loggedHours || 0;
                this.plannedHours = data.projectHours.estimatedHours || 0;
                this.calculateLoggedPercentage();
            }

            // ADD THIS: Budget data from Planned_Cost__c and Actual_Cost__c
            if (data.budget) {
                this.actualAmount = data.budget.actualCost || 0;
                this.budgetedAmount = data.budget.plannedCost || 0;
                this.budgetPercent = data.budget.budgetPercentage || 0;

                // If percentage not calculated in Apex, calculate it here
                if (this.budgetPercent === 0 && this.budgetedAmount > 0) {
                    this.calculateBudgetPercentage();
                }
            }

        } else if (error) {
            console.error('Error loading dashboard data', error);
        }
    }

    // =========================
    // Percentage Calculation
    // =========================
    calculateLoggedPercentage() {

        if (this.plannedHours === 0) {
            this.loggedPercent = 0;
            return;
        }

        const percentage =
            (this.actualHours / this.plannedHours) * 100;

        this.loggedPercent =
            Math.min(Math.round(percentage), 100);
    }

    // =========================
    // Tooltip
    // =========================
    showTooltip() {
        this.showTooltipFlag = true;
    }

    hideTooltip() {
        this.showTooltipFlag = false;
    }

    // =========================
    // Time Remaining
    // =========================
    calculateTimeRemaining(endDateString) {

        try {
            const endDate = new Date(endDateString);
            const today = new Date();

            today.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);

            const timeDiff =
                endDate.getTime() - today.getTime();

            const daysRemaining =
                Math.ceil(timeDiff / (1000 * 3600 * 24));

            console.log('Days Remaining:', daysRemaining);

        } catch (error) {
            console.error('Error calculating time', error);
        }
    }
    // Budget Calculation
    get budgetRingStyle() {
        const circumference = 2 * Math.PI * 40;
        const offset = circumference - (this.budgetPercent / 100) * circumference;

        return `stroke-dasharray: ${circumference};
                    stroke-dashoffset: ${offset};`;
    }

    // Add this method to calculate budget percentage
    calculateBudgetPercentage() {
        if (this.budgetedAmount === 0) {
            this.budgetPercent = 0;
            return;
        }

        const percentage = (this.actualAmount / this.budgetedAmount) * 100;
        this.budgetPercent = Math.min(Math.round(percentage), 100);
    }

    // Add these formatted getters
    get actualAmountFormatted() {
        return this.actualAmount.toLocaleString();
    }

    get budgetedAmountFormatted() {
        return this.budgetedAmount.toLocaleString();
    }

}