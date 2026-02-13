public class ProjectSharingHandlerNew {
    
    private static final String ROW_CAUSE  = 'Manual';
    private static final String ACCESS_LVL = 'Edit';
    
    public static void giveVisibilityOnInsert(List<Project_Team_Member__c> listOfProjectTeamMember) {
        try {
            if (listOfProjectTeamMember == null || listOfProjectTeamMember.isEmpty()) {
                return;
            }
            
            Set<Id> projectIds = new Set<Id>();
            
            for (Project_Team_Member__c ptm : listOfProjectTeamMember) {
                if (ptm.Project__c != null && ptm.Assigned_To__c != null) {
                    projectIds.add(ptm.Project__c);
                }
            }
            
            if (projectIds.isEmpty()) {
                return;
            }
            
            Map<Id, List<Project_Team_Member__c>> projectToMembers = new Map<Id, List<Project_Team_Member__c>>();
            
            List<Project_Team_Member__c> listOfProjectTeamMembers =[SELECT Id, Project__c, Assigned_To__c, Assigned_To__r.Name FROM Project_Team_Member__c WHERE Project__c IN :projectIds];
            
            System.debug('Queried Project_Team_Member__c size => ' + listOfProjectTeamMembers.size());
            
            for (Project_Team_Member__c ptm : listOfProjectTeamMembers) {
                if (!projectToMembers.containsKey(ptm.Project__c)) {
                    projectToMembers.put(ptm.Project__c, new List<Project_Team_Member__c>());
                }
                projectToMembers.get(ptm.Project__c).add(ptm);
            }

            
            List<Project__Share> sharesToInsert = new List<Project__Share>();
            
            for (Id projectId : projectToMembers.keySet()) {
                for (Project_Team_Member__c member : projectToMembers.get(projectId)) {
                    
                    Project__Share share = new Project__Share();
                    share.ParentId     = projectId;
                    share.UserOrGroupId = member.Assigned_To__c;
                    share.AccessLevel  = ACCESS_LVL;
                    share.RowCause     = ROW_CAUSE;
                    
                    sharesToInsert.add(share);
                }
            }
            
            if (!sharesToInsert.isEmpty()) {
                insert sharesToInsert;
            }
            
        } catch (Exception e) {
            System.debug('Error ===> ' + e.getMessage() + ' | Line ===> ' + e.getLineNumber());
        }
    }
    
    public static void giveVisibilityOnUpdate(List<Project_Team_Member__c> listOfProjectTeamMember,Map<Id, Project_Team_Member__c> oldMap) {
        try {
            
            if (listOfProjectTeamMember == null || listOfProjectTeamMember.isEmpty()) {
                return;
            }
            
            Set<Id> projectIds = new Set<Id>();            
            for (Project_Team_Member__c ptm : listOfProjectTeamMember) {
                if (ptm.Project__c != null && ptm.Assigned_To__c != null && oldMap.get(ptm.Id).Assigned_To__c != ptm.Assigned_To__c) {
                    projectIds.add(ptm.Project__c);
                } 
            }
            
            if (projectIds.isEmpty()) {
                return;
            }
            
            Map<Id, List<Project_Team_Member__c>> projectToMembers = new Map<Id, List<Project_Team_Member__c>>();
            
            List<Project_Team_Member__c> listOfProjectTeamMembers =
                [SELECT Id, Project__c, Assigned_To__c, Assigned_To__r.Name
                 FROM Project_Team_Member__c
                 WHERE Project__c IN :projectIds];
            
            System.debug('Queried Project_Team_Member__c size => ' + listOfProjectTeamMembers.size());
            
            for (Project_Team_Member__c ptm : listOfProjectTeamMembers) {
                if (!projectToMembers.containsKey(ptm.Project__c)) {
                    projectToMembers.put(ptm.Project__c, new List<Project_Team_Member__c>());
                }
                projectToMembers.get(ptm.Project__c).add(ptm);
            }
            
            System.debug('projectToMembers map size => ' + projectToMembers.size());
            
            List<Project__Share> sharesToInsert = new List<Project__Share>();
            
            for (Id projectId : projectToMembers.keySet()) {
                for (Project_Team_Member__c member : projectToMembers.get(projectId)) {
                    
                    Project__Share share = new Project__Share();
                    share.ParentId = projectId;
                    share.UserOrGroupId = member.Assigned_To__c;
                    share.AccessLevel = ACCESS_LVL;
                    share.RowCause = ROW_CAUSE;
                    sharesToInsert.add(share);
                }
            }
            
            if (!sharesToInsert.isEmpty()) {
                insert sharesToInsert;
            }
            
        } catch (Exception e) {
            System.debug('ERROR MESSAGE => ' + e.getMessage());
            System.debug('ERROR LINE => ' + e.getLineNumber());
            System.debug('STACK TRACE => ' + e.getStackTraceString());
        }
    }
    
    
    public static void removeVisibility(List<Project_Team_Member__c> deletedMembers) {
        try{
            Set<Id> projectIds = new Set<Id>();
            Set<Id> userIds = new Set<Id>();
            
            for (Project_Team_Member__c ptm : deletedMembers) {
                if (ptm.Project__c != null && ptm.Assigned_To__c != null) {
                    projectIds.add(ptm.Project__c);
                    userIds.add(ptm.Assigned_To__c);
                }
            }
            
            if (projectIds.isEmpty() || userIds.isEmpty()) {
                return;
            }
            
            List<Project__Share> sharesToDelete = [SELECT Id FROM Project__Share WHERE ParentId IN :projectIds 
                                                   AND UserOrGroupId IN :userIds AND RowCause = 'Manual'];
            
            if (!sharesToDelete.isEmpty()) {
                delete sharesToDelete;
            }            
        } catch (Exception e) {
            System.debug('Error ===> ' + e.getMessage() + ' | Line ===> ' + e.getLineNumber());
        }
        
        
    }
    
    
}