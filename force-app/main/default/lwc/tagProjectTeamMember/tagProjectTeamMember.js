import { LightningElement, api, track, wire } from 'lwc';
import searchUsers from '@salesforce/apex/taskController.searchUsers';
import assignProjectMembers from '@salesforce/apex/taskController.assignProjectMembers';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference } from 'lightning/navigation';

export default class TagProjectTeamMembers extends LightningElement {

    @api recordId; // Project Id

    @track searchTerm = '';
    @track users = [];
    @track selectedUsers = [];

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

    get disableAssignButton() {
        return this.selectedUsers.length === 0;
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
                    this.users = result;
                })
                .catch(() => {
                    this.users = [];
                });
        }, 300);
    }

    handleUserSelect(event) {
        const userId = event.currentTarget.dataset.id;
        const userName = event.currentTarget.dataset.name;

        const exists = this.selectedUsers.some(u => u.Id === userId);
        if (!exists) {
            this.selectedUsers = [...this.selectedUsers, { Id: userId, Name: userName }];
        }

        this.searchTerm = '';
        this.users = [];
    }

    handleRemoveUser(event) {
        const userId = event.target.name;
        this.selectedUsers = this.selectedUsers.filter(u => u.Id !== userId);
    }

    handleAssign() {
    const userIds = this.selectedUsers.map(u => u.Id);

    assignProjectMembers({
        projectId: this.recordId,
        userIds: userIds
    })
    .then(result => {

        if (result.includes('duplicate')) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Project Team Assignment',
                    message: 'Already assigned to this project...',
                    variant: 'warning'
                })
            );
        } else {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Project Team Assignment',
                    message: 'Project team members assigned successfully!',
                    variant: 'success'
                })
            );

            // ✅ same auto refresh after 3 seconds
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        }

        // Clear selected users after assigning
        this.selectedUsers = [];

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

}