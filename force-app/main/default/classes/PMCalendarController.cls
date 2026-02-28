public with sharing class PMCalendarController {

    @AuraEnabled(cacheable=true)
    public static List<Project__c> getAllProjects() {
        return [
            SELECT Id, Name
            FROM Project__c
            ORDER BY Name ASC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Milestone__c> getMilestonesByProject(Id projectId) {
        if (projectId == null) return new List<Milestone__c>();
        return [
            SELECT Id, Name, Status__c, Start_Date__c, End_Date__c
            FROM Milestone__c
            WHERE Project__c = :projectId
            ORDER BY Start_Date__c ASC
        ];
    }

    // OLD method kept if used elsewhere - DO NOT remove if referenced in other components
    @AuraEnabled(cacheable=true)
    public static Calendar__c getCalendarByProject(Id projectId) {
        if (projectId == null) return null;
        List<Calendar__c> records = [
            SELECT Id, Name, End_Date_Time__c, Status__c
            FROM Calendar__c
            WHERE Project__c = :projectId
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];
        return records.isEmpty() ? null : records[0];
    }

    // NEW method - returns LIST for the "What's Coming Next" panel
    @AuraEnabled(cacheable=true)
    public static List<Calendar__c> getCalendarItemsByProject(Id projectId) {
        if (projectId == null) return new List<Calendar__c>();

        DateTime today  = DateTime.now();
        DateTime future = DateTime.now().addDays(14);

        return [
            SELECT Id, Name, Action__c, End_Date_Time__c
            FROM Calendar__c
            WHERE Project__c = :projectId
              AND End_Date_Time__c >= :today
              AND End_Date_Time__c <= :future
            ORDER BY End_Date_Time__c ASC
        ];
    }
}