import { LightningElement, api, track, wire } from 'lwc';
import searchUsers from '@salesforce/apex/taskController.searchUsers';
import getUserDetails from '@salesforce/apex/taskController.getUserDetails';
import getProjectTeamMembers from '@salesforce/apex/taskController.getProjectTeamMembers';
import assignProjectMembersWithDetails from '@salesforce/apex/taskController.assignProjectMembersWithDetails';
import getUserRoleOptions from '@salesforce/apex/taskController.getUserRoleOptions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference } from 'lightning/navigation';

export default class TagProjectTeamMembers extends LightningElement {

    @api recordId; // Project Id

    @track searchTerm = '';
    @track users = [];
    @track selectedUsers = [];
    @track userDetails = [];

    @track isAllocationStep = false;

    @track roleOptions = [];

    delayTimeout;

    @wire(CurrentPageReference)
    wiredPageRef(pageRef) {
        if (pageRef && !this.recordId) {
            this.recordId =
                pageRef.attributes?.recordId ||
                pageRef.state?.recordId ||
                pageRef.state?.c__recordId;
        }
    }

    @wire(getProjectTeamMembers, { projectId: '$recordId' })
    wiredTeamMembers({ data, error }) {
        if (data) {
            this.userDetails = (data || []).map(u => ({
                ...u,
                allocationPercent: u.allocationPercent || 0,
                isActive: u.isActive !== null && u.isActive !== undefined ? u.isActive : true
            }));

            // Build selectedUsers pills for existing members
            this.selectedUsers = this.userDetails.map(u => ({ Id: u.userId, Name: u.name }));

            if (this.userDetails.length) {
                this.isAllocationStep = true;
            }
        }
    }

    connectedCallback() {
        this.loadRoleOptions();
    }

    loadRoleOptions() {
        getUserRoleOptions()
            .then(result => {
                this.roleOptions = result || [];
            })
            .catch(() => {
                this.roleOptions = [];
            });
    }

    get disableAssignButton() {
        return this.selectedUsers.length === 0;
    }

    get disableSaveButton() {
        return !this.isAllocationStep || !this.userDetails.length;
    }

    get rolePicklistOptions() {
        if (this.roleOptions && this.roleOptions.length) {
            return this.roleOptions;
        }

        const uniqueRoles = Array.from(
            new Set(
                (this.userDetails || [])
                    .map(u => u.role)
                    .filter(r => r)
            )
        );

        return uniqueRoles.map(r => ({ label: r, value: r }));
    }

    handleKeyUp(event) {
        this.searchTerm = event.target.value;

        if (!this.searchTerm || this.searchTerm.length < 2) {
            this.users = [];
            return;
        }

        clearTimeout(this.delayTimeout);

        this.delayTimeout = setTimeout(() => {
            searchUsers({ searchKey: this.searchTerm })
                .then(result => {
                    const selectedIds = new Set(this.selectedUsers.map(u => u.Id));
                    this.users = (result || []).filter(u => !selectedIds.has(u.Id));
                    this.isAllocationStep = false;
                })
                .catch(() => {
                    this.users = [];
                });
        }, 300);
    }

    handleUserSelect(event) {
        const userId = event.currentTarget.dataset.id;
        const userName = event.currentTarget.dataset.name;

        const existsInSelected = this.selectedUsers.some(u => u.Id === userId);
        if (!existsInSelected) {
            this.selectedUsers = [...this.selectedUsers, { Id: userId, Name: userName }];
        }

        // Clear search results
        this.searchTerm = '';
        this.users = [];

        // If this user is already in the allocation table, do nothing further
        const existsInDetails = this.userDetails.some(u => u.userId === userId);
        if (existsInDetails) {
            this.isAllocationStep = true;
            return;
        }

        // Fetch details only for the newly added user
        getUserDetails({ userIds: [userId] })
            .then(result => {
                const newRows = (result || []).map(u => ({
                    ...u,
                    allocationPercent: 0,
                    ratePerHour: u.ratePerHour,
                    role: u.role,
                    isActive: true
                }));

                this.userDetails = [...this.userDetails, ...newRows];
                if (this.userDetails.length) {
                    this.isAllocationStep = true;
                }
            })
            .catch(() => {
                // if fetching details fails, keep existing table as-is
            });
    }

    handleRemoveUser(event) {
        const userId = event.target.name;
        this.selectedUsers = this.selectedUsers.filter(u => u.Id !== userId);

        if (this.isAllocationStep) {
            this.userDetails = this.userDetails.filter(u => u.userId !== userId);
        }
    }

    // handleNext() {
    //     const userIds = this.selectedUsers.map(u => u.Id);

    //     if (!userIds.length) {
    //         this.dispatchEvent(
    //             new ShowToastEvent({
    //                 title: 'Validation',
    //                 message: 'Please select at least one user before proceeding.',
    //                 variant: 'warning'
    //             })
    //         );
    //         return;
    //     }

    //     getUserDetails({ userIds })
    //         .then(result => {
    //             this.userDetails = (result || []).map(u => ({
    //                 ...u,
    //                 allocationPercent: 0,
    //                 ratePerHour: u.ratePerHour,
    //                 role: u.role,
    //                 isActive: true
    //             }));
    //             this.isAllocationStep = true;
    //         })
    //         .catch(error => {
    //             this.dispatchEvent(
    //                 new ShowToastEvent({
    //                     title: 'Error',
    //                     message: error.body?.message || 'Unable to fetch user details',
    //                     variant: 'error'
    //                 })
    //             );
    //         });
    // }

    handleAllocationChange(event) {
        const userId = event.target.dataset.id;
        const value = event.target.value;
        const numeric = value ? parseFloat(value) : 0;

        this.userDetails = this.userDetails.map(u =>
            u.userId === userId
                ? { ...u, allocationPercent: isNaN(numeric) ? 0 : numeric }
                : u
        );
    }

    handleRateChange(event) {
        const userId = event.target.dataset.id;
        const value = event.target.value;
        const numeric = value ? parseFloat(value) : null;

        this.userDetails = this.userDetails.map(u =>
            u.userId === userId
                ? { ...u, ratePerHour: numeric }
                : u
        );
    }

    handleRoleChange(event) {
        const userId = event.target.dataset.id;
        const value = event.detail.value;

        this.userDetails = this.userDetails.map(u =>
            u.userId === userId
                ? { ...u, role: value }
                : u
        );
    }

    handleActiveChange(event) {
        const userId = event.target.dataset.id;
        const checked = event.target.checked;

        this.userDetails = this.userDetails.map(u =>
            u.userId === userId
                ? { ...u, isActive: checked }
                : u
        );
    }

    handleSaveAllocations() {
        if (!this.recordId) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Project Id is missing. Please open this from a Project record.',
                    variant: 'error'
                })
            );
            return;
        }
        const allocations = this.userDetails.map(u => ({
            userId: u.userId,
            allocationPercent: u.allocationPercent || 0,
            ratePerHour: u.ratePerHour,
            role: u.role,
            isActive: u.isActive
        }));

        assignProjectMembersWithDetails({
            projectId: this.recordId,
            allocations
        })
            .then(result => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Project Team Assignment',
                        message: result || 'Project team members assigned successfully!',
                        variant: 'success'
                    })
                );

                setTimeout(() => {
                    window.location.reload();
                }, 3000);

                this.selectedUsers = [];
                this.userDetails = [];
                this.isAllocationStep = false;
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: error.body?.message || 'Something went wrong while assigning project team',
                        variant: 'error'
                    })
                );
            });
    }

    handleCancelAllocations() {
        this.isAllocationStep = false;
        this.userDetails = [];
    }
}