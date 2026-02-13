import { LightningElement, track, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import createBugEntries from '@salesforce/apex/bugEntriesController.createBugEntries';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';
import ISSUE_BUG_OBJECT from '@salesforce/schema/Issue_Bug__c';
import ENVIRONMENT_FIELD from '@salesforce/schema/Issue_Bug__c.Environment__c';
import Sevire_FIELD from '@salesforce/schema/Issue_Bug__c.Severity__c';
import Type_FIELD from '@salesforce/schema/Issue_Bug__c.Type__c';

export default class BugEntry extends NavigationMixin(LightningElement) {

    mileStoneCondition;
    taskListCondition;
    environmentPicklistValues;
    SeverityPicklistValues;
    TypePicklistValues;
    nextId = 2;

    @track data = {
        projectId: '',
        milestoneId: '',
        userId: '',
        taskListId: '',
        environment: '',
        uploadIdentifier: ''
    }

    @track itemList = [
        {
            id: 1,
            title: '',
            description: '',
            severity: 'Show',
            type: 'Bug',
            files: [],
            hasFiles: false,
            fileCount: 0,
            showFiles: false,
            fileToggleIcon: 'utility:chevrondown',
            fileToggleTitle: 'Show Files',
            expanded: false,
            stepsToReproduce: '',
            expectedResult: '',
            actualResult: ''
        }
    ];

    @wire(getObjectInfo, { objectApiName: ISSUE_BUG_OBJECT })
    issueBugInfo;

    @wire(getPicklistValues, { recordTypeId: '$issueBugInfo.data.defaultRecordTypeId', fieldApiName: ENVIRONMENT_FIELD })
    enviWiredPicklistValues({ data, error }) {
        if (data) {
            this.environmentPicklistValues = data.values;
        }
        if (error) {
            console.error('Picklist error → ', error);
        }
    }

    @wire(getPicklistValues, { recordTypeId: '$issueBugInfo.data.defaultRecordTypeId', fieldApiName: Sevire_FIELD })
    sevWiredPicklistValues({ data, error }) {
        if (data) {
            this.SeverityPicklistValues = data.values;
        }
        if (error) {
            console.error('Picklist error → ', error);
        }
    }

    @wire(getPicklistValues, { recordTypeId: '$issueBugInfo.data.defaultRecordTypeId', fieldApiName: Type_FIELD })
    typeWiredPicklistValues({ data, error }) {
        if (data) {
            this.TypePicklistValues = data.values;
        }
        if (error) {
            console.error('Picklist error → ', error);
        }
    }

    handleChange(event) {
        const inpName = event.target.name;
        if (inpName == 'environment') {
            this.data.environment = event.detail.value;
        }
    }

    handleInputChange(event) {
        const field = event.target.dataset.field;
        const itemId = parseInt(event.target.dataset.id);
        const value = event.target.value;

        this.itemList = this.itemList.map(item => {
            if (item.id === itemId) {
                return { ...item, [field]: value };
            }
            return item;
        });
    }

    addRow() {
        const newItem = {
            id: this.nextId++,
            title: '',
            description: '',
            severity: 'Medium',
            type: 'Bug',
            files: [],
            hasFiles: false,
            fileCount: 0,
            showFiles: false,
            fileToggleIcon: 'utility:chevrondown',
            fileToggleTitle: 'Show Files',
            expanded: false,
            stepsToReproduce: '',
            expectedResult: '',
            actualResult: ''
        };
        this.itemList = [...this.itemList, newItem];
    }

    removeRow(event) {
        const itemId = parseInt(event.currentTarget.dataset.id);

        if (this.itemList.length > 1) {
            this.itemList = this.itemList.filter(item => item.id !== itemId);
        } else {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Cannot Delete',
                    message: 'At least one bug entry is required',
                    variant: 'warning',
                })
            );
        }
    }

    toggleExpand(event) {
        const itemId = parseInt(event.currentTarget.dataset.id);

        this.itemList = this.itemList.map(item => {
            if (item.id === itemId) {
                return { ...item, expanded: !item.expanded };
            }
            return item;
        });
    }

    // *** FILE HANDLING METHODS ***

    handleUploadClick(event) {
        const itemId = parseInt(event.currentTarget.dataset.id);
        
        const fileInputs = this.template.querySelectorAll('input[type="file"]');
        const fileInput = Array.from(fileInputs).find(input => 
            parseInt(input.dataset.id, 10) === itemId
        );
        
        if (fileInput) {
            fileInput.click();
        }
    }

    handleFileSelect(event) {
        const itemId = parseInt(event.target.dataset.id);
        const files = event.target.files;
        
        if (!files || files.length === 0) return;

        this.uploadFilesToMemory(files, itemId);
        event.target.value = '';
    }

    uploadFilesToMemory(files, itemId) {
        const maxSize = 25 * 1024 * 1024;
        let uploadCount = 0;
        let errorCount = 0;
        const totalFiles = files.length;

        Array.from(files).forEach((file) => {
            if (file.size > maxSize) {
                this.showToast('Error', `${file.name} exceeds 25MB limit`, 'error');
                errorCount++;
                
                if (uploadCount + errorCount === totalFiles) {
                    if (uploadCount > 0) {
                        this.showToast('Success', `${uploadCount} file(s) ready to upload`, 'success');
                    }
                }
                return;
            }

            const reader = new FileReader();
            
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                
                const newFile = {
                    documentId: 'temp_' + Date.now() + '_' + Math.random(),
                    fileName: file.name,
                    fileType: this.getFileExtension(file.name),
                    fileSize: file.size,
                    fileSizeFormatted: this.formatFileSize(file.size),
                    icon: this.getFileIcon(this.getFileExtension(file.name)),
                    base64Data: base64
                };

                this.itemList = this.itemList.map(item => {
                    if (item.id === itemId) {
                        const updatedFiles = [...(item.files || []), newFile];
                        return {
                            ...item,
                            files: updatedFiles,
                            hasFiles: true,
                            fileCount: updatedFiles.length
                        };
                    }
                    return item;
                });

                uploadCount++;

                if (uploadCount + errorCount === totalFiles) {
                    if (uploadCount > 0) {
                        this.showToast('Success', `${uploadCount} file(s) ready to upload`, 'success');
                    }
                }
            };
            
            reader.onerror = () => {
                errorCount++;
                this.showToast('Error', `Failed to read ${file.name}`, 'error');
            };
            
            reader.readAsDataURL(file);
        });
    }

    handleToggleFiles(event) {
        const itemId = parseInt(event.currentTarget.dataset.id);

        this.itemList = this.itemList.map(item => {
            if (item.id === itemId) {
                const newShowFiles = !item.showFiles;
                return {
                    ...item,
                    showFiles: newShowFiles,
                    fileToggleIcon: newShowFiles ? 'utility:chevronup' : 'utility:chevrondown',
                    fileToggleTitle: newShowFiles ? 'Hide Files' : 'Show Files'
                };
            }
            return item;
        });
    }

    handlePreviewFile(event) {
        const documentId = event.currentTarget.dataset.id;

        this[NavigationMixin.Navigate]({
            type: 'standard__namedPage',
            attributes: {
                pageName: 'filePreview'
            },
            state: {
                selectedRecordId: documentId
            }
        });
    }

    handleRemoveFile(event) {
        const itemId = parseInt(event.currentTarget.dataset.itemId);
        const documentId = event.currentTarget.dataset.id;
        
        if (!confirm('Are you sure you want to remove this file?')) {
            return;
        }

        this.itemList = this.itemList.map(item => {
            if (item.id === itemId) {
                const updatedFiles = item.files.filter(f => f.documentId !== documentId);
                return {
                    ...item,
                    files: updatedFiles,
                    hasFiles: updatedFiles.length > 0,
                    fileCount: updatedFiles.length,
                    showFiles: updatedFiles.length > 0 ? item.showFiles : false
                };
            }
            return item;
        });
        
        this.showToast('Success', 'File removed', 'success');
    }

    getFileExtension(fileName) {
        return fileName.split('.').pop().toLowerCase();
    }

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    getFileIcon(fileType) {
        const iconMap = {
            'pdf': 'doctype:pdf',
            'doc': 'doctype:word',
            'docx': 'doctype:word',
            'xls': 'doctype:excel',
            'xlsx': 'doctype:excel',
            'csv': 'doctype:csv',
            'png': 'doctype:image',
            'jpg': 'doctype:image',
            'jpeg': 'doctype:image',
            'gif': 'doctype:image',
            'txt': 'doctype:txt',
            'zip': 'doctype:zip'
        };
        return iconMap[fileType?.toLowerCase()] || 'doctype:attachment';
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    // ... rest of existing methods ...

    handleLookupSelection(event) {
        const { name, selectedRecord } = event.detail;

        switch (name) {
            case 'Project':
                this.data.projectId = selectedRecord;
                this.mileStoneCondition = `Project__c = '${this.data.projectId}'`;
                break;

            case 'Milestone':
                this.data.milestoneId = selectedRecord;
                this.taskListCondition = `Milestone__c = '${this.data.milestoneId}'`;
                break;

            case 'TaskList':
                this.data.taskListId = selectedRecord;
                break;

            case 'User':
                this.data.userId = selectedRecord;
                break;
        }
    }

    handleLookupUpdate(event) {
        const { name, selectedRecord } = event.detail;
        switch (name) {
            case 'Project':
                this.projectId = null;
                this.milestoneId = null;
                this.mileStoneCondition = false;
                this.taskListId = null;
                this.taskListCondition = false;
                break;

            case 'Milestone':
                this.milestoneId = null;
                this.taskListId = null;
                this.taskListCondition = false;
                break;

            case 'TaskList':
                this.taskListId = null;
                break;

            case 'User':
                this.userId = null;
                break;
        }
    }

    handleSubmit() {
        let isValid = true;
        let errorMessage = '';

        if (this.data.projectId == null || this.data.projectId == '' || this.data.projectId == undefined) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Validation Error',
                    message: 'Please Select the Project',
                    variant: 'error'
                })
            );
            return;
        }
        if (this.data.environment == null || this.data.environment == '' || this.data.environment == undefined) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Validation Error',
                    message: 'Please Select the Environment',
                    variant: 'error'
                })
            );
            return;
        }

        for (let item of this.itemList) {
            if (!item.title || !item.title.trim()) {
                isValid = false;
                errorMessage = 'Bug Title is required for all entries';
                break;
            }
            if (!item.severity) {
                isValid = false;
                errorMessage = 'Severity is required for all entries';
                break;
            }
        }

        if (!isValid) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Validation Error',
                    message: errorMessage,
                    variant: 'error'
                })
            );
            return;
        }

        createBugEntries({ bugEntries: this.itemList, projectDetails: this.data })
            .then(result => {
                if (result === 'SUCCESS') {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Success',
                            message: 'Bug entries submitted successfully',
                            variant: 'success'
                        })
                    );
                    window.location.reload();
                } else {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Error',
                            message: result,
                            variant: 'error'
                        })
                    );
                }
            })
            .catch(error => {
                console.error('Apex Error ===>', error);
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Unexpected Error',
                        message: error.body?.message || 'Something went wrong',
                        variant: 'error'
                    })
                );
            });
    }

    resetForm() {
        this.itemList = [
            {
                id: 1,
                title: '',
                description: '',
                severity: 'Medium',
                type: 'Bug',
                files: [],
                hasFiles: false,
                fileCount: 0,
                showFiles: false,
                fileToggleIcon: 'utility:chevrondown',
                fileToggleTitle: 'Show Files',
                expanded: false,
                stepsToReproduce: '',
                expectedResult: '',
                actualResult: ''
            }
        ];
        this.nextId = 2;
    }
}