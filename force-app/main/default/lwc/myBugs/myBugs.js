import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getListUi } from 'lightning/uiListApi';
import ISSUES_OBJECT from '@salesforce/schema/Issue_Bug__c';
import getBugs from '@salesforce/apex/Mybugscontroller.getBugs';
import getMetrics from '@salesforce/apex/Mybugscontroller.getMetrics';
import getFilterOptions from '@salesforce/apex/Mybugscontroller.getFilterOptions';
import Id from '@salesforce/user/Id';

export default class MyBugs extends LightningElement {
    // List View Properties
    @track records = [];
    @track Newcolumns = [];
    @api selectedListView = 'All';
    wiredData;
    
    // Metrics
    @track totalRaised = 0;
    @track openCount = 0;
    @track criticalBlockerOpen = 0;
    @track slaBreached = 0;
    @track avgAging = '0d';
    
    // Filters
    @track projectOptions = [];
    @track statusOptions = [];
    @track severityOptions = [];
    @track selectedProject = '';
    @track selectedStatus = '';
    @track selectedSeverity = '';
    
    // Search
    searchKey = '';
    
    // Other
    @track isLoading = true;
    userId = Id;

    connectedCallback() {
        this.loadInitialData();
    }

    // Wire List View Data
    @wire(getListUi, { 
        objectApiName: ISSUES_OBJECT, 
        listViewApiName: '$selectedListView' 
    })
    wiredListView(result) {
        this.wiredData = result;
        const { error, data } = result;

        if (data) {
            this.Newcolumns = data.info.displayColumns || [];
            this.processListViewRecords(data.records.records);
            this.isLoading = false;
        }

        if (error) {
            console.error('List View Error:', error);
            this.showError('Error', 'Failed to load list view');
            this.isLoading = false;
        }
    }

    processListViewRecords(records) {
        this.records = records.map(record => {
            let row = {
                Id: record.id,
                cells: [],
                rawFields: {}
            };

            this.Newcolumns.forEach(col => {
                let fieldApi = col.fieldApiName;
                let cell = {
                    fieldApiName: fieldApi,
                    value: '',
                    isLink: false,
                    url: null
                };

                // Handle relationship fields (e.g., Project__r.Name)
                if (fieldApi.includes('.')) {
                    let relationshipField = fieldApi.split('.')[0];
                    let parentField = record.fields[relationshipField];
                    if (parentField?.value) {
                        cell.value =
                            parentField.displayValue ||
                            parentField.value.fields?.Name?.value ||
                            '';
                        cell.isLink = true;
                        cell.url = '/' + parentField.value.id;
                    }
                }
                // Handle regular fields
                else {
                    let fieldData = record.fields[fieldApi];
                    cell.value =
                        fieldData?.displayValue ||
                        fieldData?.value ||
                        '';
                    
                    // Store raw field values for metrics calculation
                    row.rawFields[fieldApi] = cell.value;
                    
                    // Make Name field a link
                    if (fieldApi === 'Name') {
                        cell.isLink = true;
                        cell.url = '/' + record.id;
                    }

                    // Handle lookup fields
                    if (fieldData?.value?.id) {
                        cell.isLink = true;
                        cell.url = '/' + fieldData.value.id;
                        cell.value =
                            fieldData.displayValue ||
                            fieldData.value.fields?.Name?.value ||
                            '';
                    }
                }

                row.cells.push(cell);
            });

            return row;
        });

        // Calculate metrics after records are loaded
        this.calculateMetrics();
    }

    async loadInitialData() {
        try {
            this.isLoading = true;
            
            // Load filter options
            const filterData = await getFilterOptions();
            this.processFilterOptions(filterData);
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Error loading data', error.body?.message || error.message);
        }
    }

    processFilterOptions(data) {
        // Project options
        this.projectOptions = [
            { label: 'All Projects', value: '' },
            ...data.projects.map(p => ({ label: p, value: p }))
        ];
        
        // Status options
        this.statusOptions = [
            { label: 'All Status', value: '' },
            ...data.statuses.map(s => ({ label: s, value: s }))
        ];
        
        // Severity options
        this.severityOptions = [
            { label: 'All Severity', value: '' },
            ...data.severities.map(s => ({ label: s, value: s }))
        ];
    }

    calculateMetrics() {
        if (!this.records || this.records.length === 0) {
            this.totalRaised = 0;
            this.openCount = 0;
            this.criticalBlockerOpen = 0;
            this.slaBreached = 0;
            this.avgAging = '0d';
            return;
        }

        let totalRaised = this.records.length;
        let openCount = 0;
        let criticalBlockerOpen = 0;
        let slaBreached = 0;
        let totalAgingDays = 0;
        let openBugCount = 0;

        // Define open statuses
        const openStatuses = ['New', 'In Progress', 'Assigned', 'Reopened', 'Open'];
        const criticalSeverities = ['Critical', 'Blocker'];

        this.records.forEach(row => {
            const statusCell = row.cells.find(c => 
                c.fieldApiName === 'Status__c'
            );
            const severityCell = row.cells.find(c => 
                c.fieldApiName === 'Severity__c'
            );
            const createdDateCell = row.cells.find(c => 
                c.fieldApiName === 'CreatedDate'
            );
            const slaRiskCell = row.cells.find(c => 
                c.fieldApiName === 'Is_SLA_At_Risk__c'
            );

            const status = statusCell?.value || '';
            const severity = severityCell?.value || '';
            
            // Count Open bugs
            if (openStatuses.includes(status)) {
                openCount++;
                
                // Count Critical/Blocker Open
                if (criticalSeverities.includes(severity)) {
                    criticalBlockerOpen++;
                }

                // Calculate aging for open bugs
                if (createdDateCell?.value) {
                    const createdDate = new Date(createdDateCell.value);
                    const today = new Date();
                    const diffTime = Math.abs(today - createdDate);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    totalAgingDays += diffDays;
                    openBugCount++;
                }
            }

            // Count SLA Breached
            if (slaRiskCell?.value === 'true' || 
                slaRiskCell?.value === true ||
                slaRiskCell?.value === 'Yes') {
                slaBreached++;
            }
        });

        // Calculate average aging
        const avgAgingDays = openBugCount > 0 ? totalAgingDays / openBugCount : 0;

        // Update metrics
        this.totalRaised = totalRaised;
        this.openCount = openCount;
        this.criticalBlockerOpen = criticalBlockerOpen;
        this.slaBreached = slaBreached;
        this.avgAging = avgAgingDays > 0 ? 
            (avgAgingDays < 1 ? 
                `${Math.round(avgAgingDays * 10) / 10}d` : 
                `${Math.floor(avgAgingDays)}d`) : 
            '0d';
    }

    // Filter and Search Logic
    get visibleRecords() {
        let filtered = [...this.records];

        // Apply search filter
        if (this.searchKey) {
            const key = this.searchKey.toLowerCase();
            filtered = filtered.filter(row =>
                row.cells.some(cell =>
                    String(cell.value).toLowerCase().includes(key)
                )
            );
        }

        // Apply project filter
        if (this.selectedProject) {
            filtered = filtered.filter(row => {
                const projectCell = row.cells.find(c => 
                    c.fieldApiName === 'Project__r.Name' || 
                    c.fieldApiName.includes('Project')
                );
                return projectCell?.value === this.selectedProject;
            });
        }

        // Apply status filter
        if (this.selectedStatus) {
            filtered = filtered.filter(row => {
                const statusCell = row.cells.find(c => 
                    c.fieldApiName === 'Status__c'
                );
                return statusCell?.value === this.selectedStatus;
            });
        }

        // Apply severity filter
        if (this.selectedSeverity) {
            filtered = filtered.filter(row => {
                const severityCell = row.cells.find(c => 
                    c.fieldApiName === 'Severity__c'
                );
                return severityCell?.value === this.selectedSeverity;
            });
        }

        return filtered;
    }

    get filteredBugCount() {
        return this.visibleRecords.length;
    }

    // Event Handlers
    handleSearchChange(event) {
        this.searchKey = event.target.value;
    }

    handleProjectFilter(event) {
        this.selectedProject = event.detail.value;
    }

    handleStatusFilter(event) {
        this.selectedStatus = event.detail.value;
    }

    handleSeverityFilter(event) {
        this.selectedSeverity = event.detail.value;
    }

    handleExport() {
        try {
            const recordsToExport = this.visibleRecords;
            
            if (recordsToExport.length === 0) {
                this.showError('Export failed', 'No records to export');
                return;
            }

            // Create CSV headers
            const headers = this.Newcolumns.map(col => col.label);
            
            // Create CSV rows
            const rows = recordsToExport.map(row => 
                row.cells.map(cell => cell.value || '')
            );
            
            // Build CSV
            let csv = headers.join(',') + '\n';
            rows.forEach(row => {
                csv += row.map(cell => `"${cell}"`).join(',') + '\n';
            });
            
            // Download
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `MyBugs_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            window.URL.revokeObjectURL(url);
            
            this.showSuccess('Export successful', 'Bugs exported to Excel successfully');
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Export failed', error.message);
        }
    }

    handleSaveView() {
        this.showSuccess('View saved', 'Your current view has been saved');
    }

    // Utility Methods
    showSuccess(title, message) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: 'success'
        }));
    }

    showError(title, message) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: 'error'
        }));
    }
}