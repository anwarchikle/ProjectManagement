import { LightningElement, api, track } from 'lwc';
import getFolderMetadata from '@salesforce/apex/FolderController.getFolderMetadata';
import getFiles from '@salesforce/apex/FolderController.getFiles';
import associateFileToFolder from '@salesforce/apex/FolderController.associateFileToFolder';
import deleteFiles from '@salesforce/apex/FolderController.deleteFiles';
import { NavigationMixin } from 'lightning/navigation';

export default class UploadDocuments extends NavigationMixin(LightningElement) {
    @api recordId;
    @api objectApiName;
    @track folders = [];
    @track error;
    @track isModalOpen = false;
    @track selectedFolder = '';
    @track files = [];
    @track selectedFiles = [];
    acceptedFormats = ['.pdf', '.png', '.jpg', '.jpeg', '.xlsx'];

    connectedCallback() {
        this.fetchFolderMetadata();
    }

    fetchFolderMetadata() {
        debugger;
        getFolderMetadata({ recordId: this.recordId })
            .then(data => {
                this.folders = data.map(folder => {
                    return { ...folder, variantType: 'default' };
                });
                return Promise.all(this.folders.map(folder => this.checkFolderFiles(folder)));
            })
            .then(() => {
                this.error = undefined;
            })
            .catch(error => {
                this.error = error;
                this.folders = [];
            });
    }

    checkFolderFiles(folder) {
        debugger;
        return getFiles({ recordId: this.recordId, folderLabel: folder.Label })
            .then(data => {
                folder.variantType = data.length > 0 ? 'success' : 'error';
            })
            .catch(error => {
                console.error(`Error fetching files for folder ${folder.Label}:`, error);
            });
    }

    handleFolderClick(event) {
        debugger;
        const folderLabel = event.currentTarget.querySelector('span').innerText;
        this.selectedFolder = folderLabel;
        this.fetchFiles();
        
    }

    fetchFiles() {
        debugger;
        getFiles({ recordId: this.recordId, folderLabel: this.selectedFolder })
            .then(data => {
                this.files = data;
                this.isModalOpen = true;
                this.updateFolderVariantType();

            })
            .catch(error => {
                this.error = error;
            });
    }

    updateFolderVariantType() {
        debugger;
        this.folders = this.folders.map(folder => {
            if (folder.Label === this.selectedFolder) {
                folder.variantType = this.files.length > 0 ? 'success' : 'error';
            }
            return folder;
        });
    }

    closeModal() {
        debugger;
        this.isModalOpen = false;
        this.selectedFiles = [];
    }

    handleUploadFinished(event) {
        debugger;
        const uploadedFiles = event.detail.files;
        let promises = uploadedFiles.map(file => {
            return associateFileToFolder({ contentDocumentId: file.documentId, folderLabel: this.selectedFolder });
        });

        Promise.all(promises)
            .then(() => {
                this.fetchFiles();
            })
            .catch(error => {
                this.error = error;
            });
    }

    handleFileClick(event) {
        debugger;
        const fileId = event.currentTarget.dataset.id;
        if (fileId) {
            this[NavigationMixin.Navigate]({
                type: 'standard__namedPage',
                attributes: {
                    pageName: 'filePreview'
                },
                state: {
                    selectedRecordId: fileId
                }
            });
        }
    }

    handleFileSelect(event) {
        debugger;
        const fileId = event.currentTarget.dataset.id;
        if (event.target.checked) {
            this.selectedFiles.push(fileId);
        } else {
            this.selectedFiles = this.selectedFiles.filter(id => id !== fileId);
        }
    }

    handleDownloadClick() {
        debugger;
        this.selectedFiles.forEach(fileId => {
            window.open(`/sfc/servlet.shepherd/document/download/${fileId}`, '_self');
        });
        
    }


    handleDeleteClick() {
        debugger;
        deleteFiles({ contentDocumentIds: this.selectedFiles })
            .then(() => {
                this.fetchFiles();
                this.selectedFiles = [];
            })
            .catch(error => {
                this.error = error;
            });
    }

    get isDownloadDisabled() {
        debugger;
        return this.selectedFiles.length === 0;
    }

    get isDeleteDisabled() {
        debugger;
        return this.selectedFiles.length === 0;
    }
}