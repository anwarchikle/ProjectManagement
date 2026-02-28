import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createChangeRequestsBatchForCurrentUser from '@salesforce/apex/ChangeRequestController.createChangeRequestsBatchForCurrentUser';
import getChangeRequestsForCurrentUserProject from '@salesforce/apex/ChangeRequestController.getChangeRequestsForCurrentUserProject';
import getProjectsForPMT from '@salesforce/apex/ChangeRequestController.getProjectsForPMT';
import getCurrentUserProfile from '@salesforce/apex/ChangeRequestController.getCurrentUserProfile';
import { NavigationMixin } from 'lightning/navigation';

export default class ChangeRequest extends NavigationMixin(LightningElement) {
    @track rows = [];
    @track changeRequests = [];
    @track projectOptions = [];
    @track isPMTProjectManager = false;
    isShowModal = false;
    isSaving = false;

    connectedCallback() {
        this.loadChangeRequests();
        this.checkUserProfile();
    }

    checkUserProfile() {
        getCurrentUserProfile()
            .then((profileName) => {
                this.isPMTProjectManager = profileName === 'PMT Project Manager';
                if (this.isPMTProjectManager) {
                    this.loadProjects();
                }
            })
            .catch((error) => {
                console.error('Error fetching profile:', JSON.stringify(error));
            });
    }

    loadProjects() {
        getProjectsForPMT()
            .then((data) => {
                this.projectOptions = (data || []).map((p) => ({
                    label: p.Name,
                    value: p.Id
                }));
            })
            .catch((error) => {
                this.showToast('Error', this.getErrorMessage(error), 'error');
            });
    }

    handleNewChangeRequest() {
        this.isShowModal = true;
        if (!this.rows || this.rows.length === 0) {
            this.rows = [this.createEmptyRow()];
        }
    }

    hideModalBox() {
        this.isShowModal = false;
    }

    createEmptyRow() {
        return {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
            title: '',
            description: '',
            projectId: '',
            fileName: null,
            fileBody: null
        };
    }

    handleAddRow() {
        const newRows = [...this.rows];
        newRows.push(this.createEmptyRow());
        this.rows = newRows;
    }

    handleDeleteRow(event) {
        const rowId = event.currentTarget.dataset.id;
        this.rows = this.rows.filter((row) => row.id !== rowId);
        if (this.rows.length === 0) {
            this.rows = [this.createEmptyRow()];
        }
    }

    handleFieldChange(event) {
        const rowId = event.target.dataset.id;
        const field = event.target.dataset.field;
        const value = event.detail.value;

        this.rows = this.rows.map((row) => {
            if (row.id === rowId) {
                return { ...row, [field]: value };
            }
            return row;
        });
    }

    handleProjectChange(event) {
        const rowId = event.target.dataset.id;
        const value = event.detail.value;

        this.rows = this.rows.map((row) => {
            if (row.id === rowId) {
                return { ...row, projectId: value };
            }
            return row;
        });
    }

    handleFileChange(event) {
        const files = event.target.files;
        if (!files || files.length === 0) {
            return;
        }

        const rowId = event.target.dataset.id;
        const file = files[0];
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            this.rows = this.rows.map((row) => {
                if (row.id === rowId) {
                    return { ...row, fileName: file.name, fileBody: base64 };
                }
                return row;
            });
        };
        reader.readAsDataURL(file);
    }

    handleSave() {
        if (this.isPMTProjectManager) {
            const missingProject = this.rows.some(
                (row) => (row.title || row.description) && !row.projectId
            );
            if (missingProject) {
                this.showToast('Validation', 'Please select a Project for each Change Request row.', 'warning');
                return;
            }
        }

        const payload = (this.rows || [])
            .filter((row) => row.title || row.description)
            .map((row) => ({
                title: row.title,
                description: row.description,
                projectId: row.projectId || null,
                fileName: row.fileName,
                fileBody: row.fileBody
            }));

        if (payload.length === 0) {
            this.showToast('Validation', 'Please enter at least one Change Request.', 'warning');
            return;
        }

        this.isSaving = true;

        createChangeRequestsBatchForCurrentUser({ inputs: payload })
            .then((result) => {
                if (result && result.length > 0) {
                    this.showToast('Success', 'Change Requests created successfully.', 'success');
                } else {
                    this.showToast('Info', 'No Change Requests were created.', 'info');
                }
                this.isShowModal = false;
                this.rows = [];
                this.loadChangeRequests();
            })
            .catch((error) => {
                console.error('Apex error:', JSON.stringify(error));
                this.showToast('Error', this.getErrorMessage(error), 'error');
            })
            .finally(() => {
                this.isSaving = false;
            });
    }

    loadChangeRequests() {
        getChangeRequestsForCurrentUserProject()
            .then((data) => {
                this.changeRequests = data || [];
            })
            .catch((error) => {
                this.showToast('Error', this.getErrorMessage(error), 'error');
            });
    }

    handleEdit(event) {
        const recordId = event.currentTarget.dataset.id;

        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                objectApiName: 'Change_Request__c',
                actionName: 'edit'
            }
        });
    }

    handleNavigate(event) {
        const recordId = event.currentTarget.dataset.id;

        const pageReference = {
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                objectApiName: 'Change_Request__c',
                actionName: 'view'
            }
        };

        this[NavigationMixin.GenerateUrl](pageReference)
            .then(url => {
                window.open(url, '_blank');
            });
    }

    handleUploadClick(event) {
        const rowId = event.currentTarget.dataset.id;

        const fileInput = this.template.querySelector(
            `input[data-id="${rowId}"]`
        );

        if (fileInput) {
            fileInput.click();
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }

    getErrorMessage(error) {
        if (!error) return 'Unknown error';
        if (Array.isArray(error.body)) {
            return error.body.map((e) => e.message).join(', ');
        }
        if (error.body && typeof error.body.message === 'string') {
            return error.body.message;
        }
        return typeof error.message === 'string' ? error.message : 'Unknown error';
    }
}