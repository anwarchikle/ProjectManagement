import { LightningElement, api, wire, track } from 'lwc';
import getProjectInfo from '@salesforce/apex/projectDashboardProvider.getProjectInfo';
import getDashboardData from '@salesforce/apex/projectDashboardProvider.getDashboardData';
import { refreshApex } from '@salesforce/apex';

export default class ProjectDashboard extends LightningElement {
    @api recordId;
    
    // Track reactive properties for Project Info section
    @track projectStatus = 'Loading...';
    @track projectType = 'Loading...';
    @track billingType = 'Loading...';
    
    // Track reactive properties for Tasks section
    @track totalTasks = 0;
    @track completedTasks = 0;
    @track pendingTasks = 0;
    
    // NEW: Track reactive properties for Team Members section
    @track teamMembersCount = 0;
    @track teamMembers = [];
    
    // NEW: Track reactive properties for Milestones section
    @track totalMilestones = 0;
    @track completedMilestones = 0;
    @track milestonesPercentage = 0;
    
    // Track loading state
    @track isLoading = true;
    @track showTooltipFlag = false;
    @track themeIcon = 'utility:preview';
    @track isDarkTheme = false;

    @track estimatedHours = 0;
    @track loggedHours = 0;
    @track scheduledHours = 0;
    @track billableHours = 0;
    @track nonBillableHours = 0;

    @track actualHours = 0;
    @track plannedHours = 0;
    @track loggedPercent = 0;

    @track timeRemainingData = {
    daysRemaining: 0,
    formattedDueDate: 'Not Set',
    dueDate: null
};
        get daysRemaining() {
        return this.timeRemainingData.daysRemaining;
    }
        get formattedDueDate() {
        return this.timeRemainingData.formattedDueDate;
    }

    // NEW: Getter for milestones progress bar style
    get milestonesProgressStyle() {
        const width = Math.min(this.milestonesPercentage, 100);
        return `width: ${width}%;`;
    }

    // Getter for logged ring style
    get loggedRingStyle() {
        const circumference = 2 * Math.PI * 40;
        const offset = circumference - (this.loggedPercent / 100) * circumference;
        return `stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};`;
    }
    
    // Wire service to get Project Info (EXISTING - KEEP THIS)
    @wire(getProjectInfo, { projectId: '$recordId' })
    wiredProjectInfo({ data, error }) {
        if (data) {
            console.log('✅ PROJECT INFO DATA RECEIVED:', JSON.stringify(data, null, 2));
            
            // Update the Project Info section
            this.projectStatus = data.status || 'Not Set';
            this.projectType = data.type || 'Not Set';
            this.billingType = data.billingType || 'Not Set';

            if (data.endDate) {
            this.calculateTimeRemaining(data.endDate);
        } else {
            this.timeRemainingData = {
                daysRemaining: 0,
                formattedDueDate: 'Date Not Set',
                dueDate: null
            };
        }
          
            
        } else if (error) {
            console.error('❌ ERROR LOADING PROJECT INFO:', error);
            console.error('Error body:', JSON.stringify(error.body, null, 2));
            
            // Set error state
            this.projectStatus = 'Error';
            this.projectType = 'Error';
            this.billingType = 'Error';
        }
    }
    
    // Wire service to get Dashboard Data (EXISTING - UPDATED with Team and Milestones)
    @wire(getDashboardData, { projectId: '$recordId' })
    wiredDashboardData({ data, error }) {
        if (data) {
            console.log('✅ DASHBOARD DATA RECEIVED:', JSON.stringify(data, null, 2));
            
            // 1. Update Tasks section
            if (data.tasks) {
                this.totalTasks = data.tasks.totalTasks || 0;
                this.completedTasks = data.tasks.completedTasks || 0;
                this.pendingTasks = data.tasks.pendingTasks || 0;
                
                
            }
            
            // 2. NEW: Update Team Members section - UPDATED WITH 2-LETTER INITIALS
            if (data.teamMembers) {
                this.teamMembersCount = data.teamMembers.teamMembersCount || 0;
                
                // Transform team members to have 2-letter initials
                const rawMembers = data.teamMembers.members || [];
                this.teamMembers = rawMembers.map(member => {
                    return {
                        ...member, // Keep all original properties
                        avatarInitial: this.getTwoLetterInitials(member.name) // Convert to 2 letters
                    };
                });
                
                console.log('👥 TEAM MEMBERS SET:');
                console.log('  Count:', this.teamMembersCount);
                console.log('  Members (with 2-letter initials):', this.teamMembers);
            }
            
            // 3. NEW: Update Milestones section
            if (data.milestones) {
                this.totalMilestones = data.milestones.totalMilestones || 0;
                this.completedMilestones = data.milestones.completedMilestones || 0;
                this.milestonesPercentage = data.milestones.completionPercentage || 0;
               
            }
            if (data.projectHours) {
                this.estimatedHours = data.projectHours.estimatedHours || 0;
                this.loggedHours = data.projectHours.loggedHours || 0;
                this.scheduledHours = data.projectHours.scheduledHours || 0;
                this.billableHours = data.projectHours.billableHours || 0;
                this.nonBillableHours = data.projectHours.nonBillableHours || 0;
                
                
            }

            if (data.loggedHoursData) {
                this.actualHours = data.loggedHoursData.actualHours || 0;
                this.plannedHours = data.loggedHoursData.plannedHours || 0;
                
                // Calculate percentage
                this.calculateLoggedPercentage();
                
                console.log('📊 LOGGED HOURS DATA:');
                console.log('  Actual Hours:', this.actualHours);
                console.log('  Planned Hours:', this.plannedHours);
                console.log('  Percentage:', this.loggedPercent + '%');
            }
            
            this.isLoading = false;
            
        } else if (error) {
            console.error('❌ ERROR LOADING DASHBOARD DATA:', error);
            console.error('Error body:', JSON.stringify(error.body, null, 2));
            
            // Keep existing error handling for other sections
            this.isLoading = false;
        }
    }
    
    // NEW: Helper method to get 2-letter initials from full name
    getTwoLetterInitials(fullName) {
        if (!fullName || typeof fullName !== 'string') {
            return '??';
        }
        
        // Split name into parts
        const nameParts = fullName.trim().split(' ');
        
        if (nameParts.length === 0) {
            return '??';
        }
        
        // Get first initial
        const firstInitial = nameParts[0][0] || '';
        
        // Get last initial (from last part of the name)
        const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : '';
        
        // Return uppercase initials (max 2 letters)
        return (firstInitial + lastInitial).toUpperCase();
    }
    
    // Lifecycle hook - when component is added to DOM (EXISTING)
    connectedCallback() {
        console.log('🚀 Project Dashboard Component INITIALIZED');
        console.log('📌 Record ID:', this.recordId);
        console.log('⏱️ Time:', new Date().toISOString());
    }
    
    // Helper method to show error (EXISTING)
    showError(message) {
        const toastEvent = new ShowToastEvent({
            title: 'Error',
            message: message,
            variant: 'error'
        });
        this.dispatchEvent(toastEvent);
    }
    
    // Handle refresh button click (EXISTING - UPDATED to refresh both wire methods)
    async handleRefresh() {
        console.log('🔄 Refresh button clicked');
        this.isLoading = true;
        this.projectStatus = 'Refreshing...';
        this.projectType = 'Refreshing...';
        this.billingType = 'Refreshing...';
        
        try {
            // Refresh both wire services
            await refreshApex(this.wiredProjectInfo);
            await refreshApex(this.wiredDashboardData);
            console.log('✅ Data refreshed');
            
        } catch (error) {
            console.error('❌ Error refreshing:', error);
            this.showError('Failed to refresh data');
        } finally {
            this.isLoading = false;
        }
    }

     // Method to calculate logged percentage
    calculateLoggedPercentage() {
        if (this.plannedHours === 0) {
            this.loggedPercent = 0;
            return;
        }
        
        // Calculate percentage of actual vs planned
        const percentage = (this.actualHours / this.plannedHours) * 100;
        
        // Cap at 100% to avoid showing more than planned
        this.loggedPercent = Math.min(Math.round(percentage), 100);
        
        // If actual exceeds planned, show 100% but you might want to handle this differently
        if (this.actualHours > this.plannedHours) {
            this.loggedPercent = 100;
        }
    }
    
    // Getter to check if any value is empty (EXISTING)
    get hasProjectInfo() {
        return this.projectStatus !== 'Loading...' && 
               this.projectType !== 'Loading...' && 
               this.billingType !== 'Loading...';
    }
    
    // Existing methods (KEEP THESE AS THEY ARE)
    showTooltip() {
        this.showTooltipFlag = true;
    }

    hideTooltip() {
        this.showTooltipFlag = false;
    }

    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        this.themeIcon = this.isDarkTheme ? 'utility:preview' : 'utility:preview';
        
        this.dispatchEvent(new CustomEvent('themechange', {
            detail: { isDark: this.isDarkTheme }
        }));
    }
    calculateTimeRemaining(endDateString) {
    try {
        console.log('📅 Calculating time remaining from date:', endDateString);
        
        // Parse the end date from string to Date object
        const endDate = new Date(endDateString);
        const today = new Date();
        
        // Reset time to midnight for accurate day calculation
        today.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        
        // Calculate difference in days
        const timeDiff = endDate.getTime() - today.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        // Format the due date for display
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDueDate = endDate.toLocaleDateString('en-US', options);
        
        // Update time remaining data
        this.timeRemainingData = {
            daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
            formattedDueDate: `Due: ${formattedDueDate}`,
            dueDate: endDate
        };
        
        console.log('📅 Time Remaining Calculated:');
        console.log('  Days Remaining:', this.timeRemainingData.daysRemaining);
        console.log('  Formatted Date:', this.timeRemainingData.formattedDueDate);
        
    } catch (error) {
        console.error('❌ Error calculating time remaining:', error);
        this.timeRemainingData = {
            daysRemaining: 0,
            formattedDueDate: 'Invalid Date',
            dueDate: null
        };
    }
    }
}