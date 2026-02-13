import { LightningElement,api,track } from 'lwc';
import getResults from '@salesforce/apex/LwcMultiLookupController.getResults';

export default class LwcMultiLookup extends LightningElement {
    @api objectName;
    @api fieldName;
    Label = 'Team Member';
    @api selectedContactList = [];
    @track searchRecords = [];
    @track selectedRecords = [];
    @api required = false;
    @api iconName //= 'action:new_contact'
    @api LoadingText = false;
    @track txtclassname = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
    @track messageFlag = false;
 
    searchField(event) {
        debugger;
        var currentText = event.target.value;
        var selectRecId = [];
        for(let i = 0; i < this.selectedRecords.length; i++){
            selectRecId.push(this.selectedRecords[i].recId);
        }
        this.LoadingText = true;
        getResults({ ObjectName: this.objectName, fieldName: this.fieldName, value: currentText, selectedRecId : selectRecId })
        .then(result => {
            this.searchRecords= result;
            this.LoadingText = false;
            
            this.txtclassname =  result.length > 0 ? 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open' : 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
            if(currentText.length > 0 && result.length == 0) {
                this.messageFlag = true;
            }
            else {
                this.messageFlag = false;
            }

            if(this.selectRecordId != null && this.selectRecordId.length > 0) {
                this.iconFlag = false;
                this.clearIconFlag = true;
            }
            else {
                this.iconFlag = true;
                this.clearIconFlag = false;
            }
        })
        .catch(error => {
            console.log('-------error-------------'+error);
            console.log(error);
        });
        
    }
    
   setSelectedRecord(event) {
        debugger;
        var recId = event.currentTarget.dataset.id;
        var selectName = event.currentTarget.dataset.name;
        var name = event.currentTarget.dataset.recname;
        let newsObject = { 'recId' : recId ,'recName' : selectName,  'name': name};
        this.selectedRecords.push(newsObject);
        this.txtclassname =  'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
        let selRecords = this.selectedRecords;
		this.template.querySelectorAll('lightning-input').forEach(each => {
            each.value = '';
        });
        const selectedEvent = new CustomEvent('selected', { detail: {selRecords}, });
        // Dispatches the event.
        this.dispatchEvent(selectedEvent);
    }

    removeRecord (event){
        debugger;
        let selectRecId = [];
        for(let i = 0; i < this.selectedRecords.length; i++){
            if(event.detail.name !== this.selectedRecords[i].recId)
                selectRecId.push(this.selectedRecords[i]);
        }
        this.selectedRecords = [...selectRecId];
        let selRecords = this.selectedRecords;
        const selectedEvent = new CustomEvent('selected', { detail: {selRecords}, });
        // Dispatches the event.
        this.dispatchEvent(selectedEvent);
    }
    
setManaullaySelectedRecord(recId, selectName, displayName) {
    debugger;
    let newsObject = { 
        'recId': recId,
        'recName': selectName,
        'name': displayName || selectName  // ✅ Add the display name
    };
    this.selectedRecords.push(newsObject);
    this.txtclassname = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
    let selRecords = this.selectedRecords;
    this.template.querySelectorAll('lightning-input').forEach(each => {
        each.value = '';
    });
    const selectedEvent = new CustomEvent('selected', { detail: {selRecords} });
    this.dispatchEvent(selectedEvent);
}
    connectedCallback(){
    debugger;
    let selectedContractList = this.selectedContactList;
    for(let i = 0; i < selectedContractList.length; i++){
        this.setManaullaySelectedRecord(
            selectedContractList[i].Id,           // recId
            selectedContractList[i].Email,        // recName (email)
            selectedContractList[i].Name          // ✅ name (display name)
        );
    }
}
}