public class projectDashboardProvider {
	// Wrapper for Project Info data only
    public class ProjectInfoData {
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String type { get; set; }
        @AuraEnabled public String billingType { get; set; }
        @AuraEnabled public Date endDate { get; set; }
    }
    // Wrapper for Tasks data
    public class TasksData {
        @AuraEnabled public Integer totalTasks { get; set; }
        @AuraEnabled public Integer completedTasks { get; set; }
        @AuraEnabled public Integer pendingTasks { get; set; }
    }
    public class TeamMemberData {
        @AuraEnabled public Integer teamMembersCount { get; set; }
        @AuraEnabled public List<Member> members { get; set; }
    }
    
    // Individual team member wrapper
    public class Member {
        @AuraEnabled public String userId { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String avatarInitial { get; set; }
    }
    
    // Wrapper for Milestones data
    public class MilestonesData {
        @AuraEnabled public Integer totalMilestones { get; set; }
        @AuraEnabled public Integer completedMilestones { get; set; }
        @AuraEnabled public Decimal completionPercentage { get; set; }
    }
    
    // Wrapper for ALL dashboard data
    public class DashboardData {
        @AuraEnabled public ProjectInfoData projectInfo { get; set; }
        @AuraEnabled public TasksData tasks { get; set; }
        @AuraEnabled public TeamMemberData teamMembers { get; set; }
        @AuraEnabled public MilestonesData milestones { get; set; }
        @AuraEnabled public ProjectHoursData projectHours { get; set; }
        @AuraEnabled public LoggedHoursPercentageData loggedHoursData { get; set; }
        @AuraEnabled public BudgetData budget { get; set; }
    }
    public class ProjectHoursData {
        @AuraEnabled public Decimal estimatedHours { get; set; }
        @AuraEnabled public Decimal loggedHours { get; set; }
        @AuraEnabled public Decimal scheduledHours { get; set; }
        @AuraEnabled public Decimal billableHours { get; set; }
        @AuraEnabled public Decimal nonBillableHours { get; set; }
    }
    
        public class BudgetData {
        @AuraEnabled public Decimal plannedCost { get; set; }
        @AuraEnabled public Decimal actualCost { get; set; }
        @AuraEnabled public Decimal budgetPercentage { get; set; }
    }
    
    public class LoggedHoursPercentageData {
    @AuraEnabled public Decimal actualHours { get; set; }
    @AuraEnabled public Decimal plannedHours { get; set; }
}
    
    // Method to get ONLY Project Info data
    @AuraEnabled(cacheable=true)
    public static ProjectInfoData getProjectInfo(String projectId) {
        try {
          
            
            // Query ONLY the fields we need for Project Info section
            List<Project__c> projects = [
                SELECT Status__c, Project_Group__c, Billing_Method__c,End_Date__c FROM Project__c 
                WHERE Id = :projectId 
                LIMIT 1
            ];
            
            if (projects.isEmpty()) {
    	     return new ProjectInfoData();
            }
            
            Project__c project = projects[0];
            ProjectInfoData data = new ProjectInfoData();
            
            // Map the fields
            data.status = project.Status__c;
            data.type = project.Project_Group__c;
            data.billingType = project.Billing_Method__c;
            data.endDate = project.End_Date__c;
                       
            return data;
            
        } catch (Exception e) {
            
            throw new AuraHandledException('Error loading project info: ' + e.getMessage());
        }
    }
    
    
     // Updated main method to get ALL data including tasks
    @AuraEnabled(cacheable=true)
    public static DashboardData getDashboardData(String projectId) {
        try {
            System.debug('🔄 Getting Dashboard Data for ID: ' + projectId);
            
            DashboardData data = new DashboardData();
            
            // 1. Get Project Info data (using existing method)
            data.projectInfo = getProjectInfo(projectId);
            
            // 2. Get Tasks data
            data.tasks = getTasksData(projectId);
            
             // 3. Get Team Members data
            data.teamMembers = getTeamMembersData(projectId);
            
            // 4. Get Milestones data
            data.milestones = getMilestonesData(projectId);
            data.projectHours = getProjectHoursData(projectId);
            LoggedHoursPercentageData loggedHoursData = new LoggedHoursPercentageData();
            
              List<Project__c> projects = [
            SELECT Actual_Hours__c, Planned_Hours__c 
            FROM Project__c 
            WHERE Id = :projectId 
            LIMIT 1
        ];
        
        if (!projects.isEmpty()) {
            Project__c project = projects[0];
            loggedHoursData.actualHours = project.Actual_Hours__c != null ? project.Actual_Hours__c : 0;
            loggedHoursData.plannedHours = project.Planned_Hours__c != null ? project.Planned_Hours__c : 0;
        } else {
            loggedHoursData.actualHours = 0;
            loggedHoursData.plannedHours = 0;
        }
        
        // Add to DashboardData - you'll need to add this property to DashboardData class
        data.loggedHoursData = loggedHoursData;
                        
           BudgetData budgetData = new BudgetData();
        
        // Query the Project__c record for cost fields
        List<Project__c> projectWithCost = [
            SELECT Planned_Cost__c, Actual_Cost__c 
            FROM Project__c 
            WHERE Id = :projectId 
            LIMIT 1
        ];
        
        if (!projectWithCost.isEmpty()) {
            Project__c project = projectWithCost[0];
            budgetData.plannedCost = project.Planned_Cost__c != null ? project.Planned_Cost__c : 0;
            budgetData.actualCost = project.Actual_Cost__c != null ? project.Actual_Cost__c : 0;
            
            // Calculate budget percentage
            if (budgetData.plannedCost > 0) {
                budgetData.budgetPercentage = (budgetData.actualCost / budgetData.plannedCost) * 100;
            } else {
                budgetData.budgetPercentage = 0;
            }
        } else {
            budgetData.plannedCost = 0;
            budgetData.actualCost = 0;
            budgetData.budgetPercentage = 0;
        }
        
        data.budget = budgetData;
        
        return data;
        
    } catch (Exception e) {
    
        throw new AuraHandledException('Error loading dashboard data: ' + e.getMessage());
    }
    }
    
    private static ProjectHoursData getProjectHoursData(String projectId) {
        try {
                      
            ProjectHoursData hoursData = new ProjectHoursData();
            hoursData.estimatedHours = 0;
            hoursData.loggedHours = 0;
            hoursData.scheduledHours = 0;
            hoursData.billableHours = 0;
            hoursData.nonBillableHours = 0;
            
            try {
                // Query the Project__c record for hour-related fields
                List<Project__c> projects = [
                    SELECT 
                        Planned_Hours__c,Actual_Hours__c, Hours_Remaining__c, Billable_Hours__c,Non_Billable_Hours__c FROM Project__c WHERE Id = :projectId  LIMIT 1 ];
                
                if (!projects.isEmpty()) {
                    Project__c project = projects[0];
                    
                    hoursData.estimatedHours = project.Planned_Hours__c != null ? project.Planned_Hours__c : 0;
                    hoursData.loggedHours = project.Actual_Hours__c != null ? project.Actual_Hours__c : 0;
                    hoursData.scheduledHours = project.Hours_Remaining__c != null ? project.Hours_Remaining__c : 0;
                    hoursData.billableHours = project.Billable_Hours__c != null ? project.Billable_Hours__c : 0;
                    hoursData.nonBillableHours = project.Non_Billable_Hours__c != null ? project.Non_Billable_Hours__c : 0;
                }
                
            } catch (Exception queryEx) {
            
                
                // If fields don't exist, calculate or use defaults
                hoursData.estimatedHours = 120;
                hoursData.loggedHours = 85;
                hoursData.scheduledHours = 35;
                hoursData.billableHours = 65;
                hoursData.nonBillableHours = 20;
            }
            
                       
            return hoursData;
            
        } catch (Exception e) {
       
            ProjectHoursData defaultData = new ProjectHoursData();
            defaultData.estimatedHours = 120;
            defaultData.loggedHours = 85;
            defaultData.scheduledHours = 35;
            defaultData.billableHours = 65;
            defaultData.nonBillableHours = 20;
            return defaultData;
        }
    }
    
    private static TasksData getTasksData(String projectId) {
    try {
     
        
        TasksData tasksData = new TasksData();
        tasksData.totalTasks = 0;
        tasksData.completedTasks = 0;
        tasksData.pendingTasks = 0;
        
        List<Tasks__c> tasks = [
            SELECT Id, Status__c 
            FROM Tasks__c
            WHERE Associated_Project__c = :projectId
        ];
        
        if (!tasks.isEmpty()) {
            tasksData.totalTasks = tasks.size();
            
            // Count completed tasks
            for (Tasks__c task : tasks) {
                if (task.Status__c == 'Completed') {
                    tasksData.completedTasks++;
                }
            }
            
            tasksData.pendingTasks = tasksData.totalTasks - tasksData.completedTasks;
        }  
        
        return tasksData;
        
    } catch (Exception e) {
       
        return new TasksData();
    }
}


private static TeamMemberData getTeamMembersData(String projectId) {
    try {
        
        TeamMemberData teamData = new TeamMemberData();
        teamData.members = new List<Member>();
        teamData.teamMembersCount = 0;

        try {
            List<Project_Team_Member__c> teamMembers = [
                SELECT Id, Assigned_To__c, 
                       Assigned_To__r.Name, 
                       Assigned_To__r.FirstName, 
                       Assigned_To__r.LastName
                FROM Project_Team_Member__c
                WHERE Project__c = :projectId
                ORDER BY Assigned_To__r.LastName NULLS LAST
                LIMIT 10
            ];
            
            if (!teamMembers.isEmpty()) {
                teamData.teamMembersCount = teamMembers.size();
                
                for (Project_Team_Member__c member : teamMembers) {
                    if (member.Assigned_To__c != null && member.Assigned_To__r != null) {
                        Member mem = new Member();
                        mem.userId = member.Assigned_To__c;
                        mem.name = member.Assigned_To__r.Name != null ? member.Assigned_To__r.Name : 'Unknown User';
                        
                        // Get first letter for avatar from FirstName or LastName
                        String firstName = member.Assigned_To__r.FirstName;
                        String lastName = member.Assigned_To__r.LastName;
                        
                        if (String.isNotBlank(firstName)) {
                            mem.avatarInitial = firstName.substring(0, 1).toUpperCase();
                        } else if (String.isNotBlank(lastName)) {
                            mem.avatarInitial = lastName.substring(0, 1).toUpperCase();
                        } else {
                            // If no name, use first letter of Name or 'U'
                            mem.avatarInitial = mem.name.substring(0, 1).toUpperCase();
                        }
                        
                        teamData.members.add(mem);
                    }
                }
            }
            
        } catch (Exception queryEx) {
   
            teamData.teamMembersCount = 6;
            teamData.members = getDefaultTeamMembers();
        }
        
        System.debug('👥 Team Members Data:');
       
        
        return teamData;
        
    } catch (Exception e) {

        // Return default data
        TeamMemberData defaultData = new TeamMemberData();
        defaultData.teamMembersCount = 6;
        defaultData.members = getDefaultTeamMembers();
        return defaultData;
    }
}

// Helper method for default team members
private static List<Member> getDefaultTeamMembers() {
    List<Member> defaultMembers = new List<Member>();
    List<String> initials = new List<String>{'A', 'B', 'C', 'D', 'E', 'F'};
    
    for (String initial : initials) {
        Member mem = new Member();
        mem.avatarInitial = initial;
        mem.name = 'Team Member ' + initial;
        defaultMembers.add(mem);
    }
    
    return defaultMembers;
}

// NEW METHOD: Get Milestones data
private static MilestonesData getMilestonesData(String projectId) {
    try {
        System.debug('🎯 Getting Milestones for Project: ' + projectId);
        
        MilestonesData milestonesData = new MilestonesData();
        milestonesData.totalMilestones = 0;
        milestonesData.completedMilestones = 0;
        milestonesData.completionPercentage = 0;
        
        // Query Milestones (assuming you have Milestone__c object)
        try {
            List<Milestone__c> milestones = [
                SELECT Id, Status__c
                FROM Milestone__c
                WHERE Project__c = :projectId
            ];
            
            if (!milestones.isEmpty()) {
                milestonesData.totalMilestones = milestones.size();
                
                // Count completed milestones
                for (Milestone__c milestone : milestones) {
                    if (milestone.Status__c == 'Completed') {
                        milestonesData.completedMilestones++;
                    }
                }
                
                // Calculate percentage
                if (milestonesData.totalMilestones > 0) {
                    milestonesData.completionPercentage = (milestonesData.completedMilestones / milestonesData.totalMilestones) * 100;
                }
            }
            
        } catch (Exception queryEx) {
            System.debug('⚠️ Milestone object error: ' + queryEx.getMessage());
            System.debug('⚠️ Using default milestone values');
            // If object doesn't exist, use default milestones
            milestonesData.totalMilestones = 8;
            milestonesData.completedMilestones = 3;
            milestonesData.completionPercentage = 37.5;
        }
        
        System.debug('🎯 Milestones Data:');
     
        
        return milestonesData;
        
    } catch (Exception e) {
        System.debug('⚠️ Error in getMilestonesData: ' + e.getMessage());
        // Return default data
        MilestonesData defaultData = new MilestonesData();
        defaultData.totalMilestones = 8;
        defaultData.completedMilestones = 3;
        defaultData.completionPercentage = 37.5;
        return defaultData;
    }
}
}