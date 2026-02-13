import { LightningElement, api } from 'lwc';

export default class DragAndDropList extends LightningElement {
    @api records = []
    @api stage

    dragCounter = 0;

    get isEmpty() {
        return this.records && this.records.length === 0
    }
    handleItemDrag(evt) {
        const event = new CustomEvent('listitemdrag', {
            detail: evt.detail
        })
        this.dispatchEvent(event)
    }

    handleMoveNext(evt) {
        const event = new CustomEvent('movenext', {
            detail: evt.detail
        })
        this.dispatchEvent(event)
    }
    handleDragOver(evt) {
        evt.preventDefault()
    }

    handleDragEnter() {
        this.dragCounter += 1;
        const el = this.template.querySelector('.drop-zone');
        if (el) {
            el.classList.add('drag-over');
        }
    }

    handleDragLeave() {
        this.dragCounter = Math.max(0, this.dragCounter - 1);
        if (this.dragCounter === 0) {
            const el = this.template.querySelector('.drop-zone');
            if (el) {
                el.classList.remove('drag-over');
            }
        }
    }

    handleDrop(evt) {
        evt.preventDefault()
        this.dragCounter = 0;
        const el = this.template.querySelector('.drop-zone');
        if (el) {
            el.classList.remove('drag-over');
        }
        const event = new CustomEvent('itemdrop', {
            detail: this.stage
        })
        this.dispatchEvent(event)
    }
}