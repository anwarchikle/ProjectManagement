public with sharing class TimeLogHelper {
 @AuraEnabled(cacheable=true)
    public static Tasks__c getTaskWithProject(Id taskId) {
        if (taskId == null) return null;

        return [ SELECT Id, Associated_Project__c FROM Tasks__c WHERE Id = :taskId LIMIT 1];
    }
    
    
 @AuraEnabled(cacheable=true)
    public static List<Project__c> getProjects() {
        return [SELECT Id, Name FROM Project__c ORDER BY Name LIMIT 200];
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Tasks__c> getTasksByProject(Id projectId) {
        if (projectId == null) {
            return new List<Tasks__c>();
        }
        return [SELECT Id, Name, Associated_Project__c 
                FROM Tasks__c 
                WHERE Associated_Project__c = :projectId 
                ORDER BY Name 
                LIMIT 200];
    }
    
    @AuraEnabled(cacheable=true)
    public static List<String> getBillablePicklistValues() {
        Schema.DescribeFieldResult fieldDescribe = Time_Log__c.Billable_Type__c.getDescribe();
        List<Schema.PicklistEntry> picklistValues = fieldDescribe.getPicklistValues();
        List<String> options = new List<String>();
        for (Schema.PicklistEntry entry : picklistValues) {
            options.add(entry.getValue());
        }
        return options;
    }
        
        @AuraEnabled(cacheable=true)
    public static String getUserName(Id userId) {
        User u = [SELECT Name FROM User WHERE Id = :userId LIMIT 1];
        return u.Name;
    }
    
    @AuraEnabled
    public static List<Time_Log__c> createWeeklyTimeLogs(List<Time_Log__c> timeLogs) {
        System.debug('Received time logs: ' + timeLogs);
        
        for (Time_Log__c log : timeLogs) {
            if (log.Projects__c == null) {
                throw new AuraHandledException('Project is required for all time logs');
            }
            if (log.User__c == null) {
                throw new AuraHandledException('User is required for all time logs');
            }
            if (log.Date__c == null) {
                throw new AuraHandledException('Date is required for all time logs');
            }
            if (log.Daily_Logs__c == null || log.Daily_Logs__c <= 0) {
                throw new AuraHandledException('Hours must be greater than 0');
            }
        }
        
        try {
            insert timeLogs;
            System.debug('Successfully inserted ' + timeLogs.size() + ' time logs');
            return timeLogs;
        } catch (DmlException e) {
            System.debug('Error inserting time logs: ' + e.getMessage());
            throw new AuraHandledException('Failed to create time logs: ' + e.getMessage());
        }
    }
    
}