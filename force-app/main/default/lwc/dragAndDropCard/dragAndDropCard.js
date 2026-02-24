import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation'
export default class DragAndDropCard extends NavigationMixin(LightningElement) {
    @api stage
    @api record

    get isSameStage() {
        return this.stage === this.record.Status__c
    }
    navigateTaskHandler(event) {
        debugger;
        event.preventDefault()
        this.navigateHandler(event.target.dataset.id, 'Tasks__c')
    }

    handleLinkKeyDown(event) {
        debugger;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.navigateHandler(this.record?.Id, 'Tasks__c');
        }
    }

    formatDate(value) {
        if (!value) {
            return '';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(date);
    }

    get startDateLabel() {
        return this.formatDate(this.record?.Start_Date__c);
    }

    get endDateLabel() {
        return this.formatDate(this.record?.End_Date__c);
    }

    handleMoveNext(event) {
        event.preventDefault();
        event.stopPropagation();

        const evt = new CustomEvent('movenext', {
            detail: {
                recordId: this.record?.Id,
                currentStage: this.record?.Status__c
            },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(evt);
    }

    navigateHandler(recordId, apiName) {
        this[NavigationMixin.GenerateUrl]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                objectApiName: apiName,
                actionName: 'view'
            }
        }).then(url => {
            window.open(url, '_blank');
        });
    }

    itemDragStart() {
        const event = new CustomEvent('itemdrag', {
            detail: this.record.Id
        })
        this.dispatchEvent(event)
    }
}