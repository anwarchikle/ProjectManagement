import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

import getActiveUsers from '@salesforce/apex/ResourcePlannerController.getActiveUsers';
import getProjectsByUser from '@salesforce/apex/ResourcePlannerController.getProjectsByUser';
import getTasksByProject from '@salesforce/apex/ResourcePlannerController.getTasksByProject';
import getProjectDailyTotals from '@salesforce/apex/ResourcePlannerController.getProjectDailyTotals';
import getUserDailyTotals from '@salesforce/apex/ResourcePlannerController.getUserDailyTotals';

export default class ResourcePlanner extends NavigationMixin(LightningElement) {
    @track users = [];
    @track visibleDays = [];
    @track filteredUsers = [];

    startDate;
    endDate;
    searchKey = '';
    showNoResultsMessage = false;

    hourRanges = {
        fullDay: 8,
        partialLow: 4,
        partialHigh: 7
    };

    get hasUsers() {
        return this.filteredUsers && this.filteredUsers.length > 0;
    }

    /* ================= INIT ================= */

    connectedCallback() {
        this.setDefaultDates();
        this.loadUsers();
    }

    /* ================= DATE HANDLING ================= */

    setDefaultDates() {
        const today = new Date();
        this.startDate = this.formatDate(today);

        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 7);
        this.endDate = this.formatDate(endDate);

        this.buildVisibleDays();
    }

    handleSearch(event) {
    this.searchKey = event.target.value.toLowerCase();

    if (!this.searchKey) {
        this.filteredUsers = [...this.users];
        this.showNoResultsMessage = false;
        return;
    }

    this.filteredUsers = this.users.filter(user =>
        user.fullName.toLowerCase().includes(this.searchKey)
    );

    this.showNoResultsMessage = this.filteredUsers.length === 0;
}

    showCurrentMonth() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        this.startDate = this.formatDate(firstDay);
        this.endDate = this.formatDate(lastDay);

        this.buildVisibleDays();
        this.refreshAggregates();
    }

    handleStartDateChange(event) {
        this.startDate = event.target.value;
        this.buildVisibleDays();
        this.refreshAggregates();
    }

    handleEndDateChange(event) {
        this.endDate = event.target.value;
        this.buildVisibleDays();
        this.refreshAggregates();
    }

    buildVisibleDays() {
        const days = [];
        let d = new Date(this.startDate);
        const end = new Date(this.endDate);

        while (d <= end) {
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

            days.push({
                key: this.formatDate(d),
                label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                fullLabel: d.toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                isWeekend
            });

            d.setDate(d.getDate() + 1);
        }

        this.visibleDays = days;
    }

    formatDate(date) {
        const d = date instanceof Date ? date : new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /* ================= USER LOADING ================= */

    async loadUsers() {
        const data = await getActiveUsers();

        this.users = data.map(u => ({
            userId: u.userId,
            fullName: u.name,
            initials: this.getInitials(u.name),
            isOpen: false,
            projects: [],
            dayTotals: this.createEmptyDays(),
            hasLoadedProjects: false,
            hasProjects: false
        }));

        this.filteredUsers = [...this.users];
        this.refreshAggregates();
    }

    async refreshAggregates() {
        for (const user of this.users) {
            await this.loadUserDailyTotals(user);
            if (user.hasLoadedProjects) {
                for (const project of user.projects) {
                    await this.loadProjectDailyTotals(user, project);
                }
            }
        }
        this.filteredUsers = [...this.users];
    }

    async loadUserDailyTotals(user) {
        const data = await getUserDailyTotals({
            userId: user.userId,
            startDate: this.startDate,
            endDate: this.endDate
        });

        user.dayTotals = this.mapAggregateToDays(data);
    }

    async loadProjectDailyTotals(user, project) {
        const data = await getProjectDailyTotals({
            userId: user.userId,
            projectId: project.projectId,
            startDate: this.startDate,
            endDate: this.endDate
        });

        project.dayTotals = this.mapAggregateToDays(data);
    }

    mapAggregateToDays(data) {
        const map = {};
        data.forEach(d => {
            map[this.formatDate(d.allocationDate)] = d.hours;
        });

        return this.visibleDays.map(day => {
            const value = map[day.key] || 0;
            return {
                key: day.key,
                value,
                isWeekend: day.isWeekend,
                cssClass: this.getHourCssClass(value),
                title: this.getHourTitle(value, day.fullLabel)
            };
        });
    }

    /* ================= PROJECT / TASK ================= */

    async toggleUser(event) {
        const user = this.users.find(u => u.userId === event.currentTarget.dataset.id);
        if (!user) return;

        user.isOpen = !user.isOpen;

        if (user.isOpen && !user.hasLoadedProjects) {
            const projects = await getProjectsByUser({ userId: user.userId });
            user.projects = projects.map(p => ({
                projectId: p.projectId,
                name: p.name,
                isOpen: false,
                tasks: [],
                dayTotals: this.createEmptyDays(),
                hasTasks: false
            }));
            user.hasLoadedProjects = true;
            user.hasProjects = projects.length > 0;
        }

        this.users = [...this.users];
    }

    async toggleProject(event) {
    event.stopPropagation();
    const { user: userId, project: projectId } = event.currentTarget.dataset;

    const user = this.users.find(u => u.userId === userId);
    const project = user?.projects.find(p => p.projectId === projectId);
    if (!project) return;

    project.isOpen = !project.isOpen;

    if (project.isOpen && project.tasks.length === 0) {
        const taskData = await getTasksByProject({ userId, projectId });

        const taskMap = new Map();

        taskData.forEach(t => {
            if (!taskMap.has(t.taskId)) {
                taskMap.set(t.taskId, {
                    taskId: t.taskId,
                    name: t.subject,
                    allocations: {}
                });
            }

            taskMap.get(t.taskId).allocations[
                this.formatDate(t.allocationDate)
            ] = t.allocatedHours;
        });

        project.tasks = Array.from(taskMap.values()).map(task => {
    const days = this.visibleDays.map(day => {
        const hours = task.allocations[day.key] || 0; // ✅ FIX

        return {
            key: day.key,
            hours,
            cssClass: this.getHourCssClass(hours),
            title: this.getHourTitle(hours, day.fullLabel),
            isWeekend: day.isWeekend
        };
    });

    return {
        taskId: task.taskId,
        name: task.name,
        days
    };
});

        project.hasTasks = project.tasks.length > 0;
        this.rollupProjectFromTasks(project);
    }

    this.users = [...this.users];
}


    /* ================= HELPERS ================= */

    createEmptyDays() {
        return this.visibleDays.map(d => ({
            key: d.key,
            value: 0,
            isWeekend: d.isWeekend,
            cssClass: this.getHourCssClass(0),
            title: this.getHourTitle(0, d.fullLabel)
        }));
    }

    getInitials(name) {
        return name?.split(' ').map(x => x[0]).join('').substring(0, 2).toUpperCase();
    }

    getHourCssClass(hours) {
        const h = Number(hours);
        if (h === 0) return 'util-zero';
        if (h < this.hourRanges.partialLow) return 'util-partial-low';
        if (h < this.hourRanges.fullDay) return 'util-partial-high';
        if (h === this.hourRanges.fullDay) return 'util-full';
        return 'util-over';
    }

    getHourTitle(hours, label) {
        return `${label}\n${hours} hours`;
    }
    /* ================= TASK → PROJECT ROLLUP ================= */

rollupProjectFromTasks(project) {
    const totals = {};

    // Sum hours per day from all tasks
    project.tasks.forEach(task => {
        task.days.forEach(d => {
            totals[d.key] = (totals[d.key] || 0) + d.hours;
        });
    });

    // Rebuild project.dayTotals from summed task data
    project.dayTotals = this.visibleDays.map(day => {
        const value = totals[day.key] || 0;
        return {
            key: day.key,
            value,
            isWeekend: day.isWeekend,
            cssClass: this.getHourCssClass(value),
            title: this.getHourTitle(value, day.fullLabel)
        };
    });
}


    /* ================= NAV ================= */

    handleProjectNavigate(event) {
        const projectId = event.currentTarget.dataset.project;
        this.openRecord(projectId);
    }

    handleTaskNavigate(event) {
        const taskId = event.currentTarget.dataset.task;
        this.openRecord(taskId);
    }

    openRecord(recordId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId, actionName: 'view' }
        });
    }

    
}