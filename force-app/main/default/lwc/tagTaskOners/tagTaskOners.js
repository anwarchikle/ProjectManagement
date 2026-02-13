import { LightningElement,api, track,wire } from 'lwc';
import searchUsers from '@salesforce/apex/taskController.searchUsers';
import assignTaskOwners from '@salesforce/apex/taskController.assignTaskOwners';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference } from 'lightning/navigation';

export default class TagTaskOwners extends LightningElement {

     @api recordId;

    @track searchTerm = '';
    @track users = [];
    @track selectedUsers = [];


    @wire(CurrentPageReference)
    wiredPageRef(pageRef) {
        if (pageRef && !this.recordId) {
            this.recordId =
                pageRef.attributes?.recordId ||
                pageRef.state?.recordId ||
                pageRef.state?.c__recordId;

            console.log('✅ Community Task Id:', this.recordId);
        }
    }

    delayTimeout;

    get disableAssignButton() {
        return this.selectedUsers.length === 0;
    }

    handleKeyUp(event) {
       
        this.searchTerm = event.target.value;
        if (!this.searchTerm || this.searchTerm.length <2) {
            this.users = [];
            return;
        }

        
        clearTimeout(this.delayTimeout);

        this.delayTimeout = setTimeout(() => {
           
            searchUsers({ searchKey: this.searchTerm })
                .then(result => {
                    // Just store result for now
                 
                    this.users = result;
                    console.log('Users fetched:', result);
                })
                .catch(error => {
                
                    console.error('Error while searching users', error);
                    this.users = [];
                });
        }, 300);
    }
    
    handleUserSelect(event) {
        const userId = event.currentTarget.dataset.id;
        const userName = event.currentTarget.dataset.name;

        // Prevent duplicate selection
        const alreadySelected = this.selectedUsers.some(
            user => user.Id === userId
        );

        if (!alreadySelected) {
            this.selectedUsers = [
                ...this.selectedUsers,
                { Id: userId, Name: userName }
            ];
        }

        // Reset search input (search-only behavior)
        this.searchTerm = '';
        this.users = [];
    }

    handleRemoveUser(event) {
        const userId = event.target.name;
        this.selectedUsers = this.selectedUsers.filter(user => user.Id !== userId);
    }
    

   handleAssignTask() {
    const userIds = this.selectedUsers.map(u => u.Id);

    assignTaskOwners({
        taskId: this.recordId,
        userIds: userIds
    })
    .then(result => {
     
        if (result.includes('duplicate')) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Task Assignment',
                    message: 'Already assigned to this task...',
                    variant: 'warning'
                })
            );
        } else {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Task Assignment',
                    message: 'Task owners assigned successfully!',
                    variant: 'success'
                })
            );

             setTimeout(() => {
                window.location.reload();
            }, 3000); 
        
        }

        // Clear selected users after assigning
        this.selectedUsers = [];
    })
    .catch(error => {
    console.error('Apex Error:', JSON.stringify(error));

    this.dispatchEvent(
        new ShowToastEvent({
            title: 'Error',
            message: error?.body?.message || error?.message || 'Unknown error',
            variant: 'error'
        })
    );
});
}
}