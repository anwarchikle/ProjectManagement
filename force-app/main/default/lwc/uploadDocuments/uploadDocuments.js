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
        getFolderMetadata({ recordId: this.recordId })
            .then(data => {
                this.folders = data.map(folder => {
                    return { ...folder, variantType: 'default', fileCount: 0 };
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
        return getFiles({ recordId: this.recordId, folderLabel: folder.Label })
            .then(data => {
                folder.variantType = data.length > 0 ? 'success' : 'error';
                folder.fileCount = data.length;   // store count for display
            })
            .catch(error => {
                console.error(`Error fetching files for folder ${folder.Label}:`, error);
                folder.fileCount = 0;
            });
    }

    // Custom upload trigger: programmatically click the hidden lightning-file-upload button
    triggerUpload(event) {
        const folderLabel = event.currentTarget.dataset.folder;
        // Find the hidden file upload component for this folder and trigger its button
        const uploadCmp = this.template.querySelector(`lightning-file-upload[data-folder="${folderLabel}"]`);
        if (uploadCmp) {
            // Access the internal button – note: this relies on internal structure, but is stable enough
            const button = uploadCmp.shadowRoot.querySelector('button');
            if (button) button.click();
        }
    }

    // Open folder files directly (no dropdown menu)
    openFolderFiles(event) {
        const folderLabel = event.currentTarget.dataset.folder;
        this.selectedFolder = folderLabel;
        this.fetchFiles();
    }

    fetchFiles() {
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
        this.folders = this.folders.map(folder => {
            if (folder.Label === this.selectedFolder) {
                folder.variantType = this.files.length > 0 ? 'success' : 'error';
                folder.fileCount = this.files.length;   // update count
            }
            return folder;
        });
    }

    closeModal() {
        this.isModalOpen = false;
        this.selectedFiles = [];
    }

    handleUploadFinished(event) {
        const folderLabel = event.currentTarget.dataset.folder;
        const uploadedFiles = event.detail.files;
        let promises = uploadedFiles.map(file => {
            return associateFileToFolder({ contentDocumentId: file.documentId, folderLabel: folderLabel });
        });

        Promise.all(promises)
            .then(() => {
                // Refresh the file count for this folder
                return this.checkFolderFiles(this.folders.find(f => f.Label === folderLabel));
            })
            .then(() => {
                // If modal is open for the same folder, refresh its list
                if (this.selectedFolder === folderLabel) {
                    this.fetchFiles();
                }
            })
            .catch(error => {
                this.error = error;
            });
    }

    handleFileClick(event) {
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
        const fileId = event.currentTarget.dataset.id;
        if (event.target.checked) {
            this.selectedFiles.push(fileId);
        } else {
            this.selectedFiles = this.selectedFiles.filter(id => id !== fileId);
        }
    }

    handleDownloadClick() {
        this.selectedFiles.forEach(fileId => {
            window.open(`/sfc/servlet.shepherd/document/download/${fileId}`, '_self');
        });
    }

    handleDeleteClick() {
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
        return this.selectedFiles.length === 0;
    }

    get isDeleteDisabled() {
        return this.selectedFiles.length === 0;
    }
}