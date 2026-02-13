public class RetestController {
    @AuraEnabled(cacheable=true)
    public static List<Issue_Bug__c> getRetestQueue() {
        try {
            return [
                SELECT Id, Name, CreatedDate, CreatedById, LastModifiedDate, 
                       LastModifiedById, SystemModstamp, LastViewedDate, 
                       LastReferencedDate, Issue_Id__c, Project__c, 
                       Description__c, Assignee__c, Due_Date__c, Status__c, 
                       Severity__c, Release_Milestone__c, Affected_Milestone__c, 
                       Classification__c, Reproducible__c, Flag__c, 
                       Commnets__c, Is_Active__c, Is_Current__c, 
                       Issue_Bug__c, Tasks__c, Task_List__c,
                       Environment__c, Steps_To_Reproduce__c, 
                       Expected_Result__c, Actual_Result__c, Type__c, 
                       SLA__c, Retest_Status__c, Is_SLA_At_Risk__c
                FROM Issue_Bug__c
                WHERE Status__c = 'In Retest'
            ];
        } 
        catch (Exception e) {
            throw new AuraHandledException('Error fetching Retest Queue: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static void updateRetestStatus(Id recordId, String status) {
        try {
            Issue_Bug__c bug = new Issue_Bug__c(
                Id = recordId,
                Retest_Status__c = status
            );
            
            update bug;
        } 
        catch (Exception e) {
            throw new AuraHandledException('Error updating Retest Status: ' + e.getMessage());
        }
    }
}