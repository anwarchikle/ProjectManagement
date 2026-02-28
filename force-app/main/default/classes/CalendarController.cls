public with sharing class CalendarController {
    @AuraEnabled(cacheable=true)
    public static List<Project__c> getProjects() {
        // basic: all projects user can see
        return [
            SELECT Id, Name
            FROM Project__c
            ORDER BY Name
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Calendar__c> getEvents(Id projectId, Datetime startDateTime, Datetime endDateTime) {
        Id currentUserId = UserInfo.getUserId();
        Boolean isAdmin = UserInfo.getProfileId() IN
            (SELECT Id FROM Profile WHERE Name IN ('System Administrator')); // adjust if needed

        String soql = 'SELECT Id, Title__c, Start_Date_Time__c, End_Date_Time__c, Project__c, OwnerId ' +
                      'FROM Calendar__c WHERE Start_Date_Time__c >= :startDateTime ' +
                      'AND Start_Date_Time__c <= :endDateTime';

        if (projectId != null) {
            soql += ' AND Project__c = :projectId';
        }

        if (!isAdmin) {
            soql += ' AND OwnerId = :currentUserId';
        }

        return Database.query(soql);
    }

    @AuraEnabled
    public static Id createEvent(Id projectId, Datetime startDateTime, Datetime endDateTime,
                                 String title, String note) {
        Calendar__c ev = new Calendar__c();
        ev.Project__c = projectId;
        ev.Start_Date_Time__c = startDateTime;
        ev.End_Date_Time__c = endDateTime;
        ev.Title__c = title;
        ev.NOTE__c = note;
        ev.OwnerId = UserInfo.getUserId(); // user-specific

        insert ev;
        return ev.Id;
    }
}