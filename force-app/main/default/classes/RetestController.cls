public with sharing class RetestController {
      @AuraEnabled(cacheable=true)
    public static List<Issue_Bug__c> getRetestQueue() {
        try {
            // Identify if current user is admin (by profile)
            User u = [
                SELECT Id, Profile.Name
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];
            Boolean isAdmin = (u.Profile.Name == 'System Administrator');
 
            String baseSoql = 
                'SELECT Id, Name, CreatedDate, CreatedById, LastModifiedDate, LastModifiedById, ' +
                'SystemModstamp, LastViewedDate, LastReferencedDate, Issue_Id__c, Project__c, ' +
                'Description__c, Assignee__c, Due_Date__c, Status__c, Severity__c, ' +
                'Release_Milestone__c, Affected_Milestone__c, Classification__c, Reproducible__c, ' +
                'Flag__c, Commnets__c, Is_Active__c, Is_Current__c, Environment__c, ' +
                'Steps_To_Reproduce__c, Expected_Result__c, Actual_Result__c, Type__c, SLA__c, ' +
                'Retest_Status__c, Is_SLA_At_Risk__c ' +
                'FROM Issue_Bug__c';
 
            if (!isAdmin) {
                // Logged-in (non-admin) user → only his data
                baseSoql += ' WHERE Assignee__c = :userId';
                Id userId = UserInfo.getUserId();
                return Database.query(baseSoql);
            } else {
                // Admin → all records
                return Database.query(baseSoql);
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching Retest Queue: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static void updateRetestStatus(Id recordId, String status) {
        try {
            Issue_Bug__c bug = new Issue_Bug__c(
                Id = recordId,
                Status__c = status
            );
            
            // Also update Retest_Status__c based on the status
            if (status == 'Completed') {
                bug.Retest_Status__c = 'Fixed'; 
            } else if (status == 'Open') {
                bug.Retest_Status__c = 'Pending Retest'; 
            } else if (status == 'In Retest') {
                bug.Retest_Status__c = 'In Retest'; 
            }

            update bug;
        } 
        catch (Exception e) {
            throw new AuraHandledException('Error updating Retest Status: ' + e.getMessage());
        }
    }
}