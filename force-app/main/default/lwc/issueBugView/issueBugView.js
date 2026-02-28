import { LightningElement,api,wire,track } from 'lwc';

export default class IssueBugView extends LightningElement {
    selectedListView = '';
    showMyBugs = true;
    showUATIssues = false;
    showCRLists = false;
    showQAValidation = false;
    showRetest = false;

    handleButtonClick(event) {
        debugger;
        
        if(event.target.value === 'My_Bugs'){
            this.showMyBugs = true;
            this.showUATIssues = false;
            this.showCRLists = false;
            this.showQAValidation = false;
            this.showRetest = false;
            this.selectedListView = event.target.value || 'All';
        }
        else if(event.target.value === 'UAT_Issues'){
            this.showUATIssues = true;
            this.showMyBugs = false;
            this.showCRLists = false;
            this.showQAValidation = false;
            this.showRetest = false;
            this.selectedListView = 'UAT' || 'All';
        }
        else if(event.target.value === 'CR_List'){
            this.showCRLists = true;
            this.showMyBugs = false;
            this.showUATIssues = false;
            this.showQAValidation = false;
            this.showRetest = false;
            this.selectedListView = event.target.value || 'All';
        }
        else if(event.target.value === 'QA_Validation'){
            this.showQAValidation = true;
            this.showMyBugs = false;
            this.showUATIssues = false;
            this.showCRLists = false;
            this.showRetest = false;
            this.selectedListView = event.target.value || 'All';
        }
        else if(event.target.value === 'Retesting'){
            this.showRetest = true;
            this.showMyBugs = false;
            this.showUATIssues = false;
            this.showCRLists = false;
            this.showQAValidation = false;
            this.selectedListView = event.target.value || 'All';
        }
        
    }

}